import { useState, useEffect, useRef } from 'react';
import { PlanGate } from '../components/PlanGate';
import { useCategoryStore, useDevoteeStore, useSettingsStore } from '../store';
import { getDB, generateId } from '../db';

// ── Pre-built Templates ───────────────────────────────────────────────────────
const PRESET_TEMPLATES = [
  {
    id: 'renewal',
    label: '🔔 Renewal Reminder',
    text: `Om Namah Shivaya! 🙏\nVanakkam {name},\n\nYour Kattalai subscription of ₹{balance} is due on {expiry_date}. Kindly renew at your earliest convenience.\n\nMay Lord Shiva bless your family!\n— Kattalai Admin`,
  },
  {
    id: 'due_alert',
    label: '⚠️ Overdue Alert',
    text: `🙏 Dear {name},\n\nThis is a gentle reminder that your Kattalai subscription balance of ₹{balance} is overdue as of {expiry_date}.\n\nPlease contact us to renew your blessings.\n\n— Kattalai Admin`,
  },
  {
    id: 'festival',
    label: '🎉 Festival Greetings',
    text: `🌺 Om Namah Shivaya! 🌺\n\nVanakkam {name},\n\nWishing you and your family joyous blessings on this auspicious occasion from Chidambaram Natarajar Temple!\n\n— Kattalai Admin`,
  },
  {
    id: 'thank_you',
    label: '🙏 Thank You (Payment)',
    text: `🙏 Dear {name},\n\nThank you for your generous contribution to Kattalai. Your support helps continue our spiritual services.\n\nMay Lord Nataraja shower his blessings on you and your family! 🌸\n\n— Kattalai Admin`,
  },
  {
    id: 'new_year',
    label: '🎆 New Year Wishes',
    text: `🎆 Om Namah Shivaya! 🎆\n\nDear {name},\n\nWishing you and your family a spiritually enriching and prosperous New Year!\n\nYour subscription is active until {expiry_date}.\n\n— Kattalai Admin`,
  },
  {
    id: 'custom',
    label: '✏️ Custom Template',
    text: '',
  },
];

export function Broadcast() {
  const { categories } = useCategoryStore();
  const { devotees } = useDevoteeStore();
  const { whatsappTemplate } = useSettingsStore();

  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('custom');
  const [template, setTemplate] = useState(whatsappTemplate);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState('');
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [queue, setQueue] = useState<typeof devotees>([]);
  const [sentCount, setSentCount] = useState(0);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [historyLog, setHistoryLog] = useState<any[]>([]);
  const [historyCategory, setHistoryCategory] = useState('');

  useEffect(() => { loadHistory(); }, []);

  const loadHistory = async () => {
    const db = await getDB();
    const logs = await db.getAll('broadcast_log');
    setHistoryLog(logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be under 5 MB');
      return;
    }
    setImageFileName(file.name);
    const reader = new FileReader();
    reader.onload = ev => setImageDataUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handlePresetChange = (id: string) => {
    setSelectedPreset(id);
    const found = PRESET_TEMPLATES.find(t => t.id === id);
    if (found && id !== 'custom') setTemplate(found.text);
  };

  const startBroadcast = () => {
    if (!selectedCategory) return;
    const targetDevotees = devotees.filter(d => d.category === selectedCategory && d.phone);
    setQueue(targetDevotees);
    setSentCount(0);
    setIsBroadcasting(true);
  };

  const sendNext = () => {
    if (queue.length === 0) { finishBroadcast(); return; }
    const devotee = queue[0];

    let msg = template
      .replace(/{name}/g, devotee.name)
      .replace(/{city}/g, devotee.city)
      .replace(/{nakshathiram}/g, categories.find(c => c.id === devotee.category)?.name || '')
      .replace(/{expiry_date}/g, devotee.subscription_end.slice(0, 10))
      .replace(/{balance}/g, Math.max(0, devotee.annual_amount - devotee.amount_paid).toString());

    const cc = devotee.country_code || '+91';
    const phoneDigits = cc.replace('+', '') + devotee.phone;
    window.open(`whatsapp://send?phone=${phoneDigits}&text=${encodeURIComponent(msg)}`, '_blank');

    setQueue(q => q.slice(1));
    setSentCount(s => s + 1);
  };

  const finishBroadcast = async () => {
    setIsBroadcasting(false);
    if (sentCount > 0) {
      const db = await getDB();
      const d = new Date();
      await db.put('broadcast_log', {
        id: generateId('BCST'),
        category_id: selectedCategory,
        month: String(d.getMonth() + 1).padStart(2, '0'),
        year: String(d.getFullYear()),
        contact_count: sentCount,
        timestamp: d.toISOString(),
        template_id: selectedPreset,
        has_image: Boolean(imageDataUrl),
      });
      loadHistory();
    }
  };

  // Group history by category
  const filteredHistory = historyCategory
    ? historyLog.filter(l => l.category_id === historyCategory)
    : historyLog;

  const historySummary: Record<string, { count: number; total: number }> = {};
  historyLog.forEach(l => {
    const name = categories.find(c => c.id === l.category_id)?.name || 'Unknown';
    if (!historySummary[name]) historySummary[name] = { count: 0, total: 0 };
    historySummary[name].count += 1;
    historySummary[name].total += l.contact_count;
  });

  const targetCount = devotees.filter(d => d.category === selectedCategory && d.phone).length;

  return (
    <PlanGate requiredPlan="plus" featureName="WhatsApp Broadcasting">
      <div className="section mb-16">
        <h2 className="mb-16">Broadcast</h2>

        {!isBroadcasting ? (
          <>
            <div className="card mb-24" style={{ border: '2px solid var(--gold)' }}>
              {/* Step 1: Category */}
              <div className="form-group">
                <label className="form-label">1. Select Target Category</label>
                <select className="form-input" value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
                  <option value="">-- Choose Category --</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {selectedCategory && (
                  <div className="text-sm mt-8 text-gold fw-600">
                    {targetCount} Devotees found with phone numbers
                  </div>
                )}
              </div>

              {/* Step 2: Image Attachment */}
              <div className="form-group">
                <label className="form-label">2. Attach Image (Optional)</label>
                <div
                  style={{
                    border: '2px dashed var(--border)', borderRadius: 12,
                    padding: 16, textAlign: 'center', cursor: 'pointer',
                    background: imageDataUrl ? 'rgba(255,215,0,0.05)' : 'var(--surface-2)',
                    transition: 'border-color 0.2s',
                  }}
                  onClick={() => imageInputRef.current?.click()}
                >
                  {imageDataUrl ? (
                    <div>
                      <img
                        src={imageDataUrl}
                        alt="Broadcast"
                        style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 8, marginBottom: 8, objectFit: 'contain' }}
                      />
                      <div className="text-sm text-gold">{imageFileName}</div>
                      <div className="text-xs text-muted mt-4">
                        💡 When sending, manually attach this image from your phone gallery
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: '2rem', marginBottom: 8 }}>🖼️</div>
                      <div className="text-sm fw-600">Tap to upload an image</div>
                      <div className="text-xs text-muted mt-4">JPG, PNG, GIF — max 5 MB</div>
                    </div>
                  )}
                </div>
                <input type="file" accept="image/*" ref={imageInputRef} style={{ display: 'none' }} onChange={handleImageUpload} />
                {imageDataUrl && (
                  <button className="btn btn-ghost btn-sm mt-8" onClick={() => { setImageDataUrl(null); setImageFileName(''); }}>
                    🗑️ Remove Image
                  </button>
                )}
              </div>

              {/* Step 3: Template */}
              <div className="form-group">
                <label className="form-label">3. Select Message Template</label>
                <select className="form-input mb-12" value={selectedPreset} onChange={e => handlePresetChange(e.target.value)}>
                  {PRESET_TEMPLATES.map(t => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
                <textarea
                  className="form-input"
                  rows={5}
                  value={template}
                  onChange={e => { setTemplate(e.target.value); setSelectedPreset('custom'); }}
                />
                <div className="text-xs text-muted mt-4">
                  Placeholders: <code style={{ color: 'var(--gold)' }}>{'{name}'}</code>, <code style={{ color: 'var(--gold)' }}>{'{city}'}</code>, <code style={{ color: 'var(--gold)' }}>{'{nakshathiram}'}</code>, <code style={{ color: 'var(--gold)' }}>{'{expiry_date}'}</code>, <code style={{ color: 'var(--gold)' }}>{'{balance}'}</code>
                </div>
              </div>

              <button
                className="btn btn-primary w-full"
                onClick={startBroadcast}
                disabled={!selectedCategory || targetCount === 0}
              >
                🚀 Prepare Broadcast Queue
              </button>
            </div>

            {/* ── Broadcast History ── */}
            <div className="mb-16">
              <div className="flex-between mb-12">
                <h4 className="text-gold m-0">Broadcast History</h4>
                <select
                  className="form-input"
                  style={{ width: 'auto', padding: '4px 10px', fontSize: '0.8rem' }}
                  value={historyCategory}
                  onChange={e => setHistoryCategory(e.target.value)}
                >
                  <option value="">All Categories</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Summary cards by category */}
              {!historyCategory && Object.keys(historySummary).length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
                  {Object.entries(historySummary).map(([name, data]) => (
                    <div key={name} className="card-flat text-center" style={{ padding: '12px 8px' }}>
                      <div className="fw-600 text-sm" style={{ marginBottom: 4 }}>{name}</div>
                      <div className="text-gold fw-600" style={{ fontSize: '1.3rem' }}>{data.total}</div>
                      <div className="text-xs text-muted">{data.count} broadcasts</div>
                    </div>
                  ))}
                </div>
              )}

              {filteredHistory.length === 0 ? (
                <div className="text-sm text-2">No past broadcasts{historyCategory ? ' for this category' : ''}.</div>
              ) : (
                <div className="flex-col gap-8">
                  {filteredHistory.map(log => (
                    <div key={log.id} className="card-flat flex-between">
                      <div>
                        <div className="fw-600">{categories.find(c => c.id === log.category_id)?.name || 'Unknown'}</div>
                        <div className="text-xs text-muted">{new Date(log.timestamp).toLocaleString()}</div>
                        {log.has_image && <div className="text-xs" style={{ color: 'var(--gold)' }}>🖼️ With image</div>}
                        {log.template_id && log.template_id !== 'custom' && (
                          <div className="text-xs text-muted">{PRESET_TEMPLATES.find(t => t.id === log.template_id)?.label}</div>
                        )}
                      </div>
                      <div className="badge badge-green">{log.contact_count} Sent</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="card text-center p-32">
            <h3 className="mb-8">Broadcast in Progress</h3>
            {imageDataUrl && (
              <div className="mb-16 p-12" style={{ background: 'rgba(255,215,0,0.05)', borderRadius: 12, border: '1px solid var(--gold)' }}>
                <div className="text-sm text-gold fw-600 mb-8">🖼️ Remember to attach this image!</div>
                <img src={imageDataUrl} alt="Broadcast" style={{ maxWidth: '100%', maxHeight: 120, borderRadius: 8, objectFit: 'contain' }} />
              </div>
            )}
            <div className="text-gold" style={{ fontSize: '3rem', margin: '16px 0' }}>{sentCount}</div>
            <div className="text-sm text-2 mb-24">Messages sent so far</div>

            {queue.length > 0 ? (
              <div>
                <p className="mb-16">Up next: <strong>{queue[0].name}</strong></p>
                <button className="btn btn-primary btn-lg w-full mb-16" onClick={sendNext}>
                  <span style={{ fontSize: '1.5rem' }}>💬</span> Send Next Message
                </button>
                <div className="text-xs text-muted mb-16">{queue.length} remaining in queue</div>
              </div>
            ) : (
              <div className="text-green fw-600 mb-16">Queue Empty! All messages done.</div>
            )}

            <button className="btn btn-ghost w-full" onClick={finishBroadcast}>
              Stop / Finish Broadcast
            </button>
          </div>
        )}
      </div>
    </PlanGate>
  );
}
