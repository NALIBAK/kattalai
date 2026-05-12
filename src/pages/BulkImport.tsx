import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDevoteeStore, useCategoryStore, useSettingsStore, useToastStore } from '../store';
import { upsertDevotee, generateId } from '../db';
import type { Devotee } from '../db';
import { parseBulkText, suggestCategoryForCity } from '../utils/parseBulkText';
import type { ParsedRecord } from '../utils/parseBulkText';
import { preprocessImageForOCR } from '../utils/imagePreprocess';
import Tesseract from 'tesseract.js';
import { isPlanAllowed } from '../auth';
import { useAuthStore } from '../store';

// ── Step type ─────────────────────────────────────────────────────────────────
type Step = 'input' | 'review' | 'summary';
type InputTab = 'text' | 'file' | 'photo';

// ── Edit Modal ────────────────────────────────────────────────────────────────
function EditModal({
  record, categories, defaultCategory, onSave, onClose,
}: {
  record: ParsedRecord;
  categories: { id: string; name: string; name_ta?: string }[];
  defaultCategory: string;
  onSave: (r: ParsedRecord) => void;
  onClose: () => void;
}) {
  const [r, setR] = useState({ ...record });
  const set = (k: keyof ParsedRecord, v: string) => setR(p => ({ ...p, [k]: v }));
  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 12px', background: 'var(--surface-2)',
    border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)',
    fontSize: '0.88rem', boxSizing: 'border-box', fontFamily: 'inherit',
  };
  return (
    <div style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.75)',
      backdropFilter:'blur(6px)', display:'flex', alignItems:'center',
      justifyContent:'center', padding:16 }} onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)',
        borderRadius:16, width:'100%', maxWidth:520, maxHeight:'90vh',
        overflowY:'auto', boxShadow:'0 24px 64px rgba(0,0,0,0.6)',
        animation:'slide-up 0.25s ease' }}>
        <div style={{ padding:'20px 24px 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <h3 style={{ margin:0 }}>✏️ Edit Record</h3>
            <p style={{ margin:'4px 0 0', fontSize:'0.8rem', color:'var(--text-2)' }}>Fix details before importing</p>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:'1.4rem', color:'var(--text-2)', cursor:'pointer' }}>×</button>
        </div>
        <div style={{ padding:'16px 24px', display:'grid', gap:12 }}>
          <div>
            <label style={{ fontSize:'0.75rem', color:'var(--text-2)', display:'block', marginBottom:4 }}>Full Name</label>
            <input style={inp} value={r.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Rajan Murugesan" />
          </div>
          <div>
            <label style={{ fontSize:'0.75rem', color:'var(--text-2)', display:'block', marginBottom:4 }}>Phone</label>
            <input style={inp} value={r.phone} onChange={e => set('phone', e.target.value)} placeholder="10-digit number" />
          </div>
          <div>
            <label style={{ fontSize:'0.75rem', color:'var(--text-2)', display:'block', marginBottom:4 }}>Street Address</label>
            <textarea style={{ ...inp, resize:'vertical' } as React.CSSProperties} rows={2}
              value={r.address} onChange={e => set('address', e.target.value)} />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={{ fontSize:'0.75rem', color:'var(--text-2)', display:'block', marginBottom:4 }}>Pincode</label>
              <input style={inp} value={r.pincode} onChange={e => set('pincode', e.target.value)} placeholder="6-digit" />
            </div>
            <div>
              <label style={{ fontSize:'0.75rem', color:'var(--text-2)', display:'block', marginBottom:4 }}>City</label>
              <input style={inp} value={r.city} onChange={e => set('city', e.target.value)} placeholder="City" />
            </div>
          </div>
          <div>
            <label style={{ fontSize:'0.75rem', color:'var(--text-2)', display:'block', marginBottom:4 }}>Category (Nakshathiram)</label>
            <select style={inp} value={r.suggestedCategory || defaultCategory}
              onChange={e => set('suggestedCategory', e.target.value)}>
              <option value="">— Select —</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.name_ta ? ` (${c.name_ta})` : ''}</option>
              ))}
            </select>
          </div>
          {r.rawBlock && (
            <details style={{ fontSize:'0.75rem', color:'var(--text-2)' }}>
              <summary style={{ cursor:'pointer', marginBottom:4 }}>▼ Raw text</summary>
              <pre style={{ whiteSpace:'pre-wrap', wordBreak:'break-word',
                background:'var(--surface-2)', padding:8, borderRadius:6, border:'1px solid var(--border)' }}>
                {r.rawBlock}
              </pre>
            </details>
          )}
        </div>
        <div style={{ display:'flex', gap:12, padding:'0 24px 24px' }}>
          <button onClick={onClose} style={{ flex:1, padding:12, border:'1px solid var(--border)',
            borderRadius:10, background:'transparent', color:'var(--text-2)', cursor:'pointer' }}>
            Cancel
          </button>
          <button onClick={() => { onSave({ ...r, needsReview: !r.name || !r.phone }); onClose(); }}
            style={{ flex:2, padding:12, border:'none', borderRadius:10, cursor:'pointer',
              background:'linear-gradient(135deg, var(--gold), #b8860b)', color:'#000', fontWeight:700 }}>
            ✓ Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function BulkImport() {
  const navigate = useNavigate();
  const { plan } = useAuthStore();
  const { refresh } = useDevoteeStore();
  const { categories } = useCategoryStore();
  const { defaultAmount } = useSettingsStore();
  const { showToast } = useToastStore();

  // Pro gate
  if (!isPlanAllowed(plan ?? 'free', 'pro')) {
    return (
      <div style={{ padding:24 }}>
        <button className="btn-icon" onClick={() => navigate(-1)} style={{ marginBottom:16 }}>🔙</button>
        <div className="plan-lock" style={{ background:'rgba(246,70,93,0.05)', borderColor:'var(--red)' }}>
          <div className="plan-lock-icon" style={{ color:'var(--red)', fontSize:'2.5rem' }}>🔥</div>
          <div className="plan-lock-label" style={{ color:'var(--red)' }}>PRO PLAN EXCLUSIVE</div>
          <p className="text-sm text-2 mt-8"><strong>Bulk Import</strong> is only available on the PRO plan.</p>
          <button className="btn btn-sm mt-8" style={{ background:'var(--red)', color:'#fff' }}
            onClick={() => navigate('/contact')}>Request Upgrade</button>
        </div>
      </div>
    );
  }

  const [step, setStep] = useState<Step>('input');
  const [inputTab, setInputTab] = useState<InputTab>('text');
  const [rawText, setRawText] = useState('');
  const [records, setRecords] = useState<ParsedRecord[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editTarget, setEditTarget] = useState<ParsedRecord | null>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // ── Input handlers ─────────────────────────────────────────────────────────

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setRawText(ev.target?.result as string ?? '');
    reader.readAsText(file, 'utf-8');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePhotoScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    showToast('Preprocessing photo…', 'info');
    try {
      const blob = await preprocessImageForOCR(file);
      showToast('Reading text from photo…', 'info');
      const result = await Tesseract.recognize(blob, 'eng+tam', {
        logger: m => console.log('[OCR]', m.status),
      });
      const extracted = result.data.text;
      setRawText(prev => prev ? prev + '\n\n' + extracted : extracted);
      setInputTab('text');
      showToast('Text extracted! Review and parse.', 'success');
    } catch {
      showToast('Photo scan failed. Try a clearer image.', 'error');
    } finally {
      setScanning(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  // ── Parse ──────────────────────────────────────────────────────────────────

  const handleParse = () => {
    if (!rawText.trim()) { showToast('Please enter or upload some text first.', 'error'); return; }
    const parsed = parseBulkText(rawText);
    if (parsed.length === 0) { showToast('No records found. Make sure each person is separated by a blank line.', 'error'); return; }

    // Enrich with suggested category
    const enriched = parsed.map(r => ({
      ...r,
      suggestedCategory: suggestCategoryForCity(r.city, categories),
    }));

    setRecords(enriched);
    setSelected(new Set(enriched.map(r => r._key)));
    setStep('review');
    showToast(`${enriched.length} records parsed!`, 'success');
  };

  // ── Edit save ──────────────────────────────────────────────────────────────

  const handleEditSave = (updated: ParsedRecord) => {
    setRecords(prev => prev.map(r => r._key === updated._key ? updated : r));
  };

  // ── Final save ─────────────────────────────────────────────────────────────

  const handleImport = async () => {
    const toSave = records.filter(r => selected.has(r._key));
    if (toSave.length === 0) { showToast('Select at least one record.', 'error'); return; }
    setSaving(true);
    const today = new Date().toISOString().split('T')[0];
    const expiry = new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0];
    try {
      for (const r of toSave) {
        const devotee: Devotee = {
          id: generateId(),
          name: r.name || 'Unknown',
          phone: r.phone,
          phone2: '', phone3: '',
          country_code: '+91',
          address: r.address,
          city: r.city,
          pincode: r.pincode,
          gothram: '',
          category: r.suggestedCategory || categories[0]?.id || '',
          location_lat: undefined,
          location_lng: undefined,
          location_accurate: false,
          annual_amount: defaultAmount,
          amount_paid: 0,
          prasadham_count: 1,
          prasadham_override: false,
          subscription_start: today,
          subscription_end: expiry,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await upsertDevotee(devotee);
      }
      await refresh();
      showToast(`✅ ${toSave.length} devotees imported!`, 'success');
      navigate('/devotees');
    } catch {
      showToast('Import failed. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Group for summary ──────────────────────────────────────────────────────
  const byCity = records.reduce<Record<string, ParsedRecord[]>>((acc, r) => {
    const key = r.city || 'Unknown City';
    (acc[key] ||= []).push(r);
    return acc;
  }, {});

  const selectedCount = selected.size;

  // ── Shared tab button style ────────────────────────────────────────────────
  const tabBtn = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '10px 8px', border: 'none', borderRadius: 8, cursor: 'pointer',
    fontWeight: active ? 700 : 400, fontSize: '0.85rem', fontFamily: 'inherit',
    background: active ? 'var(--gold)' : 'var(--surface-2)',
    color: active ? '#000' : 'var(--text-2)',
    transition: 'all 0.2s',
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ padding: '0 0 80px' }}>
      {/* Header */}
      <div className="section flex-between mb-24" style={{ padding: '16px 16px 0' }}>
        <div className="flex-center gap-12">
          <button className="btn-icon" onClick={() => step === 'input' ? navigate(-1) : setStep(step === 'summary' ? 'review' : 'input')}>🔙</button>
          <div>
            <h2 className="mb-0">📦 Bulk Import</h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-2)', margin: 0 }}>
              {step === 'input' && 'Step 1 of 3 — Add your address list'}
              {step === 'review' && `Step 2 of 3 — Review ${records.length} records`}
              {step === 'summary' && `Step 3 of 3 — Confirm & Import`}
            </p>
          </div>
        </div>
        <span className="badge badge-red" style={{ fontSize: '0.7rem' }}>🔥 PRO</span>
      </div>

      {/* Progress bar */}
      <div style={{ margin: '0 16px 20px', height: 4, background: 'var(--surface-2)', borderRadius: 4 }}>
        <div style={{
          height: '100%', borderRadius: 4, transition: 'width 0.4s ease',
          background: 'linear-gradient(90deg, var(--gold), #b8860b)',
          width: step === 'input' ? '33%' : step === 'review' ? '66%' : '100%',
        }} />
      </div>

      {/* ── STEP 1: INPUT ────────────────────────────────────────────────── */}
      {step === 'input' && (
        <div style={{ padding: '0 16px' }}>
          <div className="card mb-16">
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              <button style={tabBtn(inputTab === 'text')} onClick={() => setInputTab('text')}>📝 Paste Text</button>
              <button style={tabBtn(inputTab === 'file')} onClick={() => setInputTab('file')}>📂 Upload File</button>
              <button style={tabBtn(inputTab === 'photo')} onClick={() => setInputTab('photo')}>📷 Scan Photo</button>
            </div>

            {inputTab === 'text' && (
              <div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-2)', marginBottom: 8 }}>
                  Paste addresses below. Separate each person with a <strong>blank line</strong>.
                </p>
                <textarea
                  className="form-input"
                  rows={12}
                  value={rawText}
                  onChange={e => setRawText(e.target.value)}
                  placeholder={`Rajan Murugesan\n9876543210\n12 Car Street, Chidambaram\n608001\n\nSavitha Krishnan\n9123456789\n45 Anna Nagar, Chennai\n600040`}
                  style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                />
              </div>
            )}

            {inputTab === 'file' && (
              <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                <div style={{ fontSize: '3rem', marginBottom: 12 }}>📂</div>
                <p style={{ color: 'var(--text-2)', fontSize: '0.88rem', marginBottom: 16 }}>
                  Upload a <strong>.txt</strong> or <strong>.csv</strong> file.<br />
                  Each person must be separated by a blank line.
                </p>
                <button className="btn btn-ghost" onClick={() => fileInputRef.current?.click()}>
                  Choose File
                </button>
                <input ref={fileInputRef} type="file" accept=".txt,.csv" onChange={handleFileUpload} style={{ display: 'none' }} />
                {rawText && (
                  <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(14,203,129,0.1)',
                    borderRadius: 8, fontSize: '0.8rem', color: 'var(--green)' }}>
                    ✅ File loaded — {rawText.split('\n').length} lines
                  </div>
                )}
              </div>
            )}

            {inputTab === 'photo' && (
              <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                <div style={{ fontSize: '3rem', marginBottom: 12 }}>📷</div>
                <p style={{ color: 'var(--text-2)', fontSize: '0.88rem', marginBottom: 16 }}>
                  Photograph a <strong>handwritten list</strong> or <strong>printed register</strong>.<br />
                  Text will be extracted and added to the editor.
                </p>
                <button className="btn btn-ghost" disabled={scanning}
                  onClick={() => photoInputRef.current?.click()}>
                  {scanning ? '⌛ Scanning…' : '📷 Take / Upload Photo'}
                </button>
                <input ref={photoInputRef} type="file" accept="image/*" capture="environment"
                  onChange={handlePhotoScan} style={{ display: 'none' }} />
                {rawText && (
                  <p style={{ marginTop: 12, fontSize: '0.8rem', color: 'var(--green)' }}>
                    ✅ Text extracted — switch to "Paste Text" to review
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Format hint */}
          <div className="card mb-16" style={{ background: 'rgba(212,175,55,0.05)', borderColor: 'rgba(212,175,55,0.2)' }}>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-2)', margin: 0 }}>
              💡 <strong>Format tip:</strong> One person per block, separated by blank lines. Include name on first line, phone, then address. Pincode is auto-detected.
            </p>
          </div>

          <button className="btn btn-primary btn-full" style={{ fontSize: '1rem' }} onClick={handleParse}>
            Parse Addresses →
          </button>
        </div>
      )}

      {/* ── STEP 2: REVIEW LIST ──────────────────────────────────────────── */}
      {step === 'review' && (
        <div style={{ padding: '0 16px' }}>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
            {[
              { label: 'Total', value: records.length, color: 'var(--gold)' },
              { label: 'Needs Review', value: records.filter(r => r.needsReview).length, color: 'var(--amber)' },
              { label: 'Ready', value: records.filter(r => !r.needsReview).length, color: 'var(--green)' },
            ].map(s => (
              <div key={s.label} className="card" style={{ textAlign: 'center', padding: '12px 8px' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-2)', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Record cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {records.map((r, i) => (
              <div key={r._key} className="card" style={{
                borderLeft: `4px solid ${r.needsReview ? 'var(--amber)' : 'var(--green)'}`,
                cursor: 'pointer', transition: 'transform 0.15s',
              }}
                onClick={() => setEditTarget(r)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 2 }}>
                      {r.name || <span style={{ color: 'var(--amber)' }}>⚠ No name</span>}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>
                      {r.phone || <span style={{ color: 'var(--amber)' }}>No phone</span>}
                      {r.city && <> · {r.city}</>}
                      {r.pincode && <> · {r.pincode}</>}
                    </div>
                    {r.address && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 2,
                        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        {r.address}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, marginLeft: 8 }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 600, padding: '2px 8px',
                      borderRadius: 20, background: r.needsReview ? 'rgba(240,165,0,0.15)' : 'rgba(14,203,129,0.15)',
                      color: r.needsReview ? 'var(--amber)' : 'var(--green)' }}>
                      {r.needsReview ? '⚠ Review' : '✓ Ready'}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>#{i + 1} · tap to edit</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button className="btn btn-primary btn-full" style={{ fontSize: '1rem' }}
            onClick={() => setStep('summary')}>
            Continue to Summary →
          </button>
        </div>
      )}

      {/* ── STEP 3: SUMMARY ─────────────────────────────────────────────── */}
      {step === 'summary' && (
        <div style={{ padding: '0 16px' }}>
          <div className="card mb-16" style={{ background: 'rgba(212,175,55,0.05)', borderColor: 'rgba(212,175,55,0.2)' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-2)', margin: 0 }}>
              Review the groups below. Uncheck any records you don't want to import, then tap <strong>Import</strong>.
            </p>
          </div>

          {/* Select/deselect all */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              {selectedCount} of {records.length} selected
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-sm btn-ghost" onClick={() => setSelected(new Set(records.map(r => r._key)))}>All</button>
              <button className="btn btn-sm btn-ghost" onClick={() => setSelected(new Set())}>None</button>
            </div>
          </div>

          {/* Grouped by city */}
          {Object.entries(byCity).map(([city, cityRecords]) => (
            <div key={city} className="card mb-12">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontWeight: 700, color: 'var(--gold)' }}>📍 {city}</span>
                <span className="badge badge-gold">{cityRecords.length} people</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {cityRecords.map(r => (
                  <label key={r._key} style={{ display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 8,
                    cursor: 'pointer', border: selected.has(r._key) ? '1px solid var(--gold)' : '1px solid transparent' }}>
                    <input type="checkbox" checked={selected.has(r._key)}
                      onChange={e => {
                        const next = new Set(selected);
                        e.target.checked ? next.add(r._key) : next.delete(r._key);
                        setSelected(next);
                      }} style={{ width: 16, height: 16, accentColor: 'var(--gold)' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{r.name || '—'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>
                        {r.phone || 'No phone'} · {r.pincode || 'No pincode'}
                      </div>
                    </div>
                    {r.needsReview && <span style={{ fontSize: '0.7rem', color: 'var(--amber)' }}>⚠</span>}
                  </label>
                ))}
              </div>
            </div>
          ))}

          <button className="btn btn-primary btn-full" style={{ fontSize: '1rem', marginTop: 8 }}
            disabled={saving || selectedCount === 0} onClick={handleImport}>
            {saving ? '⌛ Importing…' : `📥 Import ${selectedCount} Devotee${selectedCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      {/* Edit modal */}
      {editTarget && (
        <EditModal
          record={editTarget}
          categories={categories}
          defaultCategory={categories[0]?.id ?? ''}
          onSave={handleEditSave}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}
