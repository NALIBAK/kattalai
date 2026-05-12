import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDevoteeStore, useCategoryStore, useToastStore } from '../store';
import { getSubscriptionStatus, getPaymentStatus, deleteDevotee } from '../db';

export function DevoteesList() {
  const navigate = useNavigate();
  const { devotees, load, loading, searchQuery, setSearch, filterCity, setFilterCity, filterStatus, setFilterStatus, filterPayment, setFilterPayment, sortOption, setSortOption } = useDevoteeStore();
  const { categories } = useCategoryStore();
  const { showToast } = useToastStore();
  
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('');
  
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
    // Category filter
    if (filterCategory && d.category !== filterCategory) return false;
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
  
  const activeFiltersCount = (filterCity ? 1 : 0) + (filterStatus ? 1 : 0) + (filterPayment ? 1 : 0) + (filterCategory ? 1 : 0);

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleShareSelected = async () => {
    if (selectedIds.size === 0) return;
    const selectedDevs = devotees.filter(d => selectedIds.has(d.id));
    
    // Format: Name, Address, City - Phone
    const textData = selectedDevs.map((d, index) => {
      const fullAddress = [d.address, d.city].filter(Boolean).join(', ');
      return `${index + 1}. ${d.name}\n   Address: ${fullAddress}\n   Phone: ${d.phone}`;
    }).join('\n\n');

    const shareText = `Selected Devotees:\n\n${textData}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Selected Devotees',
          text: shareText,
        });
      } catch (e) {
        navigator.clipboard.writeText(shareText);
        showToast('Copied to clipboard!', 'success');
      }
    } else {
      navigator.clipboard.writeText(shareText);
      showToast('Copied to clipboard!', 'success');
    }
    
    setIsSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`⚠️ Are you sure you want to delete ${selectedIds.size} devotees? This cannot be undone.`)) {
      return;
    }
    
    for (const id of Array.from(selectedIds)) {
      await deleteDevotee(id);
    }
    
    showToast(`Deleted ${selectedIds.size} devotees`, 'success');
    setIsSelectMode(false);
    setSelectedIds(new Set());
    load();
  };

  return (
    <div>
      {/* Header */}
      <div className="flex-between mb-16" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <h2 className="mb-0">Devotees ({filtered.length})</h2>
        <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => {
              setIsSelectMode(!isSelectMode);
              if (isSelectMode) setSelectedIds(new Set());
            }}
            style={{ color: isSelectMode ? 'var(--gold)' : 'var(--text)', borderColor: isSelectMode ? 'var(--gold)' : 'transparent', padding: '0 8px' }}>
            {isSelectMode ? 'Cancel' : '✓ Select'}
          </button>
          {!isSelectMode && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/bulk-import')}
                title="Bulk Import (Pro)" style={{ color: 'var(--gold)', borderColor: 'var(--gold)', padding: '0 8px' }}>
                📦 Bulk
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/devotees/new')} style={{ padding: '0 12px' }}>
                ➕ Add
              </button>
            </>
          )}
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
              <div key={devotee.id} className="devotee-card" style={{ display: 'flex', alignItems: 'center', gap: 12, paddingRight: isSelectMode ? 12 : 0 }} onClick={() => {
                  if (isSelectMode) {
                    toggleSelection(devotee.id);
                  } else {
                    navigate(`/devotees/${devotee.id}`);
                  }
                }}>
                {isSelectMode && (
                  <div style={{ paddingLeft: 8 }}>
                    <input 
                      type="checkbox" 
                      checked={selectedIds.has(devotee.id)} 
                      readOnly
                      style={{ width: 20, height: 20, cursor: 'pointer', accentColor: 'var(--gold)' }} 
                    />
                  </div>
                )}
                <div className="devotee-avatar" style={{ margin: 0 }}>
                  {devotee.name.charAt(0).toUpperCase()}
                </div>
                <div className="devotee-info" style={{ flex: 1 }}>
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

      {/* Floating Selection Action Bar */}
      {isSelectMode && selectedIds.size > 0 && (
        <div style={{
          position: 'fixed', bottom: 70, left: 16, right: 16,
          background: '#000', borderRadius: 12, padding: '12px 16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 100,
          border: '1px solid var(--gold)'
        }}>
          <span className="fw-700 text-gold">{selectedIds.size} Selected</span>
          <div className="flex gap-8">
             <button className="btn btn-ghost btn-sm text-red" onClick={handleDeleteSelected}>
               🗑️ Delete
             </button>
             <button className="btn btn-primary btn-sm" onClick={handleShareSelected}>
               📤 Share
             </button>
          </div>
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
                setFilterCity(''); setFilterCategory(''); setFilterStatus(''); setFilterPayment(''); setSortOption('name_asc');
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

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">City</label>
                <select className="form-input" value={filterCity} onChange={(e) => setFilterCity(e.target.value)}>
                  <option value="">All Cities</option>
                  {Array.from(new Set(devotees.map(d => d.city).filter(Boolean))).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-input" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                  <option value="">All Categories</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
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
