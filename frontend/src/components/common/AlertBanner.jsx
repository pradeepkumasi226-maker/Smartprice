import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';

export const AlertBanner = ({ title, description, actionText, onAction, icon: Icon = Sparkles }) => {
  return (
    <div className="ai-recommendation-banner">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div
          style={{
            width: '42px',
            height: '42px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--ai-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            flexShrink: 0
          }}
        >
          <Icon size={22} />
        </div>
        <div>
          <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
            {title}
          </h4>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
            {description}
          </p>
        </div>
      </div>

      {actionText && (
        <button
          onClick={onAction}
          className="btn btn-ai"
          style={{ flexShrink: 0, marginLeft: '1rem' }}
        >
          <span>{actionText}</span>
          <ArrowRight size={15} />
        </button>
      )}
    </div>
  );
};
