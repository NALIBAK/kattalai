import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../utils/i18n';

export function Dashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const chapters = [
    {
      num: t('ch1_num'),
      title: t('ch1_title'),
      desc: t('ch1_desc'),
      path: '/devotees',
      badge: 'Registry'
    },
    {
      num: t('ch2_num'),
      title: t('ch2_title'),
      desc: t('ch2_desc'),
      path: '/vasool',
      badge: 'Vasool'
    },
    {
      num: t('ch3_num'),
      title: t('ch3_title'),
      desc: t('ch3_desc'),
      path: '/map',
      badge: 'Map Hub'
    },
    {
      num: t('ch4_num'),
      title: t('ch4_title'),
      desc: t('ch4_desc'),
      path: '/broadcast',
      badge: 'Broadcast'
    },
    {
      num: t('ch5_num'),
      title: t('ch5_title'),
      desc: t('ch5_desc'),
      path: '/cover-print',
      badge: 'Printing'
    },
    {
      num: t('ch6_num'),
      title: t('ch6_title'),
      desc: t('ch6_desc'),
      path: '/settings',
      badge: 'Settings'
    }
  ];

  return (
    <div className="section pt-16 pb-32">
      {/* Golden Temple Header Banner */}
      <div 
        className="card mb-24 text-center" 
        style={{
          background: 'linear-gradient(135deg, rgba(212,175,55,0.15) 0%, rgba(0,0,0,0.4) 100%)',
          border: '2px solid var(--gold)',
          borderRadius: '12px',
          padding: '24px 16px',
          boxShadow: '0 4px 20px rgba(212,175,55,0.08)'
        }}
      >
        <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '8px' }}>🛕</span>
        <h2 className="m-0 fw-700" style={{ color: 'var(--gold)', letterSpacing: '1px', textTransform: 'uppercase' }}>
          {t('book_title')}
        </h2>
        <p className="text-xs text-muted m-0 mt-8" style={{ fontStyle: 'italic', letterSpacing: '0.5px' }}>
          {t('book_subtitle')}
        </p>
      </div>

      <h4 className="mb-16 text-2 fw-600" style={{ letterSpacing: '0.5px' }}>{t('book_chapters')}</h4>

      {/* Chapters Grid */}
      <div className="flex flex-col gap-16">
        {chapters.map((ch, idx) => (
          <div 
            key={idx}
            className="card cursor-pointer hover-scale flex-col justify-center"
            onClick={() => navigate(ch.path)}
            style={{
              padding: '20px',
              border: '1px solid var(--border)',
              background: 'linear-gradient(135deg, var(--surface) 0%, var(--surface-2) 100%)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* Elegant side border highlight */}
            <div style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: '4px',
              backgroundColor: 'var(--gold)'
            }} />

            <div className="flex-between w-full mb-8">
              <span className="text-xs fw-700" style={{ color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {ch.num}
              </span>
              <span className="badge text-xs" style={{ background: 'rgba(212,175,55,0.1)', color: 'var(--gold)', border: '1px solid rgba(212,175,55,0.2)' }}>
                {ch.badge}
              </span>
            </div>

            <h3 className="m-0 fw-600 mb-8" style={{ color: 'var(--text-1)' }}>
              {ch.title}
            </h3>
            
            <p className="m-0 text-sm text-muted" style={{ lineHeight: '1.4' }}>
              {ch.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
