import os
import chromadb
from dotenv import load_dotenv
from google import genai

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

# Open the existing ChromaDB
chroma_client = chromadb.PersistentClient(
    path="./chroma_db"
)

collection = chroma_client.get_collection(
    name="python_knowledge"
)

print("Knowledge base:", collection.count(), "chunks")

# User question
question = input("\nQuestion: ")

# Create question embedding
result = client.models.embed_content(
    model="gemini-embedding-001",
    contents=question
)

question_embedding = result.embeddings[0].values

# Retrieve candidates
results = collection.query(
    query_embeddings=[question_embedding],
    n_results=3
)

MAX_DISTANCE = 0.8

# Display retrieval
for i, document in enumerate(results["documents"][0]):
    distance = results["distances"][0][i]
    metadata = results["metadatas"][0][i]

    print("\nRetrieved chunk:")
    print("-", document)
    print("Distance:", distance)
    print("Metadata:", metadata)

# Stop if nothing is relevant
if all(
    distance > MAX_DISTANCE
    for distance in results["distances"][0]
):
    print("\nNo relevant information found.")
    exit()

# Keep relevant chunks only
# Keep relevant chunks and their sources
relevant_documents = []
sources = []

for i, document in enumerate(results["documents"][0]):
    distance = results["distances"][0][i]
    metadata = results["metadatas"][0][i]

    if distance <= MAX_DISTANCE:
        relevant_documents.append(document)

        source = metadata.get("source", "Unknown")
        if source not in sources:
            sources.append(source)

context = "\n\n".join(relevant_documents)

# Generate answer
prompt = f"""
Answer the question using only the information provided in the context.

Context:
{context}

Question:
{question}
"""

response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents=prompt
)

print("\nFinal answer:")
print(response.text)

print("\nSources:")
for source in sources:
    print("-", source)