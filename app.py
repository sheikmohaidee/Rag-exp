import hashlib
import os
import re
from io import BytesIO
from typing import Iterable

import chromadb
import streamlit as st
from dotenv import load_dotenv
from google import genai
from pypdf import PdfReader

load_dotenv()

EMBEDDING_MODEL = "gemini-embedding-001"
GENERATION_MODEL = "gemini-2.5-flash"
CHROMA_PATH = "./chroma_db"
COLLECTION_NAME = "document_qa"
MAX_CHUNK_CHARS = 1200
EMBED_BATCH_SIZE = 64
RETRIEVAL_K = 5

st.set_page_config(
    page_title="Document Q&A Assistant",
    page_icon="📚",
    layout="wide",
)

st.title("📚 Document Q&A Assistant")
st.caption("Ask questions about your PDFs and text files. Answers are grounded in your indexed documents.")

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    st.error("GEMINI_API_KEY was not found. Add it to your existing .env file.")
    st.code("GEMINI_API_KEY=your_existing_key", language="text")
    st.stop()

@st.cache_resource
def get_clients():
    gemini_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)
    collection = chroma_client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )
    return gemini_client, chroma_client, collection

client, chroma_client, collection = get_clients()


def extract_text(uploaded_file) -> str:
    name = uploaded_file.name.lower()
    raw = uploaded_file.getvalue()

    if name.endswith(".pdf"):
        reader = PdfReader(BytesIO(raw))
        pages = []
        for page in reader.pages:
            pages.append(page.extract_text() or "")
        return "\n\n".join(pages).strip()

    if name.endswith(".txt"):
        return raw.decode("utf-8", errors="replace").strip()

    raise ValueError("Only PDF and TXT files are supported.")


def split_long_paragraph(paragraph: str, max_chars: int = MAX_CHUNK_CHARS) -> list[str]:
    """Split an unusually long paragraph by sentence first, then by characters if needed."""
    sentences = re.split(r"(?<=[.!?])\s+", paragraph.strip())
    pieces, current = [], ""

    for sentence in sentences:
        if len(sentence) > max_chars:
            if current:
                pieces.append(current.strip())
                current = ""
            start = 0
            while start < len(sentence):
                pieces.append(sentence[start:start + max_chars].strip())
                start += max_chars
            continue

        candidate = f"{current} {sentence}".strip() if current else sentence
        if len(candidate) <= max_chars:
            current = candidate
        else:
            if current:
                pieces.append(current.strip())
            current = sentence

    if current:
        pieces.append(current.strip())
    return [piece for piece in pieces if piece]


def make_chunks(text: str) -> list[str]:
    """Paragraph-aware chunking with one-paragraph overlap between adjacent chunks."""
    paragraphs = [
        re.sub(r"\s+", " ", part).strip()
        for part in re.split(r"\n\s*\n", text)
        if part.strip()
    ]
    if not paragraphs:
        paragraphs = [re.sub(r"\s+", " ", text).strip()]

    normalized = []
    for paragraph in paragraphs:
        normalized.extend(split_long_paragraph(paragraph))

    chunks, current = [], []
    current_length = 0
    for paragraph in normalized:
        extra = len(paragraph) + (2 if current else 0)
        if current and current_length + extra > MAX_CHUNK_CHARS:
            chunks.append("\n\n".join(current))
            # Keep the previous paragraph as overlap for context continuity.
            current = [current[-1], paragraph]
            current_length = sum(len(p) for p in current) + 2 * (len(current) - 1)
        else:
            current.append(paragraph)
            current_length += extra

    if current:
        candidate = "\n\n".join(current)
        if not chunks or candidate != chunks[-1]:
            chunks.append(candidate)

    return [chunk for chunk in chunks if chunk.strip()]


def embed_texts(texts: list[str]) -> list[list[float]]:
    embeddings = []
    for start in range(0, len(texts), EMBED_BATCH_SIZE):
        batch = texts[start:start + EMBED_BATCH_SIZE]
        response = client.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=batch,
        )
        embeddings.extend(item.values for item in response.embeddings)
    return embeddings


def index_file(uploaded_file) -> tuple[int, str]:
    source = uploaded_file.name
    text = extract_text(uploaded_file)
    if not text:
        if source.lower().endswith(".pdf"):
            raise ValueError(
                f"No selectable text was found in {source}. If it is a scanned PDF, OCR is not included in this first version."
            )
        raise ValueError(f"No readable text was found in {source}.")

    chunks = make_chunks(text)
    if not chunks:
        raise ValueError(f"No text chunks could be created from {source}.")

    # Replace this filename's previously indexed version without touching other files.
    try:
        collection.delete(where={"source": source})
    except Exception:
        pass

    vectors = embed_texts(chunks)
    file_hash = hashlib.sha256(uploaded_file.getvalue()).hexdigest()[:12]
    ids = [f"{file_hash}-{i}" for i in range(len(chunks))]
    metadatas = [
        {"source": source, "chunk_index": i, "file_hash": file_hash}
        for i in range(len(chunks))
    ]

    collection.add(
        ids=ids,
        documents=chunks,
        embeddings=vectors,
        metadatas=metadatas,
    )
    return len(chunks), source


def answer_question(question: str, max_distance: float, top_k: int):
    query_response = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=question,
    )
    query_vector = query_response.embeddings[0].values

    results = collection.query(
        query_embeddings=[query_vector],
        n_results=min(top_k, collection.count()),
        include=["documents", "metadatas", "distances"],
    )

    documents = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]

    relevant = []
    for document, metadata, distance in zip(documents, metadatas, distances):
        if distance <= max_distance:
            relevant.append({
                "document": document,
                "metadata": metadata or {},
                "distance": float(distance),
            })

    if not relevant:
        return None, [], list(zip(documents, metadatas, distances))

    context_parts = []
    for item in relevant:
        context_parts.append(
            f"[Source: {item['metadata'].get('source', 'Unknown')}, "
            f"chunk {item['metadata'].get('chunk_index', '?')}]\n"
            f"{item['document']}"
        )

    prompt = f"""You are a document question-answering assistant.
Answer using only the supplied context. Do not use outside knowledge.
If the context does not contain enough information, say that the documents do not provide the answer.
When useful, refer to the source filenames included in the context.

CONTEXT:
{chr(10).join(context_parts)}

QUESTION:
{question}
"""
    response = client.models.generate_content(
        model=GENERATION_MODEL,
        contents=prompt,
    )
    return response.text or "No answer text was returned.", relevant, list(zip(documents, metadatas, distances))


with st.sidebar:
    st.header("Knowledge base")
    st.metric("Indexed chunks", collection.count())
    st.caption("Documents are stored locally in ChromaDB at ./chroma_db.")
    st.divider()
    top_k = st.slider("Chunks to retrieve", min_value=1, max_value=10, value=5)
    max_distance = st.slider(
        "Maximum retrieval distance",
        min_value=0.1,
        max_value=1.5,
        value=0.8,
        step=0.05,
        help="Lower is stricter. Tune this against your own test questions; it is not a universal relevance score.",
    )
    if st.button("Clear document knowledge base", type="secondary", use_container_width=True):
        chroma_client.delete_collection(COLLECTION_NAME)
        st.cache_resource.clear()
        st.rerun()

upload_tab, ask_tab = st.tabs(["1. Upload & index", "2. Ask questions"])

with upload_tab:
    st.subheader("Add documents")
    files = st.file_uploader(
        "Choose PDF or TXT files",
        type=["pdf", "txt"],
        accept_multiple_files=True,
        help="Upload one or more documents. Re-uploading a filename replaces its indexed version.",
    )
    if files and st.button("Index selected documents", type="primary"):
        total_chunks = 0
        errors = []
        progress = st.progress(0)
        status = st.empty()

        for index, uploaded_file in enumerate(files):
            status.write(f"Processing **{uploaded_file.name}**…")
            try:
                count, source = index_file(uploaded_file)
                total_chunks += count
                st.success(f"{source}: indexed {count} chunks.")
            except Exception as exc:
                errors.append(f"{uploaded_file.name}: {exc}")
                st.error(f"{uploaded_file.name}: {exc}")
            progress.progress((index + 1) / len(files))

        status.empty()
        if total_chunks:
            st.success(f"Finished. Added {total_chunks} chunks from the selected files.")
        if errors:
            st.warning("Some files could not be indexed. Review the messages above.")

    st.info(
        "Note: scanned PDFs that contain images rather than selectable text need OCR; OCR is not included in this first version."
    )

with ask_tab:
    st.subheader("Ask your documents")
    if collection.count() == 0:
        st.info("Upload and index at least one document before asking questions.")
    else:
        question = st.text_area(
            "Your question",
            placeholder="What are the main points in these documents?",
            height=100,
        )
        if st.button("Get answer", type="primary", disabled=not question.strip()):
            with st.spinner("Searching your documents and generating an answer…"):
                try:
                    answer, relevant, retrieved = answer_question(
                        question.strip(), max_distance, top_k
                    )
                    if answer is None:
                        st.warning(
                            "I couldn't find sufficiently relevant information in the indexed documents. Try rephrasing the question or adding the relevant document."
                        )
                    else:
                        st.markdown("### Answer")
                        st.write(answer)
                        st.markdown("### Sources used")
                        shown = set()
                        for item in relevant:
                            source = item["metadata"].get("source", "Unknown")
                            chunk_index = item["metadata"].get("chunk_index", "?")
                            st.markdown(
                                f"- **{source}** — chunk {chunk_index} "
                                f"(distance: `{item['distance']:.3f}`)"
                            )
                            shown.add((source, chunk_index))
                        with st.expander("Inspect retrieved context"):
                            for item in relevant:
                                st.markdown(
                                    f"**{item['metadata'].get('source', 'Unknown')} · "
                                    f"chunk {item['metadata'].get('chunk_index', '?')} · "
                                    f"distance {item['distance']:.3f}**"
                                )
                                st.write(item["document"])
                                st.divider()
                except Exception as exc:
                    st.error(f"Question failed: {exc}")
