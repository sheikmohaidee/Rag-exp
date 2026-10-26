import React from 'react';
import { Sparkles, Database, ShieldCheck, AlertCircle, Menu, X, WifiOff, Loader2 } from 'lucide-react';
import { KnowledgeBaseStatus, HealthResponse } from '../types';

interface HeaderProps {
  status: KnowledgeBaseStatus | null;
  health: HealthResponse | null;
  isBackendConnected: boolean;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  activeTab: 'chat' | 'upload';
  setActiveTab: (tab: 'chat' | 'upload') => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  health,
  isBackendConnected,
  sidebarOpen,
  setSidebarOpen,
  activeTab,
  setActiveTab,
}) => {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-dark-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & Title */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Toggle Sidebar"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 via-indigo-500 to-accent-cyan p-0.5 shadow-glow-brand flex items-center justify-center">
              <div className="w-full h-full bg-dark-950 rounded-[10px] flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-brand-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-base tracking-tight text-white">DocuMind</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-brand-500/10 text-brand-400 border border-brand-500/20">
                  RAG
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-normal hidden sm:block">
                Enterprise Document Intelligence &amp; Neural Q&amp;A
              </p>
            </div>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center bg-dark-900/90 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'chat'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Ask Questions
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center space-x-1.5 ${
              activeTab === 'upload'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Upload &amp; Index</span>
            {status && status.total_documents > 0 && (
              <span className="w-4 h-4 rounded-full bg-slate-800 text-[10px] flex items-center justify-center text-slate-300">
                {status.total_documents}
              </span>
            )}
          </button>
        </div>

        {/* Status Indicators */}
        <div className="hidden lg:flex items-center space-x-4">
          <div className="flex items-center space-x-2 px-3 py-1 rounded-lg bg-slate-900/60 border border-slate-800 text-xs">
            <Database className="w-3.5 h-3.5 text-accent-cyan" />
            <span className="text-slate-400">Collection:</span>
            <span className="font-mono text-slate-200">
              {status ? status.collection_name : 'document_qa'}
            </span>
          </div>

          {/* Dedicated Backend & API Key Status Indicator */}
          <div className="flex items-center space-x-2 px-3 py-1 rounded-lg bg-slate-900/60 border border-slate-800 text-xs">
            {!isBackendConnected ? (
              <>
                <WifiOff className="w-3.5 h-3.5 text-accent-amber" />
                <span className="text-amber-400">Backend Disconnected</span>
              </>
            ) : health === null ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                <span className="text-slate-400">Connecting…</span>
              </>
            ) : health.api_key_configured ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-accent-emerald" />
                <span className="text-emerald-400">Gemini Connected</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-accent-rose" />
                <span className="text-rose-400 font-medium">API Key Missing</span>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
