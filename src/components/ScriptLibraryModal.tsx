import React, { useState } from 'react';
import {
  Search,
  Plus,
  Trash2,
  Copy,
  Code2,
  TrendingUp,
  Sliders,
  Check,
  FileCode,
  Sparkles,
} from 'lucide-react';
import { ScriptItem } from '../types/trading';

interface ScriptLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  scripts: ScriptItem[];
  currentScriptId: string;
  onSelectScript: (script: ScriptItem) => void;
  onCreateNewScript: (type: 'strategy' | 'indicator') => void;
  onDeleteScript: (id: string) => void;
}

export const ScriptLibraryModal: React.FC<ScriptLibraryModalProps> = ({
  isOpen,
  onClose,
  scripts,
  currentScriptId,
  onSelectScript,
  onCreateNewScript,
  onDeleteScript,
}) => {
  const [filter, setFilter] = useState<'all' | 'strategy' | 'indicator' | 'custom'>('all');
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const filteredScripts = scripts.filter(s => {
    if (filter === 'strategy' && s.type !== 'strategy') return false;
    if (filter === 'indicator' && s.type !== 'indicator') return false;
    if (filter === 'custom' && s.isBuiltin) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.description.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#1e222d] border border-[#2a2e39] rounded-lg max-w-3xl w-full h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#2a2e39] bg-[#171b26]">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-[#2962ff]" />
            <div>
              <h2 className="text-sm font-semibold text-white">Indicators &amp; Strategies Library</h2>
              <p className="text-[11px] text-[#787b86]">Create, test, and save unlimited custom scripts without subscriptions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#787b86] hover:text-white px-2.5 py-1 rounded hover:bg-[#2a2e39] transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Toolbar: Search & Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-[#2a2e39] bg-[#131722]">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-[#787b86] absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search indicators and strategies..."
              className="w-full bg-[#1e222d] text-white pl-9 pr-3 py-1.5 rounded border border-[#2a2e39] text-xs focus:border-[#2962ff] focus:outline-hidden"
            />
          </div>

          {/* Type Filters */}
          <div className="flex items-center gap-1 bg-[#1e222d] p-1 rounded border border-[#2a2e39]">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                filter === 'all' ? 'bg-[#2a2e39] text-white' : 'text-[#787b86] hover:text-white'
              }`}
            >
              All ({scripts.length})
            </button>
            <button
              onClick={() => setFilter('strategy')}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                filter === 'strategy' ? 'bg-[#2a2e39] text-white' : 'text-[#787b86] hover:text-white'
              }`}
            >
              Strategies
            </button>
            <button
              onClick={() => setFilter('indicator')}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                filter === 'indicator' ? 'bg-[#2a2e39] text-white' : 'text-[#787b86] hover:text-white'
              }`}
            >
              Indicators
            </button>
            <button
              onClick={() => setFilter('custom')}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                filter === 'custom' ? 'bg-[#2a2e39] text-white' : 'text-[#787b86] hover:text-white'
              }`}
            >
              My Saved
            </button>
          </div>

          {/* Create New Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onCreateNewScript('strategy')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2962ff] hover:bg-[#1e53e5] text-white rounded text-xs font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Strategy</span>
            </button>
            <button
              onClick={() => onCreateNewScript('indicator')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2a2e39] hover:bg-[#363c4e] text-white rounded text-xs font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Indicator</span>
            </button>
          </div>
        </div>

        {/* Script Cards Grid */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredScripts.length === 0 ? (
            <div className="col-span-2 text-center py-12 text-[#787b86]">
              <FileCode className="w-10 h-10 mx-auto mb-2 text-[#2a2e39]" />
              <p className="text-xs">No matching scripts found.</p>
            </div>
          ) : (
            filteredScripts.map(script => {
              const isActive = script.id === currentScriptId;
              return (
                <div
                  key={script.id}
                  onClick={() => {
                    onSelectScript(script);
                    onClose();
                  }}
                  className={`p-3.5 rounded border transition-all cursor-pointer flex flex-col justify-between ${
                    isActive
                      ? 'bg-[#2962ff]/10 border-[#2962ff]'
                      : 'bg-[#171b26] border-[#2a2e39] hover:border-[#363c4e] hover:bg-[#1e222d]'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        {script.type === 'strategy' ? (
                          <TrendingUp className="w-4 h-4 text-[#089981] shrink-0" />
                        ) : (
                          <Code2 className="w-4 h-4 text-[#2962ff] shrink-0" />
                        )}
                        <h4 className="text-xs font-semibold text-white leading-tight">
                          {script.name}
                        </h4>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2a2e39] text-[#787b86] uppercase font-mono">
                          {script.type}
                        </span>
                        {script.isBuiltin ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2a2e39]/60 text-[#2962ff]">
                            Built-in
                          </span>
                        ) : (
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              if (confirm(`Delete "${script.name}"?`)) {
                                onDeleteScript(script.id);
                              }
                            }}
                            title="Delete custom script"
                            className="p-1 text-[#787b86] hover:text-[#f23645] rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-[11px] text-[#787b86] line-clamp-2 leading-relaxed">
                      {script.description || 'Custom user script.'}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-[#2a2e39]/50 flex items-center justify-between text-[11px]">
                    <span className="text-[#505668]">
                      {new Date(script.lastModified).toLocaleDateString()}
                    </span>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onSelectScript(script);
                        onClose();
                      }}
                      className="px-2.5 py-1 bg-[#2a2e39] hover:bg-[#2962ff] text-white rounded text-[11px] font-medium transition-colors"
                    >
                      {isActive ? 'Active on Chart' : 'Add to Chart'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-[#2a2e39] bg-[#171b26] flex items-center justify-between text-xs text-[#787b86]">
          <span>Free storage: No script limit. All strategies saved to browser storage.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#2a2e39] hover:bg-[#363c4e] text-white rounded font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
