import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Brush
} from 'recharts';
import { Sliders, Download, Eye, EyeOff, Sparkles } from 'lucide-react';
import { formatCurrency, formatCompactCurrency } from '../../utils/currency';

export const RevenueTrendChart = ({ data, height = 320 }) => {
  const [showBrush, setShowBrush] = useState(false);
  const [hiddenSeries, setHiddenSeries] = useState({
    actualRevenue: false,
    aiOptimizedRevenue: false
  });

  const toggleSeries = (dataKey) => {
    setHiddenSeries(prev => ({ ...prev, [dataKey]: !prev[dataKey] }));
  };

  const handleExportCsv = () => {
    if (!data || data.length === 0) return;
    const header = 'Month,Actual Revenue,AI Optimized Projection,Revenue Delta\n';
    const rows = data.map(d => {
      const delta = (d.aiOptimizedRevenue || 0) - (d.actualRevenue || 0);
      return `"${d.month}",${d.actualRevenue || 0},${d.aiOptimizedRevenue || 0},${delta}`;
    }).join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `revenue_trend_timeseries.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const actualItem = payload.find(p => p.dataKey === 'actualRevenue');
      const aiItem = payload.find(p => p.dataKey === 'aiOptimizedRevenue');

      let deltaValue = null;
      let deltaPercent = null;
      if (actualItem && aiItem && actualItem.value && aiItem.value) {
        deltaValue = aiItem.value - actualItem.value;
        deltaPercent = ((deltaValue / actualItem.value) * 100).toFixed(1);
      }

      return (
        <div className="custom-chart-tooltip card-glass">
          <div className="tooltip-title">{label} Revenue Horizon</div>
          {payload.map((entry, index) => (
            <div key={`item-${index}`} className="tooltip-row">
              <span className="tooltip-label">
                <span className="tooltip-dot" style={{ backgroundColor: entry.color }} />
                {entry.name}:
              </span>
              <span className="tooltip-val" style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                {entry.value !== null && entry.value !== undefined && !isNaN(entry.value)
                  ? formatCurrency(entry.value, { decimals: 0 })
                  : 'N/A'}
              </span>
            </div>
          ))}

          {deltaValue !== null && (
            <div className="tooltip-delta-row" style={{ marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>Projected Lift:</span>
              <span style={{ color: deltaValue >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 800 }}>
                {deltaValue >= 0 ? `+${formatCurrency(deltaValue, { decimals: 0 })}` : formatCurrency(deltaValue, { decimals: 0 })} ({deltaPercent > 0 ? `+${deltaPercent}%` : `${deltaPercent}%`})
              </span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {/* Chart interactive control toolbar */}
      <div className="chart-micro-toolbar" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', marginBottom: '0.5rem' }}>
        <button
          className={`btn btn-sm ${showBrush ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
          onClick={() => setShowBrush(!showBrush)}
          title="Toggle interactive time-range zoom scrubber"
        >
          <Sliders size={12} />
          <span>{showBrush ? 'Hide Scrubber' : 'Zoom Scrubber'}</span>
        </button>

        <button
          className="btn btn-secondary btn-sm"
          style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
          onClick={handleExportCsv}
          title="Download chart data as CSV"
        >
          <Download size={12} />
          <span>Export CSV</span>
        </button>
      </div>

      <div className="chart-wrapper" style={{ height: showBrush ? height + 40 : height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: showBrush ? 10 : 0 }}>
            <defs>
              <linearGradient id="actualRevGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366F1" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#6366F1" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="aiRevGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" vertical={false} />
            <XAxis
              dataKey="month"
              stroke="#64748B"
              fontSize={12}
              tickLine={false}
              axisLine={{ stroke: 'rgba(148, 163, 184, 0.15)' }}
            />
            <YAxis
              stroke="#64748B"
              fontSize={12}
              tickLine={false}
              axisLine={{ stroke: 'rgba(148, 163, 184, 0.15)' }}
              tickFormatter={(v) => formatCompactCurrency(v)}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{ paddingBottom: '12px', fontSize: '12px', cursor: 'pointer' }}
              onClick={(e) => toggleSeries(e.dataKey)}
            />

            {!hiddenSeries.actualRevenue && (
              <Area
                type="monotone"
                dataKey="actualRevenue"
                name="Actual Revenue (Click to toggle)"
                stroke="#6366F1"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#actualRevGrad)"
              />
            )}

            {!hiddenSeries.aiOptimizedRevenue && (
              <Area
                type="monotone"
                dataKey="aiOptimizedRevenue"
                name="AI Optimized Projection (Click to toggle)"
                stroke="#06B6D4"
                strokeWidth={2.5}
                strokeDasharray="4 4"
                fillOpacity={1}
                fill="url(#aiRevGrad)"
              />
            )}

            {showBrush && (
              <Brush
                dataKey="month"
                height={26}
                stroke="#6366F1"
                fill="rgba(15, 23, 42, 0.8)"
                tickFormatter={(v) => String(v)}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
