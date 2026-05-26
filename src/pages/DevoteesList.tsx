import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDevoteeStore, useCategoryStore, useToastStore } from '../store';
import { getSubscriptionStatus, getPaymentStatus, deleteDevotee } from '../db';
import { allowPush } from '../utils/syncLock';
import { useTranslation } from '../utils/i18n';

export function DevoteesList() {
  const navigate = useNavigate();
  const { t } = useTranslation();
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
    
    const isTa = t('save') === 'சேமி';
    // Format: Name, Address, City - Phone
    const textData = selectedDevs.map((d, index) => {
      const fullAddress = [d.address, d.city].filter(Boolean).join(', ');
      return `${index + 1}. ${d.name}\n   ${isTa ? 'முகவரி' : 'Address'}: ${fullAddress}\n   ${isTa ? 'தொலைபேசி' : 'Phone'}: ${d.phone}`;
    }).join('\n\n');

    const shareTitle = `${t('selected')} ${t('nav_devotees')}`;
    const shareText = `${shareTitle}:\n\n${textData}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
        });
      } catch {
        navigator.clipboard.writeText(shareText);
        showToast(t('copied_clipboard'), 'success');
      }
    } else {
      navigator.clipboard.writeText(shareText);
      showToast(t('copied_clipboard'), 'success');
    }
    
    setIsSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const isTa = t('save') === 'சேமி';
    const confirmMsg = isTa 
      ? `⚠️ நீங்கள் ${selectedIds.size} பக்தர்களை நீக்க விரும்புகிறீர்களா? இதை மாற்றியமைக்க முடியாது.`
      : `⚠️ Are you sure you want to delete ${selectedIds.size} devotees? This cannot be undone.`;
      
    if (!window.confirm(confirmMsg)) {
      return;
    }
    
    for (const id of Array.from(selectedIds)) {
      await deleteDevotee(id);
    }
    
    const successMsg = isTa
      ? `${selectedIds.size} பக்தர்கள் நீக்கப்பட்டனர்.`
      : `Deleted ${selectedIds.size} devotees`;
      
    showToast(successMsg, 'success');
    allowPush();
    setIsSelectMode(false);
    setSelectedIds(new Set());
    load();
  };

  return (
    <div>
      {/* Header */}
      <div className="flex-between mb-16" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <h2 className="mb-0">{t('nav_devotees')} ({filtered.length})</h2>
        <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => {
              setIsSelectMode(!isSelectMode);
              if (isSelectMode) setSelectedIds(new Set());
            }}
            style={{ color: isSelectMode ? 'var(--gold)' : 'var(--text)', borderColor: isSelectMode ? 'var(--gold)' : 'transparent', padding: '0 8px' }}>
            {isSelectMode ? t('cancel') : `✓ ${t('select')}`}
          </button>
          {!isSelectMode && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/bulk-import')}
                title="Bulk Import (Pro)" style={{ color: 'var(--gold)', borderColor: 'var(--gold)', padding: '0 8px' }}>
                📦 {t('bulk')}
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/devotees/new')} style={{ padding: '0 12px' }}>
                {t('devotees_add_btn')}
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
            placeholder={t('devotees_search')} 
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
          <div className="empty-title">{t('devotees_empty')}</div>
          <p>{t('save') === 'சேமி' ? 'தேடல் அல்லது வடிகட்டிகளை மாற்றிப் பார்க்கவும்.' : 'Try adjusting your search or filters.'}</p>
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
                    {isPending && <div className="text-red text-xs fw-700">₹{devotee.annual_amount - devotee.amount_paid} {t('due')}</div>}
                  </div>
                  <div className="devotee-meta mb-4">
                    <span>📱 {devotee.phone}</span>
                    <span>📍 {devotee.city}</span>
                  </div>
                  <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
                    {subStatus === 'active' && <span className="badge badge-green">{t('active')}</span>}
                    {subStatus === 'expiring' && <span className="badge badge-amber">{t('expiring')}</span>}
                    {subStatus === 'expired' && <span className="badge badge-red">{t('expired')}</span>}
                    
                    {payStatus === 'paid' && <span className="badge badge-green">{t('paid')}</span>}
                    {payStatus === 'partial' && <span className="badge badge-amber">{t('partial')}</span>}
                    {payStatus === 'unpaid' && <span className="badge badge-red">{t('unpaid')}</span>}
                    
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
          border: '1px solid var(--gold)', flexWrap: 'wrap', gap: 12
        }}>
          <span className="fw-700 text-gold">{selectedIds.size} {t('selected')}</span>
          <div className="flex gap-8">
             <button className="btn btn-ghost btn-sm text-red" onClick={handleDeleteSelected}>
                🗑️ {t('delete')}
             </button>
             <button className="btn btn-primary btn-sm" onClick={handleShareSelected}>
                📤 {t('devotees_share')}
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
              <h3 className="mb-0">{t('filter_sort')}</h3>
              <button className="btn-icon" onClick={() => {
                setFilterCity(''); setFilterCategory(''); setFilterStatus(''); setFilterPayment(''); setSortOption('name_asc');
              }}>🔄</button>
            </div>
            
            <div className="form-group">
              <label className="form-label">{t('sort_by')}</label>
              <select className="form-input" value={sortOption} onChange={(e) => setSortOption(e.target.value as 'name_asc' | 'expiry_desc' | 'payment_desc')}>
                <option value="name_asc">{t('save') === 'சேமி' ? 'பெயர் (A-Z)' : 'Name (A-Z)'}</option>
                <option value="expiry_desc">{t('save') === 'சேமி' ? 'முதலில் காலாவதியாவது' : 'Expiring Earliest'}</option>
                <option value="payment_desc">{t('save') === 'சேமி' ? 'அதிகபட்ச நிலுவை' : 'Highest Payment Due'}</option>
              </select>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">{t('save') === 'சேமி' ? 'நகரம் / ஊர்' : 'City'}</label>
                <select className="form-input" value={filterCity} onChange={(e) => setFilterCity(e.target.value)}>
                  <option value="">{t('all_cities')}</option>
                  {Array.from(new Set(devotees.map(d => d.city).filter(Boolean))).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t('print_category')}</label>
                <select className="form-input" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                  <option value="">{t('all_categories')}</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">{t('save') === 'சேமி' ? 'சந்தா நிலை' : 'Subscription'}</label>
                <select className="form-input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as '' | 'active' | 'expiring' | 'expired')}>
                  <option value="">{t('all_statuses')}</option>
                  <option value="active">{t('active')}</option>
                  <option value="expiring">{t('save') === 'சேமி' ? 'விரைவில் முடிவது' : 'Expiring Soon'}</option>
                  <option value="expired">{t('expired')}</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t('save') === 'சேமி' ? 'கணக்கு நிலை' : 'Payments'}</label>
                <select className="form-input" value={filterPayment} onChange={(e) => setFilterPayment(e.target.value as '' | 'paid' | 'partial' | 'unpaid')}>
                  <option value="">{t('all_payments')}</option>
                  <option value="paid">{t('save') === 'சேமி' ? 'முழுமையாக செலுத்தியது' : 'Fully Paid'}</option>
                  <option value="partial">{t('partial')}</option>
                  <option value="unpaid">{t('unpaid')}</option>
                </select>
              </div>
            </div>

            <button className="btn btn-primary w-full mt-16" onClick={() => setIsFilterOpen(false)}>{t('apply_filters')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
