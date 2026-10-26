import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Sparkles, Save, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '../../utils/currency';

export const SaveScenarioModal = ({ isOpen, onClose, onSave, product, simulationResult, simulatedPrice }) => {
  const [scenarioName, setScenarioName] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const targetProduct = product || simulationResult?.product || null;
  const effectiveSimulatedPrice = simulatedPrice !== undefined && simulatedPrice !== null
    ? Number(simulatedPrice)
    : Number(simulationResult?.simulatedPrice ?? targetProduct?.currentPrice ?? targetProduct?.current_price ?? 0);

  const revenuePercent = simulationResult?.revenuePercentDelta !== undefined
    ? simulationResult.revenuePercentDelta
    : (simulationResult?.revenueDelta && simulationResult?.baselineRevenue
        ? Number(((simulationResult.revenueDelta / simulationResult.baselineRevenue) * 100).toFixed(1))
        : 0);

  const revDeltaFormatted = simulationResult?.revenueDelta !== undefined
    ? formatCurrency(simulationResult.revenueDelta, { showSign: true, decimals: 0 })
    : '';

  useEffect(() => {
    if (isOpen && targetProduct) {
      setScenarioName(`Price adjustment for ${targetProduct.name} to ${formatCurrency(effectiveSimulatedPrice)}`);
      setNotes('');
      setError('');
      setIsSaving(false);
    } else if (isOpen && !targetProduct) {
      setScenarioName('');
      setNotes('');
      setError('Please select a product before saving a scenario draft.');
      setIsSaving(false);
    }
  }, [isOpen, targetProduct, effectiveSimulatedPrice]);

  const handleSave = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (isSaving) return;

    if (!targetProduct) {
      setError('No product selected. Please select a valid product to simulate.');
      return;
    }
    if (!scenarioName.trim()) {
      setError('Please provide a name for this scenario draft.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const timestamp = new Date().toISOString();
      const formattedDate = timestamp.replace('T', ' ').substring(0, 16);
      const currPrice = Number(targetProduct.currentPrice ?? targetProduct.current_price ?? 0);
      const simRev = simulationResult?.simulatedRevenue ?? Math.round(effectiveSimulatedPrice * (simulationResult?.simulatedDemand ?? targetProduct.predictedDemand ?? 100));
      const baseRev = simulationResult?.baselineRevenue ?? Math.round(currPrice * (simulationResult?.baselineDemand ?? targetProduct.predictedDemand ?? 100));
      const simDem = simulationResult?.simulatedDemand ?? targetProduct.predictedDemand ?? 100;
      const baseDem = simulationResult?.baselineDemand ?? targetProduct.predictedDemand ?? 100;
      const simProf = simulationResult?.simulatedProfit ?? (simRev - (targetProduct.cost || targetProduct.baseCost || 0) * simDem);
      const baseProf = simulationResult?.baselineProfit ?? (baseRev - (targetProduct.cost || targetProduct.baseCost || 0) * baseDem);
      const profDelta = simulationResult?.profitDelta ?? (simProf - baseProf);

      await onSave({
        name: scenarioName.trim(),
        notes: notes.trim(),
        productId: targetProduct.id,
        sku: targetProduct.sku,
        productName: targetProduct.name,
        currentShelfPrice: currPrice,
        baselinePrice: currPrice,
        currentPrice: currPrice,
        simulatedPrice: effectiveSimulatedPrice,
        optimalPrice: targetProduct.recommendedPrice ?? effectiveSimulatedPrice,
        aiOptimalPrice: targetProduct.recommendedPrice ?? effectiveSimulatedPrice,
        recommendedPrice: targetProduct.recommendedPrice ?? effectiveSimulatedPrice,
        simulatedRevenue: simRev,
        projectedRevenue: simRev,
        baselineRevenue: baseRev,
        simulatedDemand: simDem,
        baselineDemand: baseDem,
        simulatedGrossMargin: simulationResult?.marginPercent || '0%',
        margin: simulationResult?.marginPercent || '0%',
        grossProfit: simProf,
        simulatedProfit: simProf,
        baselineProfit: baseProf,
        profitDelta: profDelta,
        revenueLift: `${Number(revenuePercent) > 0 ? '+' : ''}${revenuePercent}%`,
        status: 'Staged Draft',
        scenarioStatus: 'Staged Draft',
        createdAt: timestamp,
        updatedAt: timestamp,
        dateSaved: formattedDate
      });

      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to save scenario draft. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSaving ? undefined : onClose}
      title="💾 Save Pricing Scenario Draft"
      maxWidth="540px"
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!targetProduct || isSaving}
          >
            <Save size={16} />
            <span>{isSaving ? 'Saving Draft...' : 'Save Scenario Draft'}</span>
          </button>
        </>
      }
    >
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ padding: '0.85rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)' }}>Target SKU:</span>
            <strong>{targetProduct ? `${targetProduct.name} (${targetProduct.sku})` : 'No product selected'}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)' }}>Proposed Simulated Price:</span>
            <strong style={{ color: 'var(--text-accent)', fontFamily: 'var(--font-mono)', fontSize: '0.95rem' }}>
              {targetProduct ? formatCurrency(effectiveSimulatedPrice) : '—'}
            </strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)' }}>Estimated Revenue Delta:</span>
            <strong style={{ color: Number(revenuePercent) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {targetProduct ? `${Number(revenuePercent) > 0 ? '+' : ''}${revenuePercent}% ${revDeltaFormatted ? `(${revDeltaFormatted})` : ''}` : '—'}
            </strong>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">
            Scenario Name <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <input
            type="text"
            className={`form-input ${error ? 'input-error' : ''}`}
            placeholder="e.g., Summer Weekend Clearance Promo"
            value={scenarioName}
            onChange={(e) => {
              setScenarioName(e.target.value);
              if (error) setError('');
            }}
          />
          {error && <span className="field-error-text">{error}</span>}
        </div>

        <div className="form-group">
          <label className="form-label">Strategic Notes / Hypothesis (Optional)</label>
          <textarea
            className="form-input"
            rows="3"
            placeholder="e.g., Testing response to competitor stock shortages during holiday weekend."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </form>
    </Modal>
  );
};

