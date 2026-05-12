import { useState } from 'react';

export interface OcrResult {
  name: string;
  phone: string;
  address: string;
  pincode: string;
  city: string;
  rawText: string;
}

interface Props {
  result: OcrResult;
  previewUrl: string;            // Object URL of the preprocessed image
  onConfirm: (edited: OcrResult) => void;
  onCancel: () => void;
}

export function OcrReviewModal({ result, previewUrl, onConfirm, onCancel }: Props) {
  const [edited, setEdited] = useState<OcrResult>({ ...result });
  const [showRaw, setShowRaw] = useState(false);

  const set = (field: keyof OcrResult, value: string) =>
    setEdited(prev => ({ ...prev, [field]: value }));

  return (
    <div
      id="ocr-review-modal"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        width: '100%',
        maxWidth: 560,
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        animation: 'slide-up 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px 0',
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>📋 Review Scanned Data</h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-2)' }}>
              Verify and edit before saving. Nothing is filled until you confirm.
            </p>
          </div>
          <button
            onClick={onCancel}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontSize: '1.4rem', color: 'var(--text-2)', lineHeight: 1,
            }}
          >×</button>
        </div>

        {/* Scanned image preview */}
        <div style={{ padding: '16px 24px 0' }}>
          <img
            src={previewUrl}
            alt="Preprocessed scan"
            style={{
              width: '100%',
              maxHeight: 200,
              objectFit: 'contain',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: '#fff',
            }}
          />
        </div>

        {/* Editable fields */}
        <div style={{ padding: '16px 24px' }}>
          <div style={{ display: 'grid', gap: 12 }}>

            <Field id="ocr-name" label="Full Name" value={edited.name}
              onChange={v => set('name', v)} placeholder="e.g. Rajan Murugesan" />

            <Field id="ocr-phone" label="Phone" value={edited.phone}
              onChange={v => set('phone', v)} placeholder="10-digit number" />

            <Field id="ocr-address" label="Street Address" value={edited.address}
              onChange={v => set('address', v)} placeholder="e.g. 12 Car Street..." multiline />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field id="ocr-pincode" label="Pincode" value={edited.pincode}
                onChange={v => set('pincode', v)} placeholder="6-digit code" />
              <Field id="ocr-city" label="City" value={edited.city}
                onChange={v => set('city', v)} placeholder="e.g. Chennai" />
            </div>
          </div>

          {/* Raw text toggle */}
          <button
            onClick={() => setShowRaw(p => !p)}
            style={{
              marginTop: 12, background: 'transparent',
              border: '1px dashed var(--border)',
              borderRadius: 8, padding: '6px 12px',
              color: 'var(--text-2)', fontSize: '0.78rem', cursor: 'pointer', width: '100%',
            }}
          >
            {showRaw ? '▲ Hide' : '▼ Show'} raw OCR text (for manual reference)
          </button>

          {showRaw && (
            <pre style={{
              marginTop: 8, padding: '10px 12px',
              background: 'var(--surface-2)', borderRadius: 8,
              fontSize: '0.72rem', color: 'var(--text-2)',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              maxHeight: 160, overflowY: 'auto', border: '1px solid var(--border)',
            }}>
              {edited.rawText || '(no text detected)'}
            </pre>
          )}
        </div>

        {/* Actions */}
        <div style={{
          display: 'flex', gap: 12, padding: '0 24px 24px',
        }}>
          <button
            id="ocr-cancel-btn"
            onClick={onCancel}
            style={{
              flex: 1, padding: '12px', border: '1px solid var(--border)',
              borderRadius: 10, background: 'transparent',
              color: 'var(--text-2)', cursor: 'pointer', fontSize: '0.9rem',
            }}
          >
            ✕ Discard
          </button>
          <button
            id="ocr-confirm-btn"
            onClick={() => onConfirm(edited)}
            style={{
              flex: 2, padding: '12px',
              border: 'none', borderRadius: 10,
              background: 'linear-gradient(135deg, var(--gold), #b8860b)',
              color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem',
            }}
          >
            ✓ Fill Form with This Data
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tiny reusable field ──────────────────────────────────────────────────────
function Field({
  id, label, value, onChange, placeholder, multiline,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const sharedStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text)',
    fontSize: '0.88rem',
    boxSizing: 'border-box',
    outline: 'none',
    fontFamily: 'inherit',
    resize: 'vertical' as const,
  };

  return (
    <div>
      <label htmlFor={id} style={{
        display: 'block', fontSize: '0.75rem',
        color: 'var(--text-2)', marginBottom: 4, fontWeight: 500,
      }}>
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          style={sharedStyle}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={sharedStyle}
        />
      )}
    </div>
  );
}
