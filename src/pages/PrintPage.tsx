import { useState, useRef } from 'react';
import { useDevoteeStore, useCategoryStore } from '../store';
import { getSubscriptionStatus, getPaymentStatus } from '../db';
import type { Devotee } from '../db';

type FilterStatus = '' | 'active' | 'expiring' | 'expired';
type FilterPayment = '' | 'paid' | 'partial' | 'unpaid';

const PAGE_SIZE_OPTIONS = ['All', '10', '25', '50', '100'];

export function PrintPage() {
  const { devotees } = useDevoteeStore();
  const { categories } = useCategoryStore();

  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('');
  const [filterPayment, setFilterPayment] = useState<FilterPayment>('');
  const [pageSize, setPageSize] = useState('All');
  const [showColumns, setShowColumns] = useState({
    name: true,
    phone: true,
    city: true,
    pincode: false,
    category: true,
    annual: true,
    paid: true,
    balance: true,
    status: true,
    expiry: true,
  });

  const printRef = useRef<HTMLDivElement>(null);

  const getCatName = (id: string) => categories.find(c => c.id === id)?.name || 'Unknown';

  const filtered: Devotee[] = devotees.filter(d => {
    if (filterCategory && d.category !== filterCategory) return false;
    if (filterStatus && getSubscriptionStatus(d) !== filterStatus) return false;
    if (filterPayment && getPaymentStatus(d) !== filterPayment) return false;
    return true;
  });

  const displayData = pageSize === 'All' ? filtered : filtered.slice(0, parseInt(pageSize));

  const handlePrint = () => {
    window.print();
  };

  const toggleColumn = (col: keyof typeof showColumns) => {
    setShowColumns(prev => ({ ...prev, [col]: !prev[col] }));
  };

  const totalBalance = filtered.reduce((s, d) => s + Math.max(0, d.annual_amount - d.amount_paid), 0);
  const totalCollected = filtered.reduce((s, d) => s + d.amount_paid, 0);

  return (
    <div>
      {/* ── Toolbar (hidden when printing) ── */}
      <div className="no-print">
        <div className="section flex-between mb-16">
          <h2 className="mb-0">🖨️ Print & Reports</h2>
          <button className="btn btn-primary btn-sm" onClick={handlePrint}>
            🖨️ Print Now
          </button>
        </div>

        {/* Filters */}
        <div className="card mb-16 no-print">
          <h4 className="text-gold mb-16">Print Filters</h4>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-input" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                <option value="">All Categories</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Page Size</label>
              <select className="form-input" value={pageSize} onChange={e => setPageSize(e.target.value)}>
                {PAGE_SIZE_OPTIONS.map(o => <option key={o} value={o}>{o === 'All' ? 'All Records' : `${o} rows`}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Subscription Status</label>
              <select className="form-input" value={filterStatus} onChange={e => setFilterStatus(e.target.value as FilterStatus)}>
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="expiring">Expiring Soon</option>
                <option value="expired">Expired</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Payment Status</label>
              <select className="form-input" value={filterPayment} onChange={e => setFilterPayment(e.target.value as FilterPayment)}>
                <option value="">All</option>
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </div>
          </div>

          {/* Column Toggles */}
          <h5 className="text-gold mb-8 mt-8">Columns to Print</h5>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(Object.keys(showColumns) as Array<keyof typeof showColumns>).map(col => (
              <label key={col} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '4px 10px', borderRadius: 20, background: showColumns[col] ? 'rgba(255,215,0,0.1)' : 'var(--surface-2)', border: `1px solid ${showColumns[col] ? 'var(--gold)' : 'var(--border)'}`, fontSize: '0.8rem' }}>
                <input type="checkbox" checked={showColumns[col]} onChange={() => toggleColumn(col)} style={{ accentColor: 'var(--gold)' }} />
                {col.charAt(0).toUpperCase() + col.slice(1)}
              </label>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="card mb-16 no-print" style={{ background: 'rgba(255,215,0,0.05)', border: '1px solid var(--gold)' }}>
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            <div>
              <div className="text-sm text-2">Total Rows</div>
              <div className="fw-600 text-gold" style={{ fontSize: '1.4rem' }}>{filtered.length}</div>
            </div>
            <div>
              <div className="text-sm text-2">Total Collected</div>
              <div className="fw-600 text-gold" style={{ fontSize: '1.4rem' }}>₹{totalCollected.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-sm text-2">Outstanding Balance</div>
              <div className="fw-600" style={{ fontSize: '1.4rem', color: totalBalance > 0 ? 'var(--red)' : 'var(--green)' }}>₹{totalBalance.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Printable Section ── */}
      <div ref={printRef} className="print-area">
        {/* Print Header */}
        <div className="print-header" style={{ textAlign: 'center', marginBottom: 16 }}>
          <h1 style={{ margin: 0, fontSize: '1.4rem' }}>Kattalai Devotee Report</h1>
          <div style={{ fontSize: '0.8rem', color: '#666' }}>
            Printed on: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
            {filterCategory && ` | Category: ${getCatName(filterCategory)}`}
            {filterStatus && ` | Status: ${filterStatus}`}
            {filterPayment && ` | Payment: ${filterPayment}`}
          </div>
          <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
            Total: {filtered.length} devotees | Collected: ₹{totalCollected.toLocaleString()} | Outstanding: ₹{totalBalance.toLocaleString()}
          </div>
        </div>

        {/* Print Table */}
        <div style={{ overflowX: 'auto' }}>
          <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #333' }}>
                <th style={{ padding: '6px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>#</th>
                {showColumns.name     && <th style={{ padding: '6px 8px', textAlign: 'left' }}>Name</th>}
                {showColumns.phone    && <th style={{ padding: '6px 8px', textAlign: 'left' }}>Phone</th>}
                {showColumns.city     && <th style={{ padding: '6px 8px', textAlign: 'left' }}>City</th>}
                {showColumns.pincode  && <th style={{ padding: '6px 8px', textAlign: 'left' }}>Pincode</th>}
                {showColumns.category && <th style={{ padding: '6px 8px', textAlign: 'left' }}>Category</th>}
                {showColumns.annual   && <th style={{ padding: '6px 8px', textAlign: 'right' }}>Annual (₹)</th>}
                {showColumns.paid     && <th style={{ padding: '6px 8px', textAlign: 'right' }}>Paid (₹)</th>}
                {showColumns.balance  && <th style={{ padding: '6px 8px', textAlign: 'right' }}>Balance (₹)</th>}
                {showColumns.status   && <th style={{ padding: '6px 8px', textAlign: 'left' }}>Status</th>}
                {showColumns.expiry   && <th style={{ padding: '6px 8px', textAlign: 'left' }}>Expiry</th>}
              </tr>
            </thead>
            <tbody>
              {displayData.map((d, i) => {
                const subStatus = getSubscriptionStatus(d);
                const balance = Math.max(0, d.annual_amount - d.amount_paid);
                return (
                  <tr key={d.id} style={{ borderBottom: '1px solid #eee', background: i % 2 === 1 ? '#fafafa' : '#fff' }}>
                    <td style={{ padding: '5px 8px', color: '#888' }}>{i + 1}</td>
                    {showColumns.name     && <td style={{ padding: '5px 8px', fontWeight: 600 }}>{d.name}</td>}
                    {showColumns.phone    && <td style={{ padding: '5px 8px' }}>{(d.country_code || '') + d.phone}</td>}
                    {showColumns.city     && <td style={{ padding: '5px 8px' }}>{d.city}</td>}
                    {showColumns.pincode  && <td style={{ padding: '5px 8px' }}>{d.pincode || '-'}</td>}
                    {showColumns.category && <td style={{ padding: '5px 8px' }}>{getCatName(d.category)}</td>}
                    {showColumns.annual   && <td style={{ padding: '5px 8px', textAlign: 'right' }}>{d.annual_amount.toLocaleString()}</td>}
                    {showColumns.paid     && <td style={{ padding: '5px 8px', textAlign: 'right' }}>{d.amount_paid.toLocaleString()}</td>}
                    {showColumns.balance  && <td style={{ padding: '5px 8px', textAlign: 'right', color: balance > 0 ? '#c0392b' : '#27ae60', fontWeight: balance > 0 ? 700 : 400 }}>{balance > 0 ? balance.toLocaleString() : '—'}</td>}
                    {showColumns.status   && <td style={{ padding: '5px 8px' }}>
                      <span style={{
                        padding: '2px 6px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 600,
                        background: subStatus === 'active' ? '#d4edda' : subStatus === 'expiring' ? '#fff3cd' : '#f8d7da',
                        color: subStatus === 'active' ? '#155724' : subStatus === 'expiring' ? '#856404' : '#721c24',
                      }}>{subStatus.toUpperCase()}</span>
                    </td>}
                    {showColumns.expiry   && <td style={{ padding: '5px 8px', fontSize: '0.75rem' }}>{d.subscription_end.slice(0, 10)}</td>}
                  </tr>
                );
              })}
            </tbody>
            {/* Footer totals */}
            <tfoot>
              <tr style={{ borderTop: '2px solid #333', fontWeight: 700, background: '#f0f0f0' }}>
                <td colSpan={
                  1 +
                  (showColumns.name ? 1 : 0) +
                  (showColumns.phone ? 1 : 0) +
                  (showColumns.city ? 1 : 0) +
                  (showColumns.pincode ? 1 : 0) +
                  (showColumns.category ? 1 : 0)
                } style={{ padding: '6px 8px' }}>
                  Total ({displayData.length} rows)
                </td>
                {showColumns.annual   && <td style={{ padding: '6px 8px', textAlign: 'right' }}>{displayData.reduce((s, d) => s + d.annual_amount, 0).toLocaleString()}</td>}
                {showColumns.paid     && <td style={{ padding: '6px 8px', textAlign: 'right' }}>{displayData.reduce((s, d) => s + d.amount_paid, 0).toLocaleString()}</td>}
                {showColumns.balance  && <td style={{ padding: '6px 8px', textAlign: 'right', color: '#c0392b' }}>{displayData.reduce((s, d) => s + Math.max(0, d.annual_amount - d.amount_paid), 0).toLocaleString()}</td>}
                {showColumns.status   && <td />}
                {showColumns.expiry   && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
