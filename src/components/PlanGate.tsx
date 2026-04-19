import { ReactNode } from 'react';
import { useAuthStore } from '../store';
import { isPlanAllowed } from '../auth';
import { useNavigate } from 'react-router-dom';

interface PlanGateProps {
  requiredPlan: 'plus' | 'pro';
  featureName: string;
  children: ReactNode;
}

export function PlanGate({ requiredPlan, featureName, children }: PlanGateProps) {
  const navigate = useNavigate();
  const { plan } = useAuthStore();

  if (plan && isPlanAllowed(plan, requiredPlan)) {
    return <>{children}</>;
  }

  // Not allowed — show lock
  const bg = requiredPlan === 'pro' ? 'rgba(246, 70, 93, 0.05)' : 'rgba(240, 165, 0, 0.05)';
  const color = requiredPlan === 'pro' ? 'var(--red)' : 'var(--amber)';

  return (
    <div className="plan-lock" style={{ background: bg, borderColor: color }}>
      <div className="plan-lock-icon" style={{ color }}>{requiredPlan === 'pro' ? '🔥' : '⭐'}</div>
      <div className="plan-lock-label" style={{ color }}>{requiredPlan} PLAN EXCLUSIVE</div>
      <p className="text-sm text-2 mt-8">
        <strong>{featureName}</strong> is only available on the {requiredPlan.toUpperCase()} plan.
      </p>
      <button 
        className="btn btn-sm mt-8" 
        style={{ background: color, color: '#fff' }}
        onClick={() => navigate('/contact')}
      >
        Request Upgrade
      </button>
    </div>
  );
}
