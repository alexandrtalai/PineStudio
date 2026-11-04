import React, { useState, useEffect } from 'react';
import {
  Play,
  Save,
  BookOpen,
  Code2,
  FolderOpen,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { ScriptItem } from '../types/trading';
import { BUILTIN_SCRIPTS } from '../services/defaultScripts';

interface PineEditorProps {
  currentScript: ScriptItem;
  onCodeChange: (code: string) => void;
  onRunScript: () => void;
  onSaveScript: (name: string, code: string) => void;
  onSelectScript: (script: ScriptItem) => void;
  isExecuting?: boolean;
  compilationError?: string;
  compilationLogs?: string[];
}

export const PineEditor: React.FC<PineEditorProps> = ({
  currentScript,
  onCodeChange,
  onRunScript,
  onSaveScript,
  onSelectScript,
  isExecuting = false,
  compilationError,
  compilationLogs = [],
}) => {
  const [code, setCode] = useState(currentScript.code);
  const [scriptName, setScriptName] = useState(currentScript.name);
  const [showCheatSheet, setShowCheatSheet] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  useEffect(() => {
    setCode(currentScript.code);
    setScriptName(currentScript.name);
  }, [currentScript]);

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    onCodeChange(newCode);
  };

  const handleSave = () => {
    onSaveScript(scriptName, code);
    setShowSaveSuccess(true);
    setTimeout(() => setShowSaveSuccess(false), 2500);
  };

  const handleExport = () => {
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${scriptName.toLowerCase().replace(/[^a-z0-9]/g, '_')}.pine`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      if (content) {
        setCode(content);
        onCodeChange(content);
        setScriptName(file.name.replace(/\.[^/.]+$/, ''));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Line numbering
  const lineCount = code.split('\n').length;
  const lineNumbers = Array.from({ length: Math.max(lineCount, 16) }, (_, i) => i + 1);

  return (
    <div className="flex flex-col h-full bg-[#1e222d] text-[#d1d4dc] font-mono text-xs select-text">
      {/* Editor Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-3 py-1.5 bg-[#171b26] border-b border-[#2a2e39] gap-2 shrink-0">
        {/* Left: Script Name Input & Type */}
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-[#2962ff]" />
          <input
            type="text"
            value={scriptName}
            onChange={e => setScriptName(e.target.value)}
            className="bg-[#131722] text-white px-2.5 py-1 rounded border border-[#2a2e39] focus:border-[#2962ff] focus:outline-hidden font-medium text-xs w-48 sm:w-64"
            placeholder="Script Name"
          />
          <span className="text-[10px] text-[#787b86] px-1.5 py-0.5 rounded bg-[#2a2e39]/60 uppercase">
            {currentScript.type}
          </span>
        </div>

        {/* Center / Right: Action Buttons */}
        <div className="flex items-center gap-1.5">
          {/* Quick Template Selector */}
          <div className="relative flex items-center">
            <select
              onChange={e => {
                const found = BUILTIN_SCRIPTS.find(s => s.id === e.target.value);
                if (found) onSelectScript(found);
              }}
              value={currentScript.id}
              className="bg-[#2a2e39] hover:bg-[#363c4e] text-white px-2.5 py-1 rounded text-xs border border-[#363c4e] cursor-pointer focus:outline-hidden"
            >
              <option value="" disabled>Load Template...</option>
              {BUILTIN_SCRIPTS.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Save Script */}
          <button
            onClick={handleSave}
            title="Save script to local library (No limit, free forever)"
            className="flex items-center gap-1 px-2.5 py-1 bg-[#2a2e39] hover:bg-[#363c4e] text-white rounded transition-colors text-xs"
          >
            {showSaveSuccess ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-[#089981]" />
                <span className="text-[#089981]">Saved!</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5 text-[#787b86]" />
                <span className="hidden sm:inline">Save</span>
              </>
            )}
          </button>

          {/* Import / Export */}
          <label
            title="Import script file (.pine / .js / .txt)"
            className="flex items-center gap-1 px-2 py-1 bg-[#2a2e39] hover:bg-[#363c4e] text-white rounded transition-colors cursor-pointer text-xs"
          >
            <Upload className="w-3.5 h-3.5 text-[#787b86]" />
            <input type="file" accept=".pine,.js,.ts,.txt" onChange={handleImport} className="hidden" />
          </label>

          <button
            onClick={handleExport}
            title="Export script to file"
            className="p-1 bg-[#2a2e39] hover:bg-[#363c4e] text-white rounded transition-colors text-xs"
          >
            <Download className="w-3.5 h-3.5 text-[#787b86]" />
          </button>

          {/* Reference Docs / Cheat Sheet */}
          <button
            onClick={() => setShowCheatSheet(true)}
            title="Pine Script & TA Functions Guide"
            className="flex items-center gap-1 px-2.5 py-1 bg-[#2a2e39] hover:bg-[#363c4e] text-[#2962ff] rounded transition-colors text-xs"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Docs</span>
          </button>

          {/* Execute / Apply to Chart */}
          <button
            onClick={onRunScript}
            disabled={isExecuting}
            title="Add to chart and run backtest (Ctrl + Enter)"
            className="flex items-center gap-1.5 px-3 py-1 bg-[#2962ff] hover:bg-[#1e53e5] active:bg-[#1844be] text-white font-medium rounded transition-colors text-xs shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Apply & Run</span>
          </button>
        </div>
      </div>

      {/* Code Editor Body with Line Numbers */}
      <div className="flex-1 flex overflow-hidden relative font-mono text-[13px] leading-5">
        {/* Line Numbers Column */}
        <div className="w-12 py-3 bg-[#171b26] border-r border-[#2a2e39] text-[#505668] text-right pr-2.5 select-none shrink-0 overflow-hidden">
          {lineNumbers.map(num => (
            <div key={num} className="h-5">
              {num <= lineCount ? num : ''}
            </div>
          ))}
        </div>

        {/* Text Area */}
        <div className="flex-1 relative h-full bg-[#1e222d]">
          <textarea
            value={code}
            onChange={e => handleCodeChange(e.target.value)}
            onKeyDown={e => {
              // Quick execute hotkey: Ctrl + Enter / Cmd + Enter
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                onRunScript();
              }
              // Tab support
              if (e.key === 'Tab') {
                e.preventDefault();
                const start = e.currentTarget.selectionStart;
                const end = e.currentTarget.selectionEnd;
                const newCode = code.substring(0, start) + '  ' + code.substring(end);
                handleCodeChange(newCode);
                setTimeout(() => {
                  e.currentTarget.selectionStart = e.currentTarget.selectionEnd = start + 2;
                }, 0);
              }
            }}
            spellCheck={false}
            className="w-full h-full p-3 bg-transparent text-[#e0e3eb] font-mono resize-none focus:outline-hidden whitespace-pre overflow-auto"
            placeholder="Write your Pine Script or JavaScript strategy/indicator..."
          />
        </div>
      </div>

      {/* Bottom Status & Diagnostics Bar */}
      <div className="px-3 py-1.5 bg-[#171b26] border-t border-[#2a2e39] text-[11px] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 overflow-hidden">
          {compilationError ? (
            <div className="flex items-center gap-1.5 text-[#f23645] truncate">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span className="font-semibold">Error:</span>
              <span className="truncate">{compilationError}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[#089981]">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Ready. Press Ctrl+Enter to apply to chart.</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 text-[#787b86] shrink-0">
          <span>Lines: {lineCount}</span>
          <span>Chars: {code.length}</span>
        </div>
      </div>

      {/* Pine Script Quick Reference Modal */}
      {showCheatSheet && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#1e222d] border border-[#2a2e39] rounded-lg max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2e39]">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#2962ff]" />
                <h3 className="text-sm font-semibold text-white">Pine Script & TA Functions Guide</h3>
              </div>
              <button
                onClick={() => setShowCheatSheet(false)}
                className="text-[#787b86] hover:text-white px-2 py-0.5 rounded hover:bg-[#2a2e39]"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 text-xs font-sans text-[#d1d4dc]">
              <div>
                <h4 className="font-semibold text-white mb-1.5">Built-in Price Series:</h4>
                <div className="grid grid-cols-2 gap-2 font-mono text-[11px] bg-[#171b26] p-2.5 rounded border border-[#2a2e39]">
                  <div><span className="text-[#2962ff]">open</span> - Opening price array</div>
                  <div><span className="text-[#2962ff]">high</span> - Highest price array</div>
                  <div><span className="text-[#2962ff]">low</span> - Lowest price array</div>
                  <div><span className="text-[#2962ff]">close</span> - Closing price array</div>
                  <div><span className="text-[#2962ff]">volume</span> - Trade volume array</div>
                  <div><span className="text-[#2962ff]">candles</span> - Full array of OHLCV objects</div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-1.5">Technical Analysis (ta.*) Library:</h4>
                <div className="space-y-1.5 font-mono text-[11px] bg-[#171b26] p-2.5 rounded border border-[#2a2e39]">
                  <div><span className="text-[#e040fb]">ta.sma(source, length)</span> - Simple Moving Average</div>
                  <div><span className="text-[#e040fb]">ta.ema(source, length)</span> - Exponential Moving Average</div>
                  <div><span className="text-[#e040fb]">ta.rsi(source, length = 14)</span> - Relative Strength Index</div>
                  <div><span className="text-[#e040fb]">ta.macd(source, 12, 26, 9)</span> - MACD (returns &#123; macd, signal, histogram &#125;)</div>
                  <div><span className="text-[#e040fb]">ta.bb(source, length, mult)</span> - Bollinger Bands (returns &#123; upper, basis, lower &#125;)</div>
                  <div><span className="text-[#e040fb]">ta.atr(length = 14)</span> - Average True Range</div>
                  <div><span className="text-[#e040fb]">ta.supertrend(factor = 3, atrPeriod = 10)</span> - SuperTrend &#123; trend, direction &#125;</div>
                  <div><span className="text-[#e040fb]">ta.crossover(seriesA, seriesB, index)</span> - Returns true if A crossed above B</div>
                  <div><span className="text-[#e040fb]">ta.crossunder(seriesA, seriesB, index)</span> - Returns true if A crossed below B</div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-1.5">Strategy Backtesting Functions:</h4>
                <div className="space-y-1.5 font-mono text-[11px] bg-[#171b26] p-2.5 rounded border border-[#2a2e39]">
                  <div><span className="text-[#089981]">strategy.entry(&quot;Long&quot;, strategy.long, i)</span> - Enter Long trade</div>
                  <div><span className="text-[#f23645]">strategy.close(&quot;Long&quot;, i, &quot;Reason&quot;)</span> - Exit Long trade</div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-1.5">Plotting Functions:</h4>
                <div className="space-y-1.5 font-mono text-[11px] bg-[#171b26] p-2.5 rounded border border-[#2a2e39]">
                  <div><span className="text-[#ff9800]">plot(series, &quot;Title&quot;, &quot;#2962FF&quot;, 2, &quot;main&quot;)</span> - Plot on main chart</div>
                  <div><span className="text-[#ff9800]">plot(series, &quot;Title&quot;, &quot;#7E57C2&quot;, 2, &quot;sub&quot;)</span> - Plot on sub-window (RSI/MACD)</div>
                  <div><span className="text-[#ff9800]">hline(value, &quot;Title&quot;, &quot;#787B86&quot;, &quot;sub&quot;)</span> - Draw horizontal line</div>
                </div>
              </div>
            </div>

            <div className="p-3 border-t border-[#2a2e39] flex justify-end">
              <button
                onClick={() => setShowCheatSheet(false)}
                className="px-4 py-1.5 bg-[#2962ff] text-white rounded text-xs font-medium hover:bg-[#1e53e5]"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
