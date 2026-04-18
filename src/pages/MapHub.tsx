import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { useDevoteeStore, useSettingsStore } from '../store';
import { getSubscriptionStatus, getPaymentStatus } from '../db';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Re-apply Leaflet icon fix just in case
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export function MapHub() {
  const navigate = useNavigate();
  const { devotees, load } = useDevoteeStore();
  const { cities } = useSettingsStore();

  const [viewMode, setViewMode] = useState<'map' | 'city'>('map');
  const [selectedCity, setSelectedCity] = useState<string>('');

  useEffect(() => {
    load();
  }, [load]);

  const mapDevotees = devotees.filter(d => 
    d.location_lat && d.location_lng && (selectedCity ? d.city === selectedCity : true)
  );

  const cityGroups = cities.reduce((acc, city) => {
    acc[city] = devotees.filter(d => d.city === city);
    return acc;
  }, {} as Record<string, typeof devotees>);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 64px - 56px)' }}>
      {/* Header */}
      <div className="section flex-between mb-8" style={{ padding: '16px 0', marginBottom: 0 }}>
        <div className="flex-center gap-12">
          <button className="btn-icon" onClick={() => navigate(-1)}>🔙</button>
          <h3 className="mb-0">Map Hub</h3>
        </div>
        <div className="flex gap-4 p-4 rounded" style={{ background: 'var(--surface-2)' }}>
          <button 
            className={`btn btn-sm ${viewMode === 'map' ? 'btn-primary' : 'btn-ghost'}`} 
            style={{ padding: '6px 12px', minHeight: 0, border: 'none' }}
            onClick={() => setViewMode('map')}
          >
            🗺️ Map
          </button>
          <button 
            className={`btn btn-sm ${viewMode === 'city' ? 'btn-primary' : 'btn-ghost'}`} 
            style={{ padding: '6px 12px', minHeight: 0, border: 'none' }}
            onClick={() => setViewMode('city')}
          >
            🏢 City List
          </button>
        </div>
      </div>

      {viewMode === 'map' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginTop: 16 }}>
          <div className="mb-16">
            <select className="form-input" value={selectedCity} onChange={e => setSelectedCity(e.target.value)}>
              <option value="">All Cities (Global View)</option>
              {cities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          
          <div style={{ flex: 1, borderRadius: 'var(--r-md)', overflow: 'hidden', border: '1px solid var(--border)' }}>
            {mapDevotees.length > 0 ? (
              <MapContainer 
                center={[mapDevotees[0].location_lat!, mapDevotees[0].location_lng!]} 
                zoom={12} 
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {mapDevotees.map(d => (
                  <Marker key={d.id} position={[d.location_lat!, d.location_lng!]}>
                    <Popup>
                      <div style={{ textAlign: 'center' }}>
                        <div className="fw-700">{d.name}</div>
                        <div className="text-xs text-muted mb-8">{d.address}</div>
                        <div className="flex gap-4">
                          <button 
                            className="btn btn-sm btn-ghost flex-1" 
                            style={{ padding: '4px' }}
                            onClick={() => navigate(`/devotees/${d.id}`)}
                          >
                            👤 View
                          </button>
                          <button 
                            className="btn btn-sm flex-1" 
                            style={{ padding: '4px', background: '#1890FF', color: '#fff' }}
                            onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${d.location_lat},${d.location_lng}`, '_blank')}
                          >
                            🧭 Nav
                          </button>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            ) : (
              <div className="flex-col flex-center h-full text-muted">
                <div style={{ fontSize: '3rem' }}>🗺️</div>
                <div>No GPS tags found for selected city</div>
              </div>
            )}
          </div>
        </div>
      )}

      {viewMode === 'city' && (
        <div style={{ flex: 1, overflowY: 'auto', paddingTop: 16 }}>
          {cities.map(city => {
            const list = cityGroups[city] || [];
            if (list.length === 0) return null;
            return (
              <div key={city} className="mb-24">
                <h4 className="text-gold mb-12 flex-between">
                  <span>{city}</span>
                  <span className="badge badge-muted">{list.length} Devotees</span>
                </h4>
                <div className="flex-col gap-8">
                  {list.map(d => {
                    const subStatus = getSubscriptionStatus(d);
                    const payStatus = getPaymentStatus(d);
                    return (
                      <div key={d.id} className="card-flat flex-between" onClick={() => navigate(`/devotees/${d.id}`)} style={{ cursor: 'pointer' }}>
                        <div>
                          <div className="fw-600">{d.name}</div>
                          <div className="text-xs text-muted mb-4">{d.phone}</div>
                          <div className="flex gap-4">
                            {subStatus === 'active' && <span className="text-xs text-green">● Active</span>}
                            {subStatus === 'expiring' && <span className="text-xs text-amber">● Expiring</span>}
                            {subStatus === 'expired' && <span className="text-xs text-red">● Expired</span>}
                            <span className="text-muted text-xs">|</span>
                            {payStatus === 'paid' && <span className="text-xs text-green">Paid</span>}
                            {payStatus === 'partial' && <span className="text-xs text-amber">Partial</span>}
                            {payStatus === 'unpaid' && <span className="text-xs text-red">Unpaid</span>}
                          </div>
                        </div>
                        {d.location_lat && (
                          <div className="btn-icon text-blue flex-center" style={{ width: 32, height: 32, border: 'none' }}>
                            📍
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
