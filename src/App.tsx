import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Sliders,
  Code2,
  BarChart3,
  Terminal,
  UploadCloud,
  ChevronDown,
  Maximize2,
  Minimize2,
  RefreshCw,
} from 'lucide-react';
import {
  Candle,
  CompilationResult,
  ScriptItem,
  BacktestSettings,
  Timeframe,
  AppliedIndicator,
  IndicatorParam,
} from './types/trading';
import {
  POPULAR_SYMBOLS,
  TIMEFRAMES,
  fetchMarketCandles,
  subscribeRealtimeCandles,
} from './services/marketData';
import { BUILTIN_SCRIPTS } from './services/defaultScripts';
import { executeAppliedIndicators } from './services/pineEngine';
import { TradingChart } from './components/TradingChart';
import { PineEditor } from './components/PineEditor';
import { StrategyTester } from './components/StrategyTester';
import { ScriptLibraryModal } from './components/ScriptLibraryModal';
import { DataUploadModal } from './components/DataUploadModal';
import { IndicatorSettingsModal } from './components/IndicatorSettingsModal';

const USER_SCRIPTS_STORAGE_KEY = 'pinestudio_user_scripts_v2';
const APPLIED_INDICATORS_STORAGE_KEY = 'pinestudio_applied_indicators_v2';

// Helper to create applied indicator configuration with inputs
function createAppliedIndicatorFromScript(script: ScriptItem): AppliedIndicator {
  let params: IndicatorParam[] = [];
  let color = '#2962ff';

  if (script.id === 'ema-cross-strategy') {
    params = [
      { key: 'fastPeriod', label: 'Быстрый период EMA', type: 'number', value: 9, min: 1, max: 200 },
      { key: 'slowPeriod', label: 'Медленный период EMA', type: 'number', value: 21, min: 1, max: 500 },
    ];
    color = '#2962ff';
  } else if (script.id === 'rsi-mean-reversion') {
    params = [
      { key: 'rsiPeriod', label: 'Период RSI', type: 'number', value: 14, min: 2, max: 100 },
      { key: 'oversold', label: 'Уровень перепроданности', type: 'number', value: 32, min: 1, max: 50 },
      { key: 'overbought', label: 'Уровень перекупленности', type: 'number', value: 68, min: 50, max: 99 },
    ];
    color = '#7e57c2';
  } else if (script.id === 'bollinger-bands-strategy') {
    params = [
      { key: 'length', label: 'Период полос (Длина)', type: 'number', value: 20, min: 2, max: 200 },
      { key: 'multiplier', label: 'Множитель ст. откл.', type: 'number', value: 2, min: 0.5, max: 5, step: 0.5 },
    ];
    color = '#ff9800';
  } else if (script.id === 'supertrend-strategy') {
    params = [
      { key: 'factor', label: 'Множитель (Factor)', type: 'number', value: 3, min: 1, max: 10 },
      { key: 'atrPeriod', label: 'Период ATR', type: 'number', value: 10, min: 2, max: 100 },
    ];
    color = '#089981';
  } else if (script.id === 'macd-momentum-strategy') {
    params = [
      { key: 'fastPeriod', label: 'Быстрый период (12)', type: 'number', value: 12, min: 2, max: 100 },
      { key: 'slowPeriod', label: 'Медленный период (26)', type: 'number', value: 26, min: 2, max: 200 },
      { key: 'signalPeriod', label: 'Сигнальный период (9)', type: 'number', value: 9, min: 1, max: 50 },
    ];
    color = '#2962ff';
  } else {
    // Detect constants from script
    const matches = script.code.matchAll(/const\s+([a-zA-Z0-9_]+)\s*=\s*([0-9.]+);/g);
    for (const match of matches) {
      params.push({
        key: match[1],
        label: match[1],
        type: 'number',
        value: parseFloat(match[2]),
      });
    }
  }

  return {
    id: `applied_${script.id}_${Date.now()}`,
    scriptId: script.id,
    name: script.name,
    type: script.type,
    code: script.code,
    visible: true,
    params,
    color,
    lineWidth: 2,
  };
}

export default function App() {
  // Market Data State
  const [symbol, setSymbol] = useState<string>('BTC/USDT');
  const [timeframe, setTimeframe] = useState<Timeframe>('1h');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [isLoadingCandles, setIsLoadingCandles] = useState<boolean>(true);

  // Script Library State
  const [scripts, setScripts] = useState<ScriptItem[]>(() => {
    try {
      const saved = localStorage.getItem(USER_SCRIPTS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const customScripts = parsed.filter((s: ScriptItem) => !s.isBuiltin);
          return [...BUILTIN_SCRIPTS, ...customScripts];
        }
      }
    } catch {
      // ignore
    }
    return BUILTIN_SCRIPTS;
  });

  const [activeScript, setActiveScript] = useState<ScriptItem>(() => {
    return BUILTIN_SCRIPTS[0];
  });

  // Applied Indicators on Chart (Stored in localStorage so deleted indicators stay deleted!)
  const [appliedIndicators, setAppliedIndicators] = useState<AppliedIndicator[]>(() => {
    try {
      const saved = localStorage.getItem(APPLIED_INDICATORS_STORAGE_KEY);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed; // Can be [] if user deleted them all!
        }
      }
    } catch {
      // ignore
    }
    // Default initial setup only on brand new session
    return [createAppliedIndicatorFromScript(BUILTIN_SCRIPTS[0])];
  });

  // Selected Indicator for Settings Modal
  const [selectedIndicatorForSettings, setSelectedIndicatorForSettings] = useState<AppliedIndicator | null>(null);

  // Bottom Panel State
  const [isBottomOpen, setIsBottomOpen] = useState<boolean>(true);
  const [bottomTab, setBottomTab] = useState<'editor' | 'tester' | 'console'>('editor');
  const [bottomHeight, setBottomHeight] = useState<number>(360);

  // Modals
  const [isLibraryOpen, setIsLibraryOpen] = useState<boolean>(false);
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);

  // Backtest Settings
  const [backtestSettings, setBacktestSettings] = useState<BacktestSettings>({
    initialCapital: 10000,
    commissionPercent: 0.075,
    slippagePercent: 0.02,
    orderSizePercent: 100,
    pyramiding: 1,
  });

  // Execution & Compilation Results
  const [compilationResult, setCompilationResult] = useState<CompilationResult>({
    success: true,
    plots: [],
    markers: [],
    logs: [],
  });
  const [isExecuting, setIsExecuting] = useState<boolean>(false);

  // Save applied indicators to localStorage
  const persistAppliedIndicators = (newList: AppliedIndicator[]) => {
    setAppliedIndicators(newList);
    try {
      localStorage.setItem(APPLIED_INDICATORS_STORAGE_KEY, JSON.stringify(newList));
    } catch {
      // ignore
    }
  };

  // Save scripts to localStorage
  const saveUserScriptsToStorage = (updatedList: ScriptItem[]) => {
    setScripts(updatedList);
    try {
      localStorage.setItem(USER_SCRIPTS_STORAGE_KEY, JSON.stringify(updatedList));
    } catch {
      // ignore
    }
  };

  // Re-run execution for all active applied indicators
  const recalculateIndicators = useCallback(
    (indicatorsList: AppliedIndicator[], marketCandles: Candle[]) => {
      if (!marketCandles || marketCandles.length === 0) return;

      if (indicatorsList.length === 0) {
        setCompilationResult({
          success: true,
          plots: [],
          markers: [],
          logs: [],
          report: undefined,
        });
        return;
      }

      setIsExecuting(true);
      try {
        const result = executeAppliedIndicators(indicatorsList, marketCandles, backtestSettings);
        setCompilationResult(result);
      } catch (err: unknown) {
        setCompilationResult({
          success: false,
          error: err instanceof Error ? err.message : String(err),
          plots: [],
          markers: [],
          logs: [],
        });
      } finally {
        setIsExecuting(false);
      }
    },
    [backtestSettings]
  );

  // Load Market Candles
  const loadCandles = useCallback(async (sym: string, tf: Timeframe) => {
    setIsLoadingCandles(true);
    try {
      const data = await fetchMarketCandles(sym, tf, 200);
      setCandles(data);
      // Immediately calculate applied indicators on the newly fetched candles
      recalculateIndicators(appliedIndicators, data);
    } catch {
      // ignore
    } finally {
      setIsLoadingCandles(false);
    }
  }, [appliedIndicators, recalculateIndicators]);

  useEffect(() => {
    loadCandles(symbol, timeframe);
  }, [symbol, timeframe, loadCandles]);

  // Real-time WebSocket live candle streaming (updates forming candle every second)
  useEffect(() => {
    const unsubscribe = subscribeRealtimeCandles(symbol, timeframe, (liveCandle) => {
      setCandles(prev => {
        if (!prev || prev.length === 0) return prev;
        const lastIndex = prev.length - 1;
        const last = prev[lastIndex];

        if (liveCandle.time === last.time) {
          // Dynamic update of current open candle
          const updated = [...prev];
          updated[lastIndex] = {
            ...last,
            high: Math.max(last.high, liveCandle.high),
            low: Math.min(last.low, liveCandle.low),
            close: liveCandle.close,
            volume: liveCandle.volume,
          };
          return updated;
        } else if (liveCandle.time > last.time) {
          // New candle tick
          return [...prev, liveCandle];
        }
        return prev;
      });
    });

    return () => {
      unsubscribe();
    };
  }, [symbol, timeframe]);

  // Historical pagination: load earlier candles before oldest candle
  const [isLoadingEarlier, setIsLoadingEarlier] = useState<boolean>(false);
  const handleLoadEarlierData = useCallback(async () => {
    if (isLoadingEarlier || candles.length === 0) return;
    setIsLoadingEarlier(true);
    const oldestTimestamp = candles[0].time;
    try {
      const older = await fetchMarketCandles(symbol, timeframe, 200, oldestTimestamp);
      if (older && older.length > 0) {
        const existingTimes = new Set(candles.map(c => c.time));
        const newOlder = older.filter(c => !existingTimes.has(c.time));
        if (newOlder.length > 0) {
          const merged = [...newOlder, ...candles].sort((a, b) => a.time - b.time);
          setCandles(merged);
          recalculateIndicators(appliedIndicators, merged);
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingEarlier(false);
    }
  }, [candles, symbol, timeframe, appliedIndicators, recalculateIndicators, isLoadingEarlier]);

  // Handle Code Change in Editor
  const handleCodeChange = (newCode: string) => {
    setActiveScript(prev => ({
      ...prev,
      code: newCode,
      lastModified: Date.now(),
    }));

    // If active script is in applied indicators, update its code
    const exists = appliedIndicators.some(ind => ind.scriptId === activeScript.id);
    if (exists) {
      const updated = appliedIndicators.map(ind =>
        ind.scriptId === activeScript.id ? { ...ind, code: newCode } : ind
      );
      persistAppliedIndicators(updated);
    }
  };

  // Handle Save Script
  const handleSaveScript = (name: string, code: string) => {
    const existingIndex = scripts.findIndex(s => s.id === activeScript.id);

    if (existingIndex !== -1 && !activeScript.isBuiltin) {
      const updated = [...scripts];
      updated[existingIndex] = {
        ...updated[existingIndex],
        name,
        code,
        lastModified: Date.now(),
      };
      saveUserScriptsToStorage(updated);
      setActiveScript(updated[existingIndex]);
    } else {
      const newScript: ScriptItem = {
        id: `custom_${Date.now()}`,
        name,
        type: activeScript.type,
        code,
        description: 'User saved script',
        isBuiltin: false,
        lastModified: Date.now(),
      };
      const updated = [...scripts, newScript];
      saveUserScriptsToStorage(updated);
      setActiveScript(newScript);
    }
  };

  // Run / Apply Active Script from Pine Editor
  const handleRunActiveScript = () => {
    // If active script is not yet applied, add it
    const existingIdx = appliedIndicators.findIndex(i => i.scriptId === activeScript.id);
    let updated: AppliedIndicator[];

    if (existingIdx !== -1) {
      updated = appliedIndicators.map(i =>
        i.scriptId === activeScript.id ? { ...i, code: activeScript.code, visible: true } : i
      );
    } else {
      const newApplied = createAppliedIndicatorFromScript(activeScript);
      updated = [...appliedIndicators, newApplied];
    }

    persistAppliedIndicators(updated);
    recalculateIndicators(updated, candles);
  };

  // Handle Select Script (from template dropdown or library)
  const handleSelectScript = (script: ScriptItem) => {
    setActiveScript(script);

    // Add or activate in applied indicators
    const existingIdx = appliedIndicators.findIndex(i => i.scriptId === script.id);
    let updated: AppliedIndicator[];

    if (existingIdx !== -1) {
      updated = appliedIndicators.map(i =>
        i.scriptId === script.id ? { ...i, visible: true } : i
      );
    } else {
      const newApplied = createAppliedIndicatorFromScript(script);
      updated = [...appliedIndicators, newApplied];
    }

    persistAppliedIndicators(updated);
    recalculateIndicators(updated, candles);
  };

  // Handle Create New Script
  const handleCreateNewScript = (type: 'strategy' | 'indicator') => {
    const newScript: ScriptItem = {
      id: `custom_${Date.now()}`,
      name: type === 'strategy' ? 'My Custom Strategy' : 'My Custom Indicator',
      type,
      code:
        type === 'strategy'
          ? BUILTIN_SCRIPTS.find(s => s.id === 'custom-blank-strategy')?.code || ''
          : `// Custom Indicator\nconst myEMA = ta.ema(close, 20);\nplot(myEMA, "EMA 20", "#2962FF", 2, "main");`,
      description: 'Custom user script',
      isBuiltin: false,
      lastModified: Date.now(),
    };
    const updated = [...scripts, newScript];
    saveUserScriptsToStorage(updated);
    setActiveScript(newScript);

    const newApplied = createAppliedIndicatorFromScript(newScript);
    const updatedApplied = [...appliedIndicators, newApplied];
    persistAppliedIndicators(updatedApplied);
    recalculateIndicators(updatedApplied, candles);

    setIsBottomOpen(true);
    setBottomTab('editor');
  };

  // Handle Delete Script from Library
  const handleDeleteScript = (id: string) => {
    const updated = scripts.filter(s => s.id !== id);
    saveUserScriptsToStorage(updated);

    // Also remove from applied indicators if present
    const updatedApplied = appliedIndicators.filter(i => i.scriptId !== id);
    persistAppliedIndicators(updatedApplied);
    recalculateIndicators(updatedApplied, candles);

    if (activeScript.id === id) {
      setActiveScript(BUILTIN_SCRIPTS[0]);
    }
  };

  // Handle Custom Data Upload
  const handleCustomDataLoaded = (newCandles: Candle[], assetName: string) => {
    setSymbol(assetName);
    setCandles(newCandles);
    recalculateIndicators(appliedIndicators, newCandles);
  };

  // --- On-Chart Indicator Actions (Eye, Gear, Code, Trash) ---

  // 1. Toggle Visibility (Eye)
  const handleToggleIndicatorVisibility = (id: string) => {
    const updated = appliedIndicators.map(ind =>
      ind.id === id ? { ...ind, visible: !ind.visible } : ind
    );
    persistAppliedIndicators(updated);
    recalculateIndicators(updated, candles);
  };

  // 2. Open Settings (Gear)
  const handleOpenIndicatorSettings = (indicator: AppliedIndicator) => {
    setSelectedIndicatorForSettings(indicator);
  };

  // 3. Open Source Code ({ }) - Tooltip: "Исходный код"
  const handleOpenIndicatorCode = (indicator: AppliedIndicator) => {
    const matchingScript = scripts.find(s => s.id === indicator.scriptId);
    if (matchingScript) {
      setActiveScript(matchingScript);
    }
    setIsBottomOpen(true);
    setBottomTab('editor');
  };

  // 4. Remove Indicator (Trash) - CRITICAL: Persistent deletion!
  const handleRemoveIndicator = (id: string) => {
    const updated = appliedIndicators.filter(ind => ind.id !== id);
    // Persist to localStorage so it stays deleted even across symbol switches & reloads
    persistAppliedIndicators(updated);
    recalculateIndicators(updated, candles);
  };

  // 5. Apply Settings from Modal (Gear -> OK)
  const handleApplyIndicatorSettings = (
    indicatorId: string,
    newParams: IndicatorParam[],
    newColor: string,
    newLineWidth: number
  ) => {
    const updated = appliedIndicators.map(ind => {
      if (ind.id !== indicatorId) return ind;

      let updatedCode = ind.code;
      newParams.forEach(p => {
        const regex = new RegExp(`(const|let|var)\\s+${p.key}\\s*=\\s*[0-9.]+;`, 'g');
        updatedCode = updatedCode.replace(regex, `$1 ${p.key} = ${p.value};`);
      });

      updatedCode = updatedCode.replace(/plot\(([^,]+),\s*"([^"]+)",\s*"#[0-9a-fA-F]{6}"/g, `plot($1, "$2", "${newColor}"`);

      return {
        ...ind,
        params: newParams,
        color: newColor,
        lineWidth: newLineWidth,
        code: updatedCode,
      };
    });

    persistAppliedIndicators(updated);

    // Sync with active script if open in editor
    const target = updated.find(i => i.id === indicatorId);
    if (target && activeScript.id === target.scriptId) {
      setActiveScript(prev => ({
        ...prev,
        code: target.code,
        lastModified: Date.now(),
      }));
    }

    recalculateIndicators(updated, candles);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#131722] text-[#d1d4dc]">
      {/* Top Bar Contract (1 row, 3 clean zones) */}
      <header className="flex items-center justify-between px-3 py-2 bg-[#171b26] border-b border-[#2a2e39] gap-4 shrink-0 z-20">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
          <Activity className="w-5 h-5 text-[#2962ff]" />
          <span className="text-sm font-bold tracking-tight text-white">PineStudio</span>
          <span className="hidden sm:inline text-[11px] text-[#787b86]">/ Open TradingView &amp; Pine Backtester</span>
        </div>

        {/* Zone 2: Navigation & Chart Selection Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Symbol Dropdown */}
          <div className="relative">
            <select
              value={symbol}
              onChange={e => setSymbol(e.target.value)}
              className="bg-[#1e222d] text-white font-semibold text-xs px-2.5 py-1.5 rounded border border-[#2a2e39] hover:border-[#363c4e] focus:border-[#2962ff] focus:outline-hidden cursor-pointer"
            >
              {POPULAR_SYMBOLS.map(item => (
                <option key={item.symbol} value={item.symbol}>
                  {item.symbol} · {item.name}
                </option>
              ))}
            </select>
          </div>

          {/* Timeframe Selector Tabs */}
          <div className="hidden md:flex items-center gap-0.5 bg-[#1e222d] p-0.5 rounded border border-[#2a2e39]">
            {TIMEFRAMES.map(tf => (
              <button
                key={tf.value}
                onClick={() => setTimeframe(tf.value)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  timeframe === tf.value
                    ? 'bg-[#2962ff] text-white font-medium'
                    : 'text-[#787b86] hover:text-white'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* Indicator & Strategy Library Modal Trigger */}
          <button
            onClick={() => setIsLibraryOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e222d] hover:bg-[#2a2e39] text-white rounded text-xs border border-[#2a2e39] transition-colors"
          >
            <Sliders className="w-3.5 h-3.5 text-[#2962ff]" />
            <span className="hidden sm:inline">Indicators &amp; Strategies</span>
            {appliedIndicators.length > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-[#2962ff]/20 text-[#2962ff]">
                {appliedIndicators.length}
              </span>
            )}
          </button>

          {/* Custom CSV Upload */}
          <button
            onClick={() => setIsUploadOpen(true)}
            title="Import custom CSV candles"
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#1e222d] hover:bg-[#2a2e39] text-[#787b86] hover:text-white rounded text-xs border border-[#2a2e39] transition-colors"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Upload CSV</span>
          </button>

          {/* Refresh Market Data */}
          <button
            onClick={() => loadCandles(symbol, timeframe)}
            title="Refresh Candles"
            className="p-1.5 text-[#787b86] hover:text-white hover:bg-[#2a2e39] rounded border border-[#2a2e39] transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCandles ? 'animate-spin text-[#2962ff]' : ''}`} />
          </button>
        </div>

        {/* Zone 3: Primary Action (Toggle Pine Editor & Backtester Panel) */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsBottomOpen(prev => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
              isBottomOpen
                ? 'bg-[#2962ff] text-white shadow-xs'
                : 'bg-[#1e222d] text-white border border-[#2a2e39] hover:bg-[#2a2e39]'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Pine Editor &amp; Tester</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${isBottomOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </header>

      {/* Main Workspace: Chart + Collapsible Bottom Panel */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Top: TradingView Chart */}
        <div className="flex-1 w-full min-h-[240px] relative overflow-hidden">
          <TradingChart
            candles={candles}
            symbol={symbol}
            timeframe={timeframe}
            plots={compilationResult.plots}
            markers={compilationResult.markers}
            isLoading={isLoadingCandles}
            isLoadingEarlier={isLoadingEarlier}
            appliedIndicators={appliedIndicators}
            onToggleIndicatorVisibility={handleToggleIndicatorVisibility}
            onOpenIndicatorSettings={handleOpenIndicatorSettings}
            onOpenIndicatorCode={handleOpenIndicatorCode}
            onRemoveIndicator={handleRemoveIndicator}
            onOpenLibrary={() => setIsLibraryOpen(true)}
            onLoadEarlierData={handleLoadEarlierData}
          />
        </div>

        {/* Bottom Collapsible Panel: Pine Editor, Strategy Tester, Console */}
        {isBottomOpen && (
          <div
            style={{ height: `${bottomHeight}px` }}
            className="flex flex-col bg-[#1e222d] border-t border-[#2a2e39] shrink-0 transition-all z-10"
          >
            {/* Panel Tabs Header */}
            <div className="flex items-center justify-between px-3 py-1 bg-[#171b26] border-b border-[#2a2e39] shrink-0">
              <div className="flex items-center gap-1">
                {/* Pine Editor Tab */}
                <button
                  onClick={() => setBottomTab('editor')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                    bottomTab === 'editor'
                      ? 'bg-[#2a2e39] text-white'
                      : 'text-[#787b86] hover:text-white'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5 text-[#2962ff]" />
                  <span>Pine Editor</span>
                </button>

                {/* Strategy Tester Tab */}
                <button
                  onClick={() => setBottomTab('tester')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                    bottomTab === 'tester'
                      ? 'bg-[#2a2e39] text-white'
                      : 'text-[#787b86] hover:text-white'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5 text-[#089981]" />
                  <span>Strategy Tester</span>
                  {compilationResult.report && (
                    <span
                      className={`text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded ${
                        compilationResult.report.netProfit >= 0
                          ? 'bg-[#089981]/20 text-[#089981]'
                          : 'bg-[#f23645]/20 text-[#f23645]'
                      }`}
                    >
                      {compilationResult.report.netProfit >= 0 ? '+' : ''}
                      {compilationResult.report.netProfitPercent}%
                    </span>
                  )}
                </button>

                {/* Console / Logs Tab */}
                <button
                  onClick={() => setBottomTab('console')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                    bottomTab === 'console'
                      ? 'bg-[#2a2e39] text-white'
                      : 'text-[#787b86] hover:text-white'
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5 text-[#787b86]" />
                  <span>Logs</span>
                  {compilationResult.logs && compilationResult.logs.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#131722] text-[#787b86] font-mono">
                      {compilationResult.logs.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Panel Size Controls */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setBottomHeight(h => (h === 480 ? 320 : 480))}
                  title={bottomHeight === 480 ? 'Shrink Panel' : 'Expand Panel'}
                  className="p-1 text-[#787b86] hover:text-white hover:bg-[#2a2e39] rounded transition-colors text-xs"
                >
                  {bottomHeight === 480 ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => setIsBottomOpen(false)}
                  title="Close Panel"
                  className="p-1 text-[#787b86] hover:text-white hover:bg-[#2a2e39] rounded transition-colors text-xs"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Panel Tab Content */}
            <div className="flex-1 overflow-hidden relative">
              {bottomTab === 'editor' && (
                <PineEditor
                  currentScript={activeScript}
                  onCodeChange={handleCodeChange}
                  onRunScript={handleRunActiveScript}
                  onSaveScript={handleSaveScript}
                  onSelectScript={handleSelectScript}
                  isExecuting={isExecuting}
                  compilationError={compilationResult.error}
                  compilationLogs={compilationResult.logs}
                />
              )}

              {bottomTab === 'tester' && (
                <StrategyTester
                  report={compilationResult.report}
                  settings={backtestSettings}
                  onUpdateSettings={setBacktestSettings}
                  onReRunBacktest={handleRunActiveScript}
                />
              )}

              {bottomTab === 'console' && (
                <div className="h-full p-4 font-mono text-xs overflow-y-auto bg-[#131722] text-[#d1d4dc] space-y-1">
                  <div className="text-[#787b86] pb-2 border-b border-[#2a2e39]">
                    PineStudio Runtime Execution Output &amp; Diagnostics
                  </div>
                  {compilationResult.error && (
                    <div className="text-[#f23645] bg-[#f23645]/10 p-2 rounded border border-[#f23645]/30">
                      [Error] {compilationResult.error}
                    </div>
                  )}
                  {compilationResult.logs && compilationResult.logs.length > 0 ? (
                    compilationResult.logs.map((log, index) => (
                      <div key={index} className="text-[#787b86]">
                        <span className="text-[#2962ff]">[{index + 1}]</span> {log}
                      </div>
                    ))
                  ) : (
                    <div className="text-[#505668] py-4">No log output generated. Use log(...) inside your script to print debug values.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Script Library Modal */}
      <ScriptLibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        scripts={scripts}
        currentScriptId={activeScript.id}
        onSelectScript={handleSelectScript}
        onCreateNewScript={handleCreateNewScript}
        onDeleteScript={handleDeleteScript}
      />

      {/* Custom Data Upload Modal */}
      <DataUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onDataLoaded={handleCustomDataLoaded}
      />

      {/* Indicator Settings Modal (Gear Dialog) */}
      <IndicatorSettingsModal
        indicator={selectedIndicatorForSettings}
        isOpen={Boolean(selectedIndicatorForSettings)}
        onClose={() => setSelectedIndicatorForSettings(null)}
        onApplySettings={handleApplyIndicatorSettings}
      />
    </div>
  );
}
