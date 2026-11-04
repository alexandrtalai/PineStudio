import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  ColorType,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  createSeriesMarkers,
  IChartApi,
  ISeriesApi,
  Time,
  UTCTimestamp,
  SeriesMarker,
  ISeriesMarkersPluginApi,
} from 'lightweight-charts';
import { Candle, IndicatorPlot, TradeMarker, AppliedIndicator } from '../types/trading';
import {
  Maximize2,
  BarChart2,
  Eye,
  EyeOff,
  Settings,
  Trash2,
  ChevronUp,
  ChevronDown,
  ZoomIn,
  ZoomOut,
  Plus,
} from 'lucide-react';

interface TradingChartProps {
  candles: Candle[];
  symbol: string;
  timeframe: string;
  plots: IndicatorPlot[];
  markers: TradeMarker[];
  isLoading?: boolean;
  isLoadingEarlier?: boolean;
  appliedIndicators: AppliedIndicator[];
  onToggleIndicatorVisibility: (id: string) => void;
  onOpenIndicatorSettings: (indicator: AppliedIndicator) => void;
  onOpenIndicatorCode: (indicator: AppliedIndicator) => void;
  onRemoveIndicator: (id: string) => void;
  onOpenLibrary?: () => void;
  onLoadEarlierData?: () => void;
}

export const TradingChart: React.FC<TradingChartProps> = ({
  candles,
  symbol,
  timeframe,
  plots,
  markers,
  isLoading = false,
  isLoadingEarlier = false,
  appliedIndicators,
  onToggleIndicatorVisibility,
  onOpenIndicatorSettings,
  onOpenIndicatorCode,
  onRemoveIndicator,
  onOpenLibrary,
  onLoadEarlierData,
}) => {
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const subContainerRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);

  const mainChartRef = useRef<IChartApi | null>(null);
  const subChartRef = useRef<IChartApi | null>(null);

  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const plotSeriesRefs = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
  const subPlotSeriesRefs = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const prevFirstTimeRef = useRef<number | null>(null);
  const prevSymbolRef = useRef<string>(symbol);
  const prevTimeframeRef = useRef<string>(timeframe);
  const lastCandlesCountRef = useRef<number>(0);
  const onLoadEarlierDataRef = useRef(onLoadEarlierData);
  onLoadEarlierDataRef.current = onLoadEarlierData;

  const [showVolume, setShowVolume] = useState(true);
  const [isLegendExpanded, setIsLegendExpanded] = useState(true);

  // Filter plots: if there are no applied indicators, plots are empty
  const activePlots = appliedIndicators.length === 0 ? [] : plots;
  const subPlots = activePlots.filter(p => p.pane === 'sub');
  const mainPlots = activePlots.filter(p => p.pane !== 'sub');
  const hasSubPane = subPlots.length > 0;

  // Zoom controls
  const handleZoom = useCallback((direction: 'in' | 'out') => {
    const chart = mainChartRef.current;
    if (!chart) return;
    const timeScale = chart.timeScale();
    const range = timeScale.getVisibleLogicalRange();
    if (!range) return;

    const barsCount = range.to - range.from;
    const factor = direction === 'in' ? 0.75 : 1.35;
    const newBarsCount = Math.max(6, Math.min(candles.length * 2, barsCount * factor));
    const diff = newBarsCount - barsCount;

    timeScale.setVisibleLogicalRange({
      from: range.from - diff / 2,
      to: range.to + diff / 2,
    });
  }, [candles.length]);

  // 1. Initialize Main Chart
  useEffect(() => {
    if (!mainContainerRef.current) return;

    if (mainChartRef.current) {
      mainChartRef.current.remove();
      mainChartRef.current = null;
      markersPluginRef.current = null;
    }

    const container = mainContainerRef.current;

    // Strict TradingView interactions: mouse wheel scaling and mouse dragging enabled
    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: '#131722' },
        textColor: '#787b86',
        fontSize: 12,
        fontFamily: "'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { color: 'rgba(42, 46, 57, 0.4)' },
        horzLines: { color: 'rgba(42, 46, 57, 0.4)' },
      },
      crosshair: {
        vertLine: { color: '#758696', width: 1, style: 3, labelBackgroundColor: '#2a2e39' },
        horzLine: { color: '#758696', width: 1, style: 3, labelBackgroundColor: '#2a2e39' },
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: { time: true, price: true },
        axisDoubleClickReset: { time: true, price: true },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
        ...({ mouseDrag: true } as Record<string, boolean>),
      },
      timeScale: {
        borderColor: '#2a2e39',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#2a2e39',
        autoScale: true,
      },
    });

    mainChartRef.current = chart;

    // Add Candlestick Series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#089981',
      downColor: '#f23645',
      borderVisible: false,
      wickUpColor: '#089981',
      wickDownColor: '#f23645',
    });
    candleSeriesRef.current = candleSeries;

    // Add Markers Plugin ONCE
    try {
      markersPluginRef.current = createSeriesMarkers(candleSeries, []);
    } catch {
      // ignore
    }

    // Add Volume Series
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });
    volumeSeriesRef.current = volumeSeries;

    // Zero-flicker ResizeObserver with threshold check (prevents infinite loop with crosshair)
    let lastW = 0;
    let lastH = 0;
    const handleResize = () => {
      if (!mainContainerRef.current || !mainChartRef.current) return;
      const w = mainContainerRef.current.clientWidth;
      const h = mainContainerRef.current.clientHeight;
      if (Math.abs(w - lastW) >= 1 || Math.abs(h - lastH) >= 1) {
        lastW = w;
        lastH = h;
        mainChartRef.current.applyOptions({ width: w, height: h });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Subscribe crosshair with direct DOM mutation (NO React setState, eliminating flicker)
    chart.subscribeCrosshairMove(param => {
      if (!legendRef.current) return;
      if (!param || !param.time || !param.seriesData) return;

      const candleData = param.seriesData.get(candleSeries) as {
        open?: number;
        high?: number;
        low?: number;
        close?: number;
      } | undefined;

      if (candleData && candleData.open !== undefined) {
        const o = candleData.open.toFixed(2);
        const h = candleData.high!.toFixed(2);
        const l = candleData.low!.toFixed(2);
        const c = candleData.close!.toFixed(2);
        const diff = (candleData.close! - candleData.open).toFixed(2);
        const sign = candleData.close! >= candleData.open ? '+' : '';
        const colorClass = candleData.close! >= candleData.open ? 'text-[#089981]' : 'text-[#f23645]';

        legendRef.current.innerHTML = `
          <span>O: <span class="text-[#d1d4dc]">${o}</span></span>
          <span>H: <span class="text-[#d1d4dc]">${h}</span></span>
          <span>L: <span class="text-[#d1d4dc]">${l}</span></span>
          <span>C: <span class="${colorClass}">${c}</span></span>
          <span class="${colorClass} font-semibold">${sign}${diff}</span>
        `;
      }
    });

    // Subscribe to range changes for automatic historical pagination when scrolling left
    chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
      if (range && range.from < 20 && onLoadEarlierDataRef.current) {
        onLoadEarlierDataRef.current();
      }
    });

    return () => {
      resizeObserver.disconnect();
      if (mainChartRef.current) {
        mainChartRef.current.remove();
        mainChartRef.current = null;
        markersPluginRef.current = null;
      }
    };
  }, []);

  // 2. Update Data and Plots on Main Chart
  useEffect(() => {
    if (!mainChartRef.current || !candleSeriesRef.current) return;
    if (!candles || candles.length === 0) return;

    // Filter duplicate timestamps & sort ascending
    const candleMap = new Map<number, Candle>();
    candles.forEach(c => {
      const cleanTime = Math.floor(c.time);
      if (!candleMap.has(cleanTime)) {
        candleMap.set(cleanTime, { ...c, time: cleanTime });
      }
    });

    const uniqueCandles = Array.from(candleMap.values()).sort((a, b) => a.time - b.time);
    const validTimes = new Set(uniqueCandles.map(c => c.time));
    const last = uniqueCandles[uniqueCandles.length - 1];

    const formattedCandles = uniqueCandles.map(c => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    const isSymbolOrTfChanged = symbol !== prevSymbolRef.current || timeframe !== prevTimeframeRef.current;
    const isLiveTick = !isSymbolOrTfChanged && uniqueCandles.length === lastCandlesCountRef.current && last !== undefined;

    if (isLiveTick && candleSeriesRef.current) {
      try {
        candleSeriesRef.current.update(formattedCandles[formattedCandles.length - 1]);
      } catch {
        candleSeriesRef.current.setData(formattedCandles);
      }
    } else {
      try {
        candleSeriesRef.current.setData(formattedCandles);
      } catch {
        // ignore
      }
    }

    // Default legend view
    if (last && legendRef.current) {
      const diff = (last.close - last.open).toFixed(2);
      const sign = last.close >= last.open ? '+' : '';
      const colorClass = last.close >= last.open ? 'text-[#089981]' : 'text-[#f23645]';
      legendRef.current.innerHTML = `
        <span>O: <span class="text-[#d1d4dc]">${last.open.toFixed(2)}</span></span>
        <span>H: <span class="text-[#d1d4dc]">${last.high.toFixed(2)}</span></span>
        <span>L: <span class="text-[#d1d4dc]">${last.low.toFixed(2)}</span></span>
        <span>C: <span class="${colorClass}">${last.close.toFixed(2)}</span></span>
        <span class="${colorClass} font-semibold">${sign}${diff}</span>
      `;
    }

    // Volume Series
    if (volumeSeriesRef.current) {
      if (showVolume) {
        if (isLiveTick) {
          const lastC = uniqueCandles[uniqueCandles.length - 1];
          const prevC = uniqueCandles.length > 1 ? uniqueCandles[uniqueCandles.length - 2] : null;
          const isUp = prevC ? lastC.close >= prevC.close : lastC.close >= lastC.open;
          try {
            volumeSeriesRef.current.update({
              time: lastC.time as UTCTimestamp,
              value: lastC.volume,
              color: isUp ? 'rgba(8, 153, 129, 0.28)' : 'rgba(242, 54, 69, 0.28)',
            });
          } catch {
            // fallback
          }
        } else {
          const formattedVolume = uniqueCandles.map((c, i) => {
            const isUp = i === 0 ? c.close >= c.open : c.close >= uniqueCandles[i - 1].close;
            return {
              time: c.time as UTCTimestamp,
              value: c.volume,
              color: isUp ? 'rgba(8, 153, 129, 0.28)' : 'rgba(242, 54, 69, 0.28)',
            };
          });
          volumeSeriesRef.current.setData(formattedVolume);
        }
      } else {
        volumeSeriesRef.current.setData([]);
      }
    }

    // Clear old main plots
    plotSeriesRefs.current.forEach(series => {
      try {
        mainChartRef.current?.removeSeries(series);
      } catch {
        // ignore
      }
    });
    plotSeriesRefs.current.clear();

    // Render active main indicator lines
    if (appliedIndicators.length > 0) {
      mainPlots.forEach(plot => {
        if (!mainChartRef.current) return;

        const lineSeries = mainChartRef.current.addSeries(LineSeries, {
          color: plot.color,
          lineWidth: (plot.lineWidth || 2) as 1 | 2 | 3 | 4,
          priceLineVisible: false,
          crosshairMarkerVisible: true,
          lastValueVisible: true,
          title: plot.name,
        });

        const lineData = plot.data
          .filter(p => validTimes.has(Math.floor(p.time)))
          .map(p => ({
            time: Math.floor(p.time) as UTCTimestamp,
            value: p.value,
          }))
          .sort((a, b) => (a.time as number) - (b.time as number));

        lineSeries.setData(lineData);
        plotSeriesRefs.current.set(plot.id, lineSeries);
      });
    }

    // Update trade markers
    if (markersPluginRef.current) {
      if (markers.length > 0 && appliedIndicators.length > 0) {
        const validMarkers: SeriesMarker<Time>[] = markers
          .filter(m => validTimes.has(Math.floor(m.time)))
          .map(m => ({
            time: Math.floor(m.time) as UTCTimestamp,
            position: m.position,
            color: m.color,
            shape: m.shape,
            text: m.text,
            id: m.id,
          }))
          .sort((a, b) => (a.time as number) - (b.time as number));

        try {
          markersPluginRef.current.setMarkers(validMarkers);
        } catch {
          // ignore
        }
      } else {
        try {
          markersPluginRef.current.setMarkers([]);
        } catch {
          // ignore
        }
      }
    }
    // Check if older candles were prepended (historical pagination)
    const isPrependingHistory =
      prevFirstTimeRef.current !== null &&
      uniqueCandles.length > 0 &&
      uniqueCandles[0].time < prevFirstTimeRef.current;

    if (isPrependingHistory) {
      const prependedCount = uniqueCandles.findIndex(c => c.time === prevFirstTimeRef.current);
      if (prependedCount > 0) {
        const currentRange = mainChartRef.current.timeScale().getVisibleLogicalRange();
        if (currentRange) {
          mainChartRef.current.timeScale().setVisibleLogicalRange({
            from: currentRange.from + prependedCount,
            to: currentRange.to + prependedCount,
          });
        }
      }
    } else if (isSymbolOrTfChanged || lastCandlesCountRef.current === 0) {
      // First load or symbol change ONLY
      mainChartRef.current.timeScale().fitContent();
    }
    // Note: on isLiveTick, we DO NOT call fitContent(), preserving user scroll and zoom!

    prevFirstTimeRef.current = uniqueCandles[0]?.time ?? null;
    prevSymbolRef.current = symbol;
    prevTimeframeRef.current = timeframe;
    lastCandlesCountRef.current = uniqueCandles.length;
  }, [candles, symbol, timeframe, mainPlots, markers, showVolume, appliedIndicators.length]);

  // 3. Initialize and synchronize Sub-Pane (RSI/MACD) with Strict 75% / 25% Ratio
  useEffect(() => {
    if (!hasSubPane || !subContainerRef.current || appliedIndicators.length === 0) {
      if (subChartRef.current) {
        subChartRef.current.remove();
        subChartRef.current = null;
      }
      return;
    }

    if (subChartRef.current) {
      subChartRef.current.remove();
      subChartRef.current = null;
    }

    const container = subContainerRef.current;
    const subChart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: '#131722' },
        textColor: '#787b86',
        fontSize: 11,
        fontFamily: "'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { color: 'rgba(42, 46, 57, 0.4)' },
        horzLines: { color: 'rgba(42, 46, 57, 0.4)' },
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: { time: true, price: true },
        axisDoubleClickReset: { time: true, price: true },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
        ...({ mouseDrag: true } as Record<string, boolean>),
      },
      timeScale: {
        borderColor: '#2a2e39',
        visible: false,
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: '#2a2e39',
        autoScale: true,
      },
    });

    subChartRef.current = subChart;
    subPlotSeriesRefs.current.clear();
    const validTimes = new Set(candles.map(c => Math.floor(c.time)));

    subPlots.forEach(plot => {
      const line = subChart.addSeries(LineSeries, {
        color: plot.color,
        lineWidth: (plot.lineWidth || 2) as 1 | 2 | 3 | 4,
        priceLineVisible: false,
        title: plot.name,
      });

      const lineData = plot.data
        .filter(p => validTimes.has(Math.floor(p.time)))
        .map(p => ({
          time: Math.floor(p.time) as UTCTimestamp,
          value: p.value,
        }))
        .sort((a, b) => (a.time as number) - (b.time as number));

      line.setData(lineData);
      subPlotSeriesRefs.current.set(plot.id, line);
    });

    // Guarded bidirectional time scale sync (avoids cyclic lock)
    if (mainChartRef.current) {
      const mainTimeScale = mainChartRef.current.timeScale();
      const subTimeScale = subChart.timeScale();
      let isSyncing = false;

      mainTimeScale.subscribeVisibleLogicalRangeChange(range => {
        if (isSyncing || !range) return;
        isSyncing = true;
        subTimeScale.setVisibleLogicalRange(range);
        isSyncing = false;
      });

      subTimeScale.subscribeVisibleLogicalRangeChange(range => {
        if (isSyncing || !range) return;
        isSyncing = true;
        mainTimeScale.setVisibleLogicalRange(range);
        isSyncing = false;
      });
    }

    let subLastW = 0;
    let subLastH = 0;
    const handleSubResize = () => {
      if (!subContainerRef.current || !subChartRef.current) return;
      const w = subContainerRef.current.clientWidth;
      const h = subContainerRef.current.clientHeight;
      if (Math.abs(w - subLastW) >= 1 || Math.abs(h - subLastH) >= 1) {
        subLastW = w;
        subLastH = h;
        subChartRef.current.applyOptions({ width: w, height: h });
      }
    };

    const resizeObserver = new ResizeObserver(handleSubResize);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (subChartRef.current) {
        subChartRef.current.remove();
        subChartRef.current = null;
      }
    };
  }, [hasSubPane, subPlots, candles, appliedIndicators.length]);

  return (
    <div className="relative flex flex-col w-full h-full bg-[#131722] border-b border-[#2a2e39] overflow-hidden select-none">
      {/* Top Bar Legend & Controls */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#171b26] border-b border-[#2a2e39] text-xs shrink-0 z-10">
        <div className="flex items-center gap-3 overflow-hidden text-nowrap">
          <div className="flex items-center gap-1.5 font-semibold text-white">
            <span>{symbol}</span>
            <span className="text-[#787b86] font-normal">{timeframe}</span>
          </div>

          {/* Direct DOM Legend container (updates without triggering React re-renders) */}
          <div
            ref={legendRef}
            className="hidden sm:flex items-center gap-2 font-mono text-[11px] text-[#787b86]"
          />
        </div>

        {/* Quick Chart Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => handleZoom('in')}
            title="Приблизить график (Zoom In)"
            className="p-1.5 text-[#787b86] hover:text-white hover:bg-[#2a2e39] rounded transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => handleZoom('out')}
            title="Отдалить график (Zoom Out)"
            className="p-1.5 text-[#787b86] hover:text-white hover:bg-[#2a2e39] rounded transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setShowVolume(prev => !prev)}
            title={showVolume ? 'Скрыть объем' : 'Показать объем'}
            className={`p-1.5 rounded transition-colors text-xs flex items-center gap-1 ${
              showVolume ? 'text-[#2962ff] bg-[#2962ff]/10' : 'text-[#787b86] hover:text-white'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Vol</span>
          </button>

          <button
            onClick={() => {
              mainChartRef.current?.timeScale().fitContent();
              subChartRef.current?.timeScale().fitContent();
            }}
            title="Сбросить масштаб (Fit Content)"
            className="p-1.5 text-[#787b86] hover:text-white hover:bg-[#2a2e39] rounded transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Candlestick Chart Area: Exactly 75% height when sub-pane exists, 100% when standalone */}
      <div
        ref={mainContainerRef}
        className="w-full relative cursor-crosshair tv-chart-pane"
        style={{
          height: hasSubPane ? '75%' : '100%',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          overflow: 'hidden',
          pointerEvents: 'auto',
        }}
      >
        {/* Floating Indicator Legend Overlay */}
        <div className="absolute top-2 left-3 z-20 flex flex-col gap-1 pointer-events-none">
          <div className="flex items-center gap-1.5 pointer-events-auto">
            {appliedIndicators.length > 0 ? (
              <>
                <button
                  onClick={() => setIsLegendExpanded(prev => !prev)}
                  className="p-0.5 text-[#787b86] hover:text-white bg-[#1e222d]/90 hover:bg-[#2a2e39] rounded border border-[#2a2e39] transition-colors"
                  title={isLegendExpanded ? 'Свернуть индикаторы' : 'Развернуть индикаторы'}
                >
                  {isLegendExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                <span className="text-[11px] font-medium text-[#787b86] bg-[#1e222d]/80 px-2 py-0.5 rounded border border-[#2a2e39]/60">
                  Индикаторы ({appliedIndicators.length})
                </span>
              </>
            ) : (
              <button
                onClick={onOpenLibrary}
                className="flex items-center gap-1 text-[11px] font-medium text-[#787b86] hover:text-white bg-[#1e222d]/90 hover:bg-[#2a2e39] px-2 py-1 rounded border border-[#2a2e39] shadow-xs transition-colors"
              >
                <Plus className="w-3 h-3 text-[#2962ff]" />
                <span>Добавить индикатор</span>
              </button>
            )}
          </div>

          {/* Indicator Cards List */}
          {isLegendExpanded && appliedIndicators.length > 0 && (
            <div className="flex flex-col gap-1 mt-0.5">
              {appliedIndicators.map(indicator => (
                <div
                  key={indicator.id}
                  className="group pointer-events-auto flex items-center gap-1.5 px-2.5 py-1 bg-[#1e222d]/95 hover:bg-[#1e222d] backdrop-blur-xs rounded border border-[#2a2e39] shadow-md transition-all"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: indicator.color }}
                  />
                  <span className={`text-[11px] font-semibold tracking-tight truncate max-w-[150px] sm:max-w-[200px] ${
                    indicator.visible ? 'text-white' : 'text-[#787b86] line-through'
                  }`}>
                    {indicator.name}
                  </span>

                  <div className="flex items-center gap-0.5 ml-1">
                    <button
                      onClick={() => onToggleIndicatorVisibility(indicator.id)}
                      title={indicator.visible ? 'Скрыть индикатор' : 'Показать индикатор'}
                      className="p-1 text-[#787b86] hover:text-white hover:bg-[#2a2e39] rounded transition-colors"
                    >
                      {indicator.visible ? (
                        <Eye className="w-3.5 h-3.5" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5 text-[#f23645]" />
                      )}
                    </button>

                    <button
                      onClick={() => onOpenIndicatorSettings(indicator)}
                      title="Настройки индикатора"
                      className="p-1 text-[#787b86] hover:text-white hover:bg-[#2a2e39] rounded transition-colors"
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => onOpenIndicatorCode(indicator)}
                      title="Исходный код"
                      className="px-1.5 py-0.5 text-[#787b86] hover:text-[#2962ff] hover:bg-[#2a2e39] rounded font-mono text-[11px] font-bold transition-colors"
                    >
                      &#123; &#125;
                    </button>

                    <button
                      onClick={() => onRemoveIndicator(indicator.id)}
                      title="Удалить с графика"
                      className="p-1 text-[#787b86] hover:text-[#f23645] hover:bg-[#2a2e39] rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Loading Spinner */}
        {isLoading && (
          <div className="absolute inset-0 bg-[#131722]/80 backdrop-blur-xs flex items-center justify-center z-30">
            <div className="flex items-center gap-2 text-sm text-[#787b86]">
              <div className="w-4 h-4 border-2 border-[#2962ff] border-t-transparent rounded-full animate-spin" />
              <span>Loading market data...</span>
            </div>
          </div>
        )}
      </div>

      {/* Sub-Pane Canvas (RSI / MACD): Exactly 25% height */}
      {hasSubPane && appliedIndicators.length > 0 && (
        <div
          ref={subContainerRef}
          className="relative w-full border-t border-[#2a2e39] tv-chart-pane cursor-crosshair"
          style={{
            height: '25%',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            overflow: 'hidden',
            pointerEvents: 'auto',
          }}
        >
          <div className="absolute top-1 left-3 z-10 flex items-center gap-3 font-mono text-[10px] bg-[#131722]/80 px-2 py-0.5 rounded border border-[#2a2e39]">
            {subPlots.map(p => (
              <div key={p.id} className="flex items-center gap-1">
                <span style={{ color: p.color }}>{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
