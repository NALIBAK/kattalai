import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCategoryStore, useToastStore } from '../store';
import { PlanGate } from '../components/PlanGate';
import { getDevotee, deleteDevotee, Devotee, getSubscriptionStatus, getPaymentStatus, upsertDevotee } from '../db';
import { allowPush } from '../utils/syncLock';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix leaflet icon issue in react
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export function DevoteeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { categories } = useCategoryStore();
  const { showToast } = useToastStore();
  const [devotee, setDevotee] = useState<Devotee | null>(null);

  useEffect(() => {
    if (id) getDevotee(id).then(d => {
      if (d) setDevotee(d);
      else { showToast('Not found', 'error'); navigate('/devotees'); }
    });
  }, [id, navigate, showToast]);

  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [searchAddress, setSearchAddress] = useState('');

  const handleAutoLocate = async (customQuery?: string) => {
    const queryStr = customQuery || `${devotee?.address}, ${devotee?.city}`;
    if (!queryStr.trim()) {
      showToast('No address to search', 'error');
      return;
    }
    setIsLocating(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryStr)}&limit=1`);
      const data = await res.json();
      if (data && data.length > 0) {
        const item = data[0];
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);
        
        if (devotee) {
          const updated = {
            ...devotee,
            location_lat: lat,
            location_lng: lng,
            location_accurate: false,
            updated_at: new Date().toISOString()
          };
          await upsertDevotee(updated);
          setDevotee(updated);
          allowPush();
          showToast('📍 Location tagged successfully!', 'success');
          setIsEditingLocation(false);
          setSearchAddress('');
        }
      } else {
        showToast('Address not found. Try searching a custom location.', 'error');
      }
    } catch {
      showToast('Network error during geocoding', 'error');
    } finally {
      setIsLocating(false);
    }
  };

  const handleUseGPS = () => {
    if (!navigator.geolocation) {
      showToast('GPS not supported on this device', 'error');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (devotee) {
          const updated = {
            ...devotee,
            location_lat: pos.coords.latitude,
            location_longitude: undefined, // ensure deprecated legacy fields are cleared if any
            location_lng: pos.coords.longitude,
            location_accurate: true,
            updated_at: new Date().toISOString()
          };
          await upsertDevotee(updated);
          setDevotee(updated);
          allowPush();
          showToast('🎯 Accurate device GPS tagged!', 'success');
          setIsLocating(false);
          setIsEditingLocation(false);
        }
      },
      (err) => {
        showToast(`GPS Error: ${err.message}`, 'error');
        setIsLocating(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleClearLocation = async () => {
    if (!devotee) return;
    if (window.confirm('Remove GPS coordinates from this devotee?')) {
      const updated = {
        ...devotee,
        location_lat: undefined,
        location_lng: undefined,
        location_accurate: false,
        updated_at: new Date().toISOString()
      };
      await upsertDevotee(updated);
      setDevotee(updated);
      allowPush();
      showToast('GPS tag removed', 'info');
      setIsEditingLocation(false);
    }
  };

  if (!devotee) return <div className="p-16">Loading...</div>;

  const subStatus = getSubscriptionStatus(devotee);
  const payStatus = getPaymentStatus(devotee);
  const cat = categories.find(c => c.id === devotee.category);
  const catName = cat ? (cat.is_builtin ? `${cat.name} ${cat.name_ta ? `(${cat.name_ta})` : ''}` : cat.name) : 'Unknown';

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${devotee.name}? This will delete all their payments and family member records as well. This action cannot be undone.`)) {
      deleteDevotee(devotee.id).then(() => {
        allowPush(); // Unlock auto-push — user made a genuine edit
        showToast('Devotee deleted', 'success');
        navigate('/devotees');
      });
    }
  };

  const openGoogleMaps = () => {
    if (devotee.location_lat && devotee.location_lng) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${devotee.location_lat},${devotee.location_lng}`, '_blank');
    }
  };

  return (
    <div>
      <div className="section flex-between mb-24">
        <button className="btn-icon" onClick={() => navigate('/devotees')}>🔙</button>
        <div className="flex gap-8">
          <button className="btn btn-sm btn-ghost" onClick={() => navigate(`/devotees/${id}/edit`)}>✏️ Edit</button>
          <button className="btn btn-sm btn-danger" onClick={handleDelete}>🗑️</button>
        </div>
      </div>

      <div className="card mb-16">
        <div className="flex gap-16" style={{ alignItems: 'center', marginBottom: 16 }}>
          <div className="devotee-avatar" style={{ width: 64, height: 64, fontSize: '1.5rem' }}>
            {devotee.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="mb-4">{devotee.name}</h2>
            <div className="text-2 mb-4">📱 {devotee.phone}</div>
            <button 
              className="btn btn-sm" 
              style={{ background: '#25D366', color: '#fff', padding: '4px 8px', fontSize: '0.75rem' }}
              onClick={() => window.open(`whatsapp://send?phone=91${devotee.phone}`, '_blank')}
            >
              💬 WhatsApp Chat
            </button>
          </div>
        </div>

        <div className="flex gap-8 mb-16" style={{ flexWrap: 'wrap' }}>
          {subStatus === 'active' && <span className="badge badge-green">Sub: Active</span>}
          {subStatus === 'expiring' && <span className="badge badge-amber">Sub: Expiring Soon</span>}
          {subStatus === 'expired' && <span className="badge badge-red">Sub: Expired</span>}
          
          {payStatus === 'paid' && <span className="badge badge-green">Pay: Full</span>}
          {payStatus === 'partial' && <span className="badge badge-amber">Pay: Partial</span>}
          {payStatus === 'unpaid' && <span className="badge badge-red">Pay: Unpaid</span>}
          
          {cat && !cat.is_builtin ? (
            <span className="badge" style={{ backgroundColor: `${cat.color}20`, color: cat.color }}>
              {cat.name}
            </span>
          ) : (
            <span className="badge badge-muted">{catName}</span>
          )}
        </div>

        <div className="divider"></div>
        <div className="grid-2">
          <div>
            <div className="text-xs text-muted mb-4">Category / Nakshathiram</div>
            <div className="fw-600">{catName}</div>
          </div>
          <div>
            <div className="text-xs text-muted mb-4">Gothram</div>
            <div className="fw-600">{devotee.gothram || '—'}</div>
          </div>
        </div>
      </div>

      {/* Financial info */}
      {devotee.annual_amount > 0 && devotee.subscription_end && (
        <div className="card mb-16">
          <div className="flex-between mb-16">
            <h4 className="text-gold">Subscription Details</h4>
            <span className="text-2 text-sm">{(devotee.subscription_start || '').slice(0,10)} to {(devotee.subscription_end || '').slice(0,10)}</span>
          </div>
          <div className="grid-3 mb-16">
            <div>
              <div className="text-xs text-muted">Annual</div>
              <div className="fw-600">₹{devotee.annual_amount}</div>
            </div>
            <div>
              <div className="text-xs text-muted">Paid</div>
              <div className="fw-600 text-green">₹{devotee.amount_paid}</div>
            </div>
            <div>
              <div className="text-xs text-muted">Pending</div>
              <div className="fw-600 text-red">₹{Math.max(0, devotee.annual_amount - devotee.amount_paid)}</div>
            </div>
          </div>
          <button className="btn btn-ghost w-full btn-sm" onClick={() => navigate(`/devotees/${id}/payments`)}>💳 View Payment History</button>
        </div>
      )}

      {/* Location */}
      <PlanGate requiredPlan="pro" featureName="GPS Map & Navigation">
        <div className="card mb-32 p-0" style={{ overflow: 'hidden' }}>
          <div className="p-16 flex-between" style={{ flexWrap: 'nowrap' }}>
            <div>
              <h4 className="text-gold mb-4">Location & Navigation</h4>
              <div className="text-sm text-2">📍 {devotee.address}, {devotee.city}</div>
            </div>
            <button 
              className="btn btn-ghost btn-sm" 
              onClick={() => setIsEditingLocation(!isEditingLocation)}
              title="Edit Location Coordinates"
              style={{ flexShrink: 0 }}
            >
              {isEditingLocation ? 'Cancel' : '⚙️ Pin GPS'}
            </button>
          </div>
          
          {isEditingLocation ? (
            <div className="p-16 pt-0 animate-fade-in">
              <div className="card-flat" style={{ border: '1.5px solid var(--gold)' }}>
                <h5 className="mb-8 text-gold">📍 Pin Devotee GPS Location</h5>
                
                {/* Auto Locate Address */}
                <div className="mb-12">
                  <div className="text-xs text-muted mb-4">Quick Auto-locate from profile address:</div>
                  <button 
                    className="btn btn-primary btn-sm w-full" 
                    onClick={() => handleAutoLocate()} 
                    disabled={isLocating}
                  >
                    {isLocating ? '🌐 Locating...' : '🌐 Auto-Locate Profile Address'}
                  </button>
                </div>
                
                <div className="divider" style={{ margin: '12px 0' }} />

                {/* Custom Address Search */}
                <div className="form-group mb-12">
                  <label className="form-label">Search Custom Address / Landmark</label>
                  <div className="flex gap-8">
                    <input 
                      type="text" 
                      className="form-input flex-1" 
                      placeholder="e.g. Chidambaram Natarajar Temple..." 
                      value={searchAddress} 
                      onChange={e => setSearchAddress(e.target.value)} 
                    />
                    <button 
                      className="btn btn-primary btn-sm flex-center" 
                      onClick={() => handleAutoLocate(searchAddress)} 
                      disabled={isLocating || !searchAddress.trim()}
                      style={{ padding: '0 12px' }}
                    >
                      🔍
                    </button>
                  </div>
                </div>

                <div className="divider" style={{ margin: '12px 0' }} />

                {/* Manual Device GPS */}
                <div className="grid-2">
                  <button 
                    className="btn btn-ghost btn-sm" 
                    onClick={handleUseGPS}
                    disabled={isLocating}
                    style={{ border: '1.5px solid var(--gold)', color: 'var(--gold)' }}
                  >
                    📍 Tag Device GPS
                  </button>
                  
                  {devotee.location_lat && (
                    <button 
                      className="btn btn-danger btn-sm" 
                      onClick={handleClearLocation}
                    >
                      🗑️ Clear GPS Tag
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : devotee.location_lat && devotee.location_lng ? (
            <div>
              <div style={{ height: 200, width: '100%', background: 'var(--surface-2)' }}>
                <MapContainer 
                  center={[devotee.location_lat, devotee.location_lng]} 
                  zoom={15} 
                  style={{ height: '100%', width: '100%', zIndex: 1 }}
                  zoomControl={false}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[devotee.location_lat, devotee.location_lng]} />
                </MapContainer>
              </div>
              <div className="p-16 flex gap-8" style={{ background: 'var(--surface-2)' }}>
                <button className="btn btn-primary flex-1" onClick={openGoogleMaps}>
                  🧭 Navigate in Google Maps
                </button>
              </div>
            </div>
          ) : (
            <div className="p-16 pt-0">
              <div className="empty-state p-16" style={{ border: '1px dashed var(--border)', borderRadius: 'var(--r-sm)' }}>
                <div style={{ fontSize: '2rem' }}>📍</div>
                <div className="text-sm mb-16">No GPS Location Set</div>
                
                {/* Instant Quick-setup options directly on card */}
                <div className="flex-col gap-8 w-full" style={{ maxWidth: '300px' }}>
                  <button 
                    className="btn btn-ghost btn-sm w-full" 
                    onClick={() => handleAutoLocate()}
                    disabled={isLocating}
                  >
                    {isLocating ? '🌐 Finding...' : '🌐 Auto-Locate from Address'}
                  </button>
                  <button 
                    className="btn btn-ghost btn-sm w-full" 
                    onClick={handleUseGPS}
                    disabled={isLocating}
                    style={{ border: '1px solid var(--gold)', color: 'var(--gold)' }}
                  >
                    📍 Tag Device GPS (Current)
                  </button>
                  <button 
                    className="btn btn-sm w-full" 
                    style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
                    onClick={() => setIsEditingLocation(true)}
                  >
                    🔍 Search Custom Address
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </PlanGate>

      {devotee.gmap_link && (
        <div className="card mb-32 p-0" style={{ overflow: 'hidden' }}>
          <div className="p-16">
            <h4 className="text-gold mb-4">Google Maps Shared View 🌐</h4>
            <div className="text-xs text-muted mb-12">Interactive live map view loaded directly from your saved shared link.</div>
          </div>
          <div style={{ height: 300, width: '100%', border: 'none', background: 'var(--surface-2)' }}>
            <iframe
              title="Google Map Shared View"
              src={`https://maps.google.com/maps?q=${encodeURIComponent(devotee.gmap_link)}&t=&z=16&ie=UTF8&iwloc=&output=embed`}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          <div className="p-16" style={{ background: 'var(--surface-2)' }}>
            <button 
              className="btn btn-ghost btn-sm w-full"
              style={{ border: '1px solid var(--gold)', color: 'var(--gold)' }}
              onClick={() => window.open(devotee.gmap_link, '_blank')}
            >
              🌐 Open Original Link
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
