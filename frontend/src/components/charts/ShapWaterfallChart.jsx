import React from 'react';
import { ArrowUpRight, ArrowDownRight, Sparkles } from 'lucide-react';
import { formatCurrency } from '../../utils/currency';

export const ShapWaterfallChart = ({ shapData }) => {
  if (!shapData || !shapData.features) return null;

  return (
    <div className="shap-waterfall-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Sparkles size={16} color="var(--text-ai)" />
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {shapData.is_genuine_shap ? 'Local SHAP Price Decomposition' : 'Local Decision Attribution Decomposition'}
            </h4>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Additive feature attribution breaking down how base price shifts to optimal price
          </p>
        </div>

        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Recommended Target Price
          </span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-accent)', fontFamily: 'var(--font-mono)' }}>
            {formatCurrency(shapData.finalPrice)}
          </div>
        </div>
      </div>

      <div className="shap-legend-row">
        <div className="shap-legend-item">
          <div className="shap-color-pill shap-color-base" />
          <span style={{ color: 'var(--text-secondary)' }}>Baseline Shelf Price</span>
        </div>
        <div className="shap-legend-item">
          <div className="shap-color-pill shap-color-positive" />
          <span style={{ color: 'var(--text-secondary)' }}>Positive Driver (Price Increase Leverage)</span>
        </div>
        <div className="shap-legend-item">
          <div className="shap-color-pill shap-color-negative" />
          <span style={{ color: 'var(--text-secondary)' }}>Negative Driver (Discount / Volume Pressure)</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {shapData.features.map((feature, idx) => {
          const isBase = feature.type === 'base';
          const isPos = feature.type === 'positive';
          const isNeg = feature.type === 'negative';

          return (
            <div
              key={idx}
              className={`shap-factor-row ${isPos ? 'positive' : isNeg ? 'negative' : ''}`}
              style={{
                borderLeftWidth: '4px',
                borderLeftColor: isBase ? '#6366F1' : isPos ? 'var(--success)' : 'var(--danger)'
              }}
            >
              <div style={{ flex: 1, paddingRight: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '0.85rem' }}>
                  {isPos && <ArrowUpRight size={15} color="var(--success)" />}
                  {isNeg && <ArrowDownRight size={15} color="var(--danger)" />}
                  <span>{feature.name}</span>
                </div>
                {feature.reason && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {feature.reason}
                  </div>
                )}
              </div>

              <div style={{ textAlign: 'right' }}>
                <span
                  className="shap-value-pill"
                  style={{
                    color: isBase ? '#818CF8' : isPos ? 'var(--success)' : 'var(--danger)'
                  }}
                >
                  {isBase ? formatCurrency(feature.impact) : formatCurrency(feature.delta, { showSign: true })}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {shapData.naturalLanguageExplanation && (
        <div
          style={{
            marginTop: '1.25rem',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(6, 182, 212, 0.08)',
            border: '1px solid rgba(6, 182, 212, 0.25)',
            fontSize: '0.82rem',
            lineHeight: 1.6,
            color: 'var(--text-primary)'
          }}
        >
          <strong style={{ color: 'var(--text-accent)', display: 'block', marginBottom: '0.25rem' }}>
            AI Executive Summary:
          </strong>
          {shapData.naturalLanguageExplanation}
        </div>
      )}
    </div>
  );
};
