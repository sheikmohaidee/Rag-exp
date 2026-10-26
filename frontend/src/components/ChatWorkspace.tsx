import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Copy,
  Check,
  RotateCcw,
  BookOpen,
  HelpCircle,
  FileText,
  BadgeAlert,
  ShieldCheck,
} from 'lucide-react';
import { ChatMessage, RetrievalConfig, KnowledgeBaseStatus } from '../types';
import { api } from '../services/api';

interface ChatWorkspaceProps {
  status: KnowledgeBaseStatus | null;
  config: RetrievalConfig;
  onGoToUpload: () => void;
}

export const ChatWorkspace: React.FC<ChatWorkspaceProps> = ({
  status,
  config,
  onGoToUpload,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const toggleSourceExpand = (messageId: string) => {
    setExpandedSources((prev) => ({
      ...prev,
      [messageId]: !prev[messageId],
    }));
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSend = async (questionText?: string) => {
    const q = (questionText || inputQuestion).trim();
    if (!q || isLoading) return;

    if (!status || status.total_chunks === 0) {
      const emptyMsg: ChatMessage = {
        id: Date.now().toString(),
        sender: 'assistant',
        text: 'The knowledge base is currently empty. Please upload and index PDF or TXT documents before asking questions.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isSupported: false,
      };
      setMessages((prev) => [...prev, {
        id: (Date.now() - 1).toString(),
        sender: 'user',
        text: q,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }, emptyMsg]);
      setInputQuestion('');
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputQuestion('');
    setIsLoading(true);

    try {
      const response = await api.query(q, config.maxDistance, config.topK);

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: response.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isSupported: response.is_supported,
        sources: response.relevant_sources,
        retrievedCandidates: response.retrieved_candidates,
        distanceThreshold: response.distance_threshold,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: `Error processing query: ${err.message || 'Server error occurred'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        error: err.message,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Dynamic sample questions based on documents in collection
  const sampleQuestions = [
    ...(status?.documents?.length
      ? [
          `Summarize the key information in ${status.documents[0].source}`,
          `What are the policies or important instructions mentioned in the documents?`,
          `Are there any specific dates, guidelines, or contacts listed?`,
        ]
      : [
          'What is the refund policy mentioned in the store guide?',
          'How does the library membership work?',
          'What are the operating hours and rules?',
        ]),
  ];

  const getDistanceColor = (dist: number, maxDist: number) => {
    const ratio = dist / maxDist;
    if (ratio < 0.6) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (ratio <= 1.0) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-5xl mx-auto w-full px-4 sm:px-6">
      {/* Top Banner if Knowledge base is empty */}
      {status && status.total_chunks === 0 && (
        <div className="mt-4 p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 flex items-center justify-between text-xs text-amber-300">
          <div className="flex items-center space-x-2">
            <HelpCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>No documents currently indexed in 'document_qa'.</span>
          </div>
          <button
            onClick={onGoToUpload}
            className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 font-medium text-amber-200 transition-colors"
          >
            Upload Documents
          </button>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto py-6 space-y-6">
        {messages.length === 0 ? (
          /* Empty State */
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto space-y-6 my-auto pt-8">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-accent-cyan p-0.5 shadow-glow-brand">
              <div className="w-full h-full bg-dark-950 rounded-[22px] flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-brand-400" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold tracking-tight text-white">
                How can I assist with your documents today?
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Answers are strictly grounded in your indexed documents using Gemini embeddings and ChromaDB vector search.
              </p>
            </div>

            {/* Quick Starter Questions */}
            <div className="w-full space-y-2 pt-2">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-left pl-1">
                Suggested Prompts
              </p>
              <div className="grid gap-2 text-left">
                {sampleQuestions.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(prompt)}
                    className="p-3 rounded-xl glass-card border border-slate-800/80 hover:border-brand-500/40 hover:bg-slate-800/40 text-xs text-slate-300 hover:text-white transition-all text-left flex items-center justify-between group"
                  >
                    <span>{prompt}</span>
                    <Sparkles className="w-3.5 h-3.5 text-slate-600 group-hover:text-brand-400 transition-colors flex-shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Messages List */
          <div className="space-y-6">
            <div className="flex justify-end">
              <button
                onClick={() => setMessages([])}
                className="text-xs text-slate-500 hover:text-slate-300 flex items-center space-x-1.5 transition-colors"
                title="Reset conversation"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Clear conversation</span>
              </button>
            </div>

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex space-x-3 ${
                  msg.sender === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {/* Assistant Avatar */}
                {msg.sender === 'assistant' && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-accent-cyan p-0.5 flex-shrink-0 mt-0.5 shadow-sm">
                    <div className="w-full h-full bg-dark-900 rounded-[10px] flex items-center justify-center">
                      <Bot className="w-4 h-4 text-brand-400" />
                    </div>
                  </div>
                )}

                {/* Message Content Bubble */}
                <div
                  className={`max-w-2xl rounded-2xl p-4 space-y-3 ${
                    msg.sender === 'user'
                      ? 'bg-brand-600 text-white shadow-glow-brand rounded-tr-sm'
                      : 'glass-panel border border-slate-800/90 text-slate-100 rounded-tl-sm'
                  }`}
                >
                  <div className="flex items-center justify-between space-x-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] font-medium text-slate-400">
                        {msg.sender === 'user' ? 'You' : 'DocuMind Assistant'}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {msg.timestamp}
                      </span>
                    </div>

                    {msg.sender === 'assistant' && !msg.error && (
                      <div className="flex items-center space-x-1.5">
                        {msg.isSupported ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <ShieldCheck className="w-3 h-3" />
                            <span>Grounded</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            <BadgeAlert className="w-3 h-3" />
                            <span>Unsupported / No Grounding</span>
                          </span>
                        )}

                        <button
                          onClick={() => copyToClipboard(msg.text, msg.id)}
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
                          title="Copy answer"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Body Text */}
                  <div className="text-sm leading-relaxed whitespace-pre-wrap font-sans">
                    {msg.text}
                  </div>

                  {/* Sources Citations Section for Assistant */}
                  {msg.sender === 'assistant' && msg.sources && msg.sources.length > 0 && (
                    <div className="pt-3 border-t border-slate-800/70 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-300">
                          <BookOpen className="w-3.5 h-3.5 text-brand-400" />
                          <span>Sources Referenced ({msg.sources.length})</span>
                        </div>
                        <button
                          onClick={() => toggleSourceExpand(msg.id)}
                          className="text-xs text-brand-400 hover:text-brand-300 flex items-center space-x-1 transition-colors"
                        >
                          <span>
                            {expandedSources[msg.id]
                              ? 'Hide Context Chunks'
                              : 'Inspect Retrieved Chunks'}
                          </span>
                          {expandedSources[msg.id] ? (
                            <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ChevronRight className="w-3 h-3" />
                          )}
                        </button>
                      </div>

                      {/* Source Pills */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {msg.sources.map((src, i) => (
                          <div
                            key={i}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono border flex items-center space-x-2 ${getDistanceColor(
                              src.distance,
                              msg.distanceThreshold || 0.8
                            )}`}
                          >
                            <FileText className="w-3 h-3 opacity-70" />
                            <span className="font-semibold">{src.source}</span>
                            <span className="opacity-70">chunk {src.chunk_index}</span>
                            <span className="text-[10px] opacity-90">
                              (dist: {src.distance.toFixed(3)})
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Expandable Chunks Preview */}
                      {expandedSources[msg.id] && (
                        <div className="mt-3 space-y-2.5 pt-2 border-t border-slate-800/50">
                          {msg.sources.map((src, idx) => (
                            <div
                              key={idx}
                              className="p-3 rounded-xl bg-dark-900/90 border border-slate-800 space-y-1.5 text-xs font-sans"
                            >
                              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                                <span className="font-semibold text-slate-200">
                                  {src.source} · chunk {src.chunk_index}
                                </span>
                                <span className="text-brand-400">
                                  cosine dist: {src.distance.toFixed(3)}
                                </span>
                              </div>
                              <p className="text-slate-300 leading-relaxed font-sans bg-dark-950/50 p-2.5 rounded-lg border border-slate-800/80 text-xs">
                                {src.document}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* If query was unsupported and all chunks failed threshold */}
                  {msg.sender === 'assistant' &&
                    !msg.isSupported &&
                    msg.retrievedCandidates &&
                    msg.retrievedCandidates.length > 0 &&
                    (!msg.sources || msg.sources.length === 0) && (
                      <div className="pt-2 border-t border-slate-800/70 text-xs text-slate-400 space-y-1.5">
                        <div className="flex items-center space-x-1.5 text-amber-400">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Candidate chunks exceeded maximum distance ({msg.distanceThreshold?.toFixed(2)}):</span>
                        </div>
                        <div className="space-y-1 font-mono text-[11px]">
                          {msg.retrievedCandidates.map((c, i) => (
                            <div key={i} className="flex justify-between text-slate-500">
                              <span>{c.source} (chunk {c.chunk_index})</span>
                              <span>dist: {c.distance.toFixed(3)} &gt; threshold</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </div>

                {/* User Avatar */}
                {msg.sender === 'user' && (
                  <div className="w-8 h-8 rounded-xl bg-slate-800 flex-shrink-0 mt-0.5 flex items-center justify-center text-slate-300">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex space-x-3 items-start">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-accent-cyan p-0.5 flex-shrink-0 shadow-sm animate-pulse">
                  <div className="w-full h-full bg-dark-900 rounded-[10px] flex items-center justify-center">
                    <Bot className="w-4 h-4 text-brand-400" />
                  </div>
                </div>
                <div className="glass-panel p-4 rounded-2xl rounded-tl-sm border border-slate-800 flex items-center space-x-3">
                  <div className="flex space-x-1.5">
                    <div className="w-2 h-2 rounded-full bg-brand-400 animate-bounce" />
                    <div
                      className="w-2 h-2 rounded-full bg-brand-400 animate-bounce"
                      style={{ animationDelay: '0.2s' }}
                    />
                    <div
                      className="w-2 h-2 rounded-full bg-brand-400 animate-bounce"
                      style={{ animationDelay: '0.4s' }}
                    />
                  </div>
                  <span className="text-xs text-slate-400">
                    Searching ChromaDB &amp; generating grounded response…
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Bar Area */}
      <div className="pb-6 pt-2">
        <div className="glass-panel p-2 rounded-2xl border border-slate-800/90 shadow-2xl focus-within:border-brand-500/60 transition-all flex items-end space-x-2">
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputQuestion}
            onChange={(e) => setInputQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              status && status.total_chunks > 0
                ? "Ask a question about your indexed documents... (Enter to send, Shift+Enter for new line)"
                : "Upload documents to begin asking questions..."
            }
            className="flex-1 bg-transparent border-0 resize-none text-sm text-slate-100 placeholder-slate-500 focus:ring-0 focus:outline-none p-2.5 max-h-32 min-h-[44px]"
          />

          <button
            onClick={() => handleSend()}
            disabled={!inputQuestion.trim() || isLoading}
            className="p-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-glow-brand flex-shrink-0"
            title="Send Question"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 px-1">
          <span>Grounded retrieval using ChromaDB &amp; Gemini Flash</span>
          <span className="font-mono">
            K={config.topK} · Dist={config.maxDistance.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
};
