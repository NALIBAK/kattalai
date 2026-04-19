import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore, useDevoteeStore, useCategoryStore, useToastStore } from '../store';
import { getDB, upsertDevotee, upsertCategory, Devotee, Category, PaymentEntry } from '../db';
import { PlanGate } from '../components/PlanGate';
import { useAppLock } from '../components/AppLock';
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

  // App Lock state
  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinStep, setPinStep] = useState<'view' | 'set' | 'change'>('view');
  const [pinError, setPinError] = useState('');

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
                  <div className="flex gap-8 mb-4">
                    <span className="badge badge-green">🔒 PIN Active</span>
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

        {/* ── VCF / Contacts Export ── */}
        <div className="card mb-16">
          <div className="flex-between">
            <div>
              <h4 className="m-0 text-gold mb-4">📇 Export Contacts (.vcf)</h4>
              <div className="text-sm text-2">Export all devotees as a contacts file with multiple phone numbers. Import directly into your phone.</div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={handleExportVCF} style={{ marginLeft: 12, flexShrink: 0 }}>
              📥 Export VCF
            </button>
          </div>
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
  );
}
