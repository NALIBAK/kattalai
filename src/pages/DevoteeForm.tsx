import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDevoteeStore, useCategoryStore, useSettingsStore, useToastStore } from '../store';
import { getDevotee, upsertDevotee, generateId, Devotee } from '../db';
import { searchPincodes } from '../data/india_pincodes';

// ── Country codes ─────────────────────────────────────────────────────────────
const COUNTRY_CODES = [
  { code: '+91', name: 'India 🇮🇳' },
  { code: '+1',  name: 'USA/Canada 🇺🇸' },
  { code: '+44', name: 'UK 🇬🇧' },
  { code: '+61', name: 'Australia 🇦🇺' },
  { code: '+971', name: 'UAE 🇦🇪' },
  { code: '+65', name: 'Singapore 🇸🇬' },
  { code: '+60', name: 'Malaysia 🇲🇾' },
  { code: '+94', name: 'Sri Lanka 🇱🇰' },
  { code: '+977', name: 'Nepal 🇳🇵' },
  { code: '+880', name: 'Bangladesh 🇧🇩' },
  { code: '+49', name: 'Germany 🇩🇪' },
  { code: '+33', name: 'France 🇫🇷' },
  { code: '+81', name: 'Japan 🇯🇵' },
  { code: '+86', name: 'China 🇨🇳' },
  { code: '+55', name: 'Brazil 🇧🇷' },
  { code: '+7',  name: 'Russia 🇷🇺' },
  { code: '+27', name: 'South Africa 🇿🇦' },
  { code: '+234', name: 'Nigeria 🇳🇬' },
  { code: '+966', name: 'Saudi Arabia 🇸🇦' },
  { code: '+974', name: 'Qatar 🇶🇦' },
];

export function DevoteeForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { refresh, devotees } = useDevoteeStore();
  const { categories } = useCategoryStore();
  const { defaultAmount } = useSettingsStore();
  const { showToast } = useToastStore();
  
  const dynamicCities = Array.from(new Set(devotees.map(d => d.city).filter(Boolean).sort()));
  
  const isEdit = Boolean(id);
  const isIndia = (cc: string) => cc === '+91';

  const [formData, setFormData] = useState<Partial<Devotee>>({
    name: '',
    country_code: '+91',
    phone: '',
    phone2: '',
    phone3: '',
    pincode: '',
    address: '',
    city: '',
    gothram: '',
    category: categories[0]?.id || '',
    annual_amount: defaultAmount,
    amount_paid: 0,
    prasadham_count: 1,
    prasadham_override: false,
    location_lat: undefined,
    location_lng: undefined,
    location_accurate: false,
    subscription_start: new Date().toISOString().split('T')[0],
    subscription_end: new Date(Date.now() + 365*86400000).toISOString().split('T')[0],
  });

  const [isGeocoding, setIsGeocoding] = useState(false);
  const [pincodeQuery, setPincodeQuery] = useState('');
  const [pincodeSuggestions, setPincodeSuggestions] = useState<{ code: string; city: string; state: string }[]>([]);
  const [showPincodeDrop, setShowPincodeDrop] = useState(false);
  const pincodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEdit && id) {
      getDevotee(id).then(d => {
        if (d) {
          setFormData(d);
          setPincodeQuery(d.pincode || '');
        } else {
          showToast('Devotee not found', 'error');
          navigate('/devotees');
        }
      });
    }
  }, [id, isEdit, navigate, showToast]);

  // Close pincode dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pincodeRef.current && !pincodeRef.current.contains(e.target as Node)) {
        setShowPincodeDrop(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleChange = (field: keyof Devotee, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePincodeInput = (val: string) => {
    setPincodeQuery(val);
    handleChange('pincode', val);
    if (isIndia(formData.country_code || '+91') && val.length >= 2) {
      const results = searchPincodes(val);
      setPincodeSuggestions(results);
      setShowPincodeDrop(results.length > 0);
    } else {
      setShowPincodeDrop(false);
    }
  };

  const selectPincode = (entry: { code: string; city: string; state: string }) => {
    setPincodeQuery(entry.code);
    handleChange('pincode', entry.code);
    // Auto-fill city from geodata (always helpful)
    handleChange('city', entry.city);
    setShowPincodeDrop(false);
  };

  const handleGeocode = async () => {
    if (!formData.address || !formData.city) {
      showToast('Please enter Address and City first', 'error');
      return;
    }
    try {
      setIsGeocoding(true);
      const query = encodeURIComponent(`${formData.address}, ${formData.city}`);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`);
      const data = await res.json();
      if (data && data.length > 0) {
        setFormData(prev => ({
          ...prev,
          location_lat: parseFloat(data[0].lat),
          location_lng: parseFloat(data[0].lon),
          location_accurate: false,
        }));
        showToast('Approximate location found!', 'success');
      } else {
        showToast('Location not found. Try simplifying the address.', 'error');
      }
    } catch {
      showToast('Geocoding failed. Check network.', 'error');
    } finally {
      setIsGeocoding(false);
    }
  };

  const getGPS = () => {
    if (!navigator.geolocation) { showToast('GPS not supported on device', 'error'); return; }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setFormData(prev => ({
          ...prev, location_lat: pos.coords.latitude, location_lng: pos.coords.longitude, location_accurate: true,
        }));
        showToast('Accurate GPS Location saved', 'success');
      },
      err => showToast(err.message, 'error'),
      { enableHighAccuracy: true }
    );
  };

  const handleSave = async () => {
    if (!formData.name || !formData.category) {
      showToast('Name and Category are required', 'error');
      return;
    }

    const devId = isEdit ? id! : generateId();
    const newDevotee: Devotee = {
      ...formData as Devotee,
      id: devId,
      country_code: formData.country_code || '+91',
      created_at: isEdit ? formData.created_at! : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await upsertDevotee(newDevotee);
    await refresh();
    showToast('Devotee saved', 'success');
    navigate(isEdit ? `/devotees/${devId}` : '/devotees');
  };

  const countryCode = formData.country_code || '+91';
  const india = isIndia(countryCode);

  return (
    <div>
      <div className="section flex-between mb-24">
        <div className="flex-center gap-12">
          <button className="btn-icon" onClick={() => navigate(-1)}>🔙</button>
          <h2 className="mb-0">{isEdit ? 'Edit Devotee' : 'New Devotee'}</h2>
        </div>
        <button className="btn btn-primary btn-sm" onClick={handleSave}>💾 Save</button>
      </div>

      {/* ── 1. Personal Details ── */}
      <div className="card mb-16">
        <h4 className="mb-16 text-gold">1. Personal Details</h4>
        <div className="form-group">
          <label className="form-label">Full Name *</label>
          <input className="form-input" value={formData.name} onChange={e => handleChange('name', e.target.value)} placeholder="e.g. Rajan Murugesan" />
        </div>

        {/* Country Code + Primary Phone */}
        <div className="form-group">
          <label className="form-label">Phone (WhatsApp)
            <span style={{ color: 'var(--text-2)', fontWeight: 400, marginLeft: 6, fontSize: '0.8rem' }}>Optional</span>
          </label>
          <div className="flex gap-8">
            <select
              className="form-input"
              style={{ width: 160, flexShrink: 0 }}
              value={countryCode}
              onChange={e => handleChange('country_code', e.target.value)}
            >
              {COUNTRY_CODES.map(c => (
                <option key={c.code} value={c.code}>{c.code} {c.name}</option>
              ))}
            </select>
            <input
              className="form-input flex-1"
              type="tel"
              value={formData.phone}
              onChange={e => handleChange('phone', e.target.value)}
              placeholder={india ? '10-digit number' : 'Phone number'}
            />
          </div>
        </div>

        {/* Additional phone numbers */}
        <div className="form-group">
          <label className="form-label">Alt Phone 2
            <span style={{ color: 'var(--text-2)', fontWeight: 400, marginLeft: 6, fontSize: '0.8rem' }}>Optional</span>
          </label>
          <div className="flex gap-8">
            <select className="form-input" style={{ width: 120, flexShrink: 0 }} value={countryCode} onChange={e => handleChange('country_code', e.target.value)}>
              {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
            </select>
            <input className="form-input flex-1" type="tel" value={formData.phone2 || ''} onChange={e => handleChange('phone2', e.target.value)} placeholder="Optional 2nd number" />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Alt Phone 3
            <span style={{ color: 'var(--text-2)', fontWeight: 400, marginLeft: 6, fontSize: '0.8rem' }}>Optional</span>
          </label>
          <div className="flex gap-8">
            <select className="form-input" style={{ width: 120, flexShrink: 0 }} value={countryCode} onChange={e => handleChange('country_code', e.target.value)}>
              {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
            </select>
            <input className="form-input flex-1" type="tel" value={formData.phone3 || ''} onChange={e => handleChange('phone3', e.target.value)} placeholder="Optional 3rd number" />
          </div>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Gothram</label>
            <input className="form-input" value={formData.gothram} onChange={e => handleChange('gothram', e.target.value)} placeholder="e.g. Bharadwaja" />
          </div>
          <div className="form-group">
            <label className="form-label">Nakshathiram / Category *</label>
            <select className="form-input" value={formData.category} onChange={e => handleChange('category', e.target.value)}>
              <option value="">Select Categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name} {c.name_ta ? `(${c.name_ta})` : ''}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── 2. Address & Location ── */}
      <div className="card mb-16">
        <h4 className="mb-16 text-gold">2. Address & Location</h4>
        <div className="form-group">
          <label className="form-label">City</label>
          <input 
            className="form-input" 
            value={formData.city} 
            onChange={e => handleChange('city', e.target.value)} 
            placeholder="e.g. Chidambaram"
            list="city-suggestions"
          />
          <datalist id="city-suggestions">
            {dynamicCities.map(c => <option key={c} value={c} />)}
          </datalist>
        </div>

        {/* Pincode field */}
        <div className="form-group" ref={pincodeRef} style={{ position: 'relative' }}>
          <label className="form-label">
            Pincode / ZIP Code
            {india && <span style={{ color: 'var(--text-2)', fontWeight: 400, marginLeft: 6, fontSize: '0.8rem' }}>India — searchable</span>}
            {!india && <span style={{ color: 'var(--text-2)', fontWeight: 400, marginLeft: 6, fontSize: '0.8rem' }}>Optional</span>}
          </label>
          <input
            className="form-input"
            value={pincodeQuery}
            onChange={e => handlePincodeInput(e.target.value)}
            onFocus={() => { if (pincodeSuggestions.length > 0) setShowPincodeDrop(true); }}
            placeholder={india ? 'Search by pincode or city...' : 'Enter postal/ZIP code (optional)'}
            autoComplete="off"
          />
          {showPincodeDrop && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 8, maxHeight: 220, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            }}>
              {pincodeSuggestions.map(s => (
                <div
                  key={s.code}
                  onMouseDown={() => selectPincode(s)}
                  style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span className="fw-600">{s.code}</span>
                  <span className="text-sm text-2">{s.city}, {s.state}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Street Address</label>
          <textarea className="form-input" value={formData.address} onChange={e => handleChange('address', e.target.value)} placeholder="e.g. 12 Car Street..." rows={2} />
        </div>

        <div className="card-flat" style={{ background: formData.location_accurate ? 'rgba(14,203,129,0.05)' : 'var(--surface-2)' }}>
          <div className="flex-between mb-8">
            <label className="form-label mb-0">Location Tag 📍</label>
            {formData.location_lat && (
              <span className={`badge ${formData.location_accurate ? 'badge-green' : 'badge-amber'}`}>
                {formData.location_accurate ? 'Exact GPS' : 'Approximate'}
              </span>
            )}
          </div>
          <div className="flex gap-8 mt-8">
            <button className="btn btn-sm btn-ghost flex-1" onClick={handleGeocode} disabled={isGeocoding}>
              {isGeocoding ? '...' : '🌐 Auto-Locate'}
            </button>
            <button className="btn btn-sm flex-1" style={{ border: '1px solid var(--gold)', color: 'var(--gold)' }} onClick={getGPS}>
              📍 Use GPS (Exact)
            </button>
          </div>
          {formData.location_lat && (
            <div className="text-xs text-muted mt-8">
              Lat: {formData.location_lat.toFixed(4)}, Lng: {formData.location_lng?.toFixed(4)}
            </div>
          )}
        </div>
      </div>

      {/* ── 3. Subscription ── */}
      <div className="card mb-32">
        <h4 className="mb-16 text-gold">3. Subscription</h4>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Annual Amount (₹)</label>
            <input className="form-input" type="number" value={formData.annual_amount} onChange={e => handleChange('annual_amount', Number(e.target.value))} />
          </div>
          <div className="form-group">
            <label className="form-label">Initially Paid (₹)</label>
            <input className="form-input" type="number" value={formData.amount_paid} onChange={e => handleChange('amount_paid', Number(e.target.value))} disabled={isEdit} />
            {isEdit && <div className="form-hint">Edit via Payment History</div>}
          </div>
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Start Date</label>
            <input className="form-input" type="date" value={formData.subscription_start?.slice(0,10)} onChange={e => handleChange('subscription_start', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Expiry Date</label>
            <input className="form-input" type="date" value={formData.subscription_end?.slice(0,10)} onChange={e => handleChange('subscription_end', e.target.value)} />
          </div>
        </div>
      </div>
    </div>
  );
}
