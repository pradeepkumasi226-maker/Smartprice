import React from 'react';

export const Badge = ({ children, variant = 'info', hasDot = true, className = '' }) => {
  const variantClass = `badge-${variant}`;
  return (
    <span className={`badge ${variantClass} ${className}`}>
      {hasDot && <span className="badge-dot" />}
      {children}
    </span>
  );
};
