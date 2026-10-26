import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceDot
} from 'recharts';
import { formatCurrency, formatCompactCurrency } from '../../utils/currency';

export const ElasticityCurveChart = ({ data = [], height = 300 }) => {
  const safeData = Array.isArray(data) ? data : [];
  const optimalPoint = safeData.find(d => d.isOptimal) || safeData[safeData.length - 3] || safeData[0] || null;

  if (safeData.length === 0) {
    return (
      <div className="chart-wrapper" style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
        Elasticity data loading or unavailable
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-chart-tooltip">
          <div className="tooltip-title">Price Point: {formatCurrency(label)}</div>
          {payload.map((entry, index) => (
            <div key={`item-${index}`} className="tooltip-row">
              <span className="tooltip-label">
                <span className="tooltip-dot" style={{ backgroundColor: entry.color }} />
                {entry.name}:
              </span>
              <span className="tooltip-val">
                {entry.dataKey === 'demand' ? `${entry.value} units` : formatCurrency(entry.value, { decimals: 0 })}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="chart-wrapper" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={safeData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" vertical={false} />
          <XAxis
            dataKey="price"
            stroke="#64748B"
            fontSize={12}
            tickFormatter={(v) => formatCurrency(v, { decimals: 0 })}
            tickLine={false}
            axisLine={{ stroke: 'rgba(148, 163, 184, 0.15)' }}
          />
          <YAxis
            yAxisId="rev"
            stroke="#64748B"
            fontSize={12}
            tickLine={false}
            axisLine={{ stroke: 'rgba(148, 163, 184, 0.15)' }}
            tickFormatter={(v) => formatCompactCurrency(v)}
          />
          <YAxis
            yAxisId="demand"
            orientation="right"
            stroke="#64748B"
            fontSize={12}
            tickLine={false}
            axisLine={{ stroke: 'rgba(148, 163, 184, 0.15)' }}
            tickFormatter={(v) => `${v}u`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            wrapperStyle={{ paddingBottom: '12px', fontSize: '12px' }}
          />
          <Line
            yAxisId="rev"
            type="monotone"
            dataKey="revenue"
            name="Projected Revenue"
            stroke="#06B6D4"
            strokeWidth={2.5}
            dot={{ r: 3 }}
          />
          <Line
            yAxisId="rev"
            type="monotone"
            dataKey="profit"
            name="Estimated Gross Profit"
            stroke="#10B981"
            strokeWidth={2.5}
            dot={{ r: 3 }}
          />
          <Line
            yAxisId="demand"
            type="monotone"
            dataKey="demand"
            name="Expected Demand (Units)"
            stroke="#F59E0B"
            strokeWidth={2}
            strokeDasharray="3 3"
            dot={{ r: 2 }}
          />
          {optimalPoint && optimalPoint.profit !== undefined && (
            <ReferenceDot
              yAxisId="rev"
              x={optimalPoint.price}
              y={optimalPoint.profit}
              r={6}
              fill="#10B981"
              stroke="#ffffff"
              strokeWidth={2}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

