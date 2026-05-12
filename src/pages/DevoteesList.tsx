import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDevoteeStore, useCategoryStore } from '../store';
import { getSubscriptionStatus, getPaymentStatus } from '../db';

export function DevoteesList() {
  const navigate = useNavigate();
  const { devotees, load, loading, searchQuery, setSearch, filterCity, setFilterCity, filterStatus, setFilterStatus, filterPayment, setFilterPayment, sortOption, setSortOption } = useDevoteeStore();
  const { categories } = useCategoryStore();
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = devotees.filter(d => {
    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!d.name.toLowerCase().includes(q) && !d.phone.includes(q)) return false;
    }
    // City filter
    if (filterCity && d.city !== filterCity) return false;
    // Status filter
    if (filterStatus && getSubscriptionStatus(d) !== filterStatus) return false;
    // Payment filter
    if (filterPayment && getPaymentStatus(d) !== filterPayment) return false;
    
    return true;
  });

  // Apply Sort
  filtered.sort((a, b) => {
    if (sortOption === 'name_asc') return a.name.localeCompare(b.name);
    if (sortOption === 'expiry_desc') {
      return new Date(a.subscription_end).getTime() - new Date(b.subscription_end).getTime();
    }
    if (sortOption === 'payment_desc') {
      const aPending = Math.max(0, a.annual_amount - a.amount_paid);
      const bPending = Math.max(0, b.annual_amount - b.amount_paid);
      return bPending - aPending; // Highest pending first
    }
    return 0;
  });

  const getCatBadge = (id: string) => {
    const c = categories.find(cat => cat.id === id);
    if (!c) return <span className="badge badge-muted">Unknown</span>;
    if (c.is_builtin) return <span className="badge badge-muted">{c.name}</span>;
    return <span className="badge" style={{ backgroundColor: `${c.color}20`, color: c.color }}>{c.name}</span>;
  };
  
  const activeFiltersCount = (filterCity ? 1 : 0) + (filterStatus ? 1 : 0) + (filterPayment ? 1 : 0);

  return (
    <div>
      {/* Header */}
      <div className="section flex-between mb-16" style={{ position: 'sticky', top: '56px', background: 'var(--bg)', zIndex: 10, padding: '16px 0', marginTop: '-16px' }}>
        <h2 className="mb-0">Devotees ({filtered.length})</h2>
        <div className="flex gap-8">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/bulk-import')}
            title="Bulk Import (Pro)" style={{ color: 'var(--gold)', borderColor: 'var(--gold)' }}>
            📦 Bulk
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/devotees/new')}>➕ Add New</button>
        </div>
      </div>
      
      {/* Search & Filter Trigger */}
      <div className="flex gap-8 mb-16">
        <div className="search-bar flex-1">
          <span>🔍</span>
          <input 
            type="text" 
            placeholder="Search name or phone..." 
            value={searchQuery}
            onChange={(e) => setSearch(e.target.value)}
          />
          {searchQuery && <button onClick={() => setSearch('')}>✖️</button>}
        </div>
        <button 
          className="btn btn-ghost" 
          style={{ position: 'relative', width: '46px', padding: 0 }}
          onClick={() => setIsFilterOpen(true)}
        >
          ⚙️
          {activeFiltersCount > 0 && (
            <div className="nav-badge" style={{ top: -4, right: -4 }}>{activeFiltersCount}</div>
          )}
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex-col gap-12">
          <div className="skeleton" style={{ height: 80 }} />
          <div className="skeleton" style={{ height: 80 }} />
          <div className="skeleton" style={{ height: 80 }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">👥</div>
          <div className="empty-title">No devotees found</div>
          <p>Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="flex-col gap-12">
          {filtered.map(devotee => {
            const subStatus = getSubscriptionStatus(devotee);
            const payStatus = getPaymentStatus(devotee);
            const isPending = devotee.annual_amount > devotee.amount_paid;
            
            return (
              <div key={devotee.id} className="devotee-card" onClick={() => navigate(`/devotees/${devotee.id}`)}>
                <div className="devotee-avatar">
                  {devotee.name.charAt(0).toUpperCase()}
                </div>
                <div className="devotee-info">
                  <div className="flex-between">
                    <div className="devotee-name">{devotee.name}</div>
                    {isPending && <div className="text-red text-xs fw-700">₹{devotee.annual_amount - devotee.amount_paid} Due</div>}
                  </div>
                  <div className="devotee-meta mb-4">
                    <span>📱 {devotee.phone}</span>
                    <span>📍 {devotee.city}</span>
                  </div>
                  <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
                    {subStatus === 'active' && <span className="badge badge-green">Active</span>}
                    {subStatus === 'expiring' && <span className="badge badge-amber">Expiring</span>}
                    {subStatus === 'expired' && <span className="badge badge-red">Expired</span>}
                    
                    {payStatus === 'paid' && <span className="badge badge-green">Paid</span>}
                    {payStatus === 'partial' && <span className="badge badge-amber">Partial</span>}
                    {payStatus === 'unpaid' && <span className="badge badge-red">Unpaid</span>}
                    
                    {getCatBadge(devotee.category)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Filter Bottom Sheet */}
      {isFilterOpen && (
        <div className="sheet-overlay" onClick={(e) => e.target === e.currentTarget && setIsFilterOpen(false)}>
          <div className="sheet">
            <div className="sheet-handle"></div>
            <div className="flex-between mb-16">
              <h3 className="mb-0">Filter & Sort</h3>
              <button className="btn-icon" onClick={() => {
                setFilterCity(''); setFilterStatus(''); setFilterPayment(''); setSortOption('name_asc');
              }}>🔄</button>
            </div>
            
            <div className="form-group">
              <label className="form-label">Sort By</label>
              <select className="form-input" value={sortOption} onChange={(e) => setSortOption(e.target.value as any)}>
                <option value="name_asc">Name (A-Z)</option>
                <option value="expiry_desc">Expiring Earliest</option>
                <option value="payment_desc">Highest Payment Due</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">City</label>
              <select className="form-input" value={filterCity} onChange={(e) => setFilterCity(e.target.value)}>
                <option value="">All Cities</option>
                {Array.from(new Set(devotees.map(d => d.city))).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Subscription</label>
                <select className="form-input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}>
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="expiring">Expiring Soon</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Payments</label>
                <select className="form-input" value={filterPayment} onChange={(e) => setFilterPayment(e.target.value as any)}>
                  <option value="">All Payments</option>
                  <option value="paid">Fully Paid</option>
                  <option value="partial">Partial</option>
                  <option value="unpaid">Unpaid</option>
                </select>
              </div>
            </div>

            <button className="btn btn-primary w-full mt-16" onClick={() => setIsFilterOpen(false)}>Apply Filters</button>
          </div>
        </div>
      )}
    </div>
  );
}
