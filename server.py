"""FastAPI backend for DocuMind RAG Document Q&A Assistant.

Integrates with Google Gemini models and ChromaDB persistent storage,
matching the exact chunking, embedding, and retrieval pipeline from app.py.
"""

import hashlib
import logging
import os
import re
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List, Optional

import chromadb
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from google import genai
from pydantic import BaseModel, Field
from pypdf import PdfReader

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("documind.rag")

# Path management: Guarantee project root resolution independent of working directory
ROOT_DIR = Path(__file__).resolve().parent
ENV_PATH = ROOT_DIR / ".env"
CHROMA_PATH = str(ROOT_DIR / "chroma_db")

# Load environment reliably from the project root .env
if ENV_PATH.exists():
    load_dotenv(dotenv_path=ENV_PATH, override=True)
    logger.info("Loaded .env from %s", ENV_PATH)
else:
    load_dotenv(override=True)
    logger.warning(".env not found at %s; attempted default load_dotenv()", ENV_PATH)

# Configuration constants matching the existing pipeline
EMBEDDING_MODEL = "gemini-embedding-001"
GENERATION_MODEL = "gemini-2.5-flash"
COLLECTION_NAME = "document_qa"
MAX_CHUNK_CHARS = 1200
EMBED_BATCH_SIZE = 64
DEFAULT_RETRIEVAL_K = 5
DEFAULT_MAX_DISTANCE = 0.8

app = FastAPI(
    title="DocuMind RAG API",
    description="High-performance document indexing and question-answering API powered by Gemini & ChromaDB",
    version="1.0.0",
)

# Enable CORS for Vite dev server and common frontend origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Ensure any unhandled server exception returns a structured JSON error payload."""
    logger.exception("Unhandled exception during %s: %s", request.url.path, str(exc))
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": f"Internal server error: {type(exc).__name__}: {str(exc)}",
            "path": request.url.path,
        },
    )


def get_gemini_api_key() -> Optional[str]:
    """Retrieve GEMINI_API_KEY, reloading from project root .env if missing."""
    key = os.getenv("GEMINI_API_KEY")
    if not key and ENV_PATH.exists():
        load_dotenv(dotenv_path=ENV_PATH, override=True)
        key = os.getenv("GEMINI_API_KEY")

    if key:
        cleaned = key.strip()
        # Return cleaned key if non-empty and not dummy placeholder
        if cleaned and cleaned != "your_existing_key":
            return cleaned
    return None


def get_gemini_client() -> genai.Client:
    """Initialize and return Gemini client with validated API key."""
    api_key = get_gemini_api_key()
    if not api_key:
        logger.error(
            "GEMINI_API_KEY is missing or empty. Checked path: %s (exists=%s)",
            ENV_PATH,
            ENV_PATH.exists(),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"GEMINI_API_KEY is not configured in the backend .env file at {ENV_PATH}.",
        )
    return genai.Client(api_key=api_key)


def get_chroma_resources():
    """Retrieve ChromaDB client and the document_qa collection using absolute path."""
    chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)
    collection = chroma_client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )
    return chroma_client, collection


# Text extraction and paragraph-aware chunking logic
def extract_text(filename: str, raw_bytes: bytes) -> str:
    """Extract text from PDF or TXT bytes."""
    name = filename.lower()
    if name.endswith(".pdf"):
        reader = PdfReader(BytesIO(raw_bytes))
        pages = []
        for i, page in enumerate(reader.pages):
            page_text = page.extract_text() or ""
            if page_text.strip():
                pages.append(page_text.strip())
        return "\n\n".join(pages).strip()

    if name.endswith(".txt"):
        return raw_bytes.decode("utf-8", errors="replace").strip()

    raise ValueError("Only PDF (.pdf) and TXT (.txt) files are supported.")


def split_long_paragraph(paragraph: str, max_chars: int = MAX_CHUNK_CHARS) -> List[str]:
    """Split an unusually long paragraph by sentence first, then by characters if needed."""
    sentences = re.split(r"(?<=[.!?])\s+", paragraph.strip())
    pieces: List[str] = []
    current = ""

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


def make_chunks(text: str) -> List[str]:
    """Paragraph-aware chunking with one-paragraph overlap between adjacent chunks."""
    paragraphs = [
        re.sub(r"\s+", " ", part).strip()
        for part in re.split(r"\n\s*\n", text)
        if part.strip()
    ]
    if not paragraphs:
        paragraphs = [re.sub(r"\s+", " ", text).strip()]

    normalized: List[str] = []
    for paragraph in paragraphs:
        normalized.extend(split_long_paragraph(paragraph))

    chunks: List[str] = []
    current: List[str] = []
    current_length = 0

    for paragraph in normalized:
        extra = len(paragraph) + (2 if current else 0)
        if current and current_length + extra > MAX_CHUNK_CHARS:
            chunks.append("\n\n".join(current))
            # Keep previous paragraph as overlap for context continuity
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


def embed_texts(client: genai.Client, texts: List[str]) -> List[List[float]]:
    """Generate embeddings in batches using the configured Gemini embedding model."""
    embeddings: List[List[float]] = []
    for start in range(0, len(texts), EMBED_BATCH_SIZE):
        batch = texts[start:start + EMBED_BATCH_SIZE]
        logger.info("Embedding batch of %d chunks with %s", len(batch), EMBEDING_MODEL if 'EMBEDING_MODEL' in globals() else EMBEDDING_MODEL)
        response = client.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=batch,
        )
        embeddings.extend(item.values for item in response.embeddings)
    return embeddings


# Pydantic Request & Response Models
class QueryRequest(BaseModel):
    question: str = Field(..., min_length=1, description="Question to answer using indexed documents")
    max_distance: float = Field(DEFAULT_MAX_DISTANCE, ge=0.05, le=2.0, description="Max cosine distance threshold")
    top_k: int = Field(DEFAULT_RETRIEVAL_K, ge=1, le=20, description="Number of candidate chunks to retrieve")


class SourceReference(BaseModel):
    source: str
    chunk_index: int
    distance: float
    document: str
    file_hash: Optional[str] = None


class QueryResponse(BaseModel):
    question: str
    answer: str
    is_supported: bool
    relevant_sources: List[SourceReference]
    all_retrieved_count: int
    retrieved_candidates: List[SourceReference]
    distance_threshold: float


class DocumentSummary(BaseModel):
    source: str
    chunk_count: int
    file_hash: str


class HealthResponse(BaseModel):
    status: str
    api_key_configured: bool
    env_file_found: bool
    chroma_dir_found: bool


class KnowledgeBaseStatus(BaseModel):
    status: str
    collection_name: str
    total_chunks: int
    total_documents: int
    documents: List[DocumentSummary]
    embedding_model: str
    generation_model: str
    has_api_key: bool
    api_key_configured: bool


class IndexResult(BaseModel):
    filename: str
    chunk_count: int
    file_hash: str
    status: str
    error: Optional[str] = None


class BatchIndexResponse(BaseModel):
    total_files: int
    indexed_files: int
    total_chunks: int
    results: List[IndexResult]


# API Endpoints
@app.get("/api/health", response_model=HealthResponse)
def health_check():
    """Liveness probe verifying server state and API key availability."""
    api_key = get_gemini_api_key()
    api_key_present = bool(api_key and len(api_key) > 5)
    return HealthResponse(
        status="ok",
        api_key_configured=api_key_present,
        env_file_found=ENV_PATH.exists(),
        chroma_dir_found=Path(CHROMA_PATH).exists(),
    )


@app.get("/api/status", response_model=KnowledgeBaseStatus)
def get_status():
    """Returns knowledge base statistics and list of indexed documents."""
    api_key = get_gemini_api_key()
    api_key_present = bool(api_key and len(api_key) > 5)

    _, collection = get_chroma_resources()
    total_chunks = collection.count()

    doc_map: Dict[str, Dict[str, Any]] = {}
    if total_chunks > 0:
        existing = collection.get(include=["metadatas"])
        for meta in existing.get("metadatas", []):
            if not meta:
                continue
            src = meta.get("source", "Unknown")
            f_hash = meta.get("file_hash", "")
            if src not in doc_map:
                doc_map[src] = {"chunk_count": 0, "file_hash": f_hash}
            doc_map[src]["chunk_count"] += 1

    documents = [
        DocumentSummary(
            source=name,
            chunk_count=data["chunk_count"],
            file_hash=data["file_hash"],
        )
        for name, data in sorted(doc_map.items())
    ]

    return KnowledgeBaseStatus(
        status="healthy",
        collection_name=COLLECTION_NAME,
        total_chunks=total_chunks,
        total_documents=len(documents),
        documents=documents,
        embedding_model=EMBEDDING_MODEL,
        generation_model=GENERATION_MODEL,
        has_api_key=api_key_present,
        api_key_configured=api_key_present,
    )


@app.get("/api/documents", response_model=List[DocumentSummary])
def list_documents():
    """List all currently indexed documents and their chunk counts."""
    _, collection = get_chroma_resources()
    total = collection.count()
    if total == 0:
        return []

    data = collection.get(include=["metadatas"])
    doc_map: Dict[str, Dict[str, Any]] = {}
    for meta in data.get("metadatas", []):
        if not meta:
            continue
        src = meta.get("source", "Unknown")
        f_hash = meta.get("file_hash", "")
        if src not in doc_map:
            doc_map[src] = {"chunk_count": 0, "file_hash": f_hash}
        doc_map[src]["chunk_count"] += 1

    return [
        DocumentSummary(
            source=name,
            chunk_count=info["chunk_count"],
            file_hash=info["file_hash"],
        )
        for name, info in sorted(doc_map.items())
    ]


@app.get("/api/documents/{filename}/chunks")
def get_document_chunks(filename: str):
    """Retrieve indexed chunks for a specific document."""
    _, collection = get_chroma_resources()
    results = collection.get(
        where={"source": filename},
        include=["documents", "metadatas"],
    )
    docs = results.get("documents", [])
    metas = results.get("metadatas", [])
    chunks = []
    for doc, meta in zip(docs, metas):
        chunks.append({
            "chunk_index": meta.get("chunk_index", 0),
            "text": doc,
            "file_hash": meta.get("file_hash", ""),
        })
    chunks.sort(key=lambda x: x["chunk_index"])
    return {"source": filename, "chunks": chunks, "total": len(chunks)}


@app.delete("/api/documents/{filename}")
def delete_document(filename: str):
    """Delete a specific document and its chunks from the collection."""
    _, collection = get_chroma_resources()
    try:
        collection.delete(where={"source": filename})
        logger.info("Deleted document '%s' from %s", filename, COLLECTION_NAME)
        return {"status": "success", "message": f"Document '{filename}' removed."}
    except Exception as exc:
        logger.exception("Failed to delete document '%s': %s", filename, str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete document '{filename}': {str(exc)}",
        )


@app.post("/api/documents/clear")
def clear_collection():
    """Clear all indexed documents from the document_qa collection safely."""
    chroma_client, _ = get_chroma_resources()
    try:
        chroma_client.delete_collection(COLLECTION_NAME)
        # Re-create empty collection
        chroma_client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
        logger.info("Successfully cleared collection %s", COLLECTION_NAME)
        return {"status": "success", "message": f"Collection '{COLLECTION_NAME}' cleared."}
    except Exception as exc:
        logger.exception("Failed to clear collection %s: %s", COLLECTION_NAME, str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to clear collection: {str(exc)}",
        )


@app.post("/api/documents/upload", response_model=BatchIndexResponse)
async def upload_documents(files: List[UploadFile] = File(...)):
    """Upload and index multiple PDF or TXT files."""
    logger.info("Upload request received with %d file(s)", len(files))
    client = get_gemini_client()
    _, collection = get_chroma_resources()

    results: List[IndexResult] = []
    total_chunks = 0
    indexed_files = 0

    for upload_file in files:
        filename = upload_file.filename or "unknown"
        logger.info("Processing upload for '%s'", filename)

        try:
            raw_bytes = await upload_file.read()
            if not raw_bytes:
                raise ValueError(f"File '{filename}' is empty (0 bytes).")

            text = extract_text(filename, raw_bytes)
            if not text:
                if filename.lower().endswith(".pdf"):
                    raise ValueError(
                        f"No selectable text found in '{filename}'. Scanned PDFs require an OCR layer, which is not supported in this version."
                    )
                raise ValueError(f"No readable text found in '{filename}'.")

            chunks = make_chunks(text)
            if not chunks:
                raise ValueError(f"No text chunks could be created from '{filename}'.")

            logger.info("Created %d chunks for '%s'. Deduplicating previous entries...", len(chunks), filename)

            # Remove previous version of this filename to prevent duplicate/stale chunks
            try:
                collection.delete(where={"source": filename})
            except Exception as del_err:
                logger.debug("Prior collection cleanup for %s: %s", filename, str(del_err))

            # Generate vectors in batch
            vectors = embed_texts(client, chunks)
            file_hash = hashlib.sha256(raw_bytes).hexdigest()[:12]
            ids = [f"{file_hash}-{i}" for i in range(len(chunks))]
            metadatas = [
                {"source": filename, "chunk_index": i, "file_hash": file_hash}
                for i in range(len(chunks))
            ]

            collection.add(
                ids=ids,
                documents=chunks,
                embeddings=vectors,
                metadatas=metadatas,
            )

            total_chunks += len(chunks)
            indexed_files += 1
            logger.info("Successfully indexed '%s' (%d chunks, hash=%s)", filename, len(chunks), file_hash)
            results.append(IndexResult(
                filename=filename,
                chunk_count=len(chunks),
                file_hash=file_hash,
                status="success",
            ))

        except Exception as exc:
            logger.exception("Failed to index '%s': %s", filename, str(exc))
            results.append(IndexResult(
                filename=filename,
                chunk_count=0,
                file_hash="",
                status="error",
                error=str(exc),
            ))

    return BatchIndexResponse(
        total_files=len(files),
        indexed_files=indexed_files,
        total_chunks=total_chunks,
        results=results,
    )


@app.post("/api/query", response_model=QueryResponse)
def query_documents(request: QueryRequest):
    """Answer questions grounded in the indexed documents."""
    client = get_gemini_client()
    _, collection = get_chroma_resources()

    collection_count = collection.count()
    if collection_count == 0:
        return QueryResponse(
            question=request.question,
            answer="No documents are currently indexed in the knowledge base. Please upload and index PDF or TXT files first.",
            is_supported=False,
            relevant_sources=[],
            all_retrieved_count=0,
            retrieved_candidates=[],
            distance_threshold=request.max_distance,
        )

    # Embed the user question
    try:
        query_response = client.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=request.question,
        )
        query_vector = query_response.embeddings[0].values
    except Exception as exc:
        logger.exception("Failed to embed question: %s", str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to embed question: {str(exc)}",
        )

    # Retrieve candidate chunks from ChromaDB
    n_results = min(request.top_k, collection_count)
    results = collection.query(
        query_embeddings=[query_vector],
        n_results=n_results,
        include=["documents", "metadatas", "distances"],
    )

    documents = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]

    all_candidates: List[SourceReference] = []
    relevant: List[SourceReference] = []

    for doc, meta, dist in zip(documents, metadatas, distances):
        meta_dict = meta or {}
        ref = SourceReference(
            source=meta_dict.get("source", "Unknown"),
            chunk_index=int(meta_dict.get("chunk_index", 0)),
            distance=float(dist),
            document=doc,
            file_hash=meta_dict.get("file_hash"),
        )
        all_candidates.append(ref)
        if dist <= request.max_distance:
            relevant.append(ref)

    # If no chunk is within distance threshold, reject unsupported question
    if not relevant:
        return QueryResponse(
            question=request.question,
            answer="The indexed documents do not contain sufficiently relevant information to answer this question. Try rephrasing or adjusting the retrieval distance threshold.",
            is_supported=False,
            relevant_sources=[],
            all_retrieved_count=len(all_candidates),
            retrieved_candidates=all_candidates,
            distance_threshold=request.max_distance,
        )

    # Format context for grounded prompt
    context_parts: List[str] = []
    for item in relevant:
        context_parts.append(
            f"[Source: {item.source}, chunk {item.chunk_index}]\n{item.document}"
        )

    prompt = f"""You are a document question-answering assistant.
Answer using only the supplied context. Do not use outside knowledge.
If the context does not contain enough information, say that the documents do not provide the answer.
When useful, refer to the source filenames included in the context.

CONTEXT:
{chr(10).join(context_parts)}

QUESTION:
{request.question}
"""

    try:
        response = client.models.generate_content(
            model=GENERATION_MODEL,
            contents=prompt,
        )
        answer_text = response.text or "No answer text was returned."
    except Exception as exc:
        logger.exception("Failed to generate answer from Gemini: %s", str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate answer from Gemini: {str(exc)}",
        )

    # Check whether the answer expresses that the documents don't have the answer
    negative_patterns = [
        "do not provide the answer",
        "does not provide the answer",
        "do not contain enough information",
        "does not contain enough information",
        "not mentioned in the context",
        "not mentioned in the provided",
        "cannot be answered from the provided",
    ]
    is_supported = not any(pattern in answer_text.lower() for pattern in negative_patterns)

    return QueryResponse(
        question=request.question,
        answer=answer_text,
        is_supported=is_supported,
        relevant_sources=relevant,
        all_retrieved_count=len(all_candidates),
        retrieved_candidates=all_candidates,
        distance_threshold=request.max_distance,
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)
