import CryptoJS from 'crypto-js';
import { setAuthCache, clearAuthCache, getAuthCache } from '../db';
import type { AuthCache } from '../db';

const HMAC_SECRET = import.meta.env.VITE_HMAC_SECRET || 'dev_secret_kattalai_2026';
const SHEET_API_KEY = import.meta.env.VITE_SHEETS_API_KEY || '';
const SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID || '';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

// ── HMAC signing ──────────────────────────────────────────────────────────────
function signCache(data: Omit<AuthCache, 'signature'>): string {
  const payload = `${data.email}|${data.plan}|${data.verified_on}|${data.valid_until}|${data.real_expiry}|${data.name}|${data.picture}`;
  return CryptoJS.HmacSHA256(payload, HMAC_SECRET).toString();
}

function verifyCache(cache: AuthCache): boolean {
  const expected = signCache(cache);
  return expected === cache.signature;
}

// ── Google Sign-In ────────────────────────────────────────────────────────────
export function initGoogleAuth(): Promise<void> {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
}

export function signInWithGoogle(): Promise<{ email: string; name: string; picture: string }> {
  return new Promise((resolve, reject) => {
    if (!(window as any).google) { reject(new Error('Google not loaded')); return; }
    (window as any).google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response: any) => {
        if (!response.credential) { reject(new Error('No credential')); return; }
        // Decode JWT payload
        const payload = JSON.parse(atob(response.credential.split('.')[1]));
        resolve({ email: payload.email, name: payload.name, picture: payload.picture });
      },
    });
    (window as any).google.accounts.id.prompt((notification: any) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        // Show the button if one-tap fails
        (window as any).google.accounts.id.renderButton(
          document.getElementById('google-signin-btn'),
          { theme: 'filled_black', size: 'large', width: 280, text: 'signin_with' }
        );
      }
    });
  });
}

// ── Google Sheet access control ───────────────────────────────────────────────
interface SheetRow { email: string; plan: 'free' | 'plus' | 'pro'; expiry: string; }

async function fetchApprovedUsers(): Promise<SheetRow[]> {
  if (!SHEET_ID || !SHEET_API_KEY) {
    // DEV MODE: return a dummy approved user for testing
    return [{ email: 'sskabilan2004@gmail.com', plan: 'pro', expiry: '2099-12-31' }];
  }
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Sheet1?key=${SHEET_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  const rows: string[][] = data.values?.slice(1) || []; // skip header
  return rows.map(([email, plan, expiry]) => ({
    email: email?.trim().toLowerCase(),
    plan: (plan?.trim().toLowerCase() || 'free') as 'free' | 'plus' | 'pro',
    expiry: expiry?.trim() || '2099-12-31',
  }));
}

// ── Main auth verification ────────────────────────────────────────────────────
export async function verifyAccess(email: string, name?: string, picture?: string): Promise<AuthCache | null> {
  try {
    const users = await fetchApprovedUsers();
    const user = users.find(u => u.email === email.toLowerCase());
    if (!user) return null;

    // Check expiry from sheet
    if (new Date(user.expiry) < new Date()) return null;

    const existing = await getAuthCache();
    
    const today = new Date().toISOString().split('T')[0];
    const validUntil = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    const cacheData: Omit<AuthCache, 'signature'> = { 
      email, 
      name: name || existing?.name || 'User',
      picture: picture || existing?.picture || '',
      plan: user.plan, 
      real_expiry: user.expiry,
      verified_on: today, 
      valid_until: validUntil 
    };
    
    const signature = signCache(cacheData);
    const cache: AuthCache = { ...cacheData, signature };

    await setAuthCache(cache);
    return cache;
  } catch (error) {
    console.error('VerifyAccess error', error);
    return null;
  }
}

// ── Offline cache check ───────────────────────────────────────────────────────
export function validateCachedAuth(cache: AuthCache): 'valid' | 'grace' | 'expired' {
  if (!verifyCache(cache)) return 'expired'; // tampered

  const today = new Date();
  const validUntil = new Date(cache.valid_until);
  const gracePeriod = new Date(validUntil.getTime() + 7 * 86400000);

  if (today <= validUntil) return 'valid';
  if (today <= gracePeriod) return 'grace';
  return 'expired';
}

export function isPlanAllowed(userPlan: string, required: 'free' | 'plus' | 'pro'): boolean {
  const order = { free: 0, plus: 1, pro: 2 };
  return (order[userPlan as keyof typeof order] ?? -1) >= order[required];
}

export async function logout(): Promise<void> {
  if ((window as any).google) {
    (window as any).google.accounts.id.disableAutoSelect();
  }
  await clearAuthCache();
}
