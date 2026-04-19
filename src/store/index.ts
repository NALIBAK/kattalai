import { create } from 'zustand';
import { getAllDevotees, getAllCategories, getSetting, setSetting } from '../db';
import type { Devotee, Category, AuthCache } from '../db';

// ── Auth Store ─────────────────────────────────────────────────
interface AuthState {
  user: { email: string; name: string; picture: string } | null;
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
  setCache: (cache) => set({ cache, plan: cache.plan }),
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
  cities: string[];
  defaultAmount: number;
  prasadhamRule: 'per_member' | 'per_address';
  theme: 'light' | 'dark' | 'system';
  language: 'en' | 'ta';
  notifyDaysBefore: number;
  broadcastResetDay: number;
  whatsappTemplate: string;
  gDriveLinked: boolean;
  gDriveAutoSync: boolean;
  gDriveLastSync: string | null;
  loadSettings: () => Promise<void>;
  setTheme: (t: SettingsState['theme']) => void;
  setCities: (c: string[]) => void;
  setDefaultAmount: (a: number) => void;
  setWhatsappTemplate: (t: string) => void;
  updateSetting: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;
  setTempleName: (n: string) => Promise<void>;
  setGDriveSetting: (key: 'gDriveLinked' | 'gDriveAutoSync' | 'gDriveLastSync', value: any) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  templeName: 'Chidambaram Natarajar Temple',
  cities: ['Chidambaram'],
  defaultAmount: 1200,
  prasadhamRule: 'per_member',
  theme: 'system',
  language: 'en',
  notifyDaysBefore: 30,
  broadcastResetDay: 1,
  priority: 1,
  whatsappTemplate: 'Om Namah Shivaya! Dear {name},\n\nWe wanted to remind you that your Kattalai subscription of ₹{balance} is due on {expiry_date}. May Lord Shiva bless your family with prosperity.\n\n- Kattalai Admin',
  gDriveLinked: false,
  gDriveAutoSync: false,
  gDriveLastSync: null,
  loadSettings: async () => {
    // We only load these keys from DB, others use defaults if not found
    const templeName = await getSetting('temple_name', 'Sri Kattalai Temple');
    const cities = await getSetting('cities', ['Madurai', 'Chennai', 'Coimbatore', 'Trichy', 'Salem', 'Tirunelveli', 'Erode']);
    const defaultAmount = await getSetting('default_amount', 200);
    const prasadhamRule = await getSetting('prasadham_rule', 'per_member');
    const theme = await getSetting('theme', 'system');
    const language = await getSetting('language', 'en');
    const notifyDaysBefore = await getSetting('notify_days_before', 30);
    const broadcastResetDay = await getSetting('broadcast_reset_day', 1);
    const whatsappTemplate = await getSetting('whatsapp_template', 'Om Namah Shivaya! Dear {name},\n\nWe wanted to remind you that your Kattalai subscription of ₹{balance} is due on {expiry_date}. May Lord Shiva bless your family with prosperity.\n\n- Kattalai Admin');
    const gDriveLinked = await getSetting('gdrive_linked', false);
    const gDriveAutoSync = await getSetting('gdrive_autosync', false);
    const gDriveLastSync = await getSetting('gdrive_lastsync', null);
    
    set({ 
      templeName, cities, defaultAmount, prasadhamRule, theme, language, 
      notifyDaysBefore, broadcastResetDay, whatsappTemplate,
      gDriveLinked, gDriveAutoSync, gDriveLastSync
    } as any);
  },
  setTheme: (t) => set({ theme: t }),
  setCities: async (c) => {
    set({ cities: c });
    await setSetting('cities', c);
  },
  setDefaultAmount: async (a) => {
    set({ defaultAmount: a });
    await setSetting('default_amount', a);
  },
  setWhatsappTemplate: async (t) => {
    set({ whatsappTemplate: t });
    await setSetting('whatsapp_template', t);
  },
  updateSetting: (key, value) => set((s) => ({ ...s, [key]: value })),
  setTempleName: async (n) => {
    set({ templeName: n });
    await setSetting('temple_name', n);
  },
  setGDriveSetting: async (key, value) => {
    set({ [key]: value } as any);
    const dbKey = key === 'gDriveLinked' ? 'gdrive_linked' : key === 'gDriveAutoSync' ? 'gdrive_autosync' : 'gdrive_lastsync';
    await setSetting(dbKey, value);
  },
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
