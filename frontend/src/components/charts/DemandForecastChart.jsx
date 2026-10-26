import React, { useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Brush
} from 'recharts';
import { Sliders, Download } from 'lucide-react';

export const DemandForecastChart = ({ data, height = 320 }) => {
  const [showBrush, setShowBrush] = useState(false);
  const [hiddenSeries, setHiddenSeries] = useState({
    upperP90: false,
    lowerP10: false,
    promoUplift: false,
    baseline: false,
    forecastP50: false
  });

  const toggleSeries = (dataKey) => {
    setHiddenSeries(prev => ({ ...prev, [dataKey]: !prev[dataKey] }));
  };

  const handleExportCsv = () => {
    if (!data || data.length === 0) return;
    const header = 'Time,Historical Baseline,Projected Demand (P50),Lower P10,Upper P90,Promotional Surge,Actual Revenue (INR),Projected Revenue (INR)\n';
    const rows = data.map(d =>
      `"${d.time}",${d.baseline || d.historical_sales || 0},${d.forecastP50 || d.predicted_demand || 0},${d.lowerP10 || d.lower_bound || 0},${d.upperP90 || d.upper_bound || 0},${d.promoUplift || 0},${d.actual_revenue || 0},${d.projected_revenue || 0}`
    ).join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `demand_forecast_data.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const p50 = payload.find(p => p.dataKey === 'forecastP50');
      const base = payload.find(p => p.dataKey === 'baseline');
      const currentPoint = payload[0]?.payload || {};
      let delta = null;
      if (p50 && base && p50.value !== undefined && base.value !== undefined) {
        delta = p50.value - base.value;
      }

      return (
        <div className="custom-chart-tooltip card-glass">
          <div className="tooltip-title">{label} - Demand Horizon</div>
          {payload.map((entry, index) => (
            <div key={`item-${index}`} className="tooltip-row">
              <span className="tooltip-label">
                <span className="tooltip-dot" style={{ backgroundColor: entry.color }} />
                {entry.name}:
              </span>
              <span className="tooltip-val" style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                {entry.value !== null && entry.value !== undefined && !isNaN(entry.value)
                  ? `${Number(entry.value).toLocaleString()} units`
                  : '0 units'}
              </span>
            </div>
          ))}

          {delta !== null && (
            <div className="tooltip-delta-row" style={{ marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Net Variance vs Baseline:</span>
              <span style={{ color: delta >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 800 }}>
                {delta >= 0 ? `+${delta.toLocaleString()}` : delta.toLocaleString()} units {base.value ? `(${((delta / base.value) * 100).toFixed(1)}%)` : ''}
              </span>
            </div>
          )}

          {currentPoint.projected_revenue ? (
            <div className="tooltip-delta-row" style={{ marginTop: '0.3rem', fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Projected Revenue:</span>
              <span style={{ color: 'var(--accent)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                ₹{Number(currentPoint.projected_revenue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          ) : null}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {/* Micro control bar */}
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
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: showBrush ? 10 : 0 }}>
            <defs>
              <linearGradient id="confidenceBandGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#10B981" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" vertical={false} />
            <XAxis
              dataKey="time"
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
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{ paddingBottom: '12px', fontSize: '12px', cursor: 'pointer' }}
              onClick={(e) => toggleSeries(e.dataKey)}
            />

            {!hiddenSeries.upperP90 && (
              <Area
                type="monotone"
                dataKey="upperP90"
                name="P90 Upper Bound"
                stroke="#10B981"
                strokeWidth={1}
                strokeDasharray="2 2"
                fill="#10B981"
                fillOpacity={0.12}
              />
            )}

            {!hiddenSeries.lowerP10 && (
              <Line
                type="monotone"
                dataKey="lowerP10"
                name="P10 Lower Bound"
                stroke="#059669"
                strokeWidth={1.5}
                strokeDasharray="3 3"
                dot={false}
              />
            )}

            {!hiddenSeries.promoUplift && (
              <Bar
                dataKey="promoUplift"
                name="Promotional Surge"
                fill="#F59E0B"
                radius={[4, 4, 0, 0]}
                barSize={16}
              />
            )}

            {!hiddenSeries.baseline && (
              <Line
                type="monotone"
                dataKey="baseline"
                name="Historical Baseline"
                stroke="#64748B"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
              />
            )}

            {!hiddenSeries.forecastP50 && (
              <Line
                type="monotone"
                dataKey="forecastP50"
                name="Projected Demand (P50)"
                stroke="#10B981"
                strokeWidth={3}
                dot={{ r: 4, fill: '#10B981' }}
              />
            )}

            {showBrush && (
              <Brush
                dataKey="time"
                height={26}
                stroke="#10B981"
                fill="rgba(15, 23, 42, 0.8)"
                tickFormatter={(v) => String(v)}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

