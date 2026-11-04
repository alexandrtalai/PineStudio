export interface Candle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1D';

export interface SymbolInfo {
  symbol: string;
  name: string;
  category: 'crypto' | 'stocks' | 'forex' | 'commodities';
  baseAsset: string;
  quoteAsset: string;
  priceDecimals: number;
}

export interface IndicatorPlotPoint {
  time: number;
  value: number;
}

export interface IndicatorPlot {
  id: string;
  name: string;
  color: string;
  lineWidth?: number;
  pane: 'main' | 'sub';
  type?: 'line' | 'histogram';
  data: IndicatorPlotPoint[];
}

export interface TradeMarker {
  time: number;
  position: 'aboveBar' | 'belowBar' | 'inBar';
  color: string;
  shape: 'arrowUp' | 'arrowDown' | 'circle';
  text: string;
  id?: string;
}

export interface Trade {
  id: string;
  entryTime: number;
  exitTime: number;
  type: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  size: number;
  pnl: number;
  pnlPercent: number;
  cumEquity: number;
  reason: string;
}

export interface BacktestSettings {
  initialCapital: number;
  commissionPercent: number; // e.g. 0.075 for Binance spot/futures
  slippagePercent: number; // e.g. 0.02
  orderSizePercent: number; // % of current equity to risk per trade (e.g. 100 or 50)
  pyramiding: number; // max entries in same direction
}

export interface BacktestReport {
  initialCapital: number;
  finalCapital: number;
  netProfit: number;
  netProfitPercent: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number; // 0 to 100
  profitFactor: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  avgTradePercent: number;
  sharpeRatio: number;
  trades: Trade[];
  equityCurve: { time: number; equity: number }[];
}

export interface ScriptItem {
  id: string;
  name: string;
  type: 'indicator' | 'strategy';
  code: string;
  description: string;
  isBuiltin?: boolean;
  lastModified: number;
  category?: string;
}

export interface IndicatorParam {
  key: string;
  label: string;
  type: 'number' | 'string' | 'boolean';
  value: number | string | boolean;
  min?: number;
  max?: number;
  step?: number;
}

export interface AppliedIndicator {
  id: string;
  scriptId: string;
  name: string;
  type: 'indicator' | 'strategy';
  code: string;
  visible: boolean;
  params: IndicatorParam[];
  color: string;
  lineWidth: number;
}

export interface CompilationResult {
  success: boolean;
  error?: string;
  errorLine?: number;
  logs?: string[];
  plots: IndicatorPlot[];
  report?: BacktestReport;
  markers: TradeMarker[];
}

