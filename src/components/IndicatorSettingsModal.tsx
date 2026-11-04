import React, { useState, useEffect } from 'react';
import { Settings2, RotateCcw } from 'lucide-react';
import { AppliedIndicator, IndicatorParam } from '../types/trading';

interface IndicatorSettingsModalProps {
  indicator: AppliedIndicator | null;
  isOpen: boolean;
  onClose: () => void;
  onApplySettings: (id: string, params: IndicatorParam[], color: string, lineWidth: number) => void;
}

const COLOR_PRESETS = [
  '#2962ff', // TradingView Blue
  '#089981', // TV Green
  '#f23645', // TV Red
  '#ff9800', // TV Orange
  '#7e57c2', // TV Purple
  '#00bcd4', // TV Cyan
  '#ffeb3b', // TV Yellow
  '#ffffff', // White
];

export const IndicatorSettingsModal: React.FC<IndicatorSettingsModalProps> = ({
  indicator,
  isOpen,
  onClose,
  onApplySettings,
}) => {
  const [activeTab, setActiveTab] = useState<'inputs' | 'style'>('inputs');
  const [params, setParams] = useState<IndicatorParam[]>([]);
  const [color, setColor] = useState('#2962ff');
  const [lineWidth, setLineWidth] = useState(2);

  useEffect(() => {
    if (indicator) {
      setParams(JSON.parse(JSON.stringify(indicator.params)));
      setColor(indicator.color);
      setLineWidth(indicator.lineWidth);
    }
  }, [indicator]);

  if (!isOpen || !indicator) return null;

  const handleParamChange = (index: number, val: unknown) => {
    const updated = [...params];
    updated[index].value = val as string | number | boolean;
    setParams(updated);
  };

  const handleSave = () => {
    onApplySettings(indicator.id, params, color, lineWidth);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#1e222d] border border-[#2a2e39] rounded-lg max-w-md w-full shadow-2xl overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2e39] bg-[#171b26]">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-[#2962ff]" />
            <span className="font-semibold text-white">{indicator.name}</span>
          </div>
          <button
            onClick={onClose}
            className="text-[#787b86] hover:text-white px-2 py-0.5 rounded hover:bg-[#2a2e39]"
          >
            ✕
          </button>
        </div>

        {/* Tabs: Inputs / Style */}
        <div className="flex items-center border-b border-[#2a2e39] bg-[#131722] px-4 pt-2">
          <button
            onClick={() => setActiveTab('inputs')}
            className={`pb-2 px-3 font-medium transition-colors border-b-2 ${
              activeTab === 'inputs'
                ? 'border-[#2962ff] text-white'
                : 'border-transparent text-[#787b86] hover:text-white'
            }`}
          >
            Входные данные (Inputs)
          </button>
          <button
            onClick={() => setActiveTab('style')}
            className={`pb-2 px-3 font-medium transition-colors border-b-2 ${
              activeTab === 'style'
                ? 'border-[#2962ff] text-white'
                : 'border-transparent text-[#787b86] hover:text-white'
            }`}
          >
            Стиль (Style)
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {activeTab === 'inputs' && (
            <div className="space-y-3">
              {params.length === 0 ? (
                <div className="text-center py-6 text-[#787b86]">
                  Нет настраиваемых параметров. Откройте &quot;Исходный код&quot; &#123; &#125; для тонкой правки логики.
                </div>
              ) : (
                params.map((param, idx) => (
                  <div key={param.key} className="flex items-center justify-between gap-3">
                    <label className="text-[#d1d4dc] font-medium">{param.label}</label>
                    {param.type === 'number' ? (
                      <input
                        type="number"
                        value={Number(param.value)}
                        min={param.min}
                        max={param.max}
                        step={param.step || 1}
                        onChange={e => handleParamChange(idx, Number(e.target.value))}
                        className="w-28 bg-[#131722] text-white px-2.5 py-1 rounded border border-[#2a2e39] font-mono text-right focus:border-[#2962ff] focus:outline-hidden"
                      />
                    ) : (
                      <input
                        type="text"
                        value={String(param.value)}
                        onChange={e => handleParamChange(idx, e.target.value)}
                        className="w-28 bg-[#131722] text-white px-2.5 py-1 rounded border border-[#2a2e39] font-mono focus:border-[#2962ff] focus:outline-hidden"
                      />
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'style' && (
            <div className="space-y-4">
              <div>
                <label className="block text-[#787b86] mb-2 font-medium">Основной цвет линии</label>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="color"
                    value={color}
                    onChange={e => setColor(e.target.value)}
                    className="w-8 h-8 rounded border border-[#2a2e39] cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={color}
                    onChange={e => setColor(e.target.value)}
                    className="w-24 bg-[#131722] text-white px-2 py-1 rounded border border-[#2a2e39] font-mono text-center uppercase"
                  />
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  {COLOR_PRESETS.map(preset => (
                    <button
                      key={preset}
                      onClick={() => setColor(preset)}
                      className={`w-6 h-6 rounded-full border transition-transform ${
                        color === preset ? 'scale-115 border-white' : 'border-transparent hover:scale-110'
                      }`}
                      style={{ backgroundColor: preset }}
                      title={preset}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[#787b86] mb-2 font-medium">Толщина линии</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4].map(w => (
                    <button
                      key={w}
                      onClick={() => setLineWidth(w)}
                      className={`flex-1 py-1.5 px-3 rounded border font-mono transition-colors ${
                        lineWidth === w
                          ? 'bg-[#2962ff] border-[#2962ff] text-white'
                          : 'bg-[#131722] border-[#2a2e39] text-[#787b86] hover:text-white'
                      }`}
                    >
                      {w}px
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#2a2e39] bg-[#171b26] flex items-center justify-between">
          <button
            onClick={() => {
              if (indicator) {
                setParams(JSON.parse(JSON.stringify(indicator.params)));
                setColor('#2962ff');
                setLineWidth(2);
              }
            }}
            className="flex items-center gap-1 text-[11px] text-[#787b86] hover:text-white"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Сброс</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-[#2a2e39] hover:bg-[#363c4e] text-white rounded font-medium transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 bg-[#2962ff] hover:bg-[#1e53e5] text-white rounded font-medium transition-colors"
            >
              ОК
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
