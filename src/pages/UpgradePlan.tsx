import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';
import { useTranslation } from '../utils/i18n';

const ADMIN_WHATSAPP = '+916381367661';

export function UpgradePlan() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, plan } = useAuthStore();

  const plusFeatures = t('save') === 'சேமி' ? [
    { icon: '💬', title: 'வாட்ஸ்அப் ஒளிபரப்பு', desc: 'பக்தர்களுக்கு அவர்களின் பிரிவுகளின் அடிப்படையில் தனிப்பயன் செய்தி வார்ப்புருக்களுடன் மொத்தமாக செய்திகளை அனுப்பவும்' },
    { icon: '📋', title: 'செய்தி வார்ப்புருக்கள்', desc: 'நினைவூட்டல்கள் மற்றும் எச்சரிக்கைகளுக்காக மீண்டும் பயன்படுத்தக்கூடிய செய்தி வார்ப்புருக்களை உருவாக்கி நிர்வகிக்கவும்' },
    { icon: '📊', title: 'ஒளிபரப்பு பகுப்பாய்வு', desc: 'மாதாந்திர பதிவுகள் மற்றும் தொடர்பு எண்ணிக்கைகளுடன் ஒளிபரப்பு வரலாற்றைக் கண்காணிக்கவும்' },
  ] : [
    { icon: '💬', title: 'WhatsApp Broadcasting', desc: 'Send bulk messages to devotees by category with custom templates' },
    { icon: '📋', title: 'Message Templates', desc: 'Create & manage reusable message templates for reminders & alerts' },
    { icon: '📊', title: 'Broadcast Analytics', desc: 'Track broadcast history with monthly logs & contact counts' },
  ];

  const proFeatures = t('save') === 'சேமி' ? [
    { icon: '🗺️', title: 'வரைபட மையம் & ஜிபிஎஸ் காட்சி', desc: 'ஊடாடும் வரைபடத்தில் அனைத்து பக்தர்களையும் எளிதான வடிகட்டிகளுடன் பார்க்கவும்' },
    { icon: '📸', title: 'OCR புகைப்பட ஸ்கேன்', desc: 'விவரங்களை தானாக நிரப்ப AI-இயங்கும் உரை பிரித்தெடுத்தல் மூலம் பக்தர் அட்டைகளை ஸ்கேன் செய்யவும்' },
    { icon: '📍', title: 'ஜிபிஎஸ் இருப்பிடக் குறியீடு', desc: 'ஒவ்வொரு பக்தரின் முகவரிக்கும் துல்லியமான ஜிபிஎஸ் ஒருங்கிணைப்புகளைக் குறிக்கவும்' },
    { icon: '🧭', title: 'ஜிபிஎஸ் வழிசெலுத்தல்', desc: 'கூகுள் வரைபடம் வழியாக பக்தர்களின் இருப்பிடங்களுக்கு ஒரே தட்டலில் வழிசெலுத்தவும்' },
    { icon: '⭐', title: 'அனைத்து பிளஸ் அம்சங்களும்', desc: 'பிளஸ் திட்டத்தில் உள்ள அனைத்தும் புரோ திட்டத்தில் சேர்க்கப்பட்டுள்ளது' },
  ] : [
    { icon: '🗺️', title: 'Map Hub & GPS Visualization', desc: 'View all devotees on an interactive map with clustering & filters' },
    { icon: '📸', title: 'OCR Photo Scan', desc: 'Scan devotee cards with AI-powered text extraction to auto-fill forms' },
    { icon: '📍', title: 'GPS Location Tagging', desc: 'Tag precise GPS coordinates for each devotee address' },
    { icon: '🧭', title: 'GPS Navigation', desc: 'One-tap navigation to devotee locations via Google Maps' },
    { icon: '⭐', title: 'All Plus Features', desc: 'Everything in Plus plan is included with Pro' },
  ];

  const handleUpgrade = (targetPlan: 'plus' | 'pro') => {
    const isTa = t('save') === 'சேமி';
    const message = encodeURIComponent(
      isTa 
        ? `வணக்கம், எனது கட்டளை கணக்கின் திட்டத்தை மேம்படுத்த விரும்புகிறேன்.\n\n` +
          `📧 மின்னஞ்சல்: ${user?.email || 'N/A'}\n` +
          `📋 தற்போதைய திட்டம்: ${(plan || 'free').toUpperCase()}\n` +
          `⬆️ புதிய திட்டம்: ${targetPlan.toUpperCase()}\n\n` +
          `தயவுசெய்து மேம்படுத்த உதவவும்.`
        : `Hi, I would like to upgrade my Kattalai plan.\n\n` +
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
        <h3 className="m-0">{t('upgrade_title')}</h3>
        <div style={{ width: 40 }} />
      </div>

      {/* Current Plan Badge */}
      <div className="card text-center mb-24" style={{ border: '1px solid var(--border)' }}>
        <div className="text-xs text-muted mb-4">{t('upgrade_current_plan')}</div>
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
              <div className="text-xs text-muted mt-4">{t('upgrade_plus_desc')}</div>
            </div>
          </div>

          <div className="flex-col gap-12 mb-20">
            {plusFeatures.map((f, i) => (
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
              height: 'auto',
              minHeight: '44px',
              padding: '10px 16px',
              whiteSpace: 'normal'
            }}
            onClick={() => handleUpgrade('plus')}
          >
            {t('upgrade_to_plus')}
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
              <div className="text-xs text-muted mt-4">{t('upgrade_pro_desc')}</div>
            </div>
            <div style={{ 
              background: 'rgba(212,175,55,0.15)', 
              color: 'var(--gold)',
              padding: '4px 10px',
              borderRadius: 12,
              fontSize: '0.7rem',
              fontWeight: 700
            }}>
              {t('upgrade_recommended')}
            </div>
          </div>

          <div className="flex-col gap-12 mb-20">
            {proFeatures.map((f, i) => (
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
              height: 'auto',
              minHeight: '44px',
              padding: '10px 16px',
              whiteSpace: 'normal'
            }}
            onClick={() => handleUpgrade('pro')}
          >
            {t('upgrade_to_pro')}
          </button>
        </div>
      )}

      {/* Already on Pro */}
      {plan === 'pro' && (
        <div className="card text-center mb-24" style={{ border: '1px solid var(--gold)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 8 }}>🎉</div>
          <h3 className="text-gold mb-8">{t('upgrade_pro_congrats')}</h3>
          <p className="text-sm text-muted">{t('upgrade_pro_enjoy')}</p>
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
