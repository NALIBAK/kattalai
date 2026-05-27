import { useState, useMemo } from 'react';
import { useDevoteeStore, useCategoryStore, useSettingsStore } from '../store';
import { useTranslation } from '../utils/i18n';
import type { Devotee } from '../db';

type PrintMode = 'envelope' | 'labels';
type GridType = '2x4' | '2x5' | '3x5';

interface PrintSettings {
  mode: PrintMode;
  grid: GridType;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  textColor: string;
  isBold: boolean;
  baseFontSize: number;
  isSpeedPost: boolean;
}


export function CoverPrint() {
  const { devotees } = useDevoteeStore();
  const { categories } = useCategoryStore();
  const { templeAddress } = useSettingsStore();
  const { t } = useTranslation();

  const [filterCategory, setFilterCategory] = useState('');
  const [settings, setSettings] = useState<PrintSettings>({
    mode: 'envelope',
    grid: '2x5',
    marginTop: 10,
    marginBottom: 10,
    marginLeft: 15,
    marginRight: 10,
    textColor: '#000000',
    isBold: true,
    baseFontSize: 16,
    isSpeedPost: false,
  });

  const filtered = useMemo(() => {
    return devotees.filter(d => !filterCategory || d.category === filterCategory);
  }, [devotees, filterCategory]);

  const handlePrint = () => {
    window.print();
  };

  const updateSetting = <K extends keyof PrintSettings>(key: K, value: PrintSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const toPostalCase = (str: string = '') => {
    return str.toUpperCase();
  };

  // QR Payload: embeds FROM (temple) + TO (devotee) for postal scanning
  const getQRPayload = (devotee: Devotee) => {
    const lines: string[] = ['TO:', devotee.name];
    if (devotee.address) lines.push(devotee.address);
    if (devotee.city || devotee.pincode)
      lines.push([devotee.city, devotee.pincode].filter(Boolean).join(' - '));
    if (devotee.phone) lines.push(`PH: ${devotee.country_code || '+91'}${devotee.phone}`);
    if (templeAddress) { lines.push('', 'FROM:'); lines.push(templeAddress); }
    return lines.join('\n');
  };

  const getAutoFontSize = (devotee: Devotee) => {
    const fullAddress = [
      devotee.name,
      devotee.address,
      `${devotee.city} ${devotee.pincode || ''}`,
      devotee.phone ? `PHONE: ${devotee.country_code || '+91'}${devotee.phone}` : ''
    ].filter(Boolean);

    const maxLineLength = Math.max(...fullAddress.map(l => l.length), 1);
    const totalChars = fullAddress.join(' ').length;

    // Base font size from user settings
    let size = settings.baseFontSize;

    // Apply auto-scaling for C6 Envelope mode
    if (settings.mode === 'envelope') {
      // Scale down for very long single lines to avoid wrap-around clipping
      if (maxLineLength > 55) {
        size *= 0.65;
      } else if (maxLineLength > 40) {
        size *= 0.8;
      } else if (maxLineLength > 28) {
        size *= 0.9;
      }

      // Scale down if total character count is very large (prevents vertical overflow)
      if (totalChars > 180) {
        size *= 0.7;
      } else if (totalChars > 120) {
        size *= 0.85;
      }
    } else {
      // settings.mode === 'labels' (A4 Label Mode)
      // Scale down based on Grid type since A4 labels are smaller than C6 envelopes
      let gridFactor = 1.0;
      if (settings.grid === '2x4') {
        gridFactor = 0.75; // 8 labels
      } else if (settings.grid === '2x5') {
        gridFactor = 0.65; // 10 labels
      } else if (settings.grid === '3x5') {
        gridFactor = 0.55; // 15 labels
      }

      size *= gridFactor;

      // Also apply line length scaling within the smaller label box
      if (maxLineLength > 45) {
        size *= 0.7;
      } else if (maxLineLength > 30) {
        size *= 0.85;
      }

      if (totalChars > 120) {
        size *= 0.75;
      }
    }

    // Ensure we don't go below a readable minimum (e.g. 7pt)
    return `${Math.max(size, 7)}pt`;
  };

  // Auto font-size for SpeedPost address column (~100mm wide, narrower than full C6)
  const getSpeedPostFontSize = (devotee: Devotee) => {
    const lines = [
      devotee.name,
      devotee.address,
      devotee.phone ? `PH: ${devotee.country_code || '+91'}${devotee.phone}` : ''
    ].filter(Boolean);
    const maxLineLength = Math.max(...lines.map(l => l.length), 1);
    let size = 12;
    if (maxLineLength > 45) size = 7.5;
    else if (maxLineLength > 35) size = 9;
    else if (maxLineLength > 25) size = 10.5;
    return `${Math.max(size, 7)}pt`;
  };

  return (
    <div className="page-content">
      {/* ── Settings Sidebar ── */}
      <div className="no-print">
        <div className="section flex-between mb-16">
          <h2 className="mb-0">{t('print_title')}</h2>
          <button className="btn btn-primary btn-sm" onClick={handlePrint}>
            {t('print_btn')}
          </button>
        </div>



        <div className="card mb-16">
          <h4 className="text-gold mb-12">{t('print_settings')}</h4>
          
          <div className="form-group">
            <label className="form-label">{t('print_category')}</label>
            <select className="form-input" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
              <option value="">{t('print_all_cats')}</option>
              {categories.filter(c => devotees.some(d => d.category === c.id)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">{t('print_mode')}</label>
              <select className="form-input" value={settings.mode} onChange={e => updateSetting('mode', e.target.value as PrintMode)}>
                <option value="envelope">{t('print_c6')}</option>
                <option value="labels">{t('print_a4')}</option>
              </select>
            </div>
            {settings.mode === 'labels' && (
              <div className="form-group">
                <label className="form-label">{t('print_layout')}</label>
                <select className="form-input" value={settings.grid} onChange={e => updateSetting('grid', e.target.value as GridType)}>
                  <option value="2x4">2 x 4 (8 labels)</option>
                  <option value="2x5">2 x 5 (10 labels)</option>
                  <option value="3x5">3 x 5 (15 labels)</option>
                </select>
              </div>
            )}
          </div>

          <div className="form-group mt-12 mb-16">
            <label className="flex gap-8 cursor-pointer" style={{ alignItems: 'center' }}>
              <input 
                type="checkbox" 
                checked={settings.isSpeedPost} 
                onChange={e => updateSetting('isSpeedPost', e.target.checked)} 
              />
              <span className="fw-600" style={{ color: 'var(--gold)' }}>{t('print_speedpost_enable')}</span>
            </label>
          </div>

          <h5 className="text-gold mt-12 mb-8">{t('print_style_color')}</h5>
          <div className="grid-3">
            <div className="form-group">
              <label className="form-label">{t('print_color')}</label>
              <input type="color" className="form-input" style={{ padding: 2, height: 44 }} value={settings.textColor} onChange={e => updateSetting('textColor', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('print_weight')}</label>
              <button 
                className={`btn btn-sm w-full ${settings.isBold ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => updateSetting('isBold', !settings.isBold)}
              >
                {settings.isBold ? t('print_weight_bold') : t('print_weight_normal')}
              </button>
            </div>
            <div className="form-group">
              <label className="form-label">{t('print_size')}</label>
              <input type="number" className="form-input" value={settings.baseFontSize} onChange={e => updateSetting('baseFontSize', Number(e.target.value))} />
            </div>
          </div>

          <h5 className="text-gold mt-12 mb-8">{t('print_margins')}</h5>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">{t('print_top')}</label>
              <input type="number" className="form-input" value={settings.marginTop} onChange={e => updateSetting('marginTop', Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('print_bottom')}</label>
              <input type="number" className="form-input" value={settings.marginBottom} onChange={e => updateSetting('marginBottom', Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('print_left')}</label>
              <input type="number" className="form-input" value={settings.marginLeft} onChange={e => updateSetting('marginLeft', Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('print_right')}</label>
              <input type="number" className="form-input" value={settings.marginRight} onChange={e => updateSetting('marginRight', Number(e.target.value))} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Printable Content ── */}
      <div className={`print-container mode-${settings.mode} grid-${settings.grid} ${settings.isSpeedPost ? 'speedpost-layout' : ''}`}>
        {filtered.map((devotee) => {
          const qrData = getQRPayload(devotee);
          
          return (
            <div 
              key={devotee.id} 
              className={`print-card ${settings.isSpeedPost ? 'speedpost-card' : ''}`}
              style={{
                paddingTop: settings.isSpeedPost ? '0' : `${settings.marginTop}mm`,
                paddingBottom: settings.isSpeedPost ? '0' : `${settings.marginBottom}mm`,
                paddingLeft: settings.isSpeedPost ? '0' : `${settings.marginLeft}mm`,
                paddingRight: settings.isSpeedPost ? '0' : `${settings.marginRight}mm`,
                color: settings.textColor,
                fontWeight: settings.isBold ? 700 : 400,
                fontSize: getAutoFontSize(devotee),
                fontFamily: "'Noto Sans Tamil', 'Outfit', sans-serif"
              }}
            >
              {settings.isSpeedPost ? (
                // ── SPEED POST: TO address (left) + QR code (right, embeds FROM+TO) ──
                <div className="sp-card" style={{ fontSize: getSpeedPostFontSize(devotee) }}>
                  <div className="sp-address">
                    <div className="sp-to-name">{toPostalCase(devotee.name)}</div>
                    <div className="sp-to-addr">{toPostalCase(devotee.address)}</div>
                    {devotee.phone && (
                      <div className="sp-to-phone">PH: {devotee.country_code || '+91'}{devotee.phone}</div>
                    )}
                  </div>
                  <div className="sp-qr">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}`}
                      alt="QR Code"
                      className="sp-qr-img"
                    />
                    <div className="sp-qr-label">SCAN FOR DETAILS</div>
                  </div>
                </div>
              ) : (
                // ── STANDARD LAYOUT ──
                <div className="card-content">
                  <div className="name-line">{toPostalCase(devotee.name)}</div>
                  <div className="address-line">{toPostalCase(devotee.address)}</div>
                  {devotee.phone && (
                    <div className="phone-line">
                      PHONE: {devotee.country_code || '+91'}{devotee.phone}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        @media screen {
          .print-container {
            display: flex;
            flex-direction: column;
            gap: 20px;
            background: #eee;
            padding: 20px;
            border-radius: 8px;
          }
          .print-card {
            background: white;
            box-shadow: 0 4px 10px rgba(0,0,0,0.1);
            min-height: 200px;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
          .speedpost-card {
            min-height: 114mm;
            border: 2px dashed rgba(0,0,0,0.2);
          }
        }

        /* ── Speed Post: TO address (left) + QR code (right) ── */
        .sp-card {
          display: grid;
          grid-template-columns: 1fr 30%;
          width: 100%;
          height: 100%;
          box-sizing: border-box;
          border: 0.5mm solid #000;
          overflow: hidden;
          color: inherit;
          font-family: inherit;
        }

        .sp-address {
          padding: 6mm 8mm;
          display: flex;
          flex-direction: column;
          justify-content: center;
          border-right: 0.5mm solid #000;
          overflow: hidden;
          word-break: break-word;
          gap: 2px;
        }

        .sp-to-name {
          font-weight: 800;
          font-size: 1.2em;
          line-height: 1.2;
          margin-bottom: 2px;
        }

        .sp-to-addr {
          font-size: 1em;
          line-height: 1.3;
        }

        .sp-to-city {
          font-size: 1.05em;
          font-weight: 700;
          line-height: 1.2;
          margin-top: 2px;
        }

        .sp-to-pin {
          font-family: monospace;
          background: #000;
          color: #fff;
          padding: 0 3px;
          border-radius: 2px;
          letter-spacing: 1px;
        }

        .sp-to-phone {
          font-size: 0.88em;
          margin-top: 3px;
        }

        .sp-qr {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 4mm;
          gap: 3px;
        }

        .sp-qr-img {
          width: 100%;
          max-width: 40mm;
          height: auto;
          display: block;
        }

        .sp-qr-label {
          font-size: 5.5pt;
          font-weight: 700;
          text-align: center;
          letter-spacing: 0.5px;
          color: #555;
          margin-top: 2px;
        }

        @media print {
          @page {
            margin: 0;
            size: ${settings.mode === 'envelope' ? '162mm 114mm' : 'A4'};
          }
          
          body { 
            background: white !important; 
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print, .bottom-nav, .page-header { display: none !important; }
          
          #root { max-width: none !important; width: 100% !important; margin: 0 !important; }
          .page-content { padding: 0 !important; margin: 0 !important; }

          .print-container {
            display: block !important;
            background: none !important;
            padding: 0 !important;
          }

          /* Envelope Mode - C6: strict 162mm × 114mm, NO bleed */
          .mode-envelope .print-card {
            width: 162mm !important;
            height: 114mm !important;
            max-width: 162mm !important;
            max-height: 114mm !important;
            page-break-after: always;
            break-after: page;
            display: flex;
            flex-direction: column;
            justify-content: center;
            box-sizing: border-box !important;
            overflow: hidden !important;
            position: relative;
          }

          /* Label Mode - A4 */
          .mode-labels {
            display: grid !important;
            width: 210mm;
            height: 297mm;
            grid-gap: 0;
            padding: 0;
          }

          .grid-2x4 { grid-template-columns: repeat(2, 1fr); grid-template-rows: repeat(4, 1fr); }
          .grid-2x5 { grid-template-columns: repeat(2, 1fr); grid-template-rows: repeat(5, 1fr); }
          .grid-3x5 { grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(5, 1fr); }

          .mode-labels .print-card {
            border: none;
            page-break-inside: avoid;
            display: flex;
            flex-direction: column;
            justify-content: center;
            box-sizing: border-box;
            overflow: hidden;
          }
          
          /* SpeedPost on C6 envelope: strict 162×114mm, no bleed */
          .mode-envelope .speedpost-card {
            width: 162mm !important;
            height: 114mm !important;
            max-width: 162mm !important;
            max-height: 114mm !important;
            padding: 0 !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
          }

          /* SpeedPost on A4 labels: fill grid cell, no fixed size */
          .mode-labels .speedpost-card {
            padding: 0 !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
            height: 100%;
          }

          /* sp-card fills 100% of its speedpost-card container */
          .sp-card {
            width: 100% !important;
            height: 100% !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
          }

          /* Tighter padding inside small A4 label cells */
          .mode-labels .sp-address {
            padding: 3mm 4mm;
          }
          .mode-labels .sp-qr {
            padding: 2mm;
          }
          .mode-labels .sp-qr-label {
            display: none;
          }

          .sp-to-pin {
            background-color: #000 !important;
            color: #fff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .sp-qr-img {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }

        .card-content {
          line-height: 1.2;
          word-wrap: break-word;
        }
        .name-line, .address-line, .city-line, .phone-line {
          margin: 0;
          padding: 0;
          border: none;
        }
      `}</style>
    </div>
  );
}
