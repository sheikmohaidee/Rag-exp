import os
import chromadb
from dotenv import load_dotenv
from google import genai

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

# Read the document
with open("chunk_test.txt", "r", encoding="utf-8") as file:
    text = file.read()

# Create overlapping chunks
paragraphs = text.split("\n\n")

chunks = []

for i in range(len(paragraphs) - 1):
    chunk = "\n\n".join(paragraphs[i:i + 2])
    chunks.append(chunk)

# Create embeddings
documents = []
embeddings = []

for chunk in chunks:
    result = client.models.embed_content(
        model="gemini-embedding-001",
        contents=chunk
    )

    documents.append(chunk)
    embeddings.append(result.embeddings[0].values)

# Open persistent ChromaDB
chroma_client = chromadb.PersistentClient(
    path="./chroma_db"
)

# Rebuild the collection
try:
    chroma_client.delete_collection("python_knowledge")
except Exception:
    pass

collection = chroma_client.get_or_create_collection(
    name="python_knowledge"
)

# Store chunks
collection.add(
    ids=[f"chunk_{i + 1}" for i in range(len(documents))],
    documents=documents,
    embeddings=embeddings,
    metadatas=[
        {
            "source": "chunk_test.txt",
            "topic": "Python"
        }
        for _ in documents
    ]
)

print("Indexing complete.")
print("Chunks stored:", collection.count())