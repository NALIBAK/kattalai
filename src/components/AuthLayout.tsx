import { ReactNode } from 'react';

export function AuthLayout({ children, title, subtitle }: { children: ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex-col flex-center" style={{ minHeight: '100dvh', background: 'var(--bg)', padding: '24px' }}>
      <div className="flex-col flex-center mb-16">
        <div style={{
          width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--gold), var(--gold-dim))',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px',
          boxShadow: '0 8px 32px rgba(212, 175, 55, 0.3)'
        }}>
          <span style={{ fontSize: '40px' }}>🛕</span>
        </div>
        <h1 style={{ textAlign: 'center', marginBottom: '8px' }}>{title}</h1>
        {subtitle && <p className="text-2" style={{ textAlign: 'center' }}>{subtitle}</p>}
      </div>
      
      <div className="card w-full" style={{ padding: '32px 24px' }}>
        {children}
      </div>

      <div className="mt-16 text-muted text-xs" style={{ textAlign: 'center' }}>
        KATTALAI MANAGEMENT v2.0
      </div>
    </div>
  );
}
