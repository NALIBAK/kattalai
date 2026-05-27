import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore, useDevoteeStore, useCategoryStore, useToastStore } from '../store';
import { getDB, Devotee, PaymentEntry, upsertDevotee } from '../db';
import { restoreFromBackupBlob } from '../utils/backup';
import { allowPush } from '../utils/syncLock';
import JSZip from 'jszip';
import { useTranslation } from '../utils/i18n';

export function Settings() {
  const navigate = useNavigate();
  const { showToast } = useToastStore();
  const { t } = useTranslation();
  const isTa = t('save') === 'சேமி';
  
  // Stores
  const { 
    theme, defaultAmount, language,
    setTheme, setDefaultAmount, setLanguage
  } = useSettingsStore();
  const { devotees, refresh: refreshDevotees } = useDevoteeStore();
  const { categories, loadCategories } = useCategoryStore();

  // Local state for UI
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // PWA Installation State
  const [isStandalone, setIsStandalone] = useState(() => {
    return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
  });
  const [deferredPrompt, setDeferredPrompt] = useState<any>(() => (window as any).deferredPrompt);
  const [isIOS] = useState(() => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  });
  const [showIOSSheet, setShowIOSSheet] = useState(false);
  const [isDismissed, setIsDismissed] = useState(() => {
    return localStorage.getItem('kattalai_pwa_dismissed') === 'true';
  });

  useEffect(() => {
    const handleInstallable = () => {
      setDeferredPrompt((window as any).deferredPrompt);
    };
    const handleInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('pwa-installable', handleInstallable);
    window.addEventListener('pwa-installed', handleInstalled);
    
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      setIsStandalone(e.matches);
    };
    
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleMediaChange);
    }

    return () => {
      window.removeEventListener('pwa-installable', handleInstallable);
      window.removeEventListener('pwa-installed', handleInstalled);
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleMediaChange);
      }
    };
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        (window as any).deferredPrompt = null;
        setDeferredPrompt(null);
      }
    } else if (isIOS) {
      setShowIOSSheet(true);
    } else {
      showToast(
        isTa
          ? 'செயலியை நிறுவ: உலாவியின் மெனுவில் (⋮) "செயலியை நிறுவு" அல்லது "முகப்புத் திரையில் சேர்" என்பதைத் தேர்ந்தெடுக்கவும்.'
          : 'To install: Open browser menu (⋮) and select "Install app" or "Add to Home Screen".',
        'info'
      );
    }
  };
  const fileInputRef = useRef<HTMLInputElement>(null);
  const vcfInputRef = useRef<HTMLInputElement>(null);

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

          {/* ── PWA Installation Support ── */}
          {isStandalone ? (
            <div className="flex-center mb-16" style={{ width: '100%' }}>
              <div className="badge badge-gold" style={{ 
                padding: '8px 16px', 
                fontSize: '0.85rem', 
                fontWeight: 700, 
                border: '1.5px solid var(--gold)',
                boxShadow: '0 2px 10px rgba(212,175,55,0.2)',
                background: 'rgba(212,175,55,0.08)',
                width: '100%',
                justifyContent: 'center',
                gap: '8px'
              }}>
                👑 {t('pwa_installed_badge')}
              </div>
            </div>
          ) : (
            (!isDismissed && (deferredPrompt || isIOS || true)) && (
              <div className="card mb-16" style={{
                border: '1.5px solid var(--gold)',
                background: 'linear-gradient(135deg, var(--surface) 0%, var(--surface-2) 100%)',
                boxShadow: '0 4px 16px rgba(212,175,55,0.15)',
                position: 'relative'
              }}>
                <button 
                  onClick={() => {
                    setIsDismissed(true);
                    localStorage.setItem('kattalai_pwa_dismissed', 'true');
                  }}
                  style={{
                    position: 'absolute',
                    top: 10,
                    right: 12,
                    fontSize: '1.1rem',
                    color: 'var(--text-3)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 4
                  }}
                >
                  ✖
                </button>
                
                <div className="flex gap-12" style={{ alignItems: 'flex-start', paddingRight: 20 }}>
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: 'rgba(212,175,55,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem',
                    flexShrink: 0
                  }}>
                    📱
                  </div>
                  <div>
                    <h4 className="m-0 fw-700" style={{ fontSize: '0.9375rem', color: 'var(--text)' }}>
                      {t('pwa_install_title')}
                    </h4>
                    <p className="text-xs text-muted mt-4" style={{ lineHeight: 1.4, opacity: 0.9 }}>
                      {t('pwa_install_desc')}
                    </p>
                  </div>
                </div>

                <button
                  className="btn btn-primary btn-full mt-12 animate-hover-scale"
                  onClick={handleInstallApp}
                  style={{
                    background: 'var(--gold)',
                    color: '#000',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    height: 'auto',
                    minHeight: '38px',
                    padding: '8px 16px',
                    borderRadius: '6px'
                  }}
                >
                  {t('pwa_btn_install')}
                </button>
              </div>
            )
          )}

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



          {/* ── VCF / Contacts Import & Export ── */}
          <div className="card mb-16">
            <h4 className="m-0 text-gold mb-4">{t('settings_contacts')}</h4>
            <div className="text-sm text-2 mb-16">{t('settings_contacts_desc')}</div>
            <div className="flex gap-12" style={{ flexWrap: 'wrap' }}>
              <button 
                className="btn btn-primary btn-sm flex-1" 
                onClick={() => vcfInputRef.current?.click()}
                style={{ whiteSpace: 'normal', height: 'auto', minHeight: '44px', padding: '8px 12px', minWidth: '140px' }}
              >
                {t('settings_import_vcf')}
              </button>
              <button 
                className="btn btn-ghost btn-sm flex-1" 
                onClick={handleExportVCF}
                style={{ whiteSpace: 'normal', height: 'auto', minHeight: '44px', padding: '8px 12px', minWidth: '140px' }}
              >
                {t('settings_export_vcf')}
              </button>
            </div>
            <input type="file" accept=".vcf,text/vcard" ref={vcfInputRef} style={{ display: 'none' }} onChange={handleVCFFileChange} />
          </div>

          {/* ── Google My Maps CSV Export ── */}
          <div className="card mb-16">
            <h4 className="m-0 text-gold mb-4">{t('settings_gmap_export')}</h4>
            <div className="text-sm text-2 mb-16">{t('settings_gmap_desc')}</div>
            <button 
              className="btn btn-ghost w-full btn-sm flex-center gap-8" 
              onClick={handleExportGMapCSV}
              style={{ whiteSpace: 'normal', height: 'auto', minHeight: '44px', padding: '8px 12px' }}
            >
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
            <div className="flex gap-12" style={{ flexWrap: 'wrap' }}>
              <button 
                className="btn flex-1 flex-center" 
                style={{ background: '#1890FF', color: '#fff', whiteSpace: 'normal', height: 'auto', minHeight: '44px', padding: '8px 12px', minWidth: '140px' }} 
                onClick={handleExportBackup} 
                disabled={isExporting}
              >
                {isExporting ? '...' : t('settings_export_zip')}
              </button>
              <button 
                className="btn btn-ghost flex-1 flex-center" 
                onClick={() => fileInputRef.current?.click()} 
                disabled={isImporting}
                style={{ whiteSpace: 'normal', height: 'auto', minHeight: '44px', padding: '8px 12px', minWidth: '140px' }}
              >
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
      {/* ── iOS Installation Guide Bottom Sheet ── */}
      {showIOSSheet && (
        <div className="sheet-overlay" onClick={e => e.target === e.currentTarget && setShowIOSSheet(false)}>
          <div className="sheet animate-slide-up" style={{ maxHeight: '90dvh' }}>
            <div className="sheet-handle" />

            <div className="flex-between mb-16">
              <div>
                <h3 className="mb-0 text-gold fw-800">{t('pwa_ios_guide_title')}</h3>
              </div>
              <button className="btn-icon" onClick={() => setShowIOSSheet(false)}>✖</button>
            </div>

            <div className="flex-col gap-16 p-8" style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>
              {/* Step 1 */}
              <div className="flex gap-12" style={{ alignItems: 'flex-start' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 14, background: 'var(--surface-2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0
                }}>1</div>
                <div>
                  <div className="fw-600">{isTa ? 'உலாவிப் பகிர் பொத்தான்' : 'Open Sharing Menu'}</div>
                  <div className="text-xs text-muted mt-2">{t('pwa_ios_step_1')}</div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-12" style={{ alignItems: 'flex-start' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 14, background: 'var(--surface-2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0
                }}>2</div>
                <div>
                  <div className="fw-600">{isTa ? 'முகப்புத் திரையில் சேர்' : 'Add to Home Screen'}</div>
                  <div className="text-xs text-muted mt-2">{t('pwa_ios_step_2')}</div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-12" style={{ alignItems: 'flex-start' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 14, background: 'var(--surface-2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0
                }}>3</div>
                <div>
                  <div className="fw-600">{isTa ? 'நிறுவலை உறுதிசெய்' : 'Confirm Installation'}</div>
                  <div className="text-xs text-muted mt-2">{t('pwa_ios_step_3')}</div>
                </div>
              </div>
            </div>

            <button 
              className="btn btn-primary w-full mt-20" 
              onClick={() => setShowIOSSheet(false)}
              style={{ background: 'var(--gold)', color: '#000', fontWeight: 700 }}
            >
              {isTa ? 'சரி, புரிந்து கொண்டேன்' : 'Got it, thanks'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

