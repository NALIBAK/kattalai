import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore, useDevoteeStore, useCategoryStore, useToastStore } from '../store';
import { getDB, upsertDevotee, upsertCategory, Devotee, Category, PaymentEntry } from '../db';
import { PlanGate } from '../components/PlanGate';
import { useAppLock, LAST_ACTIVE_KEY } from '../components/AppLock';
import JSZip from 'jszip';

export function Settings() {
  const navigate = useNavigate();
  const { showToast } = useToastStore();
  const { hasPin, setPin } = useAppLock();
  
  // Stores
  const { theme, cities, defaultAmount, templeName, setTheme, setCities, setDefaultAmount, setTempleName } = useSettingsStore();
  const { devotees, refresh: refreshDevotees } = useDevoteeStore();
  const { categories, loadCategories } = useCategoryStore();

  // Local state for UI
  const [newCity, setNewCity] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const vcfInputRef = useRef<HTMLInputElement>(null);

  // App Lock state
  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinStep, setPinStep] = useState<'view' | 'set' | 'change'>('view');
  const [pinError, setPinError] = useState('');

  // VCF Import state
  interface ParsedContact {
    name: string;
    phone: string;
    phone2: string;
    phone3: string;
    country_code: string;
    address: string;
    city: string;
    pincode: string;
    gothram: string;
    selected: boolean;
  }
  const [vcfContacts, setVcfContacts] = useState<ParsedContact[]>([]);
  const [vcfCategory, setVcfCategory] = useState('');
  const [vcfModalOpen, setVcfModalOpen] = useState(false);
  const [vcfImporting, setVcfImporting] = useState(false);

  const handleAddCity = () => {
    if (!newCity.trim() || cities.includes(newCity.trim())) return;
    setCities([...cities, newCity.trim()]);
    setNewCity('');
  };

  // ── App Lock Handlers ──────────────────────────────────────────
  const handleSavePin = () => {
    setPinError('');
    if (pinInput.length !== 4 || !/^\d{4}$/.test(pinInput)) {
      setPinError('PIN must be exactly 4 digits');
      return;
    }
    if (pinInput !== pinConfirm) {
      setPinError('PINs do not match');
      return;
    }
    setPin(pinInput);
    setPinInput('');
    setPinConfirm('');
    setPinStep('view');
    showToast('App Lock PIN set successfully! 🔐', 'success');
  };

  const handleRemovePin = () => {
    if (window.confirm('Remove App Lock? The app will no longer be protected.')) {
      setPin('');
      setPinStep('view');
      showToast('App Lock removed', 'info');
    }
  };

  // ── VCF Export ─────────────────────────────────────────────────
  const handleExportVCF = () => {
    if (devotees.length === 0) { showToast('No devotees to export', 'error'); return; }
    const lines: string[] = [];
    devotees.forEach(d => {
      lines.push('BEGIN:VCARD');
      lines.push('VERSION:3.0');
      lines.push(`FN:${d.name}`);
      lines.push(`N:${d.name};;;;`);
      const cc = (d.country_code || '+91').replace('+', '');
      if (d.phone) lines.push(`TEL;TYPE=CELL:+${cc}${d.phone}`);
      if (d.phone2) lines.push(`TEL;TYPE=CELL:+${cc}${d.phone2}`);
      if (d.phone3) lines.push(`TEL;TYPE=CELL:+${cc}${d.phone3}`);
      if (d.address) lines.push(`ADR:;;${d.address};${d.city};${d.pincode || ''};;India`);
      if (d.gothram) lines.push(`NOTE:Gothram: ${d.gothram}`);
      lines.push('END:VCARD');
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/vcard' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Kattalai_Contacts_${new Date().toISOString().slice(0, 10)}.vcf`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${devotees.length} contacts as VCF`, 'success');
  };

  // ── VCF Import ─────────────────────────────────────────────────
  const parseVCF = (text: string) => {
    // Split into individual vCard blocks
    const blocks = text.split(/END:VCARD/i).map(b => b.trim()).filter(Boolean);
    const contacts: ParsedContact[] = [];

    blocks.forEach(block => {
      const lines = block.split(/\r?\n/);
      let name = '';
      const phones: string[] = [];
      let address = '';
      let city = '';
      let pincode = '';
      let gothram = '';
      let country_code = '+91';

      lines.forEach(line => {
        // FN (full name)
        if (/^FN:/i.test(line)) {
          name = line.replace(/^FN:/i, '').trim();
        }
        // N (structured name) — fallback if FN is empty
        if (!name && /^N:/i.test(line)) {
          const parts = line.replace(/^N:/i, '').split(';');
          name = [parts[1], parts[0]].filter(Boolean).join(' ').trim();
        }
        // TEL (phone number)
        if (/^TEL/i.test(line)) {
          let num = line.replace(/^TEL[^:]*:/i, '').trim().replace(/[\s\-().]/g, '');
          // Detect country code from number
          if (num.startsWith('+')) {
            // Try to extract CC from common codes
            const ccMatch = num.match(/^(\+\d{1,3})/);
            if (ccMatch) {
              country_code = ccMatch[1];
              num = num.slice(ccMatch[1].length); // strip the CC
            }
          } else if (num.startsWith('0')) {
            num = num.slice(1); // strip leading 0 (local format)
          } else if (num.startsWith('91') && num.length === 12) {
            country_code = '+91';
            num = num.slice(2);
          }
          if (num) phones.push(num);
        }
        // ADR (structured address)
        if (/^ADR/i.test(line)) {
          const parts = line.replace(/^ADR[^:]*:/i, '').split(';');
          // Typical vCard ADR: PO Box; Ext Addr; Street; City; State; ZIP; Country
          address = [parts[2], parts[3]].filter(Boolean).join(', ').trim();
          city    = (parts[3] || '').trim();
          pincode = (parts[5] || '').trim();
        }
        // NOTE (may contain Gothram)
        if (/^NOTE:/i.test(line)) {
          const noteVal = line.replace(/^NOTE:/i, '').trim();
          const gothramMatch = noteVal.match(/gothram[:\s]+(.+)/i);
          if (gothramMatch) gothram = gothramMatch[1].trim();
        }
      });

      if (name || phones.length > 0) {
        contacts.push({
          name: name || phones[0] || 'Unknown',
          phone:  phones[0] || '',
          phone2: phones[1] || '',
          phone3: phones[2] || '',
          country_code,
          address,
          city,
          pincode,
          gothram,
          selected: true,
        });
      }
    });

    return contacts;
  };

  const handleVCFFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const contacts = parseVCF(text);
    if (contacts.length === 0) {
      showToast('No contacts found in this VCF file', 'error');
      return;
    }
    setVcfContacts(contacts);
    setVcfCategory(categories[0]?.id || '');
    setVcfModalOpen(true);
    // reset input so same file can be re-selected
    if (vcfInputRef.current) vcfInputRef.current.value = '';
  };

  const handleVCFImport = async () => {
    const toImport = vcfContacts.filter(c => c.selected);
    if (toImport.length === 0) { showToast('No contacts selected', 'error'); return; }
    if (!vcfCategory) { showToast('Please select a default category', 'error'); return; }

    setVcfImporting(true);
    try {
      const now = new Date().toISOString();
      for (const c of toImport) {
        const id = `DEV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
        const devotee: Devotee = {
          id,
          name: c.name,
          phone: c.phone,
          phone2: c.phone2 || undefined,
          phone3: c.phone3 || undefined,
          country_code: c.country_code || '+91',
          pincode: c.pincode || undefined,
          address: c.address || '',
          city: c.city || (cities[0] || ''),
          gothram: c.gothram || '',
          category: vcfCategory,
          annual_amount: defaultAmount,
          amount_paid: 0,
          prasadham_count: 1,
          prasadham_override: false,
          location_accurate: false,
          subscription_start: now.split('T')[0],
          subscription_end: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
          created_at: now,
          updated_at: now,
        };
        await upsertDevotee(devotee);
      }
      await refreshDevotees();
      showToast(`✅ Imported ${toImport.length} contacts as devotees!`, 'success');
      setVcfModalOpen(false);
      setVcfContacts([]);
    } catch (err: any) {
      showToast(err.message || 'Import failed', 'error');
    } finally {
      setVcfImporting(false);
    }
  };

  const toggleVcfContact = (i: number) => {
    setVcfContacts(prev => prev.map((c, idx) => idx === i ? { ...c, selected: !c.selected } : c));
  };

  const toggleAllVcf = (val: boolean) => {
    setVcfContacts(prev => prev.map(c => ({ ...c, selected: val })));
  };

  const handleRemoveCity = (city: string) => {
    if (window.confirm(`Remove ${city} from presets? Existing devotees won't be modified.`)) {
      setCities(cities.filter(c => c !== city));
    }
  };

  const handleExportBackup = async () => {
    setIsExporting(true);
    try {
      const db = await getDB();
      const allPayments: PaymentEntry[] = await db.getAll('payment_history') as PaymentEntry[];

      const backupObj = {
        meta: { app: 'Kattalai_CMS', version: '1.0', date: new Date().toISOString() },
        devotees,
        categories: categories.filter(c => !c.is_builtin),
        payments: allPayments
      };

      const zip = new JSZip();
      
      // 1. Add raw JSON for reliable restoration
      zip.file('kattalai_db_backup.json', JSON.stringify(backupObj, null, 2));
      
      // 2. Add CSV for humans to read (as requested by User)
      const csvHeader = 'ID,Name,Phone,City,Category,Amount\n';
      const csvRows = devotees.map(d => `${d.id},"${d.name}","${d.phone}","${d.city}","${d.category}",${d.amount_paid}`);
      zip.file('devotees_readable.csv', csvHeader + csvRows.join('\n'));

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `KATTALAI_BACKUP_${new Date().toISOString().slice(0,10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      
      showToast('Backup Exported!', 'success');
    } catch (e) {
      showToast('Export failed', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!window.confirm('⚠️ WARNING: This will overwrite current conflicting records. Ensure this is a valid backup. Continue?')) {
      return;
    }

    setIsImporting(true);
    try {
      const zip = new JSZip();
      const loadedZip = await zip.loadAsync(file);
      const jsonFile = loadedZip.file('kattalai_db_backup.json');
      
      if (!jsonFile) throw new Error('Valid JSON backup file not found in ZIP');
      
      const jsonStr = await jsonFile.async('string');
      const data = JSON.parse(jsonStr);

      if (data.categories) {
        for (const cat of data.categories) {
          await upsertCategory(cat as Category);
        }
      }
      if (data.devotees) {
        for (const dev of data.devotees) {
          await upsertDevotee(dev as Devotee);
        }
      }
      if (data.payments) {
        const db = await getDB();
        const tx = db.transaction('payment_history', 'readwrite');
        for (const pay of data.payments) {
          tx.store.put(pay as PaymentEntry);
        }
        await tx.done;
      }

      await refreshDevotees();
      await loadCategories();
      showToast('Backup restored successfully!', 'success');

    } catch (err: any) {
      showToast(err.message || 'Import failed. Invalid format.', 'error');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <div>
        <div className="section mb-16">
          <h2 className="mb-16">Settings</h2>

          {/* Global Settings */}
          <div className="card mb-16">
            <h4 className="text-gold mb-16">Preferences</h4>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Theme</label>
                <select className="form-input" value={theme} onChange={e => setTheme(e.target.value as 'light'|'dark'|'system')}>
                  <option value="system">App System Default</option>
                  <option value="dark">Dark Theme (Default)</option>
                  <option value="light">Light Theme</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Default Annual Amount (₹)</label>
                <input className="form-input" type="number" value={defaultAmount} onChange={e => setDefaultAmount(Number(e.target.value) || 0)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Temple Display Name</label>
              <input className="form-input" value={templeName} onChange={e => setTempleName(e.target.value)} />
            </div>
          </div>

          {/* Cities Setup */}
          <div className="card mb-16">
            <h4 className="text-gold mb-16">City Dropdown Presets</h4>
            <div className="flex gap-8 mb-16" style={{ flexWrap: 'wrap' }}>
              {cities.map(c => (
                <span key={c} className="badge p-8 flex gap-8">
                  {c} 
                  <button 
                    onClick={() => handleRemoveCity(c)} 
                    style={{ background:'none', border:'none', color:'var(--red)', cursor:'pointer' }}
                  >✖</button>
                </span>
              ))}
            </div>
            <div className="flex gap-8">
              <input className="form-input flex-1" placeholder="Add new city..." value={newCity} onChange={e => setNewCity(e.target.value)} />
              <button className="btn btn-primary btn-sm" onClick={handleAddCity}>Add</button>
            </div>
          </div>

          {/* ── App Lock ── */}
          <div className="card mb-16" style={{ border: '2px solid var(--gold)' }}>
            <h4 className="text-gold mb-16">🔐 App Lock (PIN)</h4>
            <div className="text-sm text-2 mb-16">
              Protect the app with a 4-digit PIN. Locks automatically after 5 minutes of inactivity.
            </div>

            {pinStep === 'view' && (
              <>
                {hasPin() ? (
                  <div>
                    <div className="flex-between mb-4">
                      <span className="badge badge-green">🔒 PIN Active</span>
                      <button 
                        className="btn btn-primary btn-sm" 
                        onClick={() => { localStorage.removeItem(LAST_ACTIVE_KEY); window.location.reload(); }}
                        style={{ height: 32, padding: '0 12px' }}
                      >
                        🔐 Lock Session
                      </button>
                    </div>
                    <div className="flex gap-8 mt-12">
                      <button className="btn btn-ghost flex-1" onClick={() => { setPinStep('change'); setPinInput(''); setPinConfirm(''); setPinError(''); }}>
                        ✏️ Change PIN
                      </button>
                      <button className="btn btn-ghost flex-1" style={{ color: 'var(--red)', borderColor: 'var(--red)' }} onClick={handleRemovePin}>
                        🗑️ Remove Lock
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-sm text-2 mb-12">No PIN set. App is currently unlocked.</div>
                    <button className="btn btn-primary w-full" onClick={() => { setPinStep('set'); setPinInput(''); setPinConfirm(''); setPinError(''); }}>
                      🔐 Set PIN Lock
                    </button>
                  </div>
                )}
              </>
            )}

            {(pinStep === 'set' || pinStep === 'change') && (
              <div>
                <h5 className="mb-12">{pinStep === 'set' ? 'Set New PIN' : 'Change PIN'}</h5>
                <div className="form-group">
                  <label className="form-label">Enter 4-digit PIN</label>
                  <input
                    className="form-input"
                    type="password"
                    maxLength={4}
                    inputMode="numeric"
                    pattern="\d{4}"
                    placeholder="••••"
                    value={pinInput}
                    onChange={e => { setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4)); setPinError(''); }}
                    style={{ letterSpacing: 8, textAlign: 'center', fontSize: '1.3rem' }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm PIN</label>
                  <input
                    className="form-input"
                    type="password"
                    maxLength={4}
                    inputMode="numeric"
                    pattern="\d{4}"
                    placeholder="••••"
                    value={pinConfirm}
                    onChange={e => { setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4)); setPinError(''); }}
                    style={{ letterSpacing: 8, textAlign: 'center', fontSize: '1.3rem' }}
                  />
                </div>
                {pinError && <div style={{ color: 'var(--red)', fontSize: '0.85rem', marginBottom: 12 }}>⚠️ {pinError}</div>}
                <div className="grid-2">
                  <button className="btn btn-ghost" onClick={() => setPinStep('view')}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleSavePin} disabled={pinInput.length < 4 || pinConfirm.length < 4}>
                    💾 Save PIN
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── VCF / Contacts Import & Export ── */}
          <div className="card mb-16">
            <h4 className="m-0 text-gold mb-4">📇 Contacts (.vcf)</h4>
            <div className="text-sm text-2 mb-16">Import contacts from your phone as devotees, or export all devotees as a .vcf contacts file.</div>
            <div className="grid-2">
              <button className="btn btn-primary btn-sm" onClick={() => vcfInputRef.current?.click()}>
                📤 Import VCF
              </button>
              <button className="btn btn-ghost btn-sm" onClick={handleExportVCF}>
                📥 Export VCF
              </button>
            </div>
            <input type="file" accept=".vcf,text/vcard" ref={vcfInputRef} style={{ display: 'none' }} onChange={handleVCFFileChange} />
          </div>

          {/* ── Custom Categories ── */}
          <div className="card mb-16 flex-between">
            <div>
              <h4 className="m-0 text-gold mb-4">Categories & Nakshathirams</h4>
              <div className="text-sm text-2">Manage colors, and custom VIP badges.</div>
            </div>
            <button className="btn btn-ghost" onClick={() => navigate('/settings/categories')}>Manage</button>
          </div>

          {/* Backup & Restore */}
          <div className="card mb-16" style={{ border: '2px dashed var(--gold)' }}>
            <h4 className="text-gold mb-16">Data Backup & Restore</h4>
            <div className="text-sm text-2 mb-16">
              Export a `ZIP` file containing raw CSVs and a system `JSON` backup file. Keep this safe to restore your device.
            </div>
            <div className="grid-2">
              <button className="btn w-full flex-center" style={{ background: '#1890FF', color: '#fff' }} onClick={handleExportBackup} disabled={isExporting}>
                {isExporting ? '...' : '📩 Export Backup'}
              </button>
              <button className="btn btn-ghost w-full flex-center" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
                {isImporting ? '...' : '📂 Restore from ZIP'}
              </button>
              <input type="file" accept=".zip" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImportBackup} />
            </div>
          </div>

          <PlanGate requiredPlan="pro" featureName="Google Drive Sync">
            <div className="card mt-24 flex gap-12" style={{ alignItems: 'center' }}>
              <div style={{ fontSize: '2rem' }}>☁️</div>
              <div>
                <div className="fw-600">Google Drive Auto-Sync</div>
                <div className="text-sm text-2">Coming soon: automatically backs up when you close the app.</div>
              </div>
            </div>
          </PlanGate>

        </div>
      </div>

      {/* ── VCF Import Preview Modal ── */}
      {vcfModalOpen && (
        <div className="sheet-overlay" onClick={e => e.target === e.currentTarget && setVcfModalOpen(false)}>
          <div className="sheet" style={{ maxHeight: '92dvh' }}>
            <div className="sheet-handle" />

            <div className="flex-between mb-16">
              <div>
                <h3 className="mb-0">📤 Import Contacts</h3>
                <div className="text-xs text-muted">{vcfContacts.filter(c => c.selected).length} of {vcfContacts.length} selected</div>
              </div>
              <button className="btn-icon" onClick={() => setVcfModalOpen(false)}>✖</button>
            </div>

            {/* Default Category */}
            <div className="form-group">
              <label className="form-label">Assign to Category *</label>
              <select className="form-input" value={vcfCategory} onChange={e => setVcfCategory(e.target.value)}>
                <option value="">-- Select Category --</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name} {c.name_ta ? `(${c.name_ta})` : ''}</option>)}
              </select>
            </div>

            {/* Select All / None */}
            <div className="flex gap-8 mb-12">
              <button className="btn btn-ghost btn-sm flex-1" onClick={() => toggleAllVcf(true)}>✅ Select All</button>
              <button className="btn btn-ghost btn-sm flex-1" onClick={() => toggleAllVcf(false)}>⬜ Deselect All</button>
            </div>

            {/* Contact list */}
            <div className="flex-col gap-8 mb-16" style={{ maxHeight: '45dvh', overflowY: 'auto' }}>
              {vcfContacts.map((c, i) => (
                <div
                  key={i}
                  onClick={() => toggleVcfContact(i)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '12px 14px',
                    background: c.selected ? 'rgba(212,175,55,0.08)' : 'var(--surface-2)',
                    border: `1.5px solid ${c.selected ? 'var(--gold)' : 'var(--border)'}`,
                    borderRadius: 10,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {/* Checkbox */}
                  <div style={{
                    width: 20, height: 20, borderRadius: 4, flexShrink: 0, marginTop: 2,
                    background: c.selected ? 'var(--gold)' : 'var(--surface)',
                    border: `2px solid ${c.selected ? 'var(--gold)' : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#000', fontSize: '0.75rem', fontWeight: 700,
                  }}>{ c.selected ? '✓' : '' }</div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="fw-600" style={{ marginBottom: 2, lineHeight: 1.3 }}>{c.name}</div>
                    {c.phone  && <div className="text-xs text-muted">📱 {c.country_code}{c.phone}</div>}
                    {c.phone2 && <div className="text-xs text-muted">📱 {c.phone2}</div>}
                    {c.phone3 && <div className="text-xs text-muted">📱 {c.phone3}</div>}
                    {c.city   && <div className="text-xs text-muted">📍 {c.city}{c.pincode ? ` — ${c.pincode}` : ''}</div>}
                    {c.gothram && <div className="text-xs" style={{ color: 'var(--gold)' }}>Gothram: {c.gothram}</div>}
                  </div>
                </div>
              ))}
            </div>

            {/* Import Button */}
            <button
              className="btn btn-primary w-full"
              onClick={handleVCFImport}
              disabled={vcfImporting || vcfContacts.filter(c => c.selected).length === 0 || !vcfCategory}
            >
              {vcfImporting ? '⏳ Importing...' : `📥 Import ${vcfContacts.filter(c => c.selected).length} Contacts`}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

