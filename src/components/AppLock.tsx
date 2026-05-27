import { useState, useEffect } from 'react';
import { useSettingsStore, useAuthStore, useToastStore } from '../store';
import { signInWithGoogle } from '../auth';
import CryptoJS from 'crypto-js';

export function AppLock() {
  const { t } = useTranslation();
  const { showToast } = useToastStore();
  const { user } = useAuthStore();
  const { 
    appLockPinHash, 
    appLockBiometricsEnabled, 
    appLockBiometricCredId,
    setAppLock, 
    unlockApp 
  } = useSettingsStore();

  const [enteredPin, setEnteredPin] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const isTa = t('save') === 'சேமி';

  // Trigger biometric prompt if enabled on mount
  useEffect(() => {
    if (appLockBiometricsEnabled && appLockBiometricCredId) {
      // Small timeout to allow overlay render to settle
      const timer = setTimeout(() => {
        handleBiometricUnlock();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [appLockBiometricsEnabled, appLockBiometricCredId]);

  const handleBiometricUnlock = async () => {
    if (!window.PublicKeyCredential) {
      showToast(
        isTa 
          ? 'இந்த சாதனத்தில் கைரேகை/முக அடையாளம் ஆதரிக்கப்படவில்லை.' 
          : 'Biometrics not supported on this device/browser.', 
        'error'
      );
      return;
    }

    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      // Perform local challenge challenge to verify credential
      await navigator.credentials.get({
        publicKey: {
          challenge,
          timeout: 60000,
          userVerification: 'required',
          allowCredentials: [{
            id: Uint8Array.from(atob(appLockBiometricCredId), c => c.charCodeAt(0)),
            type: 'public-key'
          }]
        }
      });

      // Verification successful!
      showToast(isTa ? 'உறுதி செய்யப்பட்டது!' : 'Authenticated!', 'success');
      unlockApp();
    } catch (e) {
      console.warn('Biometric unlock failed or cancelled', e);
      // Suppress alert on cancel, user can just type PIN
    }
  };

  const handleKeyPress = (num: string) => {
    if (enteredPin.length < 4) {
      const newPin = enteredPin + num;
      setEnteredPin(newPin);

      // Check pin once it reaches 4 digits
      if (newPin.length === 4) {
        verifyPin(newPin);
      }
    }
  };

  const verifyPin = (pin: string) => {
    const hash = CryptoJS.SHA256(pin).toString();
    if (hash === appLockPinHash) {
      unlockApp();
    } else {
      // Shake animation
      setIsShaking(true);
      setTimeout(() => {
        setIsShaking(false);
        setEnteredPin('');
      }, 450);
    }
  };

  const handleBackspace = () => {
    if (enteredPin.length > 0) {
      setEnteredPin(enteredPin.slice(0, -1));
    }
  };

  const handleGoogleRecovery = async () => {
    if (!user?.email) {
      showToast(isTa ? 'சுயவிவர மின்னஞ்சல் கண்டறியப்படவில்லை' : 'Registered email not found', 'error');
      return;
    }

    try {
      setIsVerifying(true);
      const googleUser = await signInWithGoogle();
      
      if (googleUser.email.toLowerCase() === user.email.toLowerCase()) {
        // Owner re-authenticated successfully! Reset lock
        await setAppLock(false, '');
        unlockApp();
        showToast(
          isTa 
            ? 'அடையாளம் உறுதி செய்யப்பட்டது! பாதுகாப்புப் பூட்டு நீக்கப்பட்டது.' 
            : 'Identity verified! App Lock has been disabled.', 
          'success'
        );
      } else {
        showToast(
          isTa 
            ? `தவறான மின்னஞ்சல்! ${user.email} கணக்குடன் உள்நுழையவும்.` 
            : `Wrong account! Please sign in as ${user.email}.`, 
          'error'
        );
      }
    } catch (error) {
      const err = error as { message?: string };
      if (err.message !== 'No credential') {
        showToast(err.message || (isTa ? 'அடையாளம் சரிபார்ப்பதில் தோல்வி' : 'Verification failed'), 'error');
      }
    } finally {
      setIsVerifying(false);
      setShowRecoveryModal(false);
    }
  };

  // Helper translations hook inline fallback
  function useTranslation() {
    const language = useSettingsStore(state => state.language) || 'ta';
    const dict = {
      ta: {
        lock_title: 'பாதுகாப்புப் பூட்டு',
        lock_enter_pin: 'செயலியைத் திறக்க 4-இலக்க PIN-ஐ உள்ளிடவும்',
        lock_biometric_prompt: 'கைரேகை அல்லது முக அடையாளத்தைப் பயன்படுத்தவும்',
        lock_forgot_pin: 'PIN குறியீட்டை மறந்துவிட்டீர்களா?',
        lock_recovery_title: 'PIN மீட்டமைப்பு',
        lock_recovery_desc: 'பாதுகாப்பு காரணங்களுக்காக, உங்கள் பதிவுசெய்யப்பட்ட கூகுள் கணக்கை மீண்டும் சரிபார்ப்பதன் மூலம் உங்கள் PIN குறியீட்டை மீட்டமைக்கலாம். இது உங்கள் தரவைப் பாதிக்காது.',
        lock_recovery_btn: '🔑 கூகுள் மூலம் சரிபார்',
        save: 'சேமி',
        cancel: 'ரத்துசெய்'
      },
      en: {
        lock_title: 'App Security Lock',
        lock_enter_pin: 'Enter 4-Digit PIN to Unlock',
        lock_biometric_prompt: 'Use Biometrics',
        lock_forgot_pin: 'Forgot PIN?',
        lock_recovery_title: 'Reset PIN Lock',
        lock_recovery_desc: 'For security, you must re-verify your Google Account to reset your PIN. This will not delete your devotee data.',
        lock_recovery_btn: '🔑 Verify with Google',
        save: 'Save',
        cancel: 'Cancel'
      }
    };
    const t = (key: 'lock_title' | 'lock_enter_pin' | 'lock_biometric_prompt' | 'lock_forgot_pin' | 'lock_recovery_title' | 'lock_recovery_desc' | 'lock_recovery_btn' | 'save' | 'cancel') => {
      const langDict = dict[language] || dict.ta;
      return langDict[key] || dict.ta[key] || key;
    };
    return { t };
  }

  return (
    <>
      <div className={`lock-overlay ${isShaking ? 'shake' : ''}`}>
        {/* Branding header */}
        <div className="text-center mb-32">
          <div style={{ fontSize: '3rem', marginBottom: '8px', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))' }}>ॐ</div>
          <h2 className="m-0 fw-800 text-gold" style={{ fontSize: '1.6rem', letterSpacing: '1px' }}>KATTALAI</h2>
          <div className="text-xs text-muted mt-4 fw-600" style={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            {isTa ? 'பாதுகாக்கப்பட்ட பகுதி' : 'SECURED AREA'}
          </div>
        </div>

        {/* Status prompt */}
        <div className="text-center mb-16">
          <div className="fw-600 text-md" style={{ color: 'var(--text-2)' }}>{t('lock_enter_pin')}</div>
        </div>

        {/* PIN Dot Indicators */}
        <div className="pin-dots-container">
          {[0, 1, 2, 3].map((index) => (
            <div 
              key={index} 
              className={`pin-dot ${index < enteredPin.length ? 'filled' : ''} ${isShaking ? 'text-red' : ''}`}
              style={{
                borderColor: isShaking ? 'var(--red)' : undefined,
                boxShadow: isShaking ? '0 0 10px rgba(246,70,93,0.5)' : undefined,
                background: isShaking && index < enteredPin.length ? 'var(--red)' : undefined
              }}
            />
          ))}
        </div>

        {/* On-screen virtual keypad */}
        <div className="numpad-grid">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button key={num} className="numpad-btn" onClick={() => handleKeyPress(num)}>
              {num}
            </button>
          ))}

          {/* Biometrics Trigger (Fingerprint Icon) */}
          {appLockBiometricsEnabled ? (
            <button className="numpad-btn action-btn" onClick={handleBiometricUnlock} title={t('lock_biometric_prompt')}>
              <span style={{ fontSize: '1.8rem' }}>👤</span>
            </button>
          ) : (
            <div style={{ width: 80, height: 80 }} />
          )}

          {/* Zero key */}
          <button className="numpad-btn" onClick={() => handleKeyPress('0')}>
            0
          </button>

          {/* Backspace Key */}
          <button className="numpad-btn action-btn" onClick={handleBackspace}>
            <span style={{ fontSize: '1.6rem' }}>⌫</span>
          </button>
        </div>

        {/* Forgot PIN Action */}
        <button 
          onClick={() => setShowRecoveryModal(true)}
          style={{
            marginTop: '32px',
            background: 'none',
            border: 'none',
            color: 'var(--gold)',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer'
          }}
        >
          🔑 {t('lock_forgot_pin')}
        </button>
      </div>

      {/* Recovery Modal Sheet */}
      {showRecoveryModal && (
        <div className="sheet-overlay animate-fade-in" onClick={e => e.target === e.currentTarget && !isVerifying && setShowRecoveryModal(false)}>
          <div className="sheet animate-slide-up" style={{ textAlign: 'center', zIndex: 100000 }}>
            <div className="sheet-handle" />
            
            <h3 className="text-gold mb-12">{t('lock_recovery_title')}</h3>
            <p className="text-xs text-muted mb-24" style={{ lineHeight: 1.5, textAlign: 'left' }}>
              {t('lock_recovery_desc')}
            </p>
            
            <div className="flex-col gap-12">
              <button 
                className="btn btn-primary w-full btn-lg" 
                onClick={handleGoogleRecovery}
                disabled={isVerifying}
                style={{ background: 'var(--gold)', color: '#000', fontWeight: 800 }}
              >
                {isVerifying ? (
                  <><span className="nav-icon animate-spin">⟳</span> {t('cancel') === 'ரத்துசெய்' ? 'சரிபார்க்கப்படுகிறது...' : 'Verifying...'}</>
                ) : (
                  t('lock_recovery_btn')
                )}
              </button>
              
              <button 
                className="btn btn-ghost w-full" 
                onClick={() => setShowRecoveryModal(false)}
                disabled={isVerifying}
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
