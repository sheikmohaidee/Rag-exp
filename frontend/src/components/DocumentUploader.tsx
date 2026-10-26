import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileUp,
  Info,
  ArrowRight,
} from 'lucide-react';
import { api } from '../services/api';
import { BatchIndexResponse } from '../types';

interface DocumentUploaderProps {
  onIndexComplete: () => void;
  onGoToChat: () => void;
}

export const DocumentUploader: React.FC<DocumentUploaderProps> = ({
  onIndexComplete,
  onGoToChat,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<BatchIndexResponse | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const validateAndAddFiles = (filesList: FileList | null) => {
    if (!filesList) return;
    const validFiles: File[] = [];
    const errors: string[] = [];

    Array.from(filesList).forEach((file) => {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.pdf') || lower.endsWith('.txt')) {
        // Prevent duplicate file names in selection
        if (!selectedFiles.some((f) => f.name === file.name)) {
          validFiles.push(file);
        }
      } else {
        errors.push(`${file.name}: only .pdf and .txt files are supported`);
      }
    });

    if (errors.length > 0) {
      setUploadError(errors.join(', '));
    } else {
      setUploadError(null);
    }

    if (validFiles.length > 0) {
      setSelectedFiles((prev) => [...prev, ...validFiles]);
      setUploadResult(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    validateAndAddFiles(e.dataTransfer.files);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    validateAndAddFiles(e.target.files);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    if (selectedFiles.length <= 1) {
      setUploadResult(null);
      setUploadError(null);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleUploadAndIndex = async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    setUploadError(null);
    setUploadProgress(15);

    try {
      // Simulate progress progression for large uploads
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => (prev < 85 ? prev + 15 : prev));
      }, 400);

      const result = await api.uploadDocuments(selectedFiles);
      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploadResult(result);
      setSelectedFiles([]);
      onIndexComplete();
    } catch (err: any) {
      setUploadError(err.message || 'Indexing failed. Ensure GEMINI_API_KEY is valid.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 space-y-8">
      {/* Title & Introduction */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Document Ingestion &amp; Indexing
        </h1>
        <p className="text-sm text-slate-400 max-w-xl mx-auto">
          Add PDF or TXT files to your knowledge base. Documents are processed using paragraph-aware chunking and embedded into ChromaDB with Gemini.
        </p>
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? 'border-brand-500 bg-brand-500/10 scale-[1.01]'
            : 'border-slate-800 hover:border-slate-700 bg-dark-900/40 hover:bg-dark-900/60'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.txt"
          onChange={handleFileInputChange}
          className="hidden"
        />

        <div className="space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600/20 to-accent-cyan/20 border border-brand-500/30 flex items-center justify-center mx-auto shadow-glow-brand">
            <UploadCloud className="w-8 h-8 text-brand-400" />
          </div>

          <div className="space-y-1">
            <p className="text-base font-medium text-slate-200">
              Drag and drop your files here, or{' '}
              <span className="text-brand-400 underline underline-offset-2">browse files</span>
            </p>
            <p className="text-xs text-slate-400">
              Supports <span className="font-mono text-slate-300">.pdf</span> (text-based) and{' '}
              <span className="font-mono text-slate-300">.txt</span> files.
            </p>
          </div>

          <div className="flex items-center justify-center space-x-6 text-[11px] text-slate-500 pt-2 font-mono">
            <span>• Paragraph-aware overlap</span>
            <span>• Batched vectors</span>
            <span>• Auto deduplication</span>
          </div>
        </div>
      </div>

      {/* OCR & Scanned PDF Notice Callout */}
      <div className="glass-card p-4 rounded-xl border border-slate-800/80 flex items-start space-x-3 text-xs text-slate-400">
        <Info className="w-4 h-4 text-accent-cyan flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-slate-300">Text-based documents recommended</p>
          <p className="text-slate-400 mt-0.5 leading-relaxed">
            Scanned PDFs that contain images of text rather than selectable text require an OCR layer. Re-uploading a file with the same name safely replaces its chunks in ChromaDB.
          </p>
        </div>
      </div>

      {/* Selected Files Staging List */}
      {selectedFiles.length > 0 && (
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileUp className="w-4 h-4 text-brand-400" />
              <h3 className="text-sm font-semibold text-slate-200">
                Staged for Indexing ({selectedFiles.length})
              </h3>
            </div>
            <button
              onClick={() => setSelectedFiles([])}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Clear all
            </button>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {selectedFiles.map((file, idx) => (
              <div
                key={`${file.name}-${idx}`}
                className="flex items-center justify-between p-3 rounded-xl bg-dark-900/60 border border-slate-800/80"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="p-2 rounded-lg bg-slate-800 text-brand-400">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate">{file.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => removeFile(idx)}
                  disabled={isUploading}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors disabled:opacity-50"
                  title="Remove from queue"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Progress Bar while uploading */}
          {isUploading && (
            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span className="flex items-center space-x-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-400" />
                  <span>Extracting, chunking and embedding documents…</span>
                </span>
                <span className="font-mono">{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brand-600 via-indigo-500 to-accent-cyan transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="pt-2 flex justify-end">
            <button
              onClick={handleUploadAndIndex}
              disabled={isUploading}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white text-xs font-semibold tracking-wide shadow-glow-brand flex items-center justify-center space-x-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing &amp; Indexing…</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>Index Selected Documents ({selectedFiles.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {uploadError && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-900/60 flex items-start space-x-3 text-xs text-rose-300">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-rose-200">Indexing Error</p>
            <p className="text-rose-300/90 leading-relaxed">{uploadError}</p>
          </div>
        </div>
      )}

      {/* Success / Result Feedback */}
      {uploadResult && (
        <div
          className={`glass-panel p-5 rounded-2xl border space-y-4 ${
            uploadResult.indexed_files === uploadResult.total_files
              ? 'border-emerald-500/30 bg-emerald-950/20'
              : uploadResult.indexed_files > 0
              ? 'border-amber-500/30 bg-amber-950/20'
              : 'border-rose-500/30 bg-rose-950/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {uploadResult.indexed_files === uploadResult.total_files ? (
                <>
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-emerald-300">
                    Indexing Completed Successfully
                  </h3>
                </>
              ) : uploadResult.indexed_files > 0 ? (
                <>
                  <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-400" />
                  <h3 className="text-sm font-semibold text-amber-300">
                    Partial Indexing Completed
                  </h3>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
                  <h3 className="text-sm font-semibold text-rose-300">
                    Document Indexing Failed
                  </h3>
                </>
              )}
            </div>

            {uploadResult.indexed_files > 0 && (
              <button
                onClick={onGoToChat}
                className="px-3.5 py-1.5 rounded-lg bg-brand-600/30 hover:bg-brand-600/50 text-brand-200 border border-brand-500/40 text-xs font-medium flex items-center space-x-1.5 transition-colors"
              >
                <span>Ask Questions Now</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <p className="text-xs text-slate-300">
            Processed{' '}
            <span className="font-bold text-white">
              {uploadResult.indexed_files} of {uploadResult.total_files}
            </span>{' '}
            files, generating and storing{' '}
            <span className="font-bold text-brand-400">{uploadResult.total_chunks}</span> chunks in
            ChromaDB.
          </p>

          <div className="space-y-1.5">
            {uploadResult.results.map((res) => (
              <div
                key={res.filename}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-lg bg-dark-900/60 border border-slate-800 text-xs gap-1"
              >
                <div className="flex items-center space-x-2 min-w-0">
                  {res.status === 'success' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                  )}
                  <span className="font-medium text-slate-200 truncate">{res.filename}</span>
                </div>
                {res.status === 'success' ? (
                  <span className="font-mono text-emerald-400 text-[11px] flex-shrink-0">
                    +{res.chunk_count} chunks
                  </span>
                ) : (
                  <span className="text-rose-400 text-[11px] leading-relaxed break-words">
                    {res.error}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
