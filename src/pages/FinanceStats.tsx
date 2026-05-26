import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDevoteeStore } from '../store';
import { getSubscriptionStatus } from '../db';

export function FinanceStats() {
  const navigate = useNavigate();
  const { devotees, setFilterStatus } = useDevoteeStore();
  const [showBalance, setShowBalance] = useState(true);

  // ── Calculation Logic ──
  const totalCollected = devotees.reduce((sum, d) => sum + (d.amount_paid || 0), 0);
  const totalPending = devotees.reduce((sum, d) => {
    const pending = Math.max(0, d.annual_amount - d.amount_paid);
    return sum + pending;
  }, 0);

  const activeCount = devotees.filter(d => getSubscriptionStatus(d) === 'active').length;
  const expiringCount = devotees.filter(d => getSubscriptionStatus(d) === 'expiring').length;
  const expiredCount = devotees.filter(d => getSubscriptionStatus(d) === 'expired').length;

  const handleStatCardClick = (status: 'active' | 'expiring' | 'expired') => {
    setFilterStatus(status);
    navigate('/devotees');
  };

  return (
    <div className="section pt-16">
      {/* Header */}
      <div className="flex-between mb-24">
        <button className="btn-icon" onClick={() => navigate('/profile')}>
          ←
        </button>
        <h3 className="m-0">Temple Ledger</h3>
        <div style={{ width: 40 }} /> {/* spacer */}
      </div>

      {/* Financial Overview Cards */}
      <div className="card mb-20" style={{ 
        border: '1px solid var(--gold)',
        background: 'linear-gradient(135deg, rgba(212,175,55,0.05), rgba(0,0,0,0.3))' 
      }}>
        <div className="flex-between mb-12">
          <span className="text-muted text-sm fw-600">Total Collected Dues</span>
          <button 
            className="btn btn-ghost" 
            style={{ 
              padding: '4px 8px', 
              fontSize: '0.8rem', 
              borderColor: 'rgba(212,175,55,0.3)', 
              color: 'var(--gold)' 
            }}
            onClick={() => setShowBalance(!showBalance)}
          >
            {showBalance ? '🕶️ Hide' : '👁️ Show'}
          </button>
        </div>
        <h1 className="m-0 fw-700" style={{ color: 'var(--gold)', fontSize: '2.5rem' }}>
          {showBalance ? `₹${totalCollected.toLocaleString('en-IN')}` : '••••••'}
        </h1>
      </div>

      <div className="card mb-24" style={{ 
        border: '1px solid rgba(220,53,69,0.3)', 
        background: 'linear-gradient(135deg, rgba(220,53,69,0.05), rgba(0,0,0,0.3))' 
      }}>
        <span className="text-muted text-sm fw-600 block mb-12">Total Pending Dues</span>
        <h1 className="m-0 fw-700" style={{ color: 'var(--red)', fontSize: '2.5rem' }}>
          ₹{totalPending.toLocaleString('en-IN')}
        </h1>
      </div>

      {/* Subscription Breakdown Header */}
      <h4 className="mb-16 text-2">Subscription Breakdown</h4>
      <p className="text-xs text-muted mb-16">Tap on any status block to view filtered devotees directly.</p>

      {/* Breakdown Grid */}
      <div className="flex flex-col gap-12 mb-24">
        {/* Active Card */}
        <div 
          className="card cursor-pointer hover-scale flex-between py-16 px-20"
          onClick={() => handleStatCardClick('active')}
          style={{
            border: '1px solid rgba(40,167,69,0.3)',
            background: 'linear-gradient(90deg, rgba(40,167,69,0.05), rgba(0,0,0,0.2))'
          }}
        >
          <div className="flex gap-12" style={{ alignItems: 'center' }}>
            <span style={{ color: '#28a745', fontSize: '1.5rem' }}>🟢</span>
            <div>
              <h5 className="m-0 fw-600">Active</h5>
              <span className="text-xs text-muted">Subscription is fully active</span>
            </div>
          </div>
          <span className="fw-700 text-lg" style={{ color: '#28a745', fontSize: '1.3rem' }}>
            {activeCount}
          </span>
        </div>

        {/* Expiring Soon Card */}
        <div 
          className="card cursor-pointer hover-scale flex-between py-16 px-20"
          onClick={() => handleStatCardClick('expiring')}
          style={{
            border: '1px solid rgba(255,193,7,0.3)',
            background: 'linear-gradient(90deg, rgba(255,193,7,0.05), rgba(0,0,0,0.2))'
          }}
        >
          <div className="flex gap-12" style={{ alignItems: 'center' }}>
            <span style={{ color: '#ffc107', fontSize: '1.5rem' }}>🟡</span>
            <div>
              <h5 className="m-0 fw-600">Expiring Soon</h5>
              <span className="text-xs text-muted">Expires within 30 days</span>
            </div>
          </div>
          <span className="fw-700 text-lg" style={{ color: '#ffc107', fontSize: '1.3rem' }}>
            {expiringCount}
          </span>
        </div>

        {/* Expired Card */}
        <div 
          className="card cursor-pointer hover-scale flex-between py-16 px-20"
          onClick={() => handleStatCardClick('expired')}
          style={{
            border: '1px solid rgba(220,53,69,0.3)',
            background: 'linear-gradient(90deg, rgba(220,53,69,0.05), rgba(0,0,0,0.2))'
          }}
        >
          <div className="flex gap-12" style={{ alignItems: 'center' }}>
            <span style={{ color: '#dc3545', fontSize: '1.5rem' }}>🔴</span>
            <div>
              <h5 className="m-0 fw-600">Expired</h5>
              <span className="text-xs text-muted">Subscription has run out</span>
            </div>
          </div>
          <span className="fw-700 text-lg" style={{ color: '#dc3545', fontSize: '1.3rem' }}>
            {expiredCount}
          </span>
        </div>
      </div>
    </div>
  );
}
