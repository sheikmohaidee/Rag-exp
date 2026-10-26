import React, { useState } from 'react';
import {
  Database,
  FileText,
  Sliders,
  Trash2,
  RefreshCw,
  Eye,
  Layers,
  AlertTriangle,
  FileBox,
} from 'lucide-react';
import { KnowledgeBaseStatus, RetrievalConfig } from '../types';

interface SidebarProps {
  status: KnowledgeBaseStatus | null;
  config: RetrievalConfig;
  setConfig: React.Dispatch<React.SetStateAction<RetrievalConfig>>;
  onRefresh: () => void;
  onClearDatabase: () => void;
  onDeleteDocument: (filename: string) => void;
  onPreviewChunks: (filename: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  status,
  config,
  setConfig,
  onRefresh,
  onClearDatabase,
  onDeleteDocument,
  onPreviewChunks,
  isOpen,
  onClose,
}) => {
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-80 bg-dark-900/95 md:bg-dark-900/50 border-r border-slate-800/80 p-5 flex flex-col justify-between overflow-y-auto transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="space-y-6">
          {/* Header & Refresh */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/70">
            <div className="flex items-center space-x-2">
              <Database className="w-4 h-4 text-brand-400" />
              <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-300">
                Knowledge Base
              </h2>
            </div>
            <button
              onClick={onRefresh}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Refresh status"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Stats Metrics Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="glass-card p-3 rounded-xl border border-slate-800">
              <div className="flex items-center space-x-1.5 text-xs text-slate-400 mb-1">
                <Layers className="w-3.5 h-3.5 text-brand-400" />
                <span>Total Chunks</span>
              </div>
              <div className="text-xl font-bold font-mono text-white">
                {status ? status.total_chunks : '—'}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">document_qa</p>
            </div>

            <div className="glass-card p-3 rounded-xl border border-slate-800">
              <div className="flex items-center space-x-1.5 text-xs text-slate-400 mb-1">
                <FileBox className="w-3.5 h-3.5 text-accent-cyan" />
                <span>Documents</span>
              </div>
              <div className="text-xl font-bold font-mono text-white">
                {status ? status.total_documents : '—'}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">PDF &amp; TXT</p>
            </div>
          </div>

          {/* Retrieval Parameters */}
          <div className="space-y-4 glass-card p-4 rounded-xl border border-slate-800/80">
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-300">
              <Sliders className="w-3.5 h-3.5 text-accent-violet" />
              <span>Retrieval Settings</span>
            </div>

            {/* Top-K */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="text-slate-400">Top Candidates (K)</span>
                <span className="font-mono font-medium text-brand-400">{config.topK}</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={config.topK}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, topK: parseInt(e.target.value, 10) }))
                }
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>1 chunk</span>
                <span>10 chunks</span>
              </div>
            </div>

            {/* Max Distance Threshold */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="text-slate-400">Max Cosine Distance</span>
                <span className="font-mono font-medium text-brand-400">
                  {config.maxDistance.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0.10"
                max="1.50"
                step="0.05"
                value={config.maxDistance}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, maxDistance: parseFloat(e.target.value) }))
                }
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>0.10 (strict)</span>
                <span>1.50 (lenient)</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                Chunks with distance greater than this threshold are filtered out as unsupported.
              </p>
            </div>
          </div>

          {/* Indexed Documents List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">Indexed Files</span>
              <span className="text-[11px] text-slate-500 font-mono">
                {status?.documents.length || 0} active
              </span>
            </div>

            {status && status.documents.length > 0 ? (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {status.documents.map((doc) => (
                  <div
                    key={doc.source}
                    className="group glass-card p-2.5 rounded-lg border border-slate-800/80 hover:border-slate-700 transition-all flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                      <div className="p-1.5 rounded-md bg-slate-800 text-slate-300 flex-shrink-0">
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p
                          className="text-xs font-medium text-slate-200 truncate"
                          title={doc.source}
                        >
                          {doc.source}
                        </p>
                        <div className="flex items-center space-x-2 text-[10px] text-slate-500 font-mono">
                          <span>{doc.chunk_count} chunks</span>
                          {doc.file_hash && (
                            <>
                              <span>•</span>
                              <span>#{doc.file_hash}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 opacity-80 group-hover:opacity-100 flex-shrink-0">
                      <button
                        onClick={() => onPreviewChunks(doc.source)}
                        className="p-1 rounded text-slate-400 hover:text-brand-400 hover:bg-slate-800 transition-colors"
                        title="Inspect chunks"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Remove '${doc.source}' from knowledge base?`)) {
                            onDeleteDocument(doc.source);
                          }
                        }}
                        className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                        title="Delete document"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 border border-dashed border-slate-800 rounded-xl p-4">
                <FileBox className="w-7 h-7 mx-auto text-slate-600 mb-2" />
                <p className="text-xs text-slate-400 font-medium">No documents indexed</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Upload PDF or TXT documents to get started.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer & Danger Zone */}
        <div className="pt-4 border-t border-slate-800/80 space-y-3">
          {/* Models Information Pill */}
          <div className="text-[11px] text-slate-500 space-y-1 font-mono bg-dark-950/60 p-2.5 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Embed:</span>
              <span className="text-slate-300">gemini-embedding-001</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Model:</span>
              <span className="text-slate-300">gemini-2.5-flash</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Storage:</span>
              <span className="text-slate-300">./chroma_db</span>
            </div>
          </div>

          {/* Clear Knowledge Base Button */}
          {showClearConfirm ? (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-900/60 space-y-2">
              <div className="flex items-center space-x-1.5 text-xs text-rose-300 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span>Clear 'document_qa'?</span>
              </div>
              <p className="text-[10px] text-rose-400/80">
                This deletes all indexed document chunks. 'python_knowledge' collection remains safe.
              </p>
              <div className="flex space-x-2 pt-1">
                <button
                  onClick={() => {
                    onClearDatabase();
                    setShowClearConfirm(false);
                  }}
                  className="flex-1 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium transition-colors"
                >
                  Yes, Clear
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="py-1.5 px-3 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowClearConfirm(true)}
              disabled={!status || status.total_chunks === 0}
              className="w-full py-2 px-3 rounded-xl text-xs font-medium text-slate-400 hover:text-rose-300 hover:bg-rose-950/30 border border-slate-800/80 hover:border-rose-900/50 transition-colors flex items-center justify-center space-x-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Document Collection</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
