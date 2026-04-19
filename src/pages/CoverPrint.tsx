import { useState, useMemo } from 'react';
import { useDevoteeStore, useCategoryStore } from '../store';
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
}

export function CoverPrint() {
  const { devotees } = useDevoteeStore();
  const { categories } = useCategoryStore();

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
    baseFontSize: 18,
  });

  const filtered = useMemo(() => {
    return devotees.filter(d => !filterCategory || d.category === filterCategory);
  }, [devotees, filterCategory]);

  const handlePrint = () => {
    window.print();
  };

  const updateSetting = (key: keyof PrintSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  // Helper to uppercase English text while keeping Tamil intact
  const toPostalCase = (str: string = '') => {
    return str.toUpperCase();
  };

  // Helper to calculate auto font size based on text length
  const getAutoFontSize = (devotee: Devotee) => {
    const totalChars = (devotee.name + devotee.address + devotee.city).length;
    let size = settings.baseFontSize;
    
    // Heuristic: scale down if content is long
    if (totalChars > 150) size = settings.baseFontSize * 0.7;
    else if (totalChars > 100) size = settings.baseFontSize * 0.85;
    
    return `${size}pt`;
  };

  return (
    <div className="page-content">
      {/* ── Settings Sidebar (Hidden on Print) ── */}
      <div className="no-print">
        <div className="section flex-between mb-16">
          <h2 className="mb-0">✉️ Cover & Labels</h2>
          <button className="btn btn-primary btn-sm" onClick={handlePrint}>
            🖨️ Print Covers
          </button>
        </div>

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
              <select className="form-input" value={settings.mode} onChange={e => updateSetting('mode', e.target.value)}>
                <option value="envelope">C6 Envelope (1/page)</option>
                <option value="labels">A4 Label Sheet (Grid)</option>
              </select>
            </div>
            {settings.mode === 'labels' && (
              <div className="form-group">
                <label className="form-label">Grid Layout</label>
                <select className="form-input" value={settings.grid} onChange={e => updateSetting('grid', e.target.value)}>
                  <option value="2x4">2 x 4 (8 labels)</option>
                  <option value="2x5">2 x 5 (10 labels)</option>
                  <option value="3x5">3 x 5 (15 labels)</option>
                </select>
              </div>
            )}
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
      <div className={`print-container mode-${settings.mode} grid-${settings.grid}`}>
        {filtered.map(devotee => (
          <div 
            key={devotee.id} 
            className="print-card"
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
          </div>
        ))}
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
        }

        @media print {
          @page {
            margin: 0;
            size: ${settings.mode === 'envelope' ? '162mm 114mm landscape' : 'A4 portrait'};
          }
          
          body { 
            background: white !important; 
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print, .bottom-nav, .page-header { display: none !important; }
          
          #root { max-width: none !important; width: 100% !important; margin: 0 !important; }
          .page-content { padding: 0 !important; margin: 0 !important; }

          .print-container {
            display: block !important;
            background: none !important;
            padding: 0 !important;
          }

          /* Envelope Mode - Optimized for physical C6 */
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
