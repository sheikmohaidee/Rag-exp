export interface DocumentSummary {
  source: string;
  chunk_count: number;
  file_hash: string;
}

export interface HealthResponse {
  status: string;
  api_key_configured: boolean;
  env_file_found?: boolean;
  chroma_dir_found?: boolean;
}

export interface KnowledgeBaseStatus {
  status: string;
  collection_name: string;
  total_chunks: number;
  total_documents: number;
  documents: DocumentSummary[];
  embedding_model: string;
  generation_model: string;
  has_api_key: boolean;
  api_key_configured?: boolean;
}

export interface SourceReference {
  source: string;
  chunk_index: number;
  distance: number;
  document: string;
  file_hash?: string;
}

export interface QueryResponse {
  question: string;
  answer: string;
  is_supported: boolean;
  relevant_sources: SourceReference[];
  all_retrieved_count: number;
  retrieved_candidates: SourceReference[];
  distance_threshold: number;
}

export interface IndexResult {
  filename: string;
  chunk_count: number;
  file_hash: string;
  status: 'success' | 'error';
  error?: string;
}

export interface BatchIndexResponse {
  total_files: number;
  indexed_files: number;
  total_chunks: number;
  results: IndexResult[];
}

export interface DocumentChunk {
  chunk_index: number;
  text: string;
  file_hash: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  isSupported?: boolean;
  sources?: SourceReference[];
  retrievedCandidates?: SourceReference[];
  distanceThreshold?: number;
  isLoading?: boolean;
  error?: string;
}

export interface RetrievalConfig {
  maxDistance: number;
  topK: number;
}
