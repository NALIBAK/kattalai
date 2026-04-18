import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCategoryStore, useToastStore } from '../store';
import { getDevotee, deleteDevotee, Devotee, getSubscriptionStatus, getPaymentStatus } from '../db';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix leaflet icon issue in react
delete (L.Icon.Default.prototype as any)._getIconUrl;
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

  if (!devotee) return <div className="p-16">Loading...</div>;

  const subStatus = getSubscriptionStatus(devotee);
  const payStatus = getPaymentStatus(devotee);
  const cat = categories.find(c => c.id === devotee.category);
  const catName = cat ? (cat.is_builtin ? `${cat.name} ${cat.name_ta ? `(${cat.name_ta})` : ''}` : cat.name) : 'Unknown';

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${devotee.name}? This will delete all their payments and family member records as well. This action cannot be undone.`)) {
      deleteDevotee(devotee.id).then(() => {
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
      <div className="card mb-16">
        <div className="flex-between mb-16">
          <h4 className="text-gold">Subscription Details</h4>
          <span className="text-2 text-sm">{devotee.subscription_start.slice(0,10)} to {devotee.subscription_end.slice(0,10)}</span>
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

      {/* Location */}
      <div className="card mb-32 p-0" style={{ overflow: 'hidden' }}>
        <div className="p-16">
          <h4 className="text-gold mb-8">Location & Navigation</h4>
          <div className="text-sm text-2 mb-16">📍 {devotee.address}, {devotee.city}</div>
        </div>
        
        {devotee.location_lat && devotee.location_lng ? (
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
            <div className="p-16" style={{ background: 'var(--surface-2)' }}>
              <button className="btn btn-primary w-full" onClick={openGoogleMaps}>
                🧭 Navigate in Google Maps
              </button>
            </div>
          </div>
        ) : (
          <div className="p-16 pt-0">
            <div className="empty-state p-16" style={{ border: '1px dashed var(--border)', borderRadius: 'var(--r-sm)' }}>
              <div style={{ fontSize: '2rem' }}>📍</div>
              <div className="text-sm">No GPS Location Set</div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
