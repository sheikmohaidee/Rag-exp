import {
  KnowledgeBaseStatus,
  DocumentSummary,
  QueryResponse,
  BatchIndexResponse,
  DocumentChunk,
  HealthResponse,
} from '../types';

const API_BASE = '/api';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorDetail = '';
    try {
      const rawText = await res.text();
      if (rawText) {
        try {
          const errJson = JSON.parse(rawText);
          errorDetail = errJson.detail || errJson.message || JSON.stringify(errJson);
        } catch {
          errorDetail = rawText.trim();
        }
      }
    } catch {
      // Ignore text read error and fallback below
    }

    if (!errorDetail) {
      errorDetail = res.statusText || `Request failed with HTTP status ${res.status}`;
    }

    throw new ApiError(errorDetail, res.status);
  }
  return res.json();
}

export const api = {
  async getHealth(): Promise<HealthResponse> {
    const res = await fetch(`${API_BASE}/health`);
    return handleResponse<HealthResponse>(res);
  },

  async getStatus(): Promise<KnowledgeBaseStatus> {
    const res = await fetch(`${API_BASE}/status`);
    return handleResponse<KnowledgeBaseStatus>(res);
  },

  async getDocuments(): Promise<DocumentSummary[]> {
    const res = await fetch(`${API_BASE}/documents`);
    return handleResponse<DocumentSummary[]>(res);
  },

  async getDocumentChunks(filename: string): Promise<{ source: string; chunks: DocumentChunk[]; total: number }> {
    const res = await fetch(`${API_BASE}/documents/${encodeURIComponent(filename)}/chunks`);
    return handleResponse<{ source: string; chunks: DocumentChunk[]; total: number }>(res);
  },

  async deleteDocument(filename: string): Promise<{ status: string; message: string }> {
    const res = await fetch(`${API_BASE}/documents/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
    });
    return handleResponse<{ status: string; message: string }>(res);
  },

  async clearCollection(): Promise<{ status: string; message: string }> {
    const res = await fetch(`${API_BASE}/documents/clear`, {
      method: 'POST',
    });
    return handleResponse<{ status: string; message: string }>(res);
  },

  async uploadDocuments(files: File[]): Promise<BatchIndexResponse> {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    // Do NOT set Content-Type header manually; browser automatically sets boundary
    const res = await fetch(`${API_BASE}/documents/upload`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse<BatchIndexResponse>(res);
  },

  async query(question: string, maxDistance: number = 0.8, topK: number = 5): Promise<QueryResponse> {
    const res = await fetch(`${API_BASE}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question,
        max_distance: maxDistance,
        top_k: topK,
      }),
    });
    return handleResponse<QueryResponse>(res);
  },
};
