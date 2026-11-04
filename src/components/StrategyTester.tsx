import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  ListOrdered,
  Settings2,
  Download,
  AlertCircle,
  Percent,
  DollarSign,
  Activity,
  ShieldAlert,
} from 'lucide-react';
import { BacktestReport, BacktestSettings } from '../types/trading';

interface StrategyTesterProps {
  report?: BacktestReport;
  settings: BacktestSettings;
  onUpdateSettings: (newSettings: BacktestSettings) => void;
  onReRunBacktest: () => void;
}

export const StrategyTester: React.FC<StrategyTesterProps> = ({
  report,
  settings,
  onUpdateSettings,
  onReRunBacktest,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'curve' | 'trades' | 'settings'>('overview');
  const [tradeFilter, setTradeFilter] = useState<'all' | 'wins' | 'losses'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  if (!report || report.totalTrades === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center text-[#787b86] bg-[#1e222d]">
        <BarChart3 className="w-12 h-12 text-[#2a2e39] mb-3" />
        <h3 className="text-sm font-semibold text-white mb-1">No Strategy Backtest Results Yet</h3>
        <p className="text-xs max-w-md text-[#787b86] mb-4">
          Open the Pine Editor, choose a strategy template (e.g. EMA Cross, RSI Reversal, SuperTrend), and click <strong className="text-white">&quot;Apply &amp; Run&quot;</strong> to backtest historical performance.
        </p>
      </div>
    );
  }

  const isNetProfitPositive = report.netProfit >= 0;

  // Filter trades
  const filteredTrades = report.trades.filter(t => {
    if (tradeFilter === 'wins' && t.pnl <= 0) return false;
    if (tradeFilter === 'losses' && t.pnl >= 0) return false;
    if (searchQuery && !t.reason.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const handleExportTradesCSV = () => {
    const headers = 'Trade,Type,Entry Time,Entry Price,Exit Time,Exit Price,Size,PnL ($),PnL (%),Cum Equity,Reason\n';
    const rows = report.trades.map((t, idx) => {
      const entryDate = new Date(t.entryTime * 1000).toISOString();
      const exitDate = new Date(t.exitTime * 1000).toISOString();
      return `${idx + 1},${t.type},"${entryDate}",${t.entryPrice},"${exitDate}",${t.exitPrice},${t.size},${t.pnl},${t.pnlPercent},${t.cumEquity},"${t.reason}"`;
    }).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backtest_trades_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Helper for rendering SVG Equity Curve
  const renderEquitySVG = () => {
    const points = report.equityCurve;
    if (!points || points.length < 2) return null;

    const equities = points.map(p => p.equity);
    const minEquity = Math.min(...equities) * 0.98;
    const maxEquity = Math.max(...equities) * 1.02;
    const range = maxEquity - minEquity || 1;

    const width = 800;
    const height = 180;
    const padding = 20;

    const coordinates = points.map((p, i) => {
      const x = padding + (i / (points.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((p.equity - minEquity) / range) * (height - 2 * padding);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const pathD = `M ${coordinates.join(' L ')}`;
    const areaD = `${pathD} L ${width - padding},${height - padding} L ${padding},${height - padding} Z`;

    return (
      <div className="w-full h-full flex flex-col p-4 bg-[#171b26] rounded border border-[#2a2e39]">
        <div className="flex items-center justify-between mb-2 text-xs">
          <span className="text-[#787b86]">Cumulative Account Equity Curve</span>
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span>Initial: <strong className="text-white">${report.initialCapital.toLocaleString()}</strong></span>
            <span>Final: <strong className={isNetProfitPositive ? 'text-[#089981]' : 'text-[#f23645]'}>${report.finalCapital.toLocaleString()}</strong></span>
          </div>
        </div>
        <div className="flex-1 w-full relative">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
            <defs>
              <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isNetProfitPositive ? '#089981' : '#f23645'} stopOpacity="0.35" />
                <stop offset="100%" stopColor={isNetProfitPositive ? '#089981' : '#f23645'} stopOpacity="0.0" />
              </linearGradient>
            </defs>
            {/* Horizontal baseline at initial capital */}
            <line
              x1={padding}
              y1={height - padding - ((report.initialCapital - minEquity) / range) * (height - 2 * padding)}
              x2={width - padding}
              y2={height - padding - ((report.initialCapital - minEquity) / range) * (height - 2 * padding)}
              stroke="#2a2e39"
              strokeDasharray="4 4"
            />
            {/* Area Fill */}
            <path d={areaD} fill="url(#equityGrad)" />
            {/* Line Path */}
            <path d={pathD} fill="none" stroke={isNetProfitPositive ? '#089981' : '#f23645'} strokeWidth="2" />
          </svg>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#1e222d] text-[#d1d4dc] text-xs">
      {/* Strategy Tester Sub-Navigation Tabs */}
      <div className="flex items-center justify-between px-3 py-1 bg-[#171b26] border-b border-[#2a2e39] shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 font-medium rounded transition-colors ${
              activeTab === 'overview'
                ? 'bg-[#2a2e39] text-white shadow-xs'
                : 'text-[#787b86] hover:text-white'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('curve')}
            className={`px-3 py-1.5 font-medium rounded transition-colors ${
              activeTab === 'curve'
                ? 'bg-[#2a2e39] text-white shadow-xs'
                : 'text-[#787b86] hover:text-white'
            }`}
          >
            Equity Curve
          </button>
          <button
            onClick={() => setActiveTab('trades')}
            className={`px-3 py-1.5 font-medium rounded transition-colors flex items-center gap-1.5 ${
              activeTab === 'trades'
                ? 'bg-[#2a2e39] text-white shadow-xs'
                : 'text-[#787b86] hover:text-white'
            }`}
          >
            <span>List of Trades</span>
            <span className="font-mono text-[10px] px-1.5 py-0.2 bg-[#131722] rounded text-[#787b86]">
              {report.totalTrades}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1.5 font-medium rounded transition-colors flex items-center gap-1 ${
              activeTab === 'settings'
                ? 'bg-[#2a2e39] text-white shadow-xs'
                : 'text-[#787b86] hover:text-white'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>
        </div>

        {/* Quick Summary Pill */}
        <div className="flex items-center gap-3 font-mono text-[11px]">
          <span className="text-[#787b86]">Net Profit:</span>
          <span className={`font-semibold ${isNetProfitPositive ? 'text-[#089981]' : 'text-[#f23645]'}`}>
            {isNetProfitPositive ? '+' : ''}${report.netProfit.toLocaleString()} ({isNetProfitPositive ? '+' : ''}{report.netProfitPercent}%)
          </span>
        </div>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 p-3 overflow-y-auto">
        {activeTab === 'overview' && (
          <div className="space-y-3">
            {/* Top Key Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 bg-[#171b26] rounded border border-[#2a2e39]">
                <div className="text-[#787b86] text-[11px] mb-1 flex items-center justify-between">
                  <span>Net Profit</span>
                  {isNetProfitPositive ? (
                    <TrendingUp className="w-3.5 h-3.5 text-[#089981]" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5 text-[#f23645]" />
                  )}
                </div>
                <div className={`text-base font-bold font-mono ${isNetProfitPositive ? 'text-[#089981]' : 'text-[#f23645]'}`}>
                  {isNetProfitPositive ? '+' : ''}${report.netProfit.toLocaleString()}
                </div>
                <div className="text-[10px] text-[#787b86] font-mono mt-0.5">
                  {isNetProfitPositive ? '+' : ''}{report.netProfitPercent}% Return
                </div>
              </div>

              <div className="p-3 bg-[#171b26] rounded border border-[#2a2e39]">
                <div className="text-[#787b86] text-[11px] mb-1 flex items-center justify-between">
                  <span>Win Rate</span>
                  <Percent className="w-3.5 h-3.5 text-[#2962ff]" />
                </div>
                <div className="text-base font-bold font-mono text-white">
                  {report.winRate}%
                </div>
                <div className="text-[10px] text-[#787b86] font-mono mt-0.5">
                  {report.winningTrades} Wins / {report.losingTrades} Losses
                </div>
              </div>

              <div className="p-3 bg-[#171b26] rounded border border-[#2a2e39]">
                <div className="text-[#787b86] text-[11px] mb-1 flex items-center justify-between">
                  <span>Profit Factor</span>
                  <Activity className="w-3.5 h-3.5 text-[#e040fb]" />
                </div>
                <div className="text-base font-bold font-mono text-white">
                  {report.profitFactor}
                </div>
                <div className="text-[10px] text-[#787b86] font-mono mt-0.5">
                  Sharpe: {report.sharpeRatio}
                </div>
              </div>

              <div className="p-3 bg-[#171b26] rounded border border-[#2a2e39]">
                <div className="text-[#787b86] text-[11px] mb-1 flex items-center justify-between">
                  <span>Max Drawdown</span>
                  <ShieldAlert className="w-3.5 h-3.5 text-[#f23645]" />
                </div>
                <div className="text-base font-bold font-mono text-[#f23645]">
                  -{report.maxDrawdownPercent}%
                </div>
                <div className="text-[10px] text-[#787b86] font-mono mt-0.5">
                  -${report.maxDrawdown.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Performance Breakdown Table */}
            <div className="bg-[#171b26] rounded border border-[#2a2e39] overflow-hidden">
              <div className="px-3 py-2 border-b border-[#2a2e39] text-xs font-semibold text-white">
                Performance Summary &amp; Trade Statistics
              </div>
              <div className="divide-y divide-[#2a2e39] text-xs">
                <div className="flex justify-between px-3 py-2">
                  <span className="text-[#787b86]">Initial Capital</span>
                  <span className="font-mono text-white">${report.initialCapital.toLocaleString()}</span>
                </div>
                <div className="flex justify-between px-3 py-2">
                  <span className="text-[#787b86]">Ending Account Equity</span>
                  <span className={`font-mono font-semibold ${isNetProfitPositive ? 'text-[#089981]' : 'text-[#f23645]'}`}>
                    ${report.finalCapital.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between px-3 py-2">
                  <span className="text-[#787b86]">Total Closed Trades</span>
                  <span className="font-mono text-white">{report.totalTrades}</span>
                </div>
                <div className="flex justify-between px-3 py-2">
                  <span className="text-[#787b86]">Average Trade Return</span>
                  <span className={`font-mono ${report.avgTradePercent >= 0 ? 'text-[#089981]' : 'text-[#f23645]'}`}>
                    {report.avgTradePercent >= 0 ? '+' : ''}{report.avgTradePercent}%
                  </span>
                </div>
                <div className="flex justify-between px-3 py-2">
                  <span className="text-[#787b86]">Commission &amp; Slippage Deducted</span>
                  <span className="font-mono text-[#787b86]">
                    {settings.commissionPercent}% fee + {settings.slippagePercent}% slippage
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'curve' && (
          <div className="h-full min-h-[220px]">
            {renderEquitySVG()}
          </div>
        )}

        {activeTab === 'trades' && (
          <div className="space-y-2">
            {/* Filter and Export Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 bg-[#171b26] p-1 rounded border border-[#2a2e39]">
                <button
                  onClick={() => setTradeFilter('all')}
                  className={`px-2.5 py-1 text-[11px] rounded transition-colors ${
                    tradeFilter === 'all' ? 'bg-[#2a2e39] text-white' : 'text-[#787b86] hover:text-white'
                  }`}
                >
                  All ({report.trades.length})
                </button>
                <button
                  onClick={() => setTradeFilter('wins')}
                  className={`px-2.5 py-1 text-[11px] rounded transition-colors ${
                    tradeFilter === 'wins' ? 'bg-[#2a2e39] text-[#089981]' : 'text-[#787b86] hover:text-white'
                  }`}
                >
                  Winners ({report.winningTrades})
                </button>
                <button
                  onClick={() => setTradeFilter('losses')}
                  className={`px-2.5 py-1 text-[11px] rounded transition-colors ${
                    tradeFilter === 'losses' ? 'bg-[#2a2e39] text-[#f23645]' : 'text-[#787b86] hover:text-white'
                  }`}
                >
                  Losers ({report.losingTrades})
                </button>
              </div>

              <button
                onClick={handleExportTradesCSV}
                className="flex items-center gap-1.5 px-3 py-1 bg-[#2a2e39] hover:bg-[#363c4e] text-white rounded transition-colors text-xs"
              >
                <Download className="w-3.5 h-3.5 text-[#787b86]" />
                <span>Export CSV</span>
              </button>
            </div>

            {/* Trades Table */}
            <div className="bg-[#171b26] rounded border border-[#2a2e39] overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#131722] text-[#787b86] text-[11px] border-b border-[#2a2e39]">
                  <tr>
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-3">Type</th>
                    <th className="py-2 px-3">Entry Time</th>
                    <th className="py-2 px-3 text-right">Entry Price</th>
                    <th className="py-2 px-3">Exit Time</th>
                    <th className="py-2 px-3 text-right">Exit Price</th>
                    <th className="py-2 px-3 text-right">PnL ($)</th>
                    <th className="py-2 px-3 text-right">ROI (%)</th>
                    <th className="py-2 px-3 text-right">Cum. Equity</th>
                    <th className="py-2 px-3">Exit Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2e39]">
                  {filteredTrades.map((trade, idx) => {
                    const isWin = trade.pnl >= 0;
                    return (
                      <tr key={trade.id} className="hover:bg-[#1e222d] transition-colors">
                        <td className="py-2 px-3 text-[#787b86]">{idx + 1}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              trade.type === 'LONG'
                                ? 'bg-[#089981]/20 text-[#089981]'
                                : 'bg-[#f23645]/20 text-[#f23645]'
                            }`}
                          >
                            {trade.type}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-[#d1d4dc] text-[11px]">
                          {new Date(trade.entryTime * 1000).toLocaleDateString()} {new Date(trade.entryTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-2 px-3 text-right text-white">
                          ${trade.entryPrice.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-[#d1d4dc] text-[11px]">
                          {new Date(trade.exitTime * 1000).toLocaleDateString()} {new Date(trade.exitTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-2 px-3 text-right text-white">
                          ${trade.exitPrice.toFixed(2)}
                        </td>
                        <td className={`py-2 px-3 text-right font-semibold ${isWin ? 'text-[#089981]' : 'text-[#f23645]'}`}>
                          {isWin ? '+' : ''}${trade.pnl.toFixed(2)}
                        </td>
                        <td className={`py-2 px-3 text-right font-semibold ${isWin ? 'text-[#089981]' : 'text-[#f23645]'}`}>
                          {isWin ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
                        </td>
                        <td className="py-2 px-3 text-right text-white font-semibold">
                          ${trade.cumEquity.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-[#787b86] text-[11px] max-w-xs truncate">
                          {trade.reason}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-xl space-y-4 bg-[#171b26] p-4 rounded border border-[#2a2e39]">
            <h4 className="text-xs font-semibold text-white mb-2">Backtest Parameters &amp; Execution Environment</h4>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[#787b86] mb-1">Initial Capital ($)</label>
                <input
                  type="number"
                  value={settings.initialCapital}
                  onChange={e => onUpdateSettings({ ...settings, initialCapital: Number(e.target.value) || 1000 })}
                  className="w-full bg-[#131722] text-white px-3 py-1.5 rounded border border-[#2a2e39] font-mono focus:border-[#2962ff] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[#787b86] mb-1">Order Size (% of Equity)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={settings.orderSizePercent}
                  onChange={e => onUpdateSettings({ ...settings, orderSizePercent: Number(e.target.value) || 100 })}
                  className="w-full bg-[#131722] text-white px-3 py-1.5 rounded border border-[#2a2e39] font-mono focus:border-[#2962ff] focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#787b86] mb-1">Commission (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={settings.commissionPercent}
                    onChange={e => onUpdateSettings({ ...settings, commissionPercent: Number(e.target.value) || 0 })}
                    className="w-full bg-[#131722] text-white px-3 py-1.5 rounded border border-[#2a2e39] font-mono focus:border-[#2962ff] focus:outline-hidden"
                  />
                  <span className="text-[10px] text-[#787b86]">e.g. 0.075% Binance fee</span>
                </div>

                <div>
                  <label className="block text-[#787b86] mb-1">Slippage (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={settings.slippagePercent}
                    onChange={e => onUpdateSettings({ ...settings, slippagePercent: Number(e.target.value) || 0 })}
                    className="w-full bg-[#131722] text-white px-3 py-1.5 rounded border border-[#2a2e39] font-mono focus:border-[#2962ff] focus:outline-hidden"
                  />
                  <span className="text-[10px] text-[#787b86]">Simulates market execution spread</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={onReRunBacktest}
                className="px-4 py-1.5 bg-[#2962ff] hover:bg-[#1e53e5] text-white font-medium rounded text-xs transition-colors"
              >
                Apply &amp; Re-run Backtest
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
