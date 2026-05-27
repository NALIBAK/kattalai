import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';
import { useTranslation } from '../utils/i18n';

export function AboutApp() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, plan } = useAuthStore();

  const handleContactDeveloper = () => {
    const isTa = t('save') === 'சேமி';
    const email = user?.email || 'N/A';
    const currentPlan = (plan || 'free').toUpperCase();
    
    const message = encodeURIComponent(
      isTa
        ? `வணக்கம் தீக்ஷிதர்,\n\nஎனது கட்டளை செயலி தொடர்பாக தொழில்நுட்ப ஆதரவு அல்லது விபரம் தேவைப்படுகிறது.\n\n` +
          `📧 மின்னஞ்சல்: ${email}\n` +
          `📋 தற்போதைய திட்டம்: ${currentPlan}\n\n` +
          `தயவுசெய்து உதவவும்.`
        : `Hi Deekshithar,\n\nI need support / assistance regarding the Kattalai App.\n\n` +
          `📧 Registered Email: ${email}\n` +
          `📋 Current Plan: ${currentPlan}\n\n` +
          `Please guide me.`
    );
    window.open(`https://wa.me/916381367661?text=${message}`, '_blank');
  };

  const isTa = t('save') === 'சேமி';

  // Feature comparison array
  const comparisonFeatures = [
    {
      name: isTa ? 'பக்தர்கள் பதிவேடு' : 'Devotee Registry',
      desc: isTa ? 'விவரங்களைச் சேமித்தல் மற்றும் தேடுதல்' : 'Add, edit and search devotees',
      free: '✅', plus: '✅', pro: '✅'
    },
    {
      name: isTa ? 'ZIP காப்புப் பிரதி' : 'ZIP Data Backups',
      desc: isTa ? 'உள்ளூர் கணினியில் காப்புப் பிரதி எடுத்தல்' : 'Manual ZIP backup/restore',
      free: '✅', plus: '✅', pro: '✅'
    },
    {
      name: isTa ? 'வாட்ஸ்அப் ஒளிபரப்பு' : 'WhatsApp Broadcasts',
      desc: isTa ? 'குழு வாரியாக மொத்தமாகச் செய்திகள் அனுப்புதல்' : 'Bulk broadcasting by category',
      free: '❌', plus: '✅', pro: '✅'
    },
    {
      name: isTa ? 'செய்தி வார்ப்புருக்கள்' : 'Message Templates',
      desc: isTa ? 'மறுபயன்பாட்டுச் செய்தி வார்ப்புருக்கள்' : 'Create & save custom templates',
      free: '❌', plus: '✅', pro: '✅'
    },
    {
      name: isTa ? 'அணுகல் பகுப்பாய்வு' : 'Broadcast Logs',
      desc: isTa ? 'ஒளிபரப்புப் பதிவுகள் கண்காணிப்பு' : 'Monthly stats and tracking',
      free: '❌', plus: '✅', pro: '✅'
    },
    {
      name: isTa ? 'கோயில் வரைபட மையம்' : 'Interactive Map Hub',
      desc: isTa ? 'பக்தர்களின் முகவரிகளை வரைபடத்தில் காண்க' : 'Devotees on interactive map',
      free: '❌', plus: '❌', pro: '🔥 ✅', isProSpecial: true
    },
    {
      name: isTa ? 'AI புகைப்பட ஸ்கேன் (OCR)' : 'AI Photo Scan (OCR)',
      desc: isTa ? 'பக்தர் அட்டையை ஸ்கேன் செய்து விவரம் நிரப்புதல்' : 'Scan devotee cards to auto-fill',
      free: '❌', plus: '❌', pro: '🔥 ✅', isProSpecial: true
    },
    {
      name: isTa ? 'ஜிபிஎஸ் வழிசெலுத்தல்' : 'GPS Location & Navigation',
      desc: isTa ? 'இருப்பிடக் குறியீடு & வரைபட வழிசெலுத்தல்' : 'GPS coordinates & 1-tap Google Maps',
      free: '❌', plus: '❌', pro: '🔥 ✅', isProSpecial: true
    }
  ];

  return (
    <div className="section pt-16 animate-fade-in" style={{ paddingBottom: '32px' }}>
      {/* Header */}
      <div className="flex-between mb-24">
        <button className="btn-icon animate-hover-scale" onClick={() => navigate(-1)}>
          ←
        </button>
        <h3 className="m-0 text-gold fw-800" style={{ letterSpacing: '0.5px' }}>
          {t('about_title')}
        </h3>
        <div style={{ width: 44 }} />
      </div>

      {/* App Branding Header */}
      <div className="card text-center mb-24" style={{
        background: 'linear-gradient(135deg, var(--surface) 0%, var(--surface-2) 100%)',
        border: '1.5px solid var(--gold)',
        boxShadow: '0 8px 24px rgba(212,175,55,0.15)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          top: -20,
          right: -20,
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'rgba(212,175,55,0.05)',
          pointerEvents: 'none'
        }} />
        <div style={{ fontSize: '3rem', marginBottom: '8px', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))' }}>ॐ</div>
        <h2 className="m-0 fw-800 text-gold" style={{ fontSize: '1.6rem', letterSpacing: '1px' }}>KATTALAI</h2>
        <div className="text-xs text-muted mt-4 fw-600" style={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {isTa ? 'ஸ்ரீ கட்டளை மேலாண்மைச் செயலி' : 'Sri Kattalai Registry Admin'}
        </div>
        <div className="text-xs text-muted mt-8" style={{ opacity: 0.8 }}>
          Version 2.1.0 • Stable Release
        </div>
      </div>

      {/* Developer Profile Card */}
      <h4 className="section-title">{t('about_developer')}</h4>
      <div className="card mb-24" style={{
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div className="flex gap-16" style={{ alignItems: 'center' }}>
          <div style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--gold-light), var(--gold-dim))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.8rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            flexShrink: 0
          }}>
            👨‍💻
          </div>
          <div>
            <h3 className="m-0 fw-700" style={{ fontSize: '1.15rem' }}>{t('about_dev_name')}</h3>
            <div className="text-xs text-gold fw-600 mt-2" style={{ letterSpacing: '0.02em' }}>{t('about_dev_role')}</div>
            <div className="text-xs text-muted mt-4" style={{ fontSize: '0.78rem', lineHeight: 1.4 }}>
              {t('about_dev_desc')}
            </div>
          </div>
        </div>
        
        <button 
          className="btn btn-primary btn-full animate-hover-scale"
          onClick={handleContactDeveloper}
          style={{
            background: 'linear-gradient(90deg, #25D366 0%, #128C7E 100%)',
            color: '#fff',
            border: 'none',
            fontWeight: 700,
            boxShadow: '0 4px 14px rgba(37,211,102,0.3)',
            borderRadius: '8px'
          }}
        >
          {t('about_contact_btn')}
        </button>
      </div>

      {/* Plans Comparison Header */}
      <h4 className="section-title">{t('about_plans_compare')}</h4>

      {/* Side-by-Side Modern Plan Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '8px',
        marginBottom: '24px'
      }}>
        {/* FREE Card */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '12px 8px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: 'var(--shadow)',
          position: 'relative'
        }}>
          <div className="text-xs text-muted fw-700" style={{ textTransform: 'uppercase', fontSize: '0.65rem' }}>FREE</div>
          <div className="fw-800 text-md mt-4" style={{ color: 'var(--text-2)' }}>₹0</div>
          <div className="text-muted" style={{ fontSize: '0.625rem', marginTop: 4 }}>
            {isTa ? 'அடிப்படை' : 'Essential'}
          </div>
        </div>

        {/* PLUS Card */}
        <div style={{
          background: 'rgba(30,144,255,0.02)',
          border: '1.5px solid var(--blue)',
          borderRadius: '8px',
          padding: '12px 8px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: 'var(--shadow)',
          position: 'relative'
        }}>
          <div className="text-xs fw-700" style={{ color: 'var(--blue)', textTransform: 'uppercase', fontSize: '0.65rem' }}>PLUS</div>
          <div className="fw-800 text-md mt-4" style={{ color: 'var(--blue)' }}>⭐️</div>
          <div className="text-muted" style={{ fontSize: '0.625rem', marginTop: 4 }}>
            {isTa ? 'ஒளிபரப்பு' : 'Broadcasts'}
          </div>
        </div>

        {/* PRO Card - Recommended */}
        <div style={{
          background: 'rgba(212,175,55,0.03)',
          border: '2px solid var(--gold)',
          borderRadius: '8px',
          padding: '12px 8px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: '0 4px 12px rgba(212,175,55,0.15)',
          position: 'relative'
        }}>
          <div style={{
            position: 'absolute',
            top: -9,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--gold)',
            color: '#000',
            fontSize: '0.55rem',
            fontWeight: 800,
            padding: '2px 6px',
            borderRadius: '10px',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            {t('upgrade_recommended')}
          </div>
          <div className="text-xs fw-700 text-gold mt-2" style={{ textTransform: 'uppercase', fontSize: '0.65rem' }}>PRO</div>
          <div className="fw-800 text-md mt-2" style={{ color: 'var(--gold)' }}>👑 🔥</div>
          <div className="text-muted" style={{ fontSize: '0.625rem', marginTop: 4 }}>
            {isTa ? 'அனைத்தும்' : 'Full Power'}
          </div>
        </div>
      </div>

      {/* Side-by-Side Detailed Matrix Table */}
      <div className="card" style={{ padding: '0px', border: '1px solid var(--border)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px 10px', textAlign: 'left', fontWeight: 700, width: '45%' }}>
                {t('about_plan_features')}
              </th>
              <th style={{ padding: '12px 4px', textAlign: 'center', fontWeight: 700, width: '18%', fontSize: '0.75rem', color: 'var(--text-3)' }}>FREE</th>
              <th style={{ padding: '12px 4px', textAlign: 'center', fontWeight: 700, width: '18%', fontSize: '0.75rem', color: 'var(--blue)' }}>PLUS</th>
              <th style={{ padding: '12px 4px', textAlign: 'center', fontWeight: 700, width: '19%', fontSize: '0.75rem', color: 'var(--gold)' }}>PRO</th>
            </tr>
          </thead>
          <tbody>
            {comparisonFeatures.map((f, i) => (
              <tr 
                key={i} 
                style={{ 
                  borderBottom: i === comparisonFeatures.length - 1 ? 'none' : '1px solid var(--border)',
                  background: f.isProSpecial ? 'rgba(212,175,55,0.015)' : 'transparent',
                  transition: 'background 0.2s'
                }}
                className="matrix-row"
              >
                <td style={{ padding: '10px 10px', verticalAlign: 'middle' }}>
                  <div className="fw-600" style={{ fontSize: '0.78rem', color: f.isProSpecial ? 'var(--gold)' : 'var(--text)' }}>
                    {f.name}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginTop: 2, lineHeight: 1.2 }}>
                    {f.desc}
                  </div>
                </td>
                <td style={{ padding: '10px 4px', textAlign: 'center', fontSize: '0.9rem', verticalAlign: 'middle' }}>
                  {f.free}
                </td>
                <td style={{ padding: '10px 4px', textAlign: 'center', fontSize: '0.9rem', verticalAlign: 'middle' }}>
                  {f.plus}
                </td>
                <td style={{ 
                  padding: '10px 4px', 
                  textAlign: 'center', 
                  fontSize: '0.95rem', 
                  verticalAlign: 'middle', 
                  fontWeight: f.isProSpecial ? 'bold' : 'normal',
                  background: f.isProSpecial ? 'rgba(212,175,55,0.03)' : 'transparent'
                }}>
                  {f.pro}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Upgrade CTA Footer */}
      {(plan !== 'pro') && (
        <button 
          className="btn btn-primary btn-full mt-24 animate-hover-scale"
          onClick={() => navigate('/upgrade')}
          style={{
            background: 'linear-gradient(135deg, var(--gold) 0%, #B79524 100%)',
            color: '#000',
            fontWeight: 800,
            border: 'none',
            fontSize: '0.95rem',
            boxShadow: '0 4px 14px rgba(212,175,55,0.3)',
            borderRadius: '8px'
          }}
        >
          🚀 {isTa ? 'இப்போதே மேம்படுத்தவும்' : 'Upgrade Plan Now'}
        </button>
      )}

      {/* Embed simple styling transitions inside template */}
      <style>{`
        .animate-hover-scale {
          transition: transform 0.2s var(--ease), box-shadow 0.2s var(--ease);
        }
        .animate-hover-scale:hover {
          transform: translateY(-2px);
        }
        .animate-hover-scale:active {
          transform: translateY(0) scale(0.98);
        }
        .matrix-row:hover {
          background: var(--surface-2) !important;
        }
      `}</style>
    </div>
  );
}
