import { create } from 'zustand';
import { 
  getAllDevotees, getAllCategories, getSetting, setSetting, 
  getAllMessageTemplates, upsertMessageTemplate, deleteMessageTemplate 
} from '../db';
import type { Devotee, Category, AuthCache, MessageTemplate } from '../db';

// ── Auth Store ─────────────────────────────────────────────────
interface AuthState {
  user: { email: string; name: string; picture: string; real_expiry?: string } | null;
  cache: AuthCache | null;
  plan: 'free' | 'plus' | 'pro' | null;
  isLoading: boolean;
  setUser: (u: AuthState['user']) => void;
  setCache: (c: AuthCache) => void;
  setPlan: (p: AuthState['plan']) => void;
  setLoading: (b: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  cache: null,
  plan: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setCache: (cache) => set({ 
    cache, 
    plan: cache.plan, 
    user: { 
      email: cache.email, 
      name: cache.name, 
      picture: cache.picture,
      real_expiry: cache.real_expiry
    } 
  }),
  setPlan: (plan) => set({ plan }),
  setLoading: (isLoading) => set({ isLoading }),
  logout: () => set({ user: null, cache: null, plan: null }),
}));

// ── Devotee Store ──────────────────────────────────────────────
interface DevoteeState {
  devotees: Devotee[];
  loading: boolean;
  searchQuery: string;
  filterCity: string;
  filterPayment: '' | 'paid' | 'partial' | 'unpaid';
  filterStatus: '' | 'active' | 'expiring' | 'expired';
  sortOption: 'name_asc' | 'expiry_desc' | 'payment_desc';
  load: () => Promise<void>;
  setSearch: (q: string) => void;
  setFilterCity: (c: string) => void;
  setFilterPayment: (f: DevoteeState['filterPayment']) => void;
  setFilterStatus: (f: DevoteeState['filterStatus']) => void;
  setSortOption: (s: DevoteeState['sortOption']) => void;
  refresh: () => Promise<void>;
}

export const useDevoteeStore = create<DevoteeState>((set) => ({
  devotees: [],
  loading: false,
  searchQuery: '',
  filterCity: '',
  filterPayment: '',
  filterStatus: '',
  sortOption: 'name_asc',
  load: async () => {
    set({ loading: true });
    const devotees = await getAllDevotees();
    set({ devotees, loading: false });
  },
  refresh: async () => {
    const devotees = await getAllDevotees();
    set({ devotees });
  },
  setSearch: (searchQuery) => set({ searchQuery }),
  setFilterCity: (filterCity) => set({ filterCity }),
  setFilterPayment: (filterPayment) => set({ filterPayment }),
  setFilterStatus: (filterStatus) => set({ filterStatus }),
  setSortOption: (sortOption) => set({ sortOption }),
}));

// ── Category Store ─────────────────────────────────────────────
interface CategoryState {
  categories: Category[];
  loadCategories: () => Promise<void>;
}

export const useCategoryStore = create<CategoryState>((set) => ({
  categories: [],
  loadCategories: async () => {
    const categories = await getAllCategories();
    set({ categories });
  },
}));

// ── Settings Store ─────────────────────────────────────────────
interface SettingsState {
  templeName: string;
  templeAddress: string;
  defaultAmount: number;
  prasadhamRule: 'per_member' | 'per_address';
  theme: 'light' | 'dark';
  language: 'en' | 'ta';
  notifyDaysBefore: number;
  broadcastResetDay: number;
  messageTemplates: MessageTemplate[];
  gDriveLinked: boolean;
  gDriveAutoSync: boolean;
  gDriveLastSync: string | null;
  appLockEnabled: boolean;
  appLockPinHash: string;
  appLockBiometricsEnabled: boolean;
  appLockBiometricCredId: string;
  isLocked: boolean;
  setAppLock: (enabled: boolean, pinHash: string) => Promise<void>;
  setBiometricsEnabled: (enabled: boolean, credId?: string) => Promise<void>;
  lockApp: () => void;
  unlockApp: () => void;
  loadSettings: () => Promise<void>;
  setTheme: (t: SettingsState['theme']) => void;
  setDefaultAmount: (a: number) => void;
  updateSetting: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;
  setTempleName: (n: string) => Promise<void>;
  setTempleAddress: (a: string) => Promise<void>;
  setLanguage: (l: 'en' | 'ta') => Promise<void>;
  setGDriveSetting: (key: 'gDriveLinked' | 'gDriveAutoSync' | 'gDriveLastSync', value: boolean | string | null) => Promise<void>;
  
  // Template Actions
  addTemplate: (label: string, text: string) => Promise<void>;
  updateTemplate: (t: MessageTemplate) => Promise<void>;
  removeTemplate: (id: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  templeName: 'Chidambaram Natarajar Temple',
  templeAddress: '',
  defaultAmount: 1200,
  prasadhamRule: 'per_member',
  theme: 'dark',
  language: 'ta',
  notifyDaysBefore: 30,
  broadcastResetDay: 1,
  messageTemplates: [],
  gDriveLinked: false,
  gDriveAutoSync: false,
  gDriveLastSync: null,
  appLockEnabled: false,
  appLockPinHash: '',
  appLockBiometricsEnabled: false,
  appLockBiometricCredId: '',
  isLocked: false,
  loadSettings: async () => {
    const templeName = await getSetting('temple_name', 'Sri Kattalai Temple');
    const templeAddress = await getSetting('temple_address', '');
    const defaultAmount = await getSetting('default_amount', 200);
    const prasadhamRule = await getSetting('prasadham_rule', 'per_member');
    let theme = await getSetting('theme', 'dark') as string;
    if (theme === 'system') theme = 'dark'; // Migrate away from system
    
    const language = await getSetting('language', 'ta');
    const notifyDaysBefore = await getSetting('notify_days_before', 30);
    const broadcastResetDay = await getSetting('broadcast_reset_day', 1);
    const gDriveLinked = await getSetting('gdrive_linked', false);
    const gDriveAutoSync = await getSetting('gdrive_autosync', false);
    const gDriveLastSync = await getSetting('gdrive_lastsync', null);
    const appLockEnabled = await getSetting('app_lock_enabled', false);
    const appLockPinHash = await getSetting('app_lock_pin_hash', '');
    const appLockBiometricsEnabled = await getSetting('app_lock_biometrics_enabled', false);
    const appLockBiometricCredId = await getSetting('app_lock_biometric_cred_id', '');
    
    let templates = await getAllMessageTemplates();
    
    // Seed default templates if empty
    if (templates.length === 0) {
      const defaults: MessageTemplate[] = [
        { id: 't1', label: '🔔 Renewal Reminder', text: 'Om Namah Shivaya! 🙏\nVanakkam {name},\n\nYour Kattalai subscription of ₹{balance} is due on {expiry_date}. Kindly renew at your earliest convenience.\n\nMay Lord Shiva bless your family!\n— Kattalai Admin' },
        { id: 't2', label: '⚠️ Overdue Alert', text: '🙏 Dear {name},\n\nThis is a gentle reminder that your Kattalai subscription balance of ₹{balance} is overdue as of {expiry_date}.\n\nPlease contact us to renew your blessings.\n\n— Kattalai Admin' },
        { id: 't3', label: '🙏 Thank You', text: '🙏 Dear {name},\n\nThank you for your generous contribution to Kattalai. Your support helps continue our spiritual services. May Lord Nataraja shower his blessings on you and your family! 🌸' }
      ];
      for (const t of defaults) await upsertMessageTemplate(t);
      templates = defaults;
    }
    
    set({ 
      templeName, templeAddress, defaultAmount, prasadhamRule, theme: theme as SettingsState['theme'], language, 
      notifyDaysBefore, broadcastResetDay,
      messageTemplates: templates,
      gDriveLinked, gDriveAutoSync, gDriveLastSync,
      appLockEnabled, appLockPinHash, appLockBiometricsEnabled, appLockBiometricCredId,
      isLocked: appLockEnabled
    } as unknown as Partial<SettingsState>);
  },
  setTheme: async (t) => {
    set({ theme: t });
    await setSetting('theme', t);
  },
  setDefaultAmount: async (a) => {
    set({ defaultAmount: a });
    await setSetting('default_amount', a);
  },
  updateSetting: (key, value) => set((s) => ({ ...s, [key]: value })),
  setTempleName: async (n) => {
    set({ templeName: n });
    await setSetting('temple_name', n);
  },
  setTempleAddress: async (a) => {
    set({ templeAddress: a });
    await setSetting('temple_address', a);
  },
  setLanguage: async (l) => {
    set({ language: l });
    await setSetting('language', l);
  },
  setGDriveSetting: async (key, value) => {
    set({ [key]: value } as unknown as Partial<SettingsState>);
    const dbKey = key === 'gDriveLinked' ? 'gdrive_linked' : key === 'gDriveAutoSync' ? 'gdrive_autosync' : 'gdrive_lastsync';
    await setSetting(dbKey, value);
  },
  setAppLock: async (enabled, pinHash) => {
    set({ appLockEnabled: enabled, appLockPinHash: pinHash, isLocked: false });
    await setSetting('app_lock_enabled', enabled);
    await setSetting('app_lock_pin_hash', pinHash);
  },
  setBiometricsEnabled: async (enabled, credId = '') => {
    set({ appLockBiometricsEnabled: enabled, appLockBiometricCredId: credId });
    await setSetting('app_lock_biometrics_enabled', enabled);
    await setSetting('app_lock_biometric_cred_id', credId);
  },
  lockApp: () => set({ isLocked: true }),
  unlockApp: () => set({ isLocked: false }),
  
  addTemplate: async (label, text) => {
    const newTemplate: MessageTemplate = {
      id: `tmpl_${Date.now()}`,
      label,
      text
    };
    await upsertMessageTemplate(newTemplate);
    set({ messageTemplates: [...get().messageTemplates, newTemplate] });
  },
  updateTemplate: async (t) => {
    await upsertMessageTemplate(t);
    set({ messageTemplates: get().messageTemplates.map(tmp => tmp.id === t.id ? t : tmp) });
  },
  removeTemplate: async (id) => {
    await deleteMessageTemplate(id);
    set({ messageTemplates: get().messageTemplates.filter(t => t.id !== id) });
  }
}));

// ── Toast Store ────────────────────────────────────────────────
interface Toast { id: string; message: string; type: 'success' | 'error' | 'info'; }
interface ToastState {
  toasts: Toast[];
  showToast: (message: string, type?: Toast['type']) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  showToast: (message, type = 'info') => {
    const id = Date.now().toString();
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter(t => t.id !== id) })), 3000);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}));
