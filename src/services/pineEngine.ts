import {
  BacktestReport,
  BacktestSettings,
  Candle,
  CompilationResult,
  IndicatorPlot,
  Trade,
  TradeMarker,
} from '../types/trading';

// --- Technical Analysis (TA) Core Math Functions ---

export function calculateSMA(data: number[], length: number): (number | null)[] {
  const result: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i];
    if (i >= length) {
      sum -= data[i - length];
    }
    if (i >= length - 1) {
      result.push(sum / length);
    } else {
      result.push(null);
    }
  }
  return result;
}

export function calculateEMA(data: number[], length: number): (number | null)[] {
  const result: (number | null)[] = [];
  const k = 2 / (length + 1);
  let ema: number | null = null;

  for (let i = 0; i < data.length; i++) {
    const val = data[i];
    if (i < length - 1) {
      result.push(null);
    } else if (i === length - 1) {
      // First EMA is SMA
      let sum = 0;
      for (let j = 0; j < length; j++) sum += data[j];
      ema = sum / length;
      result.push(ema);
    } else {
      ema = val * k + (ema as number) * (1 - k);
      result.push(ema);
    }
  }
  return result;
}

export function calculateRSI(data: number[], length = 14): (number | null)[] {
  const result: (number | null)[] = [];
  if (data.length <= length) return data.map(() => null);

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= length; i++) {
    const diff = data[i] - data[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / length;
  let avgLoss = losses / length;

  for (let i = 0; i < data.length; i++) {
    if (i < length) {
      result.push(null);
    } else if (i === length) {
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push(100 - 100 / (1 + rs));
    } else {
      const diff = data[i] - data[i - 1];
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? Math.abs(diff) : 0;

      avgGain = (avgGain * (length - 1) + gain) / length;
      avgLoss = (avgLoss * (length - 1) + loss) / length;

      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push(100 - 100 / (1 + rs));
    }
  }
  return result;
}

export function calculateATR(candles: Candle[], length = 14): (number | null)[] {
  const tr: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      tr.push(candles[i].high - candles[i].low);
    } else {
      const h_l = candles[i].high - candles[i].low;
      const h_pc = Math.abs(candles[i].high - candles[i - 1].close);
      const l_pc = Math.abs(candles[i].low - candles[i - 1].close);
      tr.push(Math.max(h_l, h_pc, l_pc));
    }
  }
  return calculateSMA(tr, length);
}

export function calculateMACD(
  data: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
} {
  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);
  const macdLine: (number | null)[] = [];

  for (let i = 0; i < data.length; i++) {
    if (fastEMA[i] !== null && slowEMA[i] !== null) {
      macdLine.push((fastEMA[i] as number) - (slowEMA[i] as number));
    } else {
      macdLine.push(null);
    }
  }

  // Filter valid macd numbers for signal EMA
  const validMacdIndices = macdLine.map((val, idx) => (val !== null ? idx : -1)).filter(i => i !== -1);
  const validMacdValues = validMacdIndices.map(i => macdLine[i] as number);
  const calculatedSignal = calculateEMA(validMacdValues, signalPeriod);

  const signalLine: (number | null)[] = new Array(data.length).fill(null);
  for (let j = 0; j < validMacdIndices.length; j++) {
    signalLine[validMacdIndices[j]] = calculatedSignal[j];
  }

  const histogram: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (macdLine[i] !== null && signalLine[i] !== null) {
      histogram.push((macdLine[i] as number) - (signalLine[i] as number));
    } else {
      histogram.push(null);
    }
  }

  return { macd: macdLine, signal: signalLine, histogram };
}

export function calculateBollingerBands(
  data: number[],
  length = 20,
  multiplier = 2
): {
  upper: (number | null)[];
  basis: (number | null)[];
  lower: (number | null)[];
} {
  const basis = calculateSMA(data, length);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < length - 1 || basis[i] === null) {
      upper.push(null);
      lower.push(null);
      continue;
    }
    const mean = basis[i] as number;
    let sumSq = 0;
    for (let j = i - length + 1; j <= i; j++) {
      sumSq += Math.pow(data[j] - mean, 2);
    }
    const stdDev = Math.sqrt(sumSq / length);
    upper.push(mean + multiplier * stdDev);
    lower.push(mean - multiplier * stdDev);
  }

  return { upper, basis, lower };
}

export function calculateSuperTrend(
  candles: Candle[],
  atrPeriod = 10,
  factor = 3
): {
  trend: (number | null)[];
  direction: (number | null)[]; // 1 = bullish, -1 = bearish
} {
  const atr = calculateATR(candles, atrPeriod);
  const trend: (number | null)[] = [];
  const direction: (number | null)[] = [];

  let upperBand = 0;
  let lowerBand = 0;
  let currentDir = 1;

  for (let i = 0; i < candles.length; i++) {
    const curAtr = atr[i];
    if (curAtr === null) {
      trend.push(null);
      direction.push(null);
      continue;
    }

    const hl2 = (candles[i].high + candles[i].low) / 2;
    const basicUpper = hl2 + factor * curAtr;
    const basicLower = hl2 - factor * curAtr;

    if (i === 0 || trend[i - 1] === null) {
      upperBand = basicUpper;
      lowerBand = basicLower;
      trend.push(candles[i].close > hl2 ? lowerBand : upperBand);
      direction.push(candles[i].close > hl2 ? 1 : -1);
      continue;
    }

    const prevClose = candles[i - 1].close;
    upperBand = basicUpper < upperBand || prevClose > upperBand ? basicUpper : upperBand;
    lowerBand = basicLower > lowerBand || prevClose < lowerBand ? basicLower : lowerBand;

    if (currentDir === 1) {
      if (candles[i].close < lowerBand) {
        currentDir = -1;
        trend.push(upperBand);
      } else {
        trend.push(lowerBand);
      }
    } else {
      if (candles[i].close > upperBand) {
        currentDir = 1;
        trend.push(lowerBand);
      } else {
        trend.push(upperBand);
      }
    }
    direction.push(currentDir);
  }

  return { trend, direction };
}

// Check crossover / crossunder
export function isCrossover(a: (number | null)[], b: (number | null)[], idx: number): boolean {
  if (idx < 1) return false;
  const a0 = a[idx];
  const a1 = a[idx - 1];
  const b0 = b[idx];
  const b1 = b[idx - 1];
  if (a0 === null || a1 === null || b0 === null || b1 === null) return false;
  return a1 <= b1 && a0 > b0;
}

export function isCrossunder(a: (number | null)[], b: (number | null)[], idx: number): boolean {
  if (idx < 1) return false;
  const a0 = a[idx];
  const a1 = a[idx - 1];
  const b0 = b[idx];
  const b1 = b[idx - 1];
  if (a0 === null || a1 === null || b0 === null || b1 === null) return false;
  return a1 >= b1 && a0 < b0;
}

// Convert simple Pine Script v4/v5 into JavaScript executable function
export function transpilePineToExecutable(pineCode: string): string {
  // If it's already full JavaScript syntax (e.g. contains 'function', 'return', 'const', 'let', 'for')
  const looksLikeJS = pineCode.includes('function') || (pineCode.includes('const ') && pineCode.includes('{'));
  if (looksLikeJS) {
    return pineCode;
  }

  const lines = pineCode.split('\n');
  const jsLines: string[] = [];

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//@') || trimmed.startsWith('//')) {
      jsLines.push(line);
      continue;
    }

    // indicator(...) or strategy(...) definition line
    if (trimmed.startsWith('indicator(') || trimmed.startsWith('strategy(')) {
      jsLines.push(`// ${trimmed}`);
      continue;
    }

    // Variable assignment: e.g. "fast = ta.ema(close, 9)" -> "const fast = ta.ema(close, 9);"
    let processed = line;
    const assignMatch = line.match(/^(\s*)([a-zA-Z0-9_]+)\s*=\s*(.+)$/);
    if (assignMatch && !line.includes('==') && !line.includes('<=') && !line.includes('>=')) {
      const indent = assignMatch[1];
      const varName = assignMatch[2];
      const expression = assignMatch[3];
      processed = `${indent}const ${varName} = ${expression};`;
    }

    // Pine "if condition" -> "if (condition) {"
    if (/^\s*if\s+/.test(processed)) {
      processed = processed.replace(/^\s*if\s+(.+)$/, (match, cond) => {
        const indent = match.substring(0, match.indexOf('if'));
        return `${indent}if (${cond.trim()}) {`;
      });
      // Add closing brace reminder or handle simple blocks
    }

    // strategy.entry / strategy.close syntax
    processed = processed.replace(/strategy\.long/gi, '"LONG"');
    processed = processed.replace(/strategy\.short/gi, '"SHORT"');

    jsLines.push(processed);
  }

  return jsLines.join('\n');
}

// --- Pine Script & Strategy Execution Environment ---

export function executeScript(
  scriptCode: string,
  candles: Candle[],
  settings: BacktestSettings = {
    initialCapital: 10000,
    commissionPercent: 0.075,
    slippagePercent: 0.02,
    orderSizePercent: 100,
    pyramiding: 1,
  }
): CompilationResult {
  const logs: string[] = [];
  const plots: IndicatorPlot[] = [];
  const markers: TradeMarker[] = [];
  const trades: Trade[] = [];

  if (!candles || candles.length === 0) {
    return {
      success: false,
      error: 'No market candle data loaded.',
      plots: [],
      markers: [],
    };
  }

  // Pre-extracted series
  const times = candles.map(c => c.time);
  const opens = candles.map(c => c.open);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);

  // Strategy Execution State
  let currentPosition: {
    id: string;
    type: 'LONG' | 'SHORT';
    entryIndex: number;
    entryTime: number;
    entryPrice: number;
    size: number;
    allocatedCapital: number;
  } | null = null;

  let currentCapital = settings.initialCapital;
  const equityPoints: { time: number; equity: number }[] = [];

  // Sandbox API exposed to the script
  const plot = (
    series: (number | null)[],
    title = 'Plot',
    color = '#2962FF',
    lineWidth = 2,
    pane: 'main' | 'sub' = 'main'
  ) => {
    if (!Array.isArray(series)) return;
    const data: { time: number; value: number }[] = [];
    for (let i = 0; i < series.length; i++) {
      if (series[i] !== null && !isNaN(series[i] as number)) {
        data.push({ time: times[i], value: Number(series[i]) });
      }
    }
    plots.push({
      id: `${title}_${plots.length}`,
      name: title,
      color,
      lineWidth,
      pane,
      data,
    });
  };

  const hline = (value: number, title = 'Level', color = '#787b86', pane: 'main' | 'sub' = 'sub') => {
    const data = times.map(t => ({ time: t, value }));
    plots.push({
      id: `hline_${title}_${plots.length}`,
      name: title,
      color,
      lineWidth: 1,
      pane,
      data,
    });
  };

  const strategy = {
    long: 'LONG' as const,
    short: 'SHORT' as const,
    position_size: () => (currentPosition ? (currentPosition.type === 'LONG' ? 1 : -1) : 0),
    entry: (id: string, direction: 'LONG' | 'SHORT', barIndex: number) => {
      if (barIndex < 0 || barIndex >= candles.length) return;

      // If already in opposite position, close it first
      if (currentPosition && currentPosition.type !== direction) {
        strategy.close(currentPosition.id, barIndex, 'Reverse');
      }

      if (currentPosition) return; // Ignore if already open in same direction

      const candle = candles[barIndex];
      // Slippage on entry
      const slippage = direction === 'LONG'
        ? 1 + settings.slippagePercent / 100
        : 1 - settings.slippagePercent / 100;
      const executedPrice = candle.close * slippage;

      const orderCapital = currentCapital * (settings.orderSizePercent / 100);
      const commission = orderCapital * (settings.commissionPercent / 100);
      currentCapital -= commission;

      const size = orderCapital / executedPrice;

      currentPosition = {
        id,
        type: direction,
        entryIndex: barIndex,
        entryTime: candle.time,
        entryPrice: executedPrice,
        size,
        allocatedCapital: orderCapital,
      };

      markers.push({
        time: candle.time,
        position: direction === 'LONG' ? 'belowBar' : 'aboveBar',
        color: direction === 'LONG' ? '#089981' : '#f23645',
        shape: direction === 'LONG' ? 'arrowUp' : 'arrowDown',
        text: `${direction === 'LONG' ? 'BUY' : 'SELL'} @ ${executedPrice.toFixed(2)}`,
        id: `entry_${barIndex}`,
      });
    },
    close: (id: string, barIndex: number, reason = 'Exit Signal') => {
      if (!currentPosition || barIndex < 0 || barIndex >= candles.length) return;

      const candle = candles[barIndex];
      const direction = currentPosition.type;

      // Slippage on exit
      const slippage = direction === 'LONG'
        ? 1 - settings.slippagePercent / 100
        : 1 + settings.slippagePercent / 100;
      const exitPrice = candle.close * slippage;

      const exitValue = currentPosition.size * exitPrice;
      const commission = exitValue * (settings.commissionPercent / 100);

      let pnl = 0;
      let pnlPercent = 0;

      if (direction === 'LONG') {
        pnl = (exitPrice - currentPosition.entryPrice) * currentPosition.size - commission;
        pnlPercent = ((exitPrice - currentPosition.entryPrice) / currentPosition.entryPrice) * 100;
      } else {
        pnl = (currentPosition.entryPrice - exitPrice) * currentPosition.size - commission;
        pnlPercent = ((currentPosition.entryPrice - exitPrice) / currentPosition.entryPrice) * 100;
      }

      currentCapital += currentPosition.allocatedCapital + pnl;

      trades.push({
        id: `trade_${trades.length + 1}`,
        entryTime: currentPosition.entryTime,
        exitTime: candle.time,
        type: currentPosition.type,
        entryPrice: Number(currentPosition.entryPrice.toFixed(2)),
        exitPrice: Number(exitPrice.toFixed(2)),
        size: Number(currentPosition.size.toFixed(4)),
        pnl: Number(pnl.toFixed(2)),
        pnlPercent: Number(pnlPercent.toFixed(2)),
        cumEquity: Number(currentCapital.toFixed(2)),
        reason,
      });

      markers.push({
        time: candle.time,
        position: direction === 'LONG' ? 'aboveBar' : 'belowBar',
        color: pnl >= 0 ? '#089981' : '#f23645',
        shape: 'circle',
        text: `CLOSE (${pnl >= 0 ? '+' : ''}${pnlPercent.toFixed(1)}%)`,
        id: `close_${barIndex}`,
      });

      currentPosition = null;
    },
  };

  // Technical Analysis Helper Object
  const ta = {
    sma: (src: number[], len: number) => calculateSMA(src, len),
    ema: (src: number[], len: number) => calculateEMA(src, len),
    rsi: (src: number[], len = 14) => calculateRSI(src, len),
    macd: (src: number[], fast = 12, slow = 26, sig = 9) => calculateMACD(src, fast, slow, sig),
    bb: (src: number[], len = 20, mult = 2) => calculateBollingerBands(src, len, mult),
    atr: (len = 14) => calculateATR(candles, len),
    supertrend: (factor = 3, atrPeriod = 10) => calculateSuperTrend(candles, atrPeriod, factor),
    crossover: (a: (number | null)[], b: (number | null)[], idx?: number) => {
      if (typeof idx === 'number') return isCrossover(a, b, idx);
      return a.map((_, i) => isCrossover(a, b, i));
    },
    crossunder: (a: (number | null)[], b: (number | null)[], idx?: number) => {
      if (typeof idx === 'number') return isCrossunder(a, b, idx);
      return a.map((_, i) => isCrossunder(a, b, i));
    },
    highest: (src: number[], len: number) => {
      const res: (number | null)[] = [];
      for (let i = 0; i < src.length; i++) {
        if (i < len - 1) res.push(null);
        else {
          let max = -Infinity;
          for (let j = i - len + 1; j <= i; j++) if (src[j] > max) max = src[j];
          res.push(max);
        }
      }
      return res;
    },
    lowest: (src: number[], len: number) => {
      const res: (number | null)[] = [];
      for (let i = 0; i < src.length; i++) {
        if (i < len - 1) res.push(null);
        else {
          let min = Infinity;
          for (let j = i - len + 1; j <= i; j++) if (src[j] < min) min = src[j];
          res.push(min);
        }
      }
      return res;
    },
  };

  // Execute user script
  try {
    const executableBody = transpilePineToExecutable(scriptCode);

    // Create sandbox function
    const sandboxFunction = new Function(
      'candles',
      'open',
      'high',
      'low',
      'close',
      'volume',
      'time',
      'ta',
      'strategy',
      'plot',
      'hline',
      'log',
      `
      try {
        ${executableBody}
      } catch (err) {
        throw err;
      }
      `
    );

    const customLog = (...args: unknown[]) => {
      logs.push(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
    };

    sandboxFunction(
      candles,
      opens,
      highs,
      lows,
      closes,
      volumes,
      times,
      ta,
      strategy,
      plot,
      hline,
      customLog
    );

    // If a position remains open at the last bar, calculate mark-to-market equity
    let peakCapital = settings.initialCapital;
    let maxDrawdown = 0;
    let maxDrawdownPercent = 0;

    let rollingCapital = settings.initialCapital;
    for (let i = 0; i < candles.length; i++) {
      const matchingTrade = trades.find(t => t.exitTime === candles[i].time);
      if (matchingTrade) {
        rollingCapital = matchingTrade.cumEquity;
      }
      if (rollingCapital > peakCapital) {
        peakCapital = rollingCapital;
      }
      const dd = peakCapital - rollingCapital;
      const ddPercent = peakCapital > 0 ? (dd / peakCapital) * 100 : 0;
      if (dd > maxDrawdown) maxDrawdown = dd;
      if (ddPercent > maxDrawdownPercent) maxDrawdownPercent = ddPercent;

      equityPoints.push({
        time: candles[i].time,
        equity: Number(rollingCapital.toFixed(2)),
      });
    }

    // Build comprehensive backtest report if any trades were made
    let report: BacktestReport | undefined = undefined;

    if (trades.length > 0) {
      const winningTrades = trades.filter(t => t.pnl > 0);
      const losingTrades = trades.filter(t => t.pnl < 0);
      const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
      const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
      const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? 99.9 : 1) : grossProfit / grossLoss;
      const netProfit = currentCapital - settings.initialCapital;
      const netProfitPercent = (netProfit / settings.initialCapital) * 100;
      const winRate = (winningTrades.length / trades.length) * 100;
      const avgTradePercent = trades.reduce((sum, t) => sum + t.pnlPercent, 0) / trades.length;

      // Sharpe Ratio approximation based on trade returns
      const returns = trades.map(t => t.pnlPercent);
      const meanReturn = returns.reduce((a, b) => a + b, 0) / (returns.length || 1);
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / (returns.length || 1);
      const stdDev = Math.sqrt(variance);
      const sharpeRatio = stdDev === 0 ? 0 : (meanReturn / stdDev) * Math.sqrt(trades.length);

      report = {
        initialCapital: settings.initialCapital,
        finalCapital: Number(currentCapital.toFixed(2)),
        netProfit: Number(netProfit.toFixed(2)),
        netProfitPercent: Number(netProfitPercent.toFixed(2)),
        totalTrades: trades.length,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        winRate: Number(winRate.toFixed(1)),
        profitFactor: Number(profitFactor.toFixed(2)),
        maxDrawdown: Number(maxDrawdown.toFixed(2)),
        maxDrawdownPercent: Number(maxDrawdownPercent.toFixed(2)),
        avgTradePercent: Number(avgTradePercent.toFixed(2)),
        sharpeRatio: Number(sharpeRatio.toFixed(2)),
        trades,
        equityCurve: equityPoints,
      };
    }

    return {
      success: true,
      logs,
      plots,
      markers,
      report,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: errorMsg,
      logs,
      plots: [],
      markers: [],
    };
  }
}

// Execute all visible applied indicators and strategies together
export function executeAppliedIndicators(
  appliedIndicators: import('../types/trading').AppliedIndicator[],
  candles: Candle[],
  settings?: BacktestSettings
): CompilationResult {
  if (!appliedIndicators || appliedIndicators.length === 0) {
    return {
      success: true,
      plots: [],
      markers: [],
      logs: [],
    };
  }

  const allPlots: IndicatorPlot[] = [];
  const allMarkers: TradeMarker[] = [];
  const allLogs: string[] = [];
  let strategyReport: BacktestReport | undefined = undefined;

  for (const ind of appliedIndicators) {
    if (!ind.visible) continue;

    const res = executeScript(ind.code, candles, settings);
    if (!res.success && res.error) {
      allLogs.push(`[${ind.name}] Error: ${res.error}`);
      continue;
    }

    if (res.logs) allLogs.push(...res.logs);

    if (res.plots) {
      res.plots.forEach(p => {
        allPlots.push({
          ...p,
          id: `${ind.id}_${p.id}`,
          color: ind.color || p.color,
          lineWidth: ind.lineWidth || p.lineWidth,
        });
      });
    }

    if (res.markers) {
      allMarkers.push(...res.markers);
    }

    if (res.report) {
      strategyReport = res.report;
    }
  }

  return {
    success: true,
    plots: allPlots,
    markers: allMarkers,
    logs: allLogs,
    report: strategyReport,
  };
}

