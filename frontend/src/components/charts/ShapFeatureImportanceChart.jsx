import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell
} from 'recharts';

export const ShapFeatureImportanceChart = ({ features, height = 300 }) => {
  const featureList = Array.isArray(features) ? features : Array.isArray(features?.features) ? features.features : [];
  const sortedData = [...featureList].sort((a, b) => b.importance - a.importance);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="custom-chart-tooltip">
          <div className="tooltip-title">{data.feature}</div>
          <div className="tooltip-row">
            <span className="tooltip-label">Category:</span>
            <span className="tooltip-val">{data.category}</span>
          </div>
          <div className="tooltip-row">
            <span className="tooltip-label">Mean |SHAP Value|:</span>
            <span className="tooltip-val">{(data.importance * 100).toFixed(1)}%</span>
          </div>
          {data.description && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.35rem' }}>
              {data.description}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const getBarColor = (index) => {
    const colors = ['#6366F1', '#06B6D4', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899'];
    return colors[index % colors.length];
  };

  return (
    <div className="chart-wrapper" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={sortedData}
          layout="vertical"
          margin={{ top: 10, right: 30, left: 60, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" horizontal={false} />
          <XAxis
            type="number"
            stroke="#64748B"
            fontSize={12}
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            tickLine={false}
            axisLine={{ stroke: 'rgba(148, 163, 184, 0.15)' }}
          />
          <YAxis
            type="category"
            dataKey="feature"
            stroke="#94A3B8"
            fontSize={12}
            tickLine={false}
            axisLine={{ stroke: 'rgba(148, 163, 184, 0.15)' }}
            width={160}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="importance"
            name="SHAP Feature Weight"
            radius={[0, 6, 6, 0]}
            barSize={18}
          >
            {sortedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(index)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

