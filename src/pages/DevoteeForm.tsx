import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDevoteeStore, useCategoryStore, useSettingsStore, useToastStore } from '../store';
import { getDevotee, upsertDevotee, generateId, Devotee } from '../db';

export function DevoteeForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { refresh } = useDevoteeStore();
  const { categories } = useCategoryStore();
  const { cities, defaultAmount } = useSettingsStore();
  const { showToast } = useToastStore();
  
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState<Partial<Devotee>>({
    name: '', phone: '', address: '', city: cities[0] || '',
    gothram: '', category: categories[0]?.id || '',
    annual_amount: defaultAmount, amount_paid: 0,
    prasadham_count: 1, prasadham_override: false,
    location_lat: undefined, location_lng: undefined, location_accurate: false,
    subscription_start: new Date().toISOString().split('T')[0],
    subscription_end: new Date(Date.now() + 365*86400000).toISOString().split('T')[0],
  });

  const [isGeocoding, setIsGeocoding] = useState(false);

  useEffect(() => {
    if (isEdit && id) {
      getDevotee(id).then(d => {
        if (d) setFormData(d);
        else { showToast('Devotee not found', 'error'); navigate('/devotees'); }
      });
    }
  }, [id, isEdit, navigate, showToast]);

  const handleChange = (field: keyof Devotee, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
          location_accurate: false // It's a geocoded estimate, not GPS
        }));
        showToast('Approximate location found!', 'success');
      } else {
        showToast('Location not found. Try simplifying the address.', 'error');
      }
    } catch (e) {
      showToast('Geocoding failed. Check network.', 'error');
    } finally {
      setIsGeocoding(false);
    }
  };

  const getGPS = () => {
    if (!navigator.geolocation) { showToast('GPS not supported on device', 'error'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData(prev => ({
          ...prev, location_lat: pos.coords.latitude, location_lng: pos.coords.longitude, location_accurate: true
        }));
        showToast('Accurate GPS Location saved', 'success');
      },
      (err) => showToast(err.message, 'error'),
      { enableHighAccuracy: true }
    );
  };

  const handleSave = async () => {
    if (!formData.name || !formData.phone || !formData.category) {
      showToast('Name, Phone, and Category are required', 'error');
      return;
    }

    const devId = isEdit ? id! : generateId();
    const newDevotee: Devotee = {
      ...formData as Devotee,
      id: devId,
      created_at: isEdit ? formData.created_at! : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await upsertDevotee(newDevotee);
    await refresh();
    showToast(`Devotee saved`, 'success');
    navigate(isEdit ? `/devotees/${devId}` : '/devotees');
  };

  return (
    <div>
      <div className="section flex-between mb-24">
        <div className="flex-center gap-12">
          <button className="btn-icon" onClick={() => navigate(-1)}>🔙</button>
          <h2 className="mb-0">{isEdit ? 'Edit Devotee' : 'New Devotee'}</h2>
        </div>
        <button className="btn btn-primary btn-sm" onClick={handleSave}>💾 Save</button>
      </div>

      <div className="card mb-16">
        <h4 className="mb-16 text-gold">1. Personal Details</h4>
        <div className="form-group">
          <label className="form-label">Full Name *</label>
          <input className="form-input" value={formData.name} onChange={e => handleChange('name', e.target.value)} placeholder="e.g. Rajan Murugesan" />
        </div>
        
        <div className="form-group">
          <label className="form-label">Phone Number * (WhatsApp)</label>
          <input className="form-input" type="tel" value={formData.phone} onChange={e => handleChange('phone', e.target.value)} placeholder="10-digit number" />
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

      <div className="card mb-16">
        <h4 className="mb-16 text-gold">2. Address & Location</h4>
        <div className="form-group">
          <label className="form-label">City *</label>
          <select className="form-input" value={formData.city} onChange={e => handleChange('city', e.target.value)}>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
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
