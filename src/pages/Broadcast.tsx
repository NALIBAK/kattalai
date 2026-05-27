import { useState, useEffect, useRef } from 'react';
import { PlanGate } from '../components/PlanGate';
import { useCategoryStore, useDevoteeStore, useSettingsStore, useToastStore } from '../store';
import { getDB, generateId, MessageTemplate } from '../db';
import { useTranslation } from '../utils/i18n';

interface BroadcastLog {
  id: string;
  category_id: string;
  month: string;
  year: string;
  contact_count: number;
  timestamp: string;
  template_id?: string;
  has_image?: boolean;
}

export function Broadcast() {
  const { categories } = useCategoryStore();
  const { devotees } = useDevoteeStore();
  const { 
    messageTemplates,
    addTemplate,
    updateTemplate,
    removeTemplate
  } = useSettingsStore();
  const { showToast } = useToastStore();
  const { t } = useTranslation();

  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [template, setTemplate] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState('');
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [queue, setQueue] = useState<typeof devotees>([]);
  const [sentCount, setSentCount] = useState(0);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [historyLog, setHistoryLog] = useState<BroadcastLog[]>([]);
  const [historyCategory, setHistoryCategory] = useState('');

  // Template Manager State
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [isAddingTemplate, setIsAddingTemplate] = useState(false);
  const [tempLabel, setTempLabel] = useState('');
  const [tempText, setTempText] = useState('');

  const handleAddTemplate = async () => {
    if (!tempLabel.trim() || !tempText.trim()) return;
    await addTemplate(tempLabel.trim(), tempText.trim());
    setIsAddingTemplate(false);
    setTempLabel('');
    setTempText('');
    showToast(t('settings_tmpl_added') || 'Template added', 'success');
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplate || !tempLabel.trim() || !tempText.trim()) return;
    await updateTemplate({ ...editingTemplate, label: tempLabel.trim(), text: tempText.trim() });
    setEditingTemplate(null);
    setTempLabel('');
    setTempText('');
    showToast(t('settings_tmpl_updated') || 'Template updated', 'success');
  };

  const handleRemoveTemplate = async (id: string) => {
    if (window.confirm(t('settings_tmpl_confirm_delete') || 'Are you sure you want to delete this template?')) {
      await removeTemplate(id);
      showToast(t('settings_tmpl_deleted') || 'Template deleted', 'info');
    }
  };

  const startEditTemplate = (t: MessageTemplate) => {
    setEditingTemplate(t);
    setTempLabel(t.label);
    setTempText(t.text);
    setIsAddingTemplate(false);
  };

  const startAddTemplate = () => {
    setIsAddingTemplate(true);
    setEditingTemplate(null);
    setTempLabel('');
    setTempText('');
  };

  const loadHistory = async () => {
    const db = await getDB();
    const logs = await db.getAll('broadcast_log');
    setHistoryLog(logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      loadHistory();
    });
  }, []);

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

  const handleTemplateChange = (id: string) => {
    setSelectedTemplateId(id);
    const found = messageTemplates.find(t => t.id === id);
    if (found) setTemplate(found.text);
    else if (id === '') setTemplate('');
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

    const msg = template
      .replace(/{name}/g, devotee.name)
      .replace(/{city}/g, devotee.city)
      .replace(/{nakshathiram}/g, categories.find(c => c.id === devotee.category)?.name || '')
      .replace(/{expiry_date}/g, (devotee.subscription_end || '').slice(0, 10))
      .replace(/{balance}/g, Math.max(0, (devotee.annual_amount || 0) - (devotee.amount_paid || 0)).toString());

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
        template_id: selectedTemplateId,
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
                  {categories.filter(c => devotees.some(d => d.category === c.id)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
                <select className="form-input mb-12" value={selectedTemplateId} onChange={e => handleTemplateChange(e.target.value)}>
                  <option value="">-- Custom Message / Select Template --</option>
                  {messageTemplates.map(t => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
                <textarea
                  className="form-input"
                  rows={5}
                  value={template}
                  onChange={e => { setTemplate(e.target.value); setSelectedTemplateId(''); }}
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

            {/* ── Message Templates Manager ── */}
            <div className="card mb-24">
              <div className="flex-between mb-16">
                <h4 className="text-gold m-0">{t('settings_templates') || 'Message Templates'}</h4>
                <button className="btn btn-primary btn-sm" onClick={startAddTemplate}>{t('settings_add_template') || '+ Add Template'}</button>
              </div>

              <div className="flex-col gap-12">
                {messageTemplates.map(tmp => {
                  const isBuiltIn = ['t1', 't2', 't3'].includes(tmp.id);
                  return (
                    <div key={tmp.id} className="card-flat" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                      <div className="flex-between mb-8">
                        <div className="fw-700">{tmp.label} {isBuiltIn && <span className="badge badge-muted" style={{ fontSize: '0.7rem', padding: '2px 6px', marginLeft: 6 }}>System</span>}</div>
                        <div className="flex gap-8">
                          <button className="btn-icon btn-sm" onClick={() => startEditTemplate(tmp)}>✏️</button>
                          {!isBuiltIn && (
                            <button className="btn-icon btn-sm" style={{ color: 'var(--red)' }} onClick={() => handleRemoveTemplate(tmp.id)}>🗑️</button>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-muted text-ellipsis-3" style={{ whiteSpace: 'pre-line' }}>{tmp.text}</div>
                    </div>
                  );
                })}
              </div>

              {(isAddingTemplate || editingTemplate) && (
                <div className="mt-24 p-16" style={{ background: 'var(--surface-3)', borderRadius: 12, border: '1.5px solid var(--gold)' }}>
                  <h5 className="mb-12">{isAddingTemplate ? (t('settings_new_template') || 'New Template') : (t('settings_edit_template') || 'Edit Template')}</h5>
                  <div className="form-group">
                    <label className="form-label">{t('settings_tmpl_label') || 'Template Name'}</label>
                    <input className="form-input" value={tempLabel} onChange={e => setTempLabel(e.target.value)} placeholder="e.g. Festival Wishes" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('settings_tmpl_text') || 'Message Text'}</label>
                    <textarea className="form-input" rows={6} value={tempText} onChange={e => setTempText(e.target.value)} placeholder="Type your message..." />
                    <div className="text-xs text-muted mt-4">
                      {t('settings_tmpl_placeholders') || 'Placeholders:'} {`{name}, {city}, {nakshathiram}, {expiry_date}, {balance}`}
                    </div>
                  </div>
                  <div className="grid-2">
                    <button className="btn btn-ghost" onClick={() => { setIsAddingTemplate(false); setEditingTemplate(null); }}>{t('settings_tmpl_cancel') || 'Cancel'}</button>
                    <button className="btn btn-primary" onClick={isAddingTemplate ? handleAddTemplate : handleUpdateTemplate} disabled={!tempLabel.trim() || !tempText.trim()}>
                      {t('settings_tmpl_save') || 'Save'}
                    </button>
                  </div>
                </div>
              )}
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
                  {categories.filter(c => devotees.some(d => d.category === c.id)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
                        {log.template_id && (
                          <div className="text-xs text-muted">{messageTemplates.find(t => t.id === log.template_id)?.label || 'Deleted Template'}</div>
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
