import os
import chromadb
from dotenv import load_dotenv
from google import genai

# Load environment variables
load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

# Create Gemini client
client = genai.Client(api_key=api_key)


# Read the test document
with open("chunk_test.txt", "r", encoding="utf-8") as file:
    text = file.read()


# Split the document into chunks
paragraphs = text.split("\n\n")

chunks = []

for i in range(len(paragraphs) - 1):
    chunk = "\n\n".join(paragraphs[i:i + 2])
    chunks.append(chunk)

# Show the chunks
print("\nChunks:")

for i, chunk in enumerate(chunks):
    print(f"\nChunk {i + 1}:")
    print(chunk)


# Lists to store our data
documents = []
embeddings = []


# Create embeddings for each chunk
for chunk in chunks:
    result = client.models.embed_content(
        model="gemini-embedding-001",
        contents=chunk
    )

    embedding = result.embeddings[0].values

    documents.append(chunk)
    embeddings.append(embedding)


# Create a local ChromaDB database
chroma_client = chromadb.PersistentClient(
    path="./chroma_db"
)


# Create a collection
chroma_client = chromadb.PersistentClient(
    path="./chroma_db"
)

try:
    chroma_client.delete_collection(name="python_knowledge")
except Exception:
    pass

collection = chroma_client.get_or_create_collection(
    name="python_knowledge"
)


# Add the new chunks and embeddings
collection.add(
    ids=[
        f"chunk_{i + 1}"
        for i in range(len(documents))
    ],
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


print("\nCollection created:", collection.name)
print("Items in collection:", collection.count())


# User's question
question = "Who created Python?"


# Convert the question into an embedding
question_result = client.models.embed_content(
    model="gemini-embedding-001",
    contents=question
)

question_embedding = question_result.embeddings[0].values


# Search ChromaDB
results = collection.query(
    query_embeddings=[question_embedding],
    n_results=3
)


print("\nQuestion:", question)


# Maximum allowed distance
MAX_DISTANCE = 0.8


# Display retrieved chunks
for i, retrieved_text in enumerate(results["documents"][0]):

    distance = results["distances"][0][i]
    metadata = results["metadatas"][0][i]

    print("\nRetrieved chunk:")
    print("-", retrieved_text)
    print("Distance:", distance)
    print("Metadata:", metadata)


# Check whether all retrieved chunks are irrelevant
if all(
    distance > MAX_DISTANCE
    for distance in results["distances"][0]
):
    print("\nNo relevant information found.")
    exit()


# Keep only relevant chunks
relevant_documents = []

for i, document in enumerate(results["documents"][0]):

    distance = results["distances"][0][i]

    if distance <= MAX_DISTANCE:
        relevant_documents.append(document)


# Combine relevant chunks into context
context = "\n\n".join(relevant_documents)


# Create the prompt
prompt = f"""
Answer the question using only the information provided in the context.

Context:
{context}

Question:
{question}
"""


# Ask Gemini to generate the answer
response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents=prompt
)


# Display final answer
print("\nFinal answer:")
print(response.text)