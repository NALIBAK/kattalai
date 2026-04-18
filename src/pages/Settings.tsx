import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore, useDevoteeStore, useCategoryStore, useToastStore } from '../store';
import { getDB, upsertDevotee, upsertCategory, Devotee, Category, PaymentEntry } from '../db';
import { PlanGate } from '../components/PlanGate';
import JSZip from 'jszip';

export function Settings() {
  const navigate = useNavigate();
  const { showToast } = useToastStore();
  
  // Stores
  const { theme, cities, defaultAmount, templeName, setTheme, setCities, setDefaultAmount, setTempleName } = useSettingsStore();
  const { devotees, refresh: refreshDevotees } = useDevoteeStore();
  const { categories, loadCategories } = useCategoryStore();

  // Local state for UI
  const [newCity, setNewCity] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddCity = () => {
    if (!newCity.trim() || cities.includes(newCity.trim())) return;
    setCities([...cities, newCity.trim()]);
    setNewCity('');
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

        {/* Custom Categories */}
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
