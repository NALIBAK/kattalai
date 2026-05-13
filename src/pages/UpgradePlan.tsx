import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';

const ADMIN_WHATSAPP = '+916381367661';

const PLUS_FEATURES = [
  { icon: '💬', title: 'WhatsApp Broadcasting', desc: 'Send bulk messages to devotees by category with custom templates' },
  { icon: '📋', title: 'Message Templates', desc: 'Create & manage reusable message templates for reminders & alerts' },
  { icon: '📊', title: 'Broadcast Analytics', desc: 'Track broadcast history with monthly logs & contact counts' },
];

const PRO_FEATURES = [
  { icon: '🗺️', title: 'Map Hub & GPS Visualization', desc: 'View all devotees on an interactive map with clustering & filters' },
  { icon: '📸', title: 'OCR Photo Scan', desc: 'Scan devotee cards with AI-powered text extraction to auto-fill forms' },
  { icon: '📍', title: 'GPS Location Tagging', desc: 'Tag precise GPS coordinates for each devotee address' },
  { icon: '🧭', title: 'GPS Navigation', desc: 'One-tap navigation to devotee locations via Google Maps' },
  { icon: '⭐', title: 'All Plus Features', desc: 'Everything in Plus plan is included with Pro' },
];

export function UpgradePlan() {
  const navigate = useNavigate();
  const { user, plan } = useAuthStore();

  const handleUpgrade = (targetPlan: 'plus' | 'pro') => {
    const message = encodeURIComponent(
      `Hi, I would like to upgrade my Kattalai plan.\n\n` +
      `📧 Email: ${user?.email || 'N/A'}\n` +
      `📋 Current Plan: ${(plan || 'free').toUpperCase()}\n` +
      `⬆️ Upgrade To: ${targetPlan.toUpperCase()}\n\n` +
      `Please help me with the upgrade process.`
    );
    window.open(`https://wa.me/${ADMIN_WHATSAPP.replace('+', '')}?text=${message}`, '_blank');
  };

  return (
    <div className="section pt-16">
      <div className="flex-between mb-24">
        <button className="btn-icon" onClick={() => navigate(-1)}>
          ←
        </button>
        <h3 className="m-0">Upgrade Plan</h3>
        <div style={{ width: 40 }} />
      </div>

      {/* Current Plan Badge */}
      <div className="card text-center mb-24" style={{ border: '1px solid var(--border, #333)' }}>
        <div className="text-xs text-muted mb-4">YOUR CURRENT PLAN</div>
        <div className="fw-700" style={{ 
          fontSize: '1.5rem', 
          color: plan === 'pro' ? 'var(--gold)' : plan === 'plus' ? '#1e90ff' : 'var(--text-2)',
          textTransform: 'uppercase'
        }}>
          {plan || 'free'}
        </div>
      </div>

      {/* Plus Plan Card */}
      {(!plan || plan === 'free') && (
        <div className="card mb-16" style={{ 
          border: '2px solid #1e90ff',
          background: 'rgba(30,144,255,0.03)'
        }}>
          <div className="flex-between mb-16">
            <div>
              <div className="flex gap-8" style={{ alignItems: 'center' }}>
                <span style={{ fontSize: '1.5rem' }}>⭐</span>
                <h3 className="m-0" style={{ color: '#1e90ff' }}>PLUS</h3>
              </div>
              <div className="text-xs text-muted mt-4">Best for active temple admins</div>
            </div>
          </div>

          <div className="flex-col gap-12 mb-20">
            {PLUS_FEATURES.map((f, i) => (
              <div key={i} className="flex gap-12" style={{ alignItems: 'flex-start' }}>
                <span style={{ fontSize: '1.2rem', flexShrink: 0, marginTop: 2 }}>{f.icon}</span>
                <div>
                  <div className="fw-600 text-sm">{f.title}</div>
                  <div className="text-xs text-muted" style={{ lineHeight: 1.4, marginTop: 2 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <button 
            className="btn btn-full"
            style={{ 
              background: '#1e90ff', 
              color: '#fff', 
              border: 'none',
              fontWeight: 700,
              height: 44
            }}
            onClick={() => handleUpgrade('plus')}
          >
            💬 Upgrade to Plus via WhatsApp
          </button>
        </div>
      )}

      {/* Pro Plan Card */}
      {(!plan || plan === 'free' || plan === 'plus') && (
        <div className="card mb-16" style={{ 
          border: '2px solid var(--gold)',
          background: 'rgba(212,175,55,0.03)'
        }}>
          <div className="flex-between mb-16">
            <div>
              <div className="flex gap-8" style={{ alignItems: 'center' }}>
                <span style={{ fontSize: '1.5rem' }}>🔥</span>
                <h3 className="m-0 text-gold">PRO</h3>
              </div>
              <div className="text-xs text-muted mt-4">Full power — everything unlocked</div>
            </div>
            <div style={{ 
              background: 'rgba(212,175,55,0.15)', 
              color: 'var(--gold)',
              padding: '4px 10px',
              borderRadius: 12,
              fontSize: '0.7rem',
              fontWeight: 700
            }}>
              RECOMMENDED
            </div>
          </div>

          <div className="flex-col gap-12 mb-20">
            {PRO_FEATURES.map((f, i) => (
              <div key={i} className="flex gap-12" style={{ alignItems: 'flex-start' }}>
                <span style={{ fontSize: '1.2rem', flexShrink: 0, marginTop: 2 }}>{f.icon}</span>
                <div>
                  <div className="fw-600 text-sm">{f.title}</div>
                  <div className="text-xs text-muted" style={{ lineHeight: 1.4, marginTop: 2 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <button 
            className="btn btn-full"
            style={{ 
              background: 'var(--gold)', 
              color: '#000', 
              border: 'none',
              fontWeight: 700,
              height: 44
            }}
            onClick={() => handleUpgrade('pro')}
          >
            💬 Upgrade to Pro via WhatsApp
          </button>
        </div>
      )}

      {/* Already on Pro */}
      {plan === 'pro' && (
        <div className="card text-center mb-24" style={{ border: '1px solid var(--gold)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 8 }}>🎉</div>
          <h3 className="text-gold mb-8">You're on the best plan!</h3>
          <p className="text-sm text-muted">You have access to all features. Enjoy!</p>
        </div>
      )}

      <style>{`
        .animate-spin {
          display: inline-block;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
