import React, { useState } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Candle } from '../types/trading';
import { parseCSVToCandles } from '../services/marketData';

interface DataUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataLoaded: (candles: Candle[], name: string) => void;
}

export const DataUploadModal: React.FC<DataUploadModalProps> = ({
  isOpen,
  onClose,
  onDataLoaded,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setSuccessCount(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      try {
        const text = event.target?.result as string;
        const candles = parseCSVToCandles(text);
        if (candles.length < 5) {
          throw new Error('CSV must contain at least 5 candles.');
        }
        setSuccessCount(candles.length);
        const assetName = file.name.replace(/\.[^/.]+$/, '').toUpperCase();
        setTimeout(() => {
          onDataLoaded(candles, assetName);
          onClose();
        }, 800);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to parse CSV file.');
      }
    };
    reader.readAsText(file);
  };

  const handleLoadSampleCSV = () => {
    // Generate sample 100-bar CSV string
    let csv = 'Date,Open,High,Low,Close,Volume\n';
    let price = 50000;
    const now = Math.floor(Date.now() / 1000) - 100 * 3600;
    for (let i = 0; i < 100; i++) {
      const open = price;
      const change = (Math.random() - 0.48) * 500;
      const close = open + change;
      const high = Math.max(open, close) + Math.random() * 200;
      const low = Math.min(open, close) - Math.random() * 200;
      const volume = Math.floor(1000 + Math.random() * 5000);
      const date = new Date((now + i * 3600) * 1000).toISOString();
      csv += `${date},${open.toFixed(2)},${high.toFixed(2)},${low.toFixed(2)},${close.toFixed(2)},${volume}\n`;
      price = close;
    }
    const candles = parseCSVToCandles(csv);
    onDataLoaded(candles, 'SAMPLE_DATA');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#1e222d] border border-[#2a2e39] rounded-lg max-w-md w-full p-5 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-[#2a2e39] mb-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[#2962ff]" />
            <h3 className="text-sm font-semibold text-white">Import Historical Candle Data</h3>
          </div>
          <button onClick={onClose} className="text-[#787b86] hover:text-white">✕</button>
        </div>

        <p className="text-xs text-[#787b86] mb-4">
          Upload any CSV file from Binance, Bybit, MetaTrader, or Yahoo Finance to test your custom strategies on historical market periods.
        </p>

        <label className="border-2 border-dashed border-[#2a2e39] hover:border-[#2962ff] rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors bg-[#171b26]/50 mb-4">
          <Upload className="w-8 h-8 text-[#787b86] mb-2" />
          <span className="text-xs font-medium text-white mb-1">Click to select CSV file</span>
          <span className="text-[11px] text-[#787b86]">Required columns: Date/Time, Open, High, Low, Close, Volume</span>
          <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
        </label>

        {error && (
          <div className="flex items-center gap-2 p-2.5 bg-[#f23645]/10 border border-[#f23645]/30 rounded text-[#f23645] text-xs mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successCount && (
          <div className="flex items-center gap-2 p-2.5 bg-[#089981]/10 border border-[#089981]/30 rounded text-[#089981] text-xs mb-4">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Loaded {successCount} candles successfully!</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-[#2a2e39]">
          <button
            onClick={handleLoadSampleCSV}
            className="text-xs text-[#2962ff] hover:underline"
          >
            Load Sample Dataset
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#2a2e39] hover:bg-[#363c4e] text-white rounded text-xs transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
