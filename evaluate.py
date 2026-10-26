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

# Questions for evaluation
questions = [
    "Who created Python?",
    "Why did Python become popular?",
    "How is Python commonly used?",
    "What is the capital of France?",
    "Who invented the telephone?",
    "What is JavaScript?"
]

print("Knowledge base:", collection.count(), "chunks")

for question in questions:

    # Create embedding for the question
    result = client.models.embed_content(
        model="gemini-embedding-001",
        contents=question
    )

    question_embedding = result.embeddings[0].values

    # Retrieve only the closest chunk
    results = collection.query(
        query_embeddings=[question_embedding],
        n_results=1
    )

    distance = results["distances"][0][0]
    document = results["documents"][0][0]

    print("\nQuestion:", question)
    print("Distance:", distance)
    print("Retrieved:", document)