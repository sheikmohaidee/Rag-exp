# DocuMind — Enterprise RAG Document Q&A Assistant

A modern, high-performance Document Q&A Assistant built with **React**, **TypeScript**, **Vite**, **Tailwind CSS**, and **FastAPI**. It leverages Google **Gemini** (`gemini-embedding-001` & `gemini-2.5-flash`) and persistent **ChromaDB** vector storage.

The application operates on the dedicated `document_qa` collection in `./chroma_db`, ensuring that existing benchmark collections (such as `python_knowledge`) remain untouched and safe. The original Streamlit implementation is preserved as a backup in `app.py`.

---

## Architecture Overview

- **Frontend (`frontend/`)**:
  - React 18, TypeScript, Vite, Tailwind CSS, Lucide icons
  - Custom responsive dark UI with DM Sans typography and subtle glassmorphic styling
  - Drag-and-drop PDF & TXT uploader with live upload and indexing progress
  - Interactive conversational Q&A workspace with source attribution citations
  - Cosine distance relevance score indicators and expandable context chunk inspection
  - Real-time knowledge base statistics and chunk previews
  - Responsive layout for desktop, tablet, and mobile

- **Backend (`server.py`)**:
  - FastAPI with CORS middleware
  - Direct integration with Gemini Python SDK (`google-genai`)
  - Batched chunk embeddings (`gemini-embedding-001`) with paragraph-aware chunking and overlap
  - Grounded answer generation (`gemini-2.5-flash`)
  - Endpoints:
    - `GET /api/health` — Liveness & API key configuration check
    - `GET /api/status` — Knowledge base statistics, collection info, active documents
    - `GET /api/documents` — List indexed documents with chunk counts & hashes
    - `GET /api/documents/{filename}/chunks` — Inspect individual chunks of an indexed document
    - `POST /api/documents/upload` — Multipart PDF/TXT upload and indexing
    - `DELETE /api/documents/{filename}` — Delete specific document
    - `POST /api/documents/clear` — Clear the `document_qa` collection safely
    - `POST /api/query` — Grounded RAG question answering with configurable `top_k` and `max_distance`

---

## Quick Start

### 1. Prerequisites & Environment

Make sure your existing `.env` file contains your Gemini API key in the project root:

```text
GEMINI_API_KEY=your_gemini_api_key_here
```

Dependencies in `.venv` include:
```powershell
pip install fastapi uvicorn pypdf chromadb google-genai python-dotenv streamlit
```

Frontend dependencies in `frontend/` are installed via:
```powershell
cd frontend
npm install
```

---

### 2. Running the Application

Open two terminals in the repository root (`C:\Users\mshei\rag-experiment`):

#### Terminal 1: Start FastAPI Backend

```powershell
.\.venv\Scripts\python -m uvicorn server:app --reload --host 127.0.0.1 --port 8000
```
- API Documentation (Swagger UI): [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- API Health Status: [http://127.0.0.1:8000/api/status](http://127.0.0.1:8000/api/status)

#### Terminal 2: Start React Frontend

```powershell
cd frontend
npm run dev
```
- Open your browser to: [http://localhost:5173](http://localhost:5173)

---

### 3. Running Automated Tests

Run the backend integration test suite:
```powershell
.\.venv\Scripts\python test_rag_pipeline.py
```

Run frontend production build verification:
```powershell
cd frontend
npm run build
```

---

### 4. Streamlit Backup

If you ever wish to run the original Streamlit application:
```powershell
.\.venv\Scripts\streamlit run app.py
```
Both applications connect to the same persistent `./chroma_db` collection (`document_qa`).
