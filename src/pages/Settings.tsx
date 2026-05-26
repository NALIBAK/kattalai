import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore, useDevoteeStore, useCategoryStore, useToastStore } from '../store';
import { getDB, Devotee, PaymentEntry, MessageTemplate, upsertDevotee } from '../db';
import { restoreFromBackupBlob } from '../utils/backup';
import { allowPush } from '../utils/syncLock';
import { PlanGate } from '../components/PlanGate';
import JSZip from 'jszip';
import { useTranslation } from '../utils/i18n';

export function Settings() {
  const navigate = useNavigate();
  const { showToast } = useToastStore();
  const { t } = useTranslation();
  
  // Stores
  const { 
    theme, defaultAmount, language,
    messageTemplates,
    setTheme, setDefaultAmount, setLanguage,
    addTemplate, updateTemplate, removeTemplate 
  } = useSettingsStore();
  const { devotees, refresh: refreshDevotees } = useDevoteeStore();
  const { categories, loadCategories } = useCategoryStore();

  // Local state for UI
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const vcfInputRef = useRef<HTMLInputElement>(null);

  // Template Editing state
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [isAddingTemplate, setIsAddingTemplate] = useState(false);
  const [tempLabel, setTempLabel] = useState('');
  const [tempText, setTempText] = useState('');

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

  // ── Template Handlers ──────────────────────────────────────────
  const handleAddTemplate = async () => {
    if (!tempLabel.trim() || !tempText.trim()) return;
    await addTemplate(tempLabel.trim(), tempText.trim());
    setIsAddingTemplate(false);
    setTempLabel('');
    setTempText('');
    showToast(t('settings_tmpl_added'), 'success');
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplate || !tempLabel.trim() || !tempText.trim()) return;
    await updateTemplate({ ...editingTemplate, label: tempLabel.trim(), text: tempText.trim() });
    setEditingTemplate(null);
    setTempLabel('');
    setTempText('');
    showToast(t('settings_tmpl_updated'), 'success');
  };

  const handleRemoveTemplate = async (id: string) => {
    if (window.confirm(t('settings_tmpl_confirm_delete'))) {
      await removeTemplate(id);
      showToast(t('settings_tmpl_deleted'), 'info');
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

  const handleExportGMapCSV = () => {
    const mapDevs = devotees.filter(d => d.location_lat && d.location_lng);
    if (mapDevs.length === 0) {
      showToast('No devotees with valid GPS tags to export', 'error');
      return;
    }

    const csvHeaders = [
      'Name',
      'Phone',
      'Address',
      'City',
      'Pincode',
      'Gothram',
      'Category',
      'Annual Dues',
      'Amount Paid',
      'Pending Dues',
      'Latitude',
      'Longitude',
      'Google Maps Link'
    ];

    const csvRows = mapDevs.map(d => {
      const cat = categories.find(c => c.id === d.category);
      const categoryName = cat ? cat.name : 'Uncategorized';
      const pendingDues = Math.max(0, d.annual_amount - d.amount_paid);
      const fullAddress = d.address ? d.address.replace(/"/g, '""') : '';
      const mapsLink = `https://www.google.com/maps/search/?api=1&query=${d.location_lat},${d.location_lng}`;

      return [
        `"${d.name.replace(/"/g, '""')}"`,
        `"${d.phone}"`,
        `"${fullAddress}"`,
        `"${d.city.replace(/"/g, '""')}"`,
        `"${d.pincode || ''}"`,
        `"${(d.gothram || '').replace(/"/g, '""')}"`,
        `"${categoryName}"`,
        d.annual_amount,
        d.amount_paid,
        pendingDues,
        d.location_lat,
        d.location_lng,
        `"${mapsLink}"`
      ].join(',');
    });

    const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Kattalai_GMap_Import_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${mapDevs.length} devotee locations for Google Maps!`, 'success');
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
      let country_code = ''; // Default to empty, detect if possible

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
          const rawNum = line.replace(/^TEL[^:]*:/i, '').trim();
          let num = rawNum.replace(/[\s\-().]/g, '');
          
          // 1. Detect country code explicitly if '+' is present
          if (num.startsWith('+')) {
            const ccMatch = num.match(/^(\+\d{1,4})/);
            if (ccMatch) {
              country_code = ccMatch[1];
              num = num.slice(ccMatch[1].length);
            }
          } 
          // 2. Handle specific prefixes ONLY if the resulting number is NOT 10 digits
          else if (num.length !== 10) {
            if (num.startsWith('0')) {
              num = num.slice(1);
            } else if (num.startsWith('91') && num.length === 12) {
              country_code = '+91';
              num = num.slice(2);
            }
          }
          
          // If after all logic it's empty, ignore
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
      showToast(t('settings_vcf_no_contacts'), 'error');
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
    if (toImport.length === 0) { showToast(t('settings_vcf_no_selected'), 'error'); return; }
    if (!vcfCategory) { showToast(t('settings_vcf_select_default_cat'), 'error'); return; }

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
          country_code: c.country_code || '',
          pincode: c.pincode || undefined,
          address: c.address || '',
          city: c.city || '',
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
      allowPush(); // Unlock auto-push
      showToast(t('settings_vcf_success').replace('{count}', String(toImport.length)), 'success');
      setVcfModalOpen(false);
      setVcfContacts([]);
    } catch (err) {
      const error = err as { message?: string };
      showToast(error.message || t('settings_backup_restore_failed'), 'error');
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

  const handleExportBackup = async () => {
    setIsExporting(true);
    try {
      const db = await getDB();
      const allPayments: PaymentEntry[] = await db.getAll('payment_history') as PaymentEntry[];
      const deletedDevotees = await db.getAll('deleted_devotees');

      const backupObj = {
        meta: { app: 'Kattalai_CMS', version: '1.0', date: new Date().toISOString() },
        devotees,
        categories: categories.filter(c => !c.is_builtin),
        payments: allPayments,
        deleted_devotees: deletedDevotees
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
      
      showToast(t('settings_backup_exported'), 'success');
    } catch {
      showToast(t('settings_backup_export_failed'), 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!window.confirm(t('settings_backup_confirm_restore'))) {
      return;
    }

    setIsImporting(true);
    try {
      await restoreFromBackupBlob(file);
      await refreshDevotees();
      await loadCategories();
      allowPush(); // Unlock auto-push
      showToast(t('settings_backup_restore_success'), 'success');

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : t('settings_backup_restore_failed');
      showToast(errMsg, 'error');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <div>
        <div className="section mb-16">
          <h2 className="mb-16">{t('settings_title')}</h2>

          {/* Global Settings */}
          <div className="card mb-16">
            <h4 className="text-gold mb-16">{t('settings_pref')}</h4>
            <div className="flex-between mb-16">
              <div>
                <div className="fw-600">{t('settings_theme')}</div>
              </div>
              <button 
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                style={{ fontSize: '1.5rem', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
                title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
              >
                {theme === 'dark' ? '🌙' : '☀️'}
              </button>
            </div>

            {/* Language Selection Toggle */}
            <div className="flex-between mb-16">
              <div>
                <div className="fw-600">{t('settings_lang')}</div>
              </div>
              <div className="flex gap-8" style={{ background: 'var(--surface-2)', padding: '4px', borderRadius: '8px' }}>
                <button
                  onClick={() => setLanguage('ta')}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    background: language === 'ta' ? 'var(--gold)' : 'transparent',
                    color: language === 'ta' ? '#000' : 'var(--text-3)',
                    transition: 'all 0.15s'
                  }}
                >
                  🇮🇳 தமிழ்
                </button>
                <button
                  onClick={() => setLanguage('en')}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    background: language === 'en' ? 'var(--gold)' : 'transparent',
                    color: language === 'en' ? '#000' : 'var(--text-3)',
                    transition: 'all 0.15s'
                  }}
                >
                  🇬🇧 English
                </button>
              </div>
            </div>
            
            <div className="form-group">
              <label className="form-label">{t('settings_default_amt')}</label>
              <input className="form-input" type="number" value={defaultAmount} onChange={e => setDefaultAmount(Number(e.target.value) || 0)} />
            </div>
          </div>

          {/* ── Message Templates Manager (Plus+) ── */}
          <PlanGate requiredPlan="plus" featureName="Message Templates">
          <div className="card mb-16">
            <div className="flex-between mb-16">
              <h4 className="text-gold m-0">{t('settings_templates')}</h4>
              <button className="btn btn-primary btn-sm" onClick={startAddTemplate}>{t('settings_add_template')}</button>
            </div>

            <div className="flex-col gap-12">
              {messageTemplates.map(t => (
                <div key={t.id} className="card-flat" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  <div className="flex-between mb-8">
                    <div className="fw-700">{t.label}</div>
                    <div className="flex gap-8">
                      <button className="btn-icon btn-sm" onClick={() => startEditTemplate(t)}>✏️</button>
                      <button className="btn-icon btn-sm" style={{ color: 'var(--red)' }} onClick={() => handleRemoveTemplate(t.id)}>🗑️</button>
                    </div>
                  </div>
                  <div className="text-xs text-muted text-ellipsis-3">{t.text}</div>
                </div>
              ))}
            </div>

            {(isAddingTemplate || editingTemplate) && (
              <div className="mt-24 p-16" style={{ background: 'var(--surface-3)', borderRadius: 12, border: '1.5px solid var(--gold)' }}>
                <h5 className="mb-12">{isAddingTemplate ? t('settings_new_template') : t('settings_edit_template')}</h5>
                <div className="form-group">
                  <label className="form-label">{t('settings_tmpl_label')}</label>
                  <input className="form-input" value={tempLabel} onChange={e => setTempLabel(e.target.value)} placeholder="e.g. Festival Wishes" />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('settings_tmpl_text')}</label>
                  <textarea className="form-input" rows={6} value={tempText} onChange={e => setTempText(e.target.value)} placeholder="Type your message..." />
                  <div className="text-xs text-muted mt-4">
                    {t('settings_tmpl_placeholders')} {`{name}, {city}, {nakshathiram}, {expiry_date}, {balance}`}
                  </div>
                </div>
                <div className="grid-2">
                  <button className="btn btn-ghost" onClick={() => { setIsAddingTemplate(false); setEditingTemplate(null); }}>{t('settings_tmpl_cancel')}</button>
                  <button className="btn btn-primary" onClick={isAddingTemplate ? handleAddTemplate : handleUpdateTemplate} disabled={!tempLabel.trim() || !tempText.trim()}>
                    {t('settings_tmpl_save')}
                  </button>
                </div>
              </div>
            )}
          </div>
          </PlanGate>

          {/* ── VCF / Contacts Import & Export ── */}
          <div className="card mb-16">
            <h4 className="m-0 text-gold mb-4">{t('settings_contacts')}</h4>
            <div className="text-sm text-2 mb-16">{t('settings_contacts_desc')}</div>
            <div className="grid-2">
              <button className="btn btn-primary btn-sm" onClick={() => vcfInputRef.current?.click()}>
                {t('settings_import_vcf')}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={handleExportVCF}>
                {t('settings_export_vcf')}
              </button>
            </div>
            <input type="file" accept=".vcf,text/vcard" ref={vcfInputRef} style={{ display: 'none' }} onChange={handleVCFFileChange} />
          </div>

          {/* ── Google My Maps CSV Export ── */}
          <div className="card mb-16">
            <h4 className="m-0 text-gold mb-4">{t('settings_gmap_export')}</h4>
            <div className="text-sm text-2 mb-16">{t('settings_gmap_desc')}</div>
            <button className="btn btn-ghost w-full btn-sm flex-center gap-8" onClick={handleExportGMapCSV}>
              {t('settings_gmap_btn')}
            </button>
          </div>

          {/* ── Custom Categories ── */}
          <div className="card mb-16 flex-between" style={{ flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h4 className="m-0 text-gold mb-4">{t('settings_categories')}</h4>
              <div className="text-sm text-2">{t('settings_categories_desc')}</div>
            </div>
            <button className="btn btn-ghost" onClick={() => navigate('/settings/categories')}>{t('settings_manage')}</button>
          </div>

          {/* ── Recycle Bin ── */}
          <div className="card mb-16 flex-between" style={{ flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h4 className="m-0 text-gold mb-4">{t('settings_recycle_bin')}</h4>
              <div className="text-sm text-2">{t('settings_recycle_desc')}</div>
            </div>
            <button className="btn btn-ghost" onClick={() => navigate('/settings/recycle-bin')}>{t('settings_view')}</button>
          </div>

          {/* Backup & Restore */}
          <div className="card mb-32" style={{ border: '2px dashed var(--gold)' }}>
            <h4 className="text-gold mb-16">{t('settings_backup_title')}</h4>
            <div className="text-sm text-2 mb-16">
              {t('settings_backup_desc')}
            </div>
            <div className="grid-2">
              <button className="btn w-full flex-center" style={{ background: '#1890FF', color: '#fff' }} onClick={handleExportBackup} disabled={isExporting}>
                {isExporting ? '...' : t('settings_export_zip')}
              </button>
              <button className="btn btn-ghost w-full flex-center" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
                {isImporting ? '...' : t('settings_import_zip')}
              </button>
              <input type="file" accept=".zip" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImportBackup} />
            </div>
          </div>




        </div>
      </div>

      {/* ── VCF Import Preview Modal ── */}
      {vcfModalOpen && (
        <div className="sheet-overlay" onClick={e => e.target === e.currentTarget && setVcfModalOpen(false)}>
          <div className="sheet" style={{ maxHeight: '92dvh' }}>
            <div className="sheet-handle" />

            <div className="flex-between mb-16">
              <div>
                <h3 className="mb-0">{t('settings_vcf_import_title')}</h3>
                <div className="text-xs text-muted">
                  {vcfContacts.filter(c => c.selected).length} {t('settings_vcf_of')} {vcfContacts.length} {t('settings_vcf_selected_count')}
                </div>
              </div>
              <button className="btn-icon" onClick={() => setVcfModalOpen(false)}>✖</button>
            </div>

            {/* Default Category */}
            <div className="form-group">
              <label className="form-label">{t('settings_vcf_assign_cat')}</label>
              <select className="form-input" value={vcfCategory} onChange={e => setVcfCategory(e.target.value)}>
                <option value="">{t('settings_vcf_select_cat_placeholder')}</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name} {c.name_ta ? `(${c.name_ta})` : ''}</option>)}
              </select>
            </div>

            {/* Select All / None */}
            <div className="flex gap-8 mb-12">
              <button className="btn btn-ghost btn-sm flex-1" onClick={() => toggleAllVcf(true)}>{t('settings_vcf_select_all')}</button>
              <button className="btn btn-ghost btn-sm flex-1" onClick={() => toggleAllVcf(false)}>{t('settings_vcf_deselect_all')}</button>
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
              {vcfImporting ? t('settings_vcf_importing') : t('settings_vcf_import_btn').replace('{count}', String(vcfContacts.filter(c => c.selected).length))}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

