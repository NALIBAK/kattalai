import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDevoteeStore, useCategoryStore, useSettingsStore } from '../store';
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

// ── Code 39 Barcode Generator (UPU / India Post Compliant) ──
const CODE39_PATTERNS: Record<string, string> = {
  '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000',
  '4': '000110001', '5': '100110000', '6': '001110000', '7': '000100101',
  '8': '100100100', '9': '001100100', 'A': '100001001', 'B': '001001001',
  'C': '101001000', 'D': '000011001', 'E': '100011000', 'F': '001011000',
  'G': '000001101', 'H': '100001100', 'I': '001001100', 'J': '000011100',
  'K': '100000011', 'L': '001000011', 'M': '101000010', 'N': '000010011',
  'O': '100010010', 'P': '001010010', 'Q': '000000111', 'R': '100000110',
  'S': '001000110', 'T': '000010110', 'U': '110000001', 'V': '011000001',
  'W': '111000000', 'X': '010010001', 'Y': '110010000', 'Z': '011010000',
  '-': '010000101', '.': '110000100', ' ': '011000100', '*': '010010100',
  '$': '010101000', '/': '010100010', '+': '010001010', '%': '000101010'
};

function getCode39SVG(text: string, height = 28): string {
  const cleanText = `*${text.toUpperCase()}*`;
  const narrowWidth = 1.0;
  const wideWidth = 2.5;
  const interGap = 0.8;
  
  let currentX = 0;
  const bars: { x: number; width: number }[] = [];
  
  for (let c = 0; c < cleanText.length; c++) {
    const char = cleanText[c];
    const pattern = CODE39_PATTERNS[char] || CODE39_PATTERNS[' '];
    
    for (let i = 0; i < 9; i++) {
      const isBar = (i % 2 === 0);
      const isWide = pattern[i] === '1';
      const width = isWide ? wideWidth : narrowWidth;
      
      if (isBar) {
        bars.push({ x: currentX, width });
      }
      currentX += width;
    }
    currentX += interGap;
  }
  
  const pathD = bars.map(b => `M ${b.x} 0 L ${b.x} ${height} L ${b.x + b.width} ${height} L ${b.x + b.width} 0 Z`).join(' ');
  return `<svg width="100%" height="${height}" viewBox="0 0 ${currentX} ${height}" preserveAspectRatio="none" style="display:block;"><path d="${pathD}" fill="black" /></svg>`;
}

export function CoverPrint() {
  const navigate = useNavigate();
  const { devotees } = useDevoteeStore();
  const { categories } = useCategoryStore();
  const { templeName, templeAddress } = useSettingsStore();

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
    if (settings.isSpeedPost && (!templeAddress || !templeName)) {
      alert('Please set your Sender Return Address (FROM) in your Profile first!');
      return;
    }
    window.print();
  };

  const updateSetting = <K extends keyof PrintSettings>(key: K, value: PrintSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const toPostalCase = (str: string = '') => {
    return str.toUpperCase();
  };

  // UPU S10 Consignment Code Generator
  const getMockTrackingNumber = (index: number) => {
    const baseNum = 10000000 + index;
    const digits = String(baseNum).split('').map(Number);
    const weights = [8, 6, 4, 2, 3, 5, 9, 7];
    let sum = 0;
    for (let i = 0; i < 8; i++) {
      sum += digits[i] * weights[i];
    }
    const remainder = sum % 11;
    let checkDigit = 0;
    if (remainder === 0) checkDigit = 5;
    else if (remainder === 1) checkDigit = 0;
    else checkDigit = 11 - remainder;

    return `SP${baseNum}${checkDigit}IN`;
  };

  // QR Payload creator
  const getQRPayload = (devotee: Devotee, index: number) => {
    const tracking = getMockTrackingNumber(index);
    return `SPEED POST\nTRACKING: ${tracking}\nFROM:\n${templeName}\n${templeAddress}\n\nTO:\n${devotee.name}\n${devotee.address}\n${devotee.city} - ${devotee.pincode || ''}\nPhone: ${devotee.phone}`;
  };

  const getAutoFontSize = (devotee: Devotee) => {
    const lines = [devotee.name, devotee.address, `${devotee.city} ${devotee.pincode || ''}`];
    const maxLineLength = Math.max(...lines.map(l => (l || '').length));
    
    let size = settings.baseFontSize;
    
    if (maxLineLength > 60) size = settings.baseFontSize * 0.7;
    else if (maxLineLength > 45) size = settings.baseFontSize * 0.82;
    else if (maxLineLength > 35) size = settings.baseFontSize * 0.9;
    
    return `${size}pt`;
  };

  const hasMissingAddress = settings.isSpeedPost && (!templeAddress || !templeName);

  return (
    <div className="page-content">
      {/* ── Settings Sidebar ── */}
      <div className="no-print">
        <div className="section flex-between mb-16">
          <h2 className="mb-0">✉️ Cover & Labels</h2>
          <button className="btn btn-primary btn-sm" onClick={handlePrint} disabled={hasMissingAddress}>
            🖨️ Print Covers
          </button>
        </div>

        {/* Warning Banner if FROM address is not set */}
        {hasMissingAddress && (
          <div className="card mb-16 text-center" style={{ border: '2px dashed var(--red)', background: 'rgba(246,70,93,0.05)', padding: '16px' }}>
            <span style={{ fontSize: '2rem' }}>⚠️</span>
            <h4 style={{ color: 'var(--red)', margin: '8px 0' }}>Sender Address Required</h4>
            <p className="text-xs text-muted mb-12">
              You must set your organization Name & Return Address in your profile to use India Speed Post optimization.
            </p>
            <button className="btn btn-primary btn-sm btn-full" onClick={() => navigate('/profile')}>
              ⚙️ Go to Profile to Set Address
            </button>
          </div>
        )}

        <div className="card mb-16">
          <h4 className="text-gold mb-12">Print Settings</h4>
          
          <div className="form-group">
            <label className="form-label">Target Category</label>
            <select className="form-input" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
              <option value="">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Print Mode</label>
              <select className="form-input" value={settings.mode} onChange={e => updateSetting('mode', e.target.value as PrintMode)}>
                <option value="envelope">C6 Envelope (1/page)</option>
                <option value="labels">A4 Label Sheet (Grid)</option>
              </select>
            </div>
            {settings.mode === 'labels' && (
              <div className="form-group">
                <label className="form-label">Grid Layout</label>
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
              <span className="fw-600" style={{ color: 'var(--gold)' }}>🇮🇳 Enable Indian Speed Post Layout</span>
            </label>
          </div>

          <h5 className="text-gold mt-12 mb-8">Style & Color</h5>
          <div className="grid-3">
            <div className="form-group">
              <label className="form-label">Color</label>
              <input type="color" className="form-input" style={{ padding: 2, height: 44 }} value={settings.textColor} onChange={e => updateSetting('textColor', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Weight</label>
              <button 
                className={`btn btn-sm w-full ${settings.isBold ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => updateSetting('isBold', !settings.isBold)}
              >
                {settings.isBold ? 'Bold' : 'Normal'}
              </button>
            </div>
            <div className="form-group">
              <label className="form-label">Size (pt)</label>
              <input type="number" className="form-input" value={settings.baseFontSize} onChange={e => updateSetting('baseFontSize', Number(e.target.value))} />
            </div>
          </div>

          <h5 className="text-gold mt-12 mb-8">Margins (mm)</h5>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Top</label>
              <input type="number" className="form-input" value={settings.marginTop} onChange={e => updateSetting('marginTop', Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label className="form-label">Bottom</label>
              <input type="number" className="form-input" value={settings.marginBottom} onChange={e => updateSetting('marginBottom', Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label className="form-label">Left</label>
              <input type="number" className="form-input" value={settings.marginLeft} onChange={e => updateSetting('marginLeft', Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label className="form-label">Right</label>
              <input type="number" className="form-input" value={settings.marginRight} onChange={e => updateSetting('marginRight', Number(e.target.value))} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Printable Content ── */}
      <div className={`print-container mode-${settings.mode} grid-${settings.grid} ${settings.isSpeedPost ? 'speedpost-layout' : ''}`}>
        {filtered.map((devotee, index) => {
          const tracking = getMockTrackingNumber(index);
          const qrData = getQRPayload(devotee, index);
          
          return (
            <div 
              key={devotee.id} 
              className={`print-card ${settings.isSpeedPost ? 'speedpost-card' : ''}`}
              style={{
                paddingTop: `${settings.marginTop}mm`,
                paddingBottom: `${settings.marginBottom}mm`,
                paddingLeft: `${settings.marginLeft}mm`,
                paddingRight: `${settings.marginRight}mm`,
                color: settings.textColor,
                fontWeight: settings.isBold ? 700 : 400,
                fontSize: getAutoFontSize(devotee),
                fontFamily: "'Noto Sans Tamil', 'Outfit', sans-serif"
              }}
            >
              {settings.isSpeedPost ? (
                // ── SPEED POST PREMIUM OPTIMIZED LAYOUT ──
                <div className="speedpost-grid">
                  
                  {/* Header Strip */}
                  <div className="speedpost-header">
                    <span className="logo-text">🇮🇳 SPEED POST</span>
                    <span className="logo-sub">DEPARTMENT OF POSTS, INDIA</span>
                  </div>

                  {/* Left Column: Address Blocks */}
                  <div className="address-section">
                    <div className="from-block">
                      <span className="section-label">FROM (SENDER):</span>
                      <div className="from-text">{toPostalCase(templeName)}</div>
                      <div className="from-addr">{toPostalCase(templeAddress)}</div>
                    </div>

                    <div className="to-block">
                      <span className="section-label">TO (RECIPIENT):</span>
                      <div className="to-name">{toPostalCase(devotee.name)}</div>
                      <div className="to-address">{toPostalCase(devotee.address)}</div>
                      <div className="to-city">
                        {toPostalCase(devotee.city)} - <span className="to-pin">{devotee.pincode || 'NO PIN'}</span>
                      </div>
                      {devotee.phone && (
                        <div className="to-phone">PHONE: {devotee.country_code || '+91'}{devotee.phone}</div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: QR and Barcodes */}
                  <div className="barcode-section">
                    {/* QR Code */}
                    <div className="qr-container">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}`} 
                        alt="Postal Routing QR"
                        className="qr-img" 
                      />
                    </div>

                    {/* Sorting Barcode (Pincode) */}
                    {devotee.pincode && (
                      <div className="barcode-item">
                        <span className="barcode-label">SORTING PINCODE</span>
                        <div 
                          className="barcode-svg" 
                          dangerouslySetInnerHTML={{ __html: getCode39SVG(devotee.pincode, 22) }} 
                        />
                        <span className="barcode-value">{devotee.pincode}</span>
                      </div>
                    )}

                    {/* Consignment Tracking Barcode */}
                    <div className="barcode-item">
                      <span className="barcode-label">CONSIGNMENT TRACKING</span>
                      <div 
                        className="barcode-svg" 
                        dangerouslySetInnerHTML={{ __html: getCode39SVG(tracking, 22) }} 
                      />
                      <span className="barcode-value">{tracking}</span>
                    </div>

                  </div>
                </div>
              ) : (
                // ── STANDARD LAYOUT ──
                <div className="card-content">
                  <div className="name-line">{toPostalCase(devotee.name)}</div>
                  <div className="address-line">{toPostalCase(devotee.address)}</div>
                  <div className="city-line">
                    {toPostalCase(devotee.city)}
                    {devotee.pincode ? ` - ${devotee.pincode}` : ''}
                  </div>
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
            min-height: 290px;
            padding: 16px;
            border: 1px dashed rgba(0,0,0,0.15);
          }
        }

        /* Speed Post CSS Grid & Elements */
        .speedpost-grid {
          display: grid;
          grid-template-columns: 1fr 180px;
          grid-template-rows: auto 1fr;
          grid-gap: 8px;
          height: 100%;
          border: 1px solid #000;
          box-sizing: border-box;
          font-size: 8.5pt !important;
          line-height: 1.25;
        }

        .speedpost-header {
          grid-column: 1 / span 2;
          background: #000;
          color: #fff;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 4px 8px;
          font-weight: 800;
          letter-spacing: 0.5px;
          font-size: 9pt !important;
        }

        .logo-text { color: var(--gold); }
        .logo-sub { font-size: 7pt; opacity: 0.8; }

        .address-section {
          padding: 8px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          border-right: 1.5px solid #000;
          gap: 12px;
        }

        .from-block {
          border-bottom: 1px dashed #ccc;
          padding-bottom: 6px;
        }

        .section-label {
          display: block;
          font-size: 7.5pt;
          font-weight: 800;
          color: #555;
          margin-bottom: 2px;
          text-decoration: underline;
        }

        .from-text {
          font-weight: 700;
          font-size: 8.5pt;
        }

        .from-addr {
          font-size: 7.5pt;
          color: #444;
        }

        .to-block {
          padding-top: 4px;
        }

        .to-name {
          font-weight: 800;
          font-size: 11pt;
          margin-bottom: 4px;
        }

        .to-address {
          font-size: 9.5pt;
          margin-bottom: 4px;
        }

        .to-city {
          font-size: 10.5pt;
          font-weight: 700;
        }

        .to-pin {
          background: #000;
          color: #fff;
          padding: 0 4px;
          border-radius: 2px;
          font-family: monospace;
          letter-spacing: 1px;
        }

        .to-phone {
          font-size: 8.5pt;
          margin-top: 4px;
          font-weight: 700;
        }

        .barcode-section {
          padding: 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .qr-container {
          width: 72px;
          height: 72px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #fff;
          border: 1px solid #000;
        }

        .qr-img {
          width: 66px;
          height: 66px;
        }

        .barcode-item {
          width: 100%;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .barcode-label {
          font-size: 6.5pt;
          font-weight: 800;
          color: #333;
          margin-bottom: 1px;
        }

        .barcode-svg {
          width: 100%;
          margin: 1px 0;
        }

        .barcode-value {
          font-family: monospace;
          font-size: 7.5pt;
          font-weight: 700;
          letter-spacing: 0.5px;
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

          /* Envelope Mode - C6 */
          .mode-envelope .print-card {
            width: 162mm;
            height: 114mm;
            page-break-after: always;
            display: flex;
            flex-direction: column;
            justify-content: center;
            box-sizing: border-box;
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
            border: 0.1mm dashed #ccc;
            page-break-inside: avoid;
            display: flex;
            flex-direction: column;
            justify-content: center;
            box-sizing: border-box;
            overflow: hidden;
          }
          
          .speedpost-card {
            height: 100%;
            padding: 3.5mm;
          }
          
          .speedpost-grid {
            border: 0.3mm solid #000;
          }
          
          .speedpost-header {
            background-color: #000 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .to-pin {
            background-color: #000 !important;
            color: #fff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }

        .card-content {
          line-height: 1.4;
          word-wrap: break-word;
        }
        .name-line {
          margin-bottom: 4px; border-bottom: 1px solid rgba(0,0,0,0.1); padding-bottom: 4px;
        }
      `}</style>
    </div>
  );
}
