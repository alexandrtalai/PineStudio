import { ScriptItem } from '../types/trading';

export const BUILTIN_SCRIPTS: ScriptItem[] = [
  {
    id: 'ema-cross-strategy',
    name: 'EMA Golden & Death Cross Strategy',
    type: 'strategy',
    category: 'Trend Following',
    description: 'Enters Long when fast EMA (9) crosses above slow EMA (21). Exits when fast EMA crosses below slow EMA.',
    isBuiltin: true,
    lastModified: Date.now(),
    code: `// EMA Golden & Death Cross Strategy
// Fast EMA (9) and Slow EMA (21)
const fastPeriod = 9;
const slowPeriod = 21;

const emaFast = ta.ema(close, fastPeriod);
const emaSlow = ta.ema(close, slowPeriod);

// Plot indicator lines on the chart
plot(emaFast, "EMA 9 (Fast)", "#2962FF", 2, "main");
plot(emaSlow, "EMA 21 (Slow)", "#FF6D00", 2, "main");

// Strategy Backtest Execution Loop
for (let i = 1; i < candles.length; i++) {
  // Buy signal: 9 EMA crosses above 21 EMA
  if (ta.crossover(emaFast, emaSlow, i)) {
    strategy.entry("Long", strategy.long, i);
  }
  // Exit signal: 9 EMA crosses below 21 EMA
  else if (ta.crossunder(emaFast, emaSlow, i)) {
    strategy.close("Long", i, "EMA Crossunder Exit");
  }
}
`,
  },
  {
    id: 'rsi-mean-reversion',
    name: 'RSI Oversold Dip Buyer Strategy',
    type: 'strategy',
    category: 'Mean Reversion',
    description: 'Buys when RSI dips into oversold territory (< 32) and recovers, exits when RSI reaches overbought level (68).',
    isBuiltin: true,
    lastModified: Date.now(),
    code: `// RSI Oversold Reversal Strategy
const rsiPeriod = 14;
const oversold = 32;
const overbought = 68;

const rsi = ta.rsi(close, rsiPeriod);

// Plot RSI and reference bands in sub-window
plot(rsi, "RSI (14)", "#7E57C2", 2, "sub");
hline(overbought, "Overbought (68)", "#F23645", "sub");
hline(50, "Midline (50)", "#787B86", "sub");
hline(oversold, "Oversold (32)", "#089981", "sub");

// Strategy Backtesting Loop
for (let i = 1; i < candles.length; i++) {
  const prevRsi = rsi[i - 1];
  const currRsi = rsi[i];

  if (prevRsi !== null && currRsi !== null) {
    // Buy when RSI bounces back above oversold level
    if (prevRsi <= oversold && currRsi > oversold) {
      strategy.entry("RSI_Long", strategy.long, i);
    }
    // Take profit when RSI enters overbought zone
    else if (currRsi >= overbought) {
      strategy.close("RSI_Long", i, "RSI Overbought TP");
    }
  }
}
`,
  },
  {
    id: 'macd-momentum-strategy',
    name: 'MACD Momentum Crossover Strategy',
    type: 'strategy',
    category: 'Momentum',
    description: 'Trades MACD line crossing Signal line with confirmation.',
    isBuiltin: true,
    lastModified: Date.now(),
    code: `// MACD Momentum Crossover Strategy
const { macd, signal, histogram } = ta.macd(close, 12, 26, 9);

// Plot MACD and Signal in sub-window
plot(macd, "MACD", "#2962FF", 2, "sub");
plot(signal, "Signal", "#FF6D00", 2, "sub");
hline(0, "Zero Level", "#787B86", "sub");

for (let i = 1; i < candles.length; i++) {
  // Bullish MACD crossover below or around zero
  if (ta.crossover(macd, signal, i)) {
    strategy.entry("MACD_Long", strategy.long, i);
  }
  // Bearish MACD crossunder
  else if (ta.crossunder(macd, signal, i)) {
    strategy.close("MACD_Long", i, "MACD Bearish Cross");
  }
}
`,
  },
  {
    id: 'bollinger-bands-strategy',
    name: 'Bollinger Bands Mean Reversion',
    type: 'strategy',
    category: 'Volatility',
    description: 'Enters Long when price bounces off Lower Band and takes profit at Middle/Upper Band.',
    isBuiltin: true,
    lastModified: Date.now(),
    code: `// Bollinger Bands Mean Reversion Strategy
const bb = ta.bb(close, 20, 2);

// Plot Bollinger Bands directly on main chart
plot(bb.upper, "BB Upper", "#2962FF", 1, "main");
plot(bb.basis, "BB Basis (SMA 20)", "#FF9800", 1, "main");
plot(bb.lower, "BB Lower", "#2962FF", 1, "main");

for (let i = 1; i < candles.length; i++) {
  const c = close[i];
  const prevC = close[i - 1];
  const lower = bb.lower[i];
  const upper = bb.upper[i];
  const basis = bb.basis[i];

  if (lower && basis && upper) {
    // Dip below lower band and close back inside
    if (prevC < lower && c > lower) {
      strategy.entry("BB_Long", strategy.long, i);
    }
    // Take profit at Upper Band or cross below basis
    else if (c >= upper) {
      strategy.close("BB_Long", i, "Upper Band Reached");
    }
  }
}
`,
  },
  {
    id: 'supertrend-strategy',
    name: 'SuperTrend Trend Following Strategy',
    type: 'strategy',
    category: 'Trend Following',
    description: 'Follows volatility-adjusted trend direction using ATR factor.',
    isBuiltin: true,
    lastModified: Date.now(),
    code: `// SuperTrend Trend Following Strategy
const st = ta.supertrend(3, 10);

plot(st.trend, "SuperTrend", "#089981", 2, "main");

for (let i = 1; i < candles.length; i++) {
  const dir = st.direction[i];
  const prevDir = st.direction[i - 1];

  if (dir !== null && prevDir !== null) {
    if (prevDir === -1 && dir === 1) {
      strategy.entry("ST_Long", strategy.long, i);
    } else if (prevDir === 1 && dir === -1) {
      strategy.close("ST_Long", i, "SuperTrend Bearish Flip");
    }
  }
}
`,
  },
  {
    id: 'multi-ema-ribbon',
    name: 'Multi-EMA Ribbon Indicator (20, 50, 100, 200)',
    type: 'indicator',
    category: 'Indicator',
    description: 'Visualizes trend hierarchy using 4 exponential moving averages on the main chart.',
    isBuiltin: true,
    lastModified: Date.now(),
    code: `// Multi-EMA Ribbon Indicator
const ema20 = ta.ema(close, 20);
const ema50 = ta.ema(close, 50);
const ema100 = ta.ema(close, 100);
const ema200 = ta.ema(close, 200);

plot(ema20, "EMA 20", "#00E676", 2, "main");
plot(ema50, "EMA 50", "#29B6F6", 2, "main");
plot(ema100, "EMA 100", "#FFB74D", 2, "main");
plot(ema200, "EMA 200", "#E040FB", 2, "main");
`,
  },
  {
    id: 'custom-blank-strategy',
    name: 'New Custom Strategy Template',
    type: 'strategy',
    category: 'Custom',
    description: 'Empty starter boilerplate for your own trading rules and backtests.',
    isBuiltin: true,
    lastModified: Date.now(),
    code: `// Write your custom strategy here
// Access built-in variables: open, high, low, close, volume, time, candles
// Access TA library: ta.sma, ta.ema, ta.rsi, ta.macd, ta.bb, ta.atr, ta.supertrend, ta.crossover, ta.crossunder

const mySMA = ta.sma(close, 20);
plot(mySMA, "SMA 20", "#2962FF", 2, "main");

for (let i = 1; i < candles.length; i++) {
  // Your entry condition
  if (close[i] > (mySMA[i] || 0) && close[i - 1] <= (mySMA[i - 1] || 0)) {
    strategy.entry("LongTrade", strategy.long, i);
  }
  // Your exit condition
  else if (close[i] < (mySMA[i] || 0) && close[i - 1] >= (mySMA[i - 1] || 0)) {
    strategy.close("LongTrade", i, "SMA Breakdown");
  }
}
`,
  },
];
