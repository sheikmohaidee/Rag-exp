import React, { useEffect, useState } from 'react';
import { X, Layers, Copy, Check, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { DocumentChunk } from '../types';

interface ChunkPreviewModalProps {
  filename: string | null;
  onClose: () => void;
}

export const ChunkPreviewModal: React.FC<ChunkPreviewModalProps> = ({
  filename,
  onClose,
}) => {
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!filename) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    api
      .getDocumentChunks(filename)
      .then((res) => {
        if (isMounted) {
          setChunks(res.chunks);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Failed to load document chunks');
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [filename]);

  if (!filename) return null;

  const copyChunk = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-dark-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <span>{filename}</span>
                {chunks.length > 0 && (
                  <span className="text-xs font-mono font-normal px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                    {chunks.length} chunks
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                Paragraph-aware chunks stored in ChromaDB
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
              <p className="text-xs">Fetching chunks from ChromaDB…</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-900/60 text-xs text-rose-300">
              {error}
            </div>
          ) : chunks.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No chunks found for this file.
            </div>
          ) : (
            chunks.map((chunk) => (
              <div
                key={chunk.chunk_index}
                className="p-4 rounded-xl bg-dark-950/70 border border-slate-800/90 space-y-2 group"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2 font-mono text-slate-400">
                    <span className="font-semibold text-brand-400">
                      Chunk #{chunk.chunk_index}
                    </span>
                    {chunk.file_hash && (
                      <span className="text-slate-600 text-[10px]">
                        hash: {chunk.file_hash}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => copyChunk(chunk.text, chunk.chunk_index)}
                    className="p-1 rounded text-slate-500 hover:text-white hover:bg-slate-800 transition-colors flex items-center space-x-1 text-[11px]"
                    title="Copy chunk text"
                  >
                    {copiedIndex === chunk.chunk_index ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed font-sans bg-dark-900/40 p-3 rounded-lg border border-slate-800/60">
                  {chunk.text}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
