import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';

export interface Devotee {
  id: string;
  name: string;
  phone: string;        // primary phone (with country code e.g. +91XXXXXXXXXX)
  phone2?: string;      // optional 2nd phone
  phone3?: string;      // optional 3rd phone
  country_code: string; // e.g. '+91'
  pincode?: string;     // postal / zip code
  address: string;
  city: string;
  location_lat?: number;
  location_lng?: number;
  location_accurate: boolean;
  gothram: string;
  category: string;
  subscription_start: string;
  subscription_end: string;
  annual_amount: number;
  amount_paid: number;
  prasadham_count: number;
  prasadham_override: boolean;
  created_at: string;
  updated_at: string;
}

export interface FamilyMember {
  id: string;
  devotee_id: string;
  name: string;
  nakshathiram: string;
  rasi: string;
}

export interface PaymentEntry {
  id: string;
  devotee_id: string;
  date: string;
  amount: number;
  note: string;
}

export interface Category {
  id: string;
  name: string;
  name_ta?: string;
  color?: string;
  is_builtin: boolean;
  sort_order: number;
}

export interface BroadcastLog {
  id: string;
  category_id: string;
  month: string;
  year: string;
  contact_count: number;
  timestamp: string;
  note?: string;
  template_id?: string;
  has_image?: boolean;
}

export interface AppSettings {
  key: string;
  value: unknown;
}

export interface AuthCache {
  email: string;
  name: string;
  picture: string;
  plan: 'free' | 'plus' | 'pro';
  real_expiry: string;
  verified_on: string;
  valid_until: string;
  signature: string;
}

export interface MessageTemplate {
  id: string;
  label: string;
  text: string;
}

interface KattalaiDB extends DBSchema {
  devotees:       { key: string; value: Devotee;       indexes: { by_city: string; by_category: string; by_status: string } };
  family_members: { key: string; value: FamilyMember;  indexes: { by_devotee: string } };
  payment_history:{ key: string; value: PaymentEntry;  indexes: { by_devotee: string } };
  categories:     { key: string; value: Category;      indexes: { by_sort: number } };
  broadcast_log:  { key: string; value: BroadcastLog;  indexes: { by_category: string } };
  settings:       { key: string; value: AppSettings };
  auth_cache:     { key: string; value: AuthCache };
  message_templates: { key: string; value: MessageTemplate };
}

let db: IDBPDatabase<KattalaiDB>;

export async function getDB() {
  if (db) return db;
  db = await openDB<KattalaiDB>('KattalaiDB', 3, {
    upgrade(db, oldVersion) {
      // ── Fresh install (oldVersion === 0) ───────────────────────
      if (oldVersion < 1) {
        // Devotees
        const devStore = db.createObjectStore('devotees', { keyPath: 'id' });
        devStore.createIndex('by_city',     'city',     { unique: false });
        devStore.createIndex('by_category', 'category', { unique: false });
        devStore.createIndex('by_status',   'subscription_end', { unique: false });

        // Family members
        const famStore = db.createObjectStore('family_members', { keyPath: 'id' });
        famStore.createIndex('by_devotee', 'devotee_id', { unique: false });

        // Payment history
        const payStore = db.createObjectStore('payment_history', { keyPath: 'id' });
        payStore.createIndex('by_devotee', 'devotee_id', { unique: false });

        // Categories
        const catStore = db.createObjectStore('categories', { keyPath: 'id' });
        catStore.createIndex('by_sort', 'sort_order', { unique: false });

        // Broadcast log
        const bcastStore = db.createObjectStore('broadcast_log', { keyPath: 'id' });
        bcastStore.createIndex('by_category', 'category_id', { unique: false });

        // Settings & Auth
        db.createObjectStore('settings',   { keyPath: 'key' });
        db.createObjectStore('auth_cache', { keyPath: 'email' });

        // Seed 27 Nakshathirams
        seedNakshathirams(catStore as any);
      }

      // ── v1 → v2 migration ─────────────────────────────────────
      if (oldVersion < 2) {
        // Ensure broadcast_log store exists (safe no-op if already created in v1 path)
        if (!db.objectStoreNames.contains('broadcast_log')) {
          const s = db.createObjectStore('broadcast_log', { keyPath: 'id' });
          s.createIndex('by_category', 'category_id', { unique: false });
        }
      }

      // ── v2 → v3 migration: Custom Templates ───────────────────
      if (oldVersion < 3) {
        if (!db.objectStoreNames.contains('message_templates')) {
          db.createObjectStore('message_templates', { keyPath: 'id' });
        }
      }
    },
  });
  return db;
}

function seedNakshathirams(store: any) {
  const nakshathirams = [
    ['Ashwini','அஸ்வினி'],['Bharani','பரணி'],['Karthigai','கார்த்திகை'],
    ['Rohini','ரோகிணி'],['Mirugaseeridam','மிருகசீரிஷம்'],['Thiruvathirai','திருவாதிரை'],
    ['Punarpusam','புனர்பூசம்'],['Pusam','பூசம்'],['Ayilyam','ஆயில்யம்'],
    ['Magha','மகம்'],['Pooram','பூரம்'],['Uttaram','உத்திரம்'],
    ['Hastham','ஹஸ்தம்'],['Chithirai','சித்திரை'],['Swathi','சுவாதி'],
    ['Visagam','விசாகம்'],['Anusham','அனுஷம்'],['Kettai','கேட்டை'],
    ['Moolam','மூலம்'],['Pooradam','பூராடம்'],['Uttaradam','உத்திராடம்'],
    ['Thiruvonam','திருவோணம்'],['Avittam','அவிட்டம்'],['Sathayam','சதயம்'],
    ['Poorattathi','பூரட்டாதி'],['Uttarattathi','உத்திரட்டாதி'],['Revathi','ரேவதி'],
  ];
  nakshathirams.forEach(([name, name_ta], i) => {
    store.put({
      id: `nk_${String(i+1).padStart(2,'0')}`,
      name, name_ta, color: undefined,
      is_builtin: true, sort_order: i + 1,
    });
  });
}

// ── CRUD helpers ──────────────────────────────────────────────

export async function getAllDevotees(): Promise<Devotee[]> {
  const db = await getDB();
  return db.getAll('devotees');
}

export async function getDevotee(id: string): Promise<Devotee | undefined> {
  const db = await getDB();
  return db.get('devotees', id);
}

export async function upsertDevotee(d: Devotee): Promise<void> {
  const db = await getDB();
  await db.put('devotees', { ...d, updated_at: new Date().toISOString() });
}

export async function deleteDevotee(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['devotees','family_members','payment_history'], 'readwrite');
  await tx.objectStore('devotees').delete(id);
  const fams = await tx.objectStore('family_members').index('by_devotee').getAll(id);
  for (const f of fams) await tx.objectStore('family_members').delete(f.id);
  const pays = await tx.objectStore('payment_history').index('by_devotee').getAll(id);
  for (const p of pays) await tx.objectStore('payment_history').delete(p.id);
  await tx.done;
}

export async function getFamilyMembers(devotee_id: string): Promise<FamilyMember[]> {
  const db = await getDB();
  return db.getAllFromIndex('family_members', 'by_devotee', devotee_id);
}

export async function upsertFamilyMember(m: FamilyMember): Promise<void> {
  const db = await getDB();
  await db.put('family_members', m);
}

export async function deleteFamilyMember(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('family_members', id);
}

export async function getPaymentHistory(devotee_id: string): Promise<PaymentEntry[]> {
  const db = await getDB();
  const entries = await db.getAllFromIndex('payment_history', 'by_devotee', devotee_id);
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

export async function addPayment(p: PaymentEntry): Promise<void> {
  const db = await getDB();
  await db.put('payment_history', p);
  // Update amount_paid on devotee
  const devotee = await db.get('devotees', p.devotee_id);
  if (devotee) {
    const history = await db.getAllFromIndex('payment_history', 'by_devotee', p.devotee_id);
    const total = history.reduce((s, e) => s + e.amount, 0);
    await db.put('devotees', { ...devotee, amount_paid: total, updated_at: new Date().toISOString() });
  }
}

export async function deletePayment(id: string, devotee_id: string): Promise<void> {
  const db = await getDB();
  await db.delete('payment_history', id);
  const devotee = await db.get('devotees', devotee_id);
  if (devotee) {
    const history = await db.getAllFromIndex('payment_history', 'by_devotee', devotee_id);
    const total = history.reduce((s, e) => s + e.amount, 0);
    await db.put('devotees', { ...devotee, amount_paid: total, updated_at: new Date().toISOString() });
  }
}

export async function getAllCategories(): Promise<Category[]> {
  const db = await getDB();
  const cats = await db.getAllFromIndex('categories', 'by_sort');
  return cats;
}

export async function upsertCategory(c: Category): Promise<void> {
  const db = await getDB();
  await db.put('categories', c);
}

export async function deleteCategory(id: string): Promise<void> {
  const db = await getDB();
  // Move devotees to uncategorised
  const devs = await db.getAllFromIndex('devotees', 'by_category', id);
  for (const d of devs) await db.put('devotees', { ...d, category: 'uncategorised' });
  await db.delete('categories', id);
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const db = await getDB();
  const s = await db.get('settings', key);
  return s ? (s.value as T) : fallback;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  await db.put('settings', { key, value });
}

export async function getAuthCache(): Promise<AuthCache | undefined> {
  const db = await getDB();
  const all = await db.getAll('auth_cache');
  return all[0];
}

export async function setAuthCache(cache: AuthCache): Promise<void> {
  const db = await getDB();
  await db.put('auth_cache', cache);
}

export async function clearAuthCache(): Promise<void> {
  const db = await getDB();
  await db.clear('auth_cache');
}

export async function getAllMessageTemplates(): Promise<MessageTemplate[]> {
  const db = await getDB();
  return db.getAll('message_templates');
}

export async function upsertMessageTemplate(t: MessageTemplate): Promise<void> {
  const db = await getDB();
  await db.put('message_templates', t);
}

export async function deleteMessageTemplate(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('message_templates', id);
}

export function generateId(prefix = 'DEV'): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
}

export function getPaymentStatus(devotee: Devotee): 'paid' | 'partial' | 'unpaid' {
  if (devotee.amount_paid >= devotee.annual_amount) return 'paid';
  if (devotee.amount_paid > 0) return 'partial';
  return 'unpaid';
}

export function getSubscriptionStatus(devotee: Devotee): 'active' | 'expiring' | 'expired' {
  const end = new Date(devotee.subscription_end);
  const now = new Date();
  const days = Math.ceil((end.getTime() - now.getTime()) / 86400000);
  if (days < 0) return 'expired';
  if (days <= 30) return 'expiring';
  return 'active';
}
