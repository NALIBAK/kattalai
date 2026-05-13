import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDevoteeStore, useAuthStore } from '../store';
import { PlanGate } from '../components/PlanGate';
import { getSubscriptionStatus } from '../db';

export function Dashboard() {
  const navigate = useNavigate();
  const { devotees, load, loading } = useDevoteeStore();
  const { plan } = useAuthStore();
  const [showFinance, setShowFinance] = useState(false);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    let active = 0, expiring = 0, expired = 0, collected = 0, pending = 0;
    devotees.forEach(d => {
      const status = getSubscriptionStatus(d);
      if (status === 'active') active++;
      else if (status === 'expiring') expiring++;
      else expired++;

      collected += d.amount_paid;
      pending += Math.max(0, d.annual_amount - d.amount_paid);
    });
    return { total: devotees.length, active, expiring, expired, collected, pending };
  }, [devotees]);

  if (loading) {
    return (
      <div className="p-16 flex-col gap-16">
        <div className="skeleton" style={{ height: 100 }} />
        <div className="grid-2"><div className="skeleton" style={{ height: 90 }} /><div className="skeleton" style={{ height: 90 }} /></div>
      </div>
    );
  }

  return (
    <div>
      <div className="section">
        <h3 className="mb-16">Temple Dashboard</h3>

        {/* Financial Summary */}
        <div className="card mb-16" style={{ background: 'linear-gradient(135deg, var(--surface-2), var(--surface))' }}>
          <div className="flex-between mb-8">
            <span className="text-2 text-sm fw-600">FINANCIAL SUMMARY (THIS YEAR)</span>
            <button className="btn-icon" style={{ width: 32, height: 32, fontSize: '1rem' }} onClick={() => setShowFinance(!showFinance)}>
              {showFinance ? '👁️' : '🕶️'}
            </button>
          </div>
          <div className="grid-2 mt-16">
            <div>
              <div className="text-muted text-xs mb-4">Total Collected</div>
              <div className="text-xl fw-700 text-green">
                {showFinance ? `₹${stats.collected.toLocaleString('en-IN')}` : '₹****'}
              </div>
            </div>
            <div>
              <div className="text-muted text-xs mb-4">Pending Dues</div>
              <div className="text-xl fw-700 text-red">
                {showFinance ? `₹${stats.pending.toLocaleString('en-IN')}` : '₹****'}
              </div>
            </div>
          </div>
        </div>

        {/* Subscription Stats */}
        <h4 className="mb-8 mt-16 text-2">Subscriptions</h4>
        <div className="grid-2 mb-16">
          <div className="stat-card" onClick={() => { useDevoteeStore.getState().setFilterStatus(''); navigate('/devotees'); }}>
            <div className="stat-label">Total Devotees</div>
            <div className="flex-between w-full">
              <div className="stat-value">{stats.total}</div>
              <div className="stat-icon">👥</div>
            </div>
          </div>
          <div className="stat-card" onClick={() => { useDevoteeStore.getState().setFilterStatus('active'); navigate('/devotees'); }}>
            <div className="stat-label text-green">Active</div>
            <div className="flex-between w-full">
              <div className="stat-value">{stats.active}</div>
              <div className="stat-icon">✅</div>
            </div>
          </div>
          <div className="stat-card" style={{ borderColor: 'rgba(240,165,0,0.3)', background: 'rgba(240,165,0,0.05)' }} onClick={() => { useDevoteeStore.getState().setFilterStatus('expiring'); navigate('/devotees'); }}>
            <div className="stat-label text-amber">Expiring (30d)</div>
            <div className="flex-between w-full">
              <div className="stat-value text-amber">{stats.expiring}</div>
              <div className="stat-icon">⚠️</div>
            </div>
          </div>
          <div className="stat-card" style={{ borderColor: 'rgba(246,70,93,0.3)', background: 'rgba(246,70,93,0.05)' }} onClick={() => { useDevoteeStore.getState().setFilterStatus('expired'); navigate('/devotees'); }}>
            <div className="stat-label text-red">Expired</div>
            <div className="flex-between w-full">
              <div className="stat-value text-red">{stats.expired}</div>
              <div className="stat-icon">❌</div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <h4 className="mb-8 mt-16 text-2">Quick Actions</h4>
        <div className="grid-2">
          <button className="btn btn-primary" onClick={() => navigate('/devotees/new')}>
            ➕ Add Devotee
          </button>
          <PlanGate requiredPlan="pro" featureName="Map Hub Access">
            <button className="btn btn-ghost" onClick={() => navigate('/map')} style={{ color: 'var(--gold)', borderColor: 'var(--gold)', width: '100%' }}>
              🗺️ Open Map Hub
            </button>
          </PlanGate>
        </div>

        {/* WhatsApp Broadcast Status (Plus+) */}
        {plan !== 'free' && (
          <div className="card mt-16" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: '2rem' }}>📢</div>
            <div>
              <div className="fw-600">WhatsApp Broadcast</div>
              <div className="text-sm text-2">Send festival greetings and reminders.</div>
              <button className="btn btn-sm mt-8" style={{ background: '#25D366', color: '#fff' }} onClick={() => navigate('/broadcast')}>
                Open Broadcast
              </button>
            </div>
          </div>
        )}

        {/* Upgrade Promo for Free Users */}
        {plan === 'free' && (
          <div className="card mt-16" style={{ 
            border: '1px solid var(--gold)', 
            background: 'linear-gradient(135deg, rgba(212,175,55,0.05), rgba(30,144,255,0.05))',
            cursor: 'pointer'
          }} onClick={() => navigate('/upgrade')}>
            <div className="flex gap-12" style={{ alignItems: 'center' }}>
              <div style={{ fontSize: '2.2rem' }}>🚀</div>
              <div style={{ flex: 1 }}>
                <div className="fw-700" style={{ color: 'var(--gold)', fontSize: '1rem' }}>Unlock Full Features</div>
                <div className="text-xs text-muted mt-4" style={{ lineHeight: 1.4 }}>
                  Get WhatsApp Broadcasting, Map Hub, GPS Tracking, OCR Scanning & more with Plus or Pro.
                </div>
                <div className="flex gap-8 mt-8">
                  <span style={{ background: 'rgba(30,144,255,0.15)', color: '#1e90ff', padding: '2px 8px', borderRadius: 8, fontSize: '0.65rem', fontWeight: 700 }}>⭐ PLUS</span>
                  <span style={{ background: 'rgba(212,175,55,0.15)', color: 'var(--gold)', padding: '2px 8px', borderRadius: 8, fontSize: '0.65rem', fontWeight: 700 }}>🔥 PRO</span>
                </div>
              </div>
              <div style={{ color: 'var(--text-2)', fontSize: '1.2rem' }}>→</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
