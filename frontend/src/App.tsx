import React, { useEffect, useState, useCallback } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { DocumentUploader } from './components/DocumentUploader';
import { ChatWorkspace } from './components/ChatWorkspace';
import { ChunkPreviewModal } from './components/ChunkPreviewModal';
import { api } from './services/api';
import { KnowledgeBaseStatus, HealthResponse, RetrievalConfig } from './types';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export const App: React.FC = () => {
  const [status, setStatus] = useState<KnowledgeBaseStatus | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'chat' | 'upload'>('chat');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [previewFilename, setPreviewFilename] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const [config, setConfig] = useState<RetrievalConfig>({
    maxDistance: 0.8,
    topK: 5,
  });

  const showNotification = useCallback(
    (type: 'success' | 'error' | 'info', message: string) => {
      setNotification({ type, message });
      setTimeout(() => {
        setNotification((current) => (current?.message === message ? null : current));
      }, 4000);
    },
    []
  );

  const checkHealthAndStatus = useCallback(async () => {
    try {
      // 1. Check health endpoint for liveness & API key
      const healthData = await api.getHealth();
      setHealth(healthData);
      setIsBackendConnected(true);

      // 2. Fetch full knowledge base status
      const statusData = await api.getStatus();
      setStatus(statusData);
    } catch (err: any) {
      console.error('Failed to load status or health:', err);
      setIsBackendConnected(false);
      showNotification('error', `Backend connection error: ${err.message || 'Check server status'}`);
    }
  }, [showNotification]);

  useEffect(() => {
    checkHealthAndStatus();
    // Periodically poll health every 15 seconds to keep connection indicator accurate
    const interval = setInterval(checkHealthAndStatus, 15000);
    return () => clearInterval(interval);
  }, [checkHealthAndStatus]);

  const handleClearDatabase = async () => {
    try {
      const res = await api.clearCollection();
      showNotification('success', res.message || "Document collection cleared.");
      await checkHealthAndStatus();
    } catch (err: any) {
      showNotification('error', `Failed to clear collection: ${err.message}`);
    }
  };

  const handleDeleteDocument = async (filename: string) => {
    try {
      const res = await api.deleteDocument(filename);
      showNotification('success', res.message || `Deleted ${filename}`);
      await checkHealthAndStatus();
    } catch (err: any) {
      showNotification('error', `Failed to delete ${filename}: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 text-slate-100 flex flex-col font-sans">
      {/* Toast Notification Banner */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 max-w-md animate-in fade-in slide-in-from-top-4 duration-200">
          <div
            className={`p-3.5 rounded-xl border shadow-xl flex items-start space-x-3 text-xs ${
              notification.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
                : notification.type === 'error'
                ? 'bg-rose-950/90 border-rose-500/40 text-rose-200'
                : 'bg-indigo-950/90 border-indigo-500/40 text-indigo-200'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            ) : notification.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            ) : (
              <Info className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
            )}
            <p className="flex-1 leading-relaxed">{notification.message}</p>
            <button
              onClick={() => setNotification(null)}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main App Navigation Header */}
      <Header
        status={status}
        health={health}
        isBackendConnected={isBackendConnected}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          status={status}
          config={config}
          setConfig={setConfig}
          onRefresh={checkHealthAndStatus}
          onClearDatabase={handleClearDatabase}
          onDeleteDocument={handleDeleteDocument}
          onPreviewChunks={(fn) => setPreviewFilename(fn)}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Content Workspace Area */}
        <main className="flex-1 overflow-y-auto bg-gradient-to-b from-dark-950 via-dark-900/30 to-dark-950 relative">
          {/* Subtle Ambient Background Glows */}
          <div className="pointer-events-none absolute -top-40 right-1/4 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl" />
          <div className="pointer-events-none absolute top-1/3 left-1/4 w-96 h-96 bg-accent-cyan/5 rounded-full blur-3xl" />

          {activeTab === 'chat' ? (
            <ChatWorkspace
              status={status}
              config={config}
              onGoToUpload={() => setActiveTab('upload')}
            />
          ) : (
            <DocumentUploader
              onIndexComplete={checkHealthAndStatus}
              onGoToChat={() => setActiveTab('chat')}
            />
          )}
        </main>
      </div>

      {/* Chunks Inspection Modal */}
      {previewFilename && (
        <ChunkPreviewModal
          filename={previewFilename}
          onClose={() => setPreviewFilename(null)}
        />
      )}
    </div>
  );
};

export default App;
