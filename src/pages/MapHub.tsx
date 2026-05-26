import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { useDevoteeStore, useCategoryStore, useToastStore } from '../store';
import { PlanGate } from '../components/PlanGate';
import { getSubscriptionStatus, getPaymentStatus, addPayment, PaymentEntry, Devotee } from '../db';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Re-apply Leaflet icon fix just in case
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom numbered marker generator for active route stops
const getStopIcon = (stopNumber: number, isVisited: boolean) => {
  return L.divIcon({
    html: `<div style="
      background: ${isVisited ? 'var(--green)' : 'var(--gold)'};
      color: #000;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      box-shadow: 0 3px 8px rgba(0,0,0,0.5);
      border: 2px solid #fff;
      font-size: 0.8rem;
      transition: all 0.2s;
    ">${stopNumber}</div>`,
    className: 'custom-stop-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
};

export function MapHub() {
  const navigate = useNavigate();
  const { devotees, load, refresh } = useDevoteeStore();
  const { categories } = useCategoryStore();
  const { showToast } = useToastStore();
  
  // Dynamic list of cities from devotees
  const cities = Array.from(new Set(devotees.map(d => d.city).filter(Boolean).sort()));

  // Modes: map, city, vasool
  const [viewMode, setViewMode] = useState<'map' | 'city' | 'vasool'>('map');
  const [selectedCity, setSelectedCity] = useState<string>('');

  // ── Vasool Tour State ──
  const [selectedDevoteeIds, setSelectedDevoteeIds] = useState<Set<string>>(new Set());
  const [isTourActive, setIsTourActive] = useState(false);
  const [tourRoute, setTourRoute] = useState<Devotee[]>([]);
  const [tourCurrentIndex, setTourCurrentIndex] = useState(0);
  const [tourVisitedIds, setTourVisitedIds] = useState<Set<string>>(new Set());
  const [startCoords, setStartCoords] = useState<[number, number] | null>(null);
  
  // ── Spot Dues Payment Modal ──
  const [spotPaymentDevotee, setSpotPaymentDevotee] = useState<Devotee | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentNote, setPaymentNote] = useState<string>('Vasool Tour Spot Collection');
  const [savingPayment, setSavingPayment] = useState(false);

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

  // Devotees with valid coordinates available for selection
  const geoTaggedDevotees = devotees.filter(d => d.location_lat && d.location_lng);

  // ── Google Maps CSV Export ──
  const handleExportGMapCSV = () => {
    const mapDevs = devotees.filter(d => d.location_lat && d.location_lng && (selectedCity ? d.city === selectedCity : true));
    if (mapDevs.length === 0) {
      showToast('No devotees with valid GPS tags in the selected city', 'error');
      return;
    }

    const csvHeaders = [
      'Name', 'Phone', 'Address', 'City', 'Pincode', 'Gothram', 'Category', 
      'Annual Dues', 'Amount Paid', 'Pending Dues', 'Latitude', 'Longitude', 'Google Maps Link'
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

  // ── Nearest Neighbor Tour Optimization (Haversine Distance) ──
  const calculateOptimalRoute = (startLat: number, startLng: number, selectedDevs: Devotee[]) => {
    const route: Devotee[] = [];
    const unvisited = [...selectedDevs];
    let currLat = startLat;
    let currLng = startLng;

    const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371; // km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };

    while (unvisited.length > 0) {
      let nearestIdx = -1;
      let minDistance = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const d = unvisited[i];
        if (d.location_lat && d.location_lng) {
          const dist = getDistance(currLat, currLng, d.location_lat, d.location_lng);
          if (dist < minDistance) {
            minDistance = dist;
            nearestIdx = i;
          }
        }
      }

      if (nearestIdx !== -1) {
        const nextDev = unvisited.splice(nearestIdx, 1)[0];
        route.push(nextDev);
        currLat = nextDev.location_lat!;
        currLng = nextDev.location_lng!;
      } else {
        route.push(...unvisited);
        break;
      }
    }
    return route;
  };

  const handleStartTour = () => {
    if (selectedDevoteeIds.size === 0) {
      showToast('Please select at least one devotee for collection', 'error');
      return;
    }

    const selectedDevs = devotees.filter(d => selectedDevoteeIds.has(d.id));
    
    showToast('Fetching your GPS coordinates...', 'info');
    
    if (!navigator.geolocation) {
      // Fallback if no geolocation
      showToast('GPS not supported. Starting tour from first devotee.', 'info');
      const fallback = selectedDevs[0];
      setStartCoords([fallback.location_lat!, fallback.location_lng!]);
      const route = calculateOptimalRoute(fallback.location_lat!, fallback.location_lng!, selectedDevs);
      setTourRoute(route);
      setTourCurrentIndex(0);
      setTourVisitedIds(new Set());
      setIsTourActive(true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setStartCoords([lat, lng]);
        
        const route = calculateOptimalRoute(lat, lng, selectedDevs);
        setTourRoute(route);
        setTourCurrentIndex(0);
        setTourVisitedIds(new Set());
        setIsTourActive(true);
        showToast(`🚚 Tour started! optimal path computed.`, 'success');
      },
      (err) => {
        showToast('GPS failed. Starting from first devotee location.', 'info');
        const fallback = selectedDevs[0];
        setStartCoords([fallback.location_lat!, fallback.location_lng!]);
        const route = calculateOptimalRoute(fallback.location_lat!, fallback.location_lng!, selectedDevs);
        setTourRoute(route);
        setTourCurrentIndex(0);
        setTourVisitedIds(new Set());
        setIsTourActive(true);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleToggleSelectDevotee = (id: string) => {
    const next = new Set(selectedDevoteeIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedDevoteeIds(next);
  };

  const handleSelectAllDevotees = (val: boolean) => {
    if (val) {
      setSelectedDevoteeIds(new Set(geoTaggedDevotees.map(d => d.id)));
    } else {
      setSelectedDevoteeIds(new Set());
    }
  };

  const handleVisitedCurrentStop = () => {
    const currentDev = tourRoute[tourCurrentIndex];
    if (!currentDev) return;

    const nextVisited = new Set(tourVisitedIds);
    nextVisited.add(currentDev.id);
    setTourVisitedIds(nextVisited);

    showToast(`Visited stop ${tourCurrentIndex + 1}: ${currentDev.name}`, 'success');

    if (tourCurrentIndex < tourRoute.length - 1) {
      setTourCurrentIndex(prev => prev + 1);
    } else {
      // Finished Tour!
      showToast('🎉 Wonderful! You have completed the entire collection route!', 'success');
      setIsTourActive(false);
      setSelectedDevoteeIds(new Set());
    }
  };

  const handleRecordSpotPayment = async () => {
    if (!spotPaymentDevotee || paymentAmount <= 0) return;
    setSavingPayment(true);

    try {
      const entry: PaymentEntry = {
        id: `PAY-${Date.now()}`,
        devotee_id: spotPaymentDevotee.id,
        date: new Date().toISOString().slice(0, 10),
        amount: paymentAmount,
        note: paymentNote
      };

      await addPayment(entry);
      await refresh(); // refresh stores
      
      showToast(`Collected ₹${paymentAmount} from ${spotPaymentDevotee.name}!`, 'success');
      setSpotPaymentDevotee(null);
      setPaymentAmount(0);
    } catch {
      showToast('Payment recording failed', 'error');
    } finally {
      setSavingPayment(false);
    }
  };

  // Polyline path coordinates
  const polylineCoords = [
    ...(startCoords ? [startCoords] : []),
    ...tourRoute.map(d => [d.location_lat!, d.location_lng!] as [number, number])
  ];

  return (
    <PlanGate requiredPlan="pro" featureName="Map Hub & GPS Visualization">
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 64px - 56px)', position: 'relative' }}>
        
        {/* Spot Payment Collection Overlay Dialog */}
        {spotPaymentDevotee && (
          <div className="sheet-overlay" style={{ zIndex: 10000 }} onClick={e => e.target === e.currentTarget && setSpotPaymentDevotee(null)}>
            <div className="sheet animate-fade-in" style={{ paddingBottom: 24 }}>
              <div className="sheet-handle" />
              <div className="flex-between mb-16">
                <div>
                  <h4 className="text-gold m-0">💳 Spot Dues Collection</h4>
                  <div className="text-xs text-muted mt-4">Collecting for: {spotPaymentDevotee.name}</div>
                </div>
                <button className="btn-icon btn-sm" onClick={() => setSpotPaymentDevotee(null)}>✖</button>
              </div>

              <div className="form-group">
                <label className="form-label">Dues Status</label>
                <div className="flex-between card-flat text-xs" style={{ background: 'var(--surface-2)' }}>
                  <span>Annual: <b>₹{spotPaymentDevotee.annual_amount}</b></span>
                  <span>Paid: <b className="text-green">₹{spotPaymentDevotee.amount_paid}</b></span>
                  <span>Pending: <b className="text-red">₹{Math.max(0, spotPaymentDevotee.annual_amount - spotPaymentDevotee.amount_paid)}</b></span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Collected Amount (₹) *</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={paymentAmount || ''} 
                  onChange={e => setPaymentAmount(Number(e.target.value) || 0)} 
                  placeholder="e.g. 500" 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Note / Receipt details</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={paymentNote} 
                  onChange={e => setPaymentNote(e.target.value)} 
                />
              </div>

              <button 
                className="btn btn-primary w-full mt-8" 
                onClick={handleRecordSpotPayment}
                disabled={savingPayment || paymentAmount <= 0}
              >
                {savingPayment ? 'Saving...' : '💾 Save Collection'}
              </button>
            </div>
          </div>
        )}

        {/* ── Active Tour navigation UI ── */}
        {isTourActive && tourRoute.length > 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
            
            {/* Tour Map */}
            <div style={{ flex: 1, position: 'relative', width: '100%', zIndex: 1 }}>
              <MapContainer 
                center={[tourRoute[tourCurrentIndex].location_lat!, tourRoute[tourCurrentIndex].location_lng!]} 
                zoom={14} 
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                
                {/* Draw dashed optimal collection polyline path */}
                <Polyline 
                  positions={polylineCoords} 
                  pathOptions={{ color: 'var(--gold)', weight: 4, dashArray: '8, 8', opacity: 0.8 }} 
                />

                {/* Start position device marker if exists */}
                {startCoords && (
                  <Marker position={startCoords}>
                    <Popup>
                      <div className="text-xs fw-700">📍 Your Current Position</div>
                    </Popup>
                  </Marker>
                )}

                {/* Tour stops numbered markers */}
                {tourRoute.map((d, index) => {
                  const isCurrent = index === tourCurrentIndex;
                  const isVisited = tourVisitedIds.has(d.id);
                  return (
                    <Marker 
                      key={d.id} 
                      position={[d.location_lat!, d.location_lng!]}
                      icon={getStopIcon(index + 1, isVisited)}
                    >
                      <Popup>
                        <div style={{ textAlign: 'center', width: 140 }}>
                          <div className="fw-700">{d.name}</div>
                          <div className="text-xs text-muted mb-4">Stop {index + 1}</div>
                          <div className="text-xs text-red fw-600 mb-8">Pending: ₹{d.annual_amount - d.amount_paid}</div>
                          <button className="btn btn-xs btn-primary w-full" onClick={() => navigate(`/devotees/${d.id}`)}>👤 Details</button>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            </div>

            {/* Bottom active stop navigation overlay card */}
            {tourRoute[tourCurrentIndex] && (
              <div 
                className="card animate-slide-up"
                style={{
                  position: 'absolute', bottom: 16, left: 16, right: 16,
                  zIndex: 100, border: '2.5px solid var(--gold)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)', background: 'var(--surface)',
                  padding: 14
                }}
              >
                <div className="flex-between mb-8">
                  <span className="badge badge-gold" style={{ fontSize: '0.7rem' }}>
                    🚚 TOUR STOP {tourCurrentIndex + 1} OF {tourRoute.length}
                  </span>
                  <div className="flex gap-4">
                    <button 
                      className="btn btn-sm btn-ghost text-red" 
                      style={{ padding: '0 8px', minHeight: 0 }}
                      onClick={() => { if (window.confirm('Cancel active collection route?')) setIsTourActive(false); }}
                    >
                      Cancel Tour
                    </button>
                  </div>
                </div>

                <h4 className="mb-4 text-gold">{tourRoute[tourCurrentIndex].name}</h4>
                <div className="text-xs text-muted mb-8 text-ellipsis-2">📍 {tourRoute[tourCurrentIndex].address}</div>
                
                <div className="flex-between card-flat mb-12" style={{ background: 'var(--surface-2)', padding: '6px 10px' }}>
                  <span className="text-xs">Pending: <b className="text-red">₹{Math.max(0, tourRoute[tourCurrentIndex].annual_amount - tourRoute[tourCurrentIndex].amount_paid)}</b></span>
                  <button 
                    className="btn btn-xs flex-center gap-4" 
                    style={{ background: 'rgba(14,203,129,0.15)', color: 'var(--green)' }}
                    onClick={() => {
                      setSpotPaymentDevotee(tourRoute[tourCurrentIndex]);
                      setPaymentAmount(Math.max(0, tourRoute[tourCurrentIndex].annual_amount - tourRoute[tourCurrentIndex].amount_paid));
                    }}
                  >
                    💳 Record Payment
                  </button>
                </div>

                <div className="grid-3" style={{ gap: 8 }}>
                  <button 
                    className="btn btn-ghost btn-sm flex-center gap-4 text-xs" 
                    onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${tourRoute[tourCurrentIndex].location_lat},${tourRoute[tourCurrentIndex].location_lng}`, '_blank')}
                  >
                    🧭 Nav
                  </button>
                  <button 
                    className="btn btn-ghost btn-sm flex-center gap-4 text-xs" 
                    onClick={() => window.open(`whatsapp://send?phone=91${tourRoute[tourCurrentIndex].phone}`, '_blank')}
                  >
                    💬 WhatsApp
                  </button>
                  <button 
                    className="btn btn-primary btn-sm flex-center gap-4 text-xs" 
                    onClick={handleVisitedCurrentStop}
                    style={{ background: 'var(--green)', color: '#000' }}
                  >
                    ✅ Visited
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Normal Tab Views (Map, City list, Vasool Route selection) */
          <>
            {/* Header and Toggle Navigation */}
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
                <button 
                  className={`btn btn-sm ${viewMode === 'vasool' ? 'btn-primary' : 'btn-ghost'}`} 
                  style={{ padding: '6px 12px', minHeight: 0, border: 'none' }}
                  onClick={() => setViewMode('vasool')}
                >
                  🚚 Vasool
                </button>
              </div>
            </div>

            {/* MAP TAB VIEW */}
            {viewMode === 'map' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginTop: 16 }}>
                <div className="flex gap-8 mb-16">
                  <select className="form-input flex-1" value={selectedCity} onChange={e => setSelectedCity(e.target.value)}>
                    <option value="">All Cities (Global View)</option>
                    {cities.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button 
                    className="btn btn-ghost" 
                    onClick={handleExportGMapCSV} 
                    title="Export for Google Maps"
                    style={{ width: '46px', padding: 0 }}
                  >
                    📥
                  </button>
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

            {/* CITY LIST TAB VIEW */}
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

            {/* VASOOL TOUR ROUTE PLANNER TAB */}
            {viewMode === 'vasool' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingTop: 16 }}>
                <div className="card mb-16" style={{ background: 'rgba(212,175,55,0.03)', borderColor: 'rgba(212,175,55,0.15)' }}>
                  <h4 className="text-gold mb-4">🚚 Collection Route Route Planner</h4>
                  <div className="text-xs text-muted mb-12">Select multiple devotees, and the app will generate the optimal tour route (shortest distance) starting from your current GPS location.</div>
                  
                  {geoTaggedDevotees.length > 0 && (
                    <div className="flex gap-8 mb-4">
                      <button className="btn btn-ghost btn-sm flex-1 text-xs" onClick={() => handleSelectAllDevotees(true)}>
                        ✅ Select All ({geoTaggedDevotees.length})
                      </button>
                      <button className="btn btn-ghost btn-sm flex-1 text-xs" onClick={() => handleSelectAllDevotees(false)}>
                        ⬜ Clear Selection
                      </button>
                    </div>
                  )}
                </div>

                {geoTaggedDevotees.length === 0 ? (
                  <div className="empty-state card">
                    <div className="empty-icon">📍</div>
                    <div className="empty-title">No GPS Tags Found</div>
                    <p className="text-sm">You must add GPS coordinates (under Edit Devotee or details page) to devotees before you can plan a collection tour.</p>
                  </div>
                ) : (
                  <>
                    {/* Checklist of geotagged devotees */}
                    <div className="flex-col gap-8 mb-16" style={{ flex: 1, overflowY: 'auto', maxHeight: '42dvh' }}>
                      {geoTaggedDevotees.map(d => {
                        const isSelected = selectedDevoteeIds.has(d.id);
                        const pendingDues = Math.max(0, d.annual_amount - d.amount_paid);
                        return (
                          <div 
                            key={d.id}
                            className="card-flat"
                            onClick={() => handleToggleSelectDevotee(d.id)}
                            style={{ 
                              display: 'flex', alignItems: 'center', gap: 12, 
                              background: isSelected ? 'rgba(212,175,55,0.06)' : 'var(--surface-2)',
                              border: `1.5px solid ${isSelected ? 'var(--gold)' : 'transparent'}`,
                              cursor: 'pointer', transition: 'all 0.15s'
                            }}
                          >
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              readOnly
                              style={{ width: 18, height: 18, accentColor: 'var(--gold)', cursor: 'pointer' }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="fw-600 text-sm">{d.name}</div>
                              <div className="text-xs text-muted">📍 {d.address}, {d.city}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span className="text-xs text-red fw-600">₹{pendingDues} due</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Start Tour Button */}
                    <button 
                      className="btn btn-primary w-full" 
                      onClick={handleStartTour}
                      disabled={selectedDevoteeIds.size === 0}
                      style={{ background: selectedDevoteeIds.size > 0 ? 'var(--gold)' : 'var(--border)' }}
                    >
                      🚀 Start Tour ({selectedDevoteeIds.size} stops)
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </PlanGate>
  );
}
