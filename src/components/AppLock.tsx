import { useState, useEffect, useCallback } from 'react';

const LOCK_STORAGE_KEY = 'kattalai_app_lock_pin';
const LAST_ACTIVE_KEY = 'kattalai_last_active';
const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

interface AppLockProps {
  children: React.ReactNode;
}

export function AppLock({ children }: AppLockProps) {
  const [isLocked, setIsLocked] = useState(false);
  const [pin, setPin] = useState('');
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [hasPinSet, setHasPinSet] = useState(false);

  // Check if PIN is configured & Handle initial lock
  const checkInitialLock = useCallback(() => {
    const storedPin = localStorage.getItem(LOCK_STORAGE_KEY);
    if (storedPin) {
      setPin(storedPin);
      setHasPinSet(true);
      
      const lastActive = localStorage.getItem(LAST_ACTIVE_KEY);
      if (lastActive) {
        const elapsed = Date.now() - parseInt(lastActive, 10);
        if (elapsed > LOCK_TIMEOUT_MS) {
          setIsLocked(true);
        }
      } else {
        // If no last active, but PIN exists, we should probably lock
        setIsLocked(true);
      }
    } else {
      setHasPinSet(false);
      setIsLocked(false);
    }
  }, []);

  useEffect(() => {
    checkInitialLock();

    // Listen for storage changes (e.g. Settings updates PIN)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === LOCK_STORAGE_KEY || e.key === LAST_ACTIVE_KEY) {
        checkInitialLock();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [checkInitialLock]);

  // Track last activity
  const resetTimer = useCallback(() => {
    localStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
  }, []);

  useEffect(() => {
    if (!hasPinSet) return;

    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(ev => window.addEventListener(ev, resetTimer, { passive: true }));

    // Check timeout every 30 seconds for better accuracy
    const interval = setInterval(() => {
      const storedPin = localStorage.getItem(LOCK_STORAGE_KEY);
      if (!storedPin) {
        setHasPinSet(false);
        setIsLocked(false);
        return;
      }

      const lastActive = localStorage.getItem(LAST_ACTIVE_KEY);
      if (lastActive) {
        const elapsed = Date.now() - parseInt(lastActive, 10);
        if (elapsed > LOCK_TIMEOUT_MS) {
          setIsLocked(true);
        }
      }
    }, 30000);

    return () => {
      events.forEach(ev => window.removeEventListener(ev, resetTimer));
      clearInterval(interval);
    };
  }, [hasPinSet, resetTimer]);

  const handleUnlock = () => {
    if (input === pin) {
      setIsLocked(false);
      setInput('');
      setError('');
      resetTimer();
    } else {
      setError('Incorrect PIN');
      setShake(true);
      setInput('');
      setTimeout(() => setShake(false), 500);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleUnlock();
  };

  if (!isLocked || !hasPinSet) {
    return <>{children}</>;
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 320, width: '100%' }}>
        {/* Lock Icon */}
        <div style={{ fontSize: '4rem', marginBottom: 16 }}>🔐</div>
        <h2 style={{ marginBottom: 4 }}>App Locked</h2>
        <p style={{ color: 'var(--text-2)', marginBottom: 32, fontSize: '0.9rem' }}>
          Enter your PIN to continue
        </p>

        {/* PIN dots display */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 24 }}>
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              style={{
                width: 16, height: 16, borderRadius: '50%',
                background: input.length > i ? 'var(--gold)' : 'var(--surface-2)',
                border: '2px solid var(--gold)',
                transition: 'background 0.2s',
              }}
            />
          ))}
        </div>

        {/* Numpad */}
        <div
          className={shake ? 'shake' : ''}
          style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12,
            marginBottom: 16,
          }}
        >
          {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((key, idx) => (
            <button
              key={idx}
              disabled={key === ''}
              onClick={() => {
                if (key === '⌫') {
                  setInput(p => p.slice(0, -1));
                  setError('');
                } else if (key && input.length < 4) {
                  const next = input + key;
                  setInput(next);
                  setError('');
                  if (next.length === 4) {
                    // Auto-submit when 4 digits entered
                    setTimeout(() => {
                      const storedPin = localStorage.getItem(LOCK_STORAGE_KEY) || '';
                      if (next === storedPin) {
                        setIsLocked(false);
                        setInput('');
                        setError('');
                        localStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
                      } else {
                        setError('Incorrect PIN');
                        setShake(true);
                        setInput('');
                        setTimeout(() => setShake(false), 500);
                      }
                    }, 100);
                  }
                }
              }}
              style={{
                padding: '18px 0',
                fontSize: key === '⌫' ? '1.4rem' : '1.3rem',
                fontWeight: 600,
                background: key === '' ? 'transparent' : 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                color: 'var(--text)',
                cursor: key === '' ? 'default' : 'pointer',
                opacity: key === '' ? 0 : 1,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => {
                if (key) (e.target as HTMLElement).style.background = 'var(--surface-3, rgba(255,215,0,0.1))';
              }}
              onMouseLeave={e => {
                if (key) (e.target as HTMLElement).style.background = 'var(--surface-2)';
              }}
            >
              {key}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ color: 'var(--red)', fontSize: '0.85rem', marginBottom: 12 }}>
            ⚠️ {error}
          </div>
        )}

        {/* Fallback text input */}
        <input
          type="password"
          placeholder="Or type PIN here"
          value={input}
          onChange={e => { setInput(e.target.value.slice(0, 4)); setError(''); }}
          onKeyDown={handleKeyDown}
          maxLength={4}
          className="form-input"
          style={{ textAlign: 'center', letterSpacing: 8, fontSize: '1.2rem', marginBottom: 12 }}
        />

        <button className="btn btn-primary w-full" onClick={handleUnlock} disabled={input.length === 0}>
          🔓 Unlock
        </button>
      </div>
    </div>
  );
}

// Hook to manage PIN from Settings
export function useAppLock() {
  const getPin = () => localStorage.getItem(LOCK_STORAGE_KEY) || '';
  const hasPin = () => Boolean(localStorage.getItem(LOCK_STORAGE_KEY));

  const setPin = (pin: string) => {
    if (pin) {
      localStorage.setItem(LOCK_STORAGE_KEY, pin);
      localStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
    } else {
      localStorage.removeItem(LOCK_STORAGE_KEY);
      localStorage.removeItem(LAST_ACTIVE_KEY);
    }
  };

  return { getPin, hasPin, setPin };
}
