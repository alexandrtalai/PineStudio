import { Candle, SymbolInfo, Timeframe } from '../types/trading';

export const POPULAR_SYMBOLS: SymbolInfo[] = [
  { symbol: 'BTC/USDT', name: 'Bitcoin', category: 'crypto', baseAsset: 'BTC', quoteAsset: 'USDT', priceDecimals: 2 },
  { symbol: 'ETH/USDT', name: 'Ethereum', category: 'crypto', baseAsset: 'ETH', quoteAsset: 'USDT', priceDecimals: 2 },
  { symbol: 'SOL/USDT', name: 'Solana', category: 'crypto', baseAsset: 'SOL', quoteAsset: 'USDT', priceDecimals: 2 },
  { symbol: 'BNB/USDT', name: 'Binance Coin', category: 'crypto', baseAsset: 'BNB', quoteAsset: 'USDT', priceDecimals: 2 },
  { symbol: 'AAPL', name: 'Apple Inc.', category: 'stocks', baseAsset: 'AAPL', quoteAsset: 'USD', priceDecimals: 2 },
  { symbol: 'NVDA', name: 'Nvidia Corp.', category: 'stocks', baseAsset: 'NVDA', quoteAsset: 'USD', priceDecimals: 2 },
  { symbol: 'EUR/USD', name: 'Euro / US Dollar', category: 'forex', baseAsset: 'EUR', quoteAsset: 'USD', priceDecimals: 4 },
  { symbol: 'GOLD', name: 'Gold / US Dollar', category: 'commodities', baseAsset: 'XAU', quoteAsset: 'USD', priceDecimals: 2 },
];

export const TIMEFRAMES: { label: string; value: Timeframe; binanceInterval: string; seconds: number }[] = [
  { label: '1m', value: '1m', binanceInterval: '1m', seconds: 60 },
  { label: '5m', value: '5m', binanceInterval: '5m', seconds: 300 },
  { label: '15m', value: '15m', binanceInterval: '15m', seconds: 900 },
  { label: '1h', value: '1h', binanceInterval: '1h', seconds: 3600 },
  { label: '4h', value: '4h', binanceInterval: '4h', seconds: 14400 },
  { label: '1D', value: '1D', binanceInterval: '1d', seconds: 86400 },
];

// High-fidelity procedural candle generator for offline reliability or non-crypto assets
export function generateRealisticCandles(
  symbol: string,
  timeframe: Timeframe,
  count = 300
): Candle[] {
  const tfConfig = TIMEFRAMES.find(t => t.value === timeframe) || TIMEFRAMES[3];
  const stepSeconds = tfConfig.seconds;

  // Base prices
  let basePrice = 65000;
  let volatility = 0.015;

  if (symbol.includes('ETH')) { basePrice = 3450; volatility = 0.02; }
  else if (symbol.includes('SOL')) { basePrice = 175; volatility = 0.028; }
  else if (symbol.includes('BNB')) { basePrice = 590; volatility = 0.018; }
  else if (symbol.includes('AAPL')) { basePrice = 225; volatility = 0.012; }
  else if (symbol.includes('NVDA')) { basePrice = 135; volatility = 0.025; }
  else if (symbol.includes('EUR')) { basePrice = 1.0850; volatility = 0.003; }
  else if (symbol.includes('GOLD')) { basePrice = 2650; volatility = 0.008; }

  const now = Math.floor(Date.now() / 1000);
  const startTime = now - count * stepSeconds;

  const candles: Candle[] = [];
  let currentClose = basePrice;
  let trend = 0.0004; // slight upward drift

  // Use pseudo-random seed based on symbol string for consistent replay
  let seed = 0;
  for (let i = 0; i < symbol.length; i++) seed = (seed << 5) - seed + symbol.charCodeAt(i);

  function random() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }

  for (let i = 0; i < count; i++) {
    const time = startTime + i * stepSeconds;
    // Periodic wave for realistic trend cycles
    const cycle = Math.sin(i / 18) * 0.008 + Math.cos(i / 45) * 0.012;
    const shock = (random() - 0.495) * volatility * 2;
    const percentChange = trend + cycle * 0.2 + shock;

    const open = currentClose;
    const close = Math.max(open * 0.1, open * (1 + percentChange));
    const wickHigh = open * (random() * volatility * 0.8);
    const wickLow = open * (random() * volatility * 0.8);

    const high = Math.max(open, close) + wickHigh;
    const low = Math.min(open, close) - wickLow;

    const volume = Math.floor((1000 + random() * 4000) * (1 + Math.abs(percentChange) * 40));

    candles.push({
      time,
      open: Number(open.toFixed(basePrice < 10 ? 4 : 2)),
      high: Number(high.toFixed(basePrice < 10 ? 4 : 2)),
      low: Number(low.toFixed(basePrice < 10 ? 4 : 2)),
      close: Number(close.toFixed(basePrice < 10 ? 4 : 2)),
      volume,
    });

    currentClose = close;
  }

  return candles;
}

// Bybit V5 interval mapping
export const BYBIT_INTERVAL_MAP: Record<string, string> = {
  '1m': '1',
  '5m': '5',
  '15m': '15',
  '1h': '60',
  '4h': '240',
  '1D': 'D',
};

// Fetch historical candles from Bybit V5 API with pagination (end timestamp) and fallback
export async function fetchMarketCandles(
  symbol: string,
  timeframe: Timeframe,
  limit = 200,
  endTimestamp?: number // Optional UNIX timestamp in seconds
): Promise<Candle[]> {
  const isCrypto = symbol.includes('USDT') || symbol.includes('BTC') || symbol.includes('ETH');

  if (isCrypto) {
    const cleanSymbol = symbol.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const bybitInterval = BYBIT_INTERVAL_MAP[timeframe] || '60';

    // 1. Try Bybit API V5 directly (or via local backend if configured)
    try {
      let bybitUrl = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${cleanSymbol}&interval=${bybitInterval}&limit=${limit}`;
      if (endTimestamp && endTimestamp > 0) {
        // Bybit requires end in milliseconds
        bybitUrl += `&end=${Math.floor(endTimestamp * 1000)}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(bybitUrl, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        const list = json?.result?.list;
        if (Array.isArray(list) && list.length > 0) {
          // Format Bybit V5: [startTime, open, high, low, close, volume, turnover]
          const candles: Candle[] = list.map((item: (string | number)[]) => ({
            time: Math.floor(Number(item[0]) / 1000), // convert ms to seconds
            open: parseFloat(String(item[1])),
            high: parseFloat(String(item[2])),
            low: parseFloat(String(item[3])),
            close: parseFloat(String(item[4])),
            volume: parseFloat(String(item[5])),
          }));

          // CRITICAL: Bybit returns candles in reverse order (newest to oldest).
          // We sort them chronologically in ascending order (oldest to newest) for TradingView:
          candles.sort((a, b) => a.time - b.time);
          return candles;
        }
      }
    } catch {
      // Try Binance fallback if Bybit was blocked by network
    }

    // 2. Binance fallback
    try {
      const tfConfig = TIMEFRAMES.find(t => t.value === timeframe) || TIMEFRAMES[3];
      let binanceUrl = `https://api.binance.com/api/v3/klines?symbol=${cleanSymbol}&interval=${tfConfig.binanceInterval}&limit=${limit}`;
      if (endTimestamp && endTimestamp > 0) {
        binanceUrl += `&endTime=${Math.floor(endTimestamp * 1000)}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(binanceUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const raw = await res.json();
        if (Array.isArray(raw) && raw.length > 0) {
          const candles: Candle[] = raw.map((item: (string | number)[]) => ({
            time: Math.floor(Number(item[0]) / 1000),
            open: parseFloat(String(item[1])),
            high: parseFloat(String(item[2])),
            low: parseFloat(String(item[3])),
            close: parseFloat(String(item[4])),
            volume: parseFloat(String(item[5])),
          }));
          candles.sort((a, b) => a.time - b.time);
          return candles;
        }
      }
    } catch {
      // fallback to generator
    }
  }

  // 3. Fallback to procedural generator for offline reliability or non-crypto assets
  return generateRealisticCandles(symbol, timeframe, limit);
}


// Parse custom CSV files (Date/Timestamp, Open, High, Low, Close, Volume)
export function parseCSVToCandles(csvText: string): Candle[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error('CSV file is empty or missing headers');

  const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
  const timeIdx = headers.findIndex(h => h.includes('time') || h.includes('date') || h.includes('timestamp'));
  const openIdx = headers.findIndex(h => h.includes('open'));
  const highIdx = headers.findIndex(h => h.includes('high'));
  const lowIdx = headers.findIndex(h => h.includes('low'));
  const closeIdx = headers.findIndex(h => h.includes('close'));
  const volIdx = headers.findIndex(h => h.includes('vol'));

  if (openIdx === -1 || highIdx === -1 || lowIdx === -1 || closeIdx === -1) {
    throw new Error('CSV must contain Open, High, Low, and Close columns.');
  }

  const candles: Candle[] = [];
  let baseTimestamp = Math.floor(Date.now() / 1000) - (lines.length * 3600);

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',').map(c => c.trim());
    if (row.length < 4) continue;

    let time = baseTimestamp + i * 3600;
    if (timeIdx !== -1 && row[timeIdx]) {
      const parsedTime = Date.parse(row[timeIdx]);
      if (!isNaN(parsedTime)) {
        time = Math.floor(parsedTime / 1000);
      } else {
        const num = Number(row[timeIdx]);
        if (!isNaN(num)) time = num > 1e11 ? Math.floor(num / 1000) : num;
      }
    }

    const open = parseFloat(row[openIdx]);
    const high = parseFloat(row[highIdx]);
    const low = parseFloat(row[lowIdx]);
    const close = parseFloat(row[closeIdx]);
    const volume = volIdx !== -1 && row[volIdx] ? parseFloat(row[volIdx]) : 1000;

    if (!isNaN(open) && !isNaN(high) && !isNaN(low) && !isNaN(close)) {
      candles.push({ time, open, high, low, close, volume });
    }
  }

  // Sort by time ascending
  candles.sort((a, b) => a.time - b.time);
  return candles;
}

/**
 * Real-time candle streamer.
 * Connects first to local FastAPI WebSocket (ws://localhost:8000/ws/candles).
 * If unavailable, connects directly to Bybit's public WebSocket stream (wss://stream.bybit.com/v5/public/spot).
 * Calls onCandle on every incoming live tick to dynamically form the current candle.
 */
export function subscribeRealtimeCandles(
  symbol: string,
  timeframe: Timeframe,
  onCandle: (candle: Candle) => void
): () => void {
  const cleanSymbol = symbol.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const bybitInterval = BYBIT_INTERVAL_MAP[timeframe] || '1';

  let isDestroyed = false;
  let activeWs: WebSocket | null = null;
  let pingTimer: any = null;

  function connectDirectBybit() {
    if (isDestroyed) return;
    try {
      const bybitWs = new WebSocket('wss://stream.bybit.com/v5/public/spot');
      activeWs = bybitWs;

      bybitWs.onopen = () => {
        if (isDestroyed) {
          try { bybitWs.close(); } catch {}
          return;
        }
        bybitWs.send(JSON.stringify({
          op: 'subscribe',
          args: [`kline.${bybitInterval}.${cleanSymbol}`]
        }));

        pingTimer = setInterval(() => {
          if (bybitWs.readyState === WebSocket.OPEN) {
            bybitWs.send(JSON.stringify({ op: 'ping' }));
          }
        }, 20000);
      };

      bybitWs.onmessage = (event) => {
        if (isDestroyed) return;
        try {
          const res = JSON.parse(event.data);
          if (res.topic && res.topic.startsWith('kline') && res.data && res.data.length > 0) {
            const k = res.data[0];
            const liveCandle: Candle = {
              time: Math.floor(parseInt(k.start, 10) / 1000),
              open: parseFloat(k.open),
              high: parseFloat(k.high),
              low: parseFloat(k.low),
              close: parseFloat(k.close),
              volume: parseFloat(k.volume),
            };
            onCandle(liveCandle);
          }
        } catch {
          // ignore
        }
      };
    } catch {
      // ignore
    }
  }

  // Attempt local FastAPI ws://localhost:8000/ws/candles first
  try {
    const localWs = new WebSocket(`ws://localhost:8000/ws/candles?symbol=${cleanSymbol}&timeframe=${timeframe}`);
    activeWs = localWs;

    localWs.onopen = () => {
      // Connected to local Python backend
    };

    localWs.onmessage = (event) => {
      if (isDestroyed) return;
      try {
        const data = JSON.parse(event.data);
        if (data.time && data.open !== undefined) {
          onCandle({
            time: data.time,
            open: data.open,
            high: data.high,
            low: data.low,
            close: data.close,
            volume: data.volume,
          });
        }
      } catch {
        // ignore
      }
    };

    localWs.onerror = () => {
      if (!isDestroyed) connectDirectBybit();
    };

    localWs.onclose = (event) => {
      if (!isDestroyed && !event.wasClean) {
        connectDirectBybit();
      }
    };
  } catch {
    connectDirectBybit();
  }

  return () => {
    isDestroyed = true;
    if (pingTimer) clearInterval(pingTimer);
    if (activeWs) {
      try { activeWs.close(); } catch { /* ignore */ }
    }
  };
}

