import React from 'react';
import { TrendingUp, TrendingDown, Minus, ArrowUpRight } from 'lucide-react';

export const MetricCard = ({
  title,
  value,
  subvalue,
  trend,
  trendValue,
  icon: Icon,
  iconColor = 'var(--primary)',
  iconBg = 'rgba(99, 102, 241, 0.12)',
  glow = false,
  onClick = null,
  clickableText = null
}) => {
  const isClickable = Boolean(onClick);

  return (
    <div
      className={`metric-card ${glow ? 'card-glow-ai' : ''} ${isClickable ? 'metric-card-interactive' : ''}`}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      style={{
        cursor: isClickable ? 'pointer' : 'default',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative'
      }}
    >
      <div className="metric-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span className="metric-title">{title}</span>
          {isClickable && (
            <ArrowUpRight size={13} style={{ opacity: 0.5, color: 'var(--text-secondary)' }} />
          )}
        </div>
        {Icon && (
          <div
            className="metric-icon-box"
            style={{ backgroundColor: iconBg, color: iconColor }}
          >
            <Icon size={18} strokeWidth={2.2} />
          </div>
        )}
      </div>

      <div className="metric-value-row">
        <span className="metric-value">{value}</span>
      </div>

      <div className="metric-trend-row">
        {trend && (
          <span
            className={`trend-badge ${
              trend === 'up'
                ? 'trend-up'
                : trend === 'down'
                ? 'trend-down'
                : 'trend-neutral'
            }`}
          >
            {trend === 'up' && <TrendingUp size={12} />}
            {trend === 'down' && <TrendingDown size={12} />}
            {trend === 'neutral' && <Minus size={12} />}
            {trendValue}
          </span>
        )}
        {subvalue && <span className="metric-subvalue">{subvalue}</span>}
      </div>
    </div>
  );
};
