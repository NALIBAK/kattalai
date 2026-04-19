import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useAuthStore, useSettingsStore, useCategoryStore, useDevoteeStore } from './store';
import { getAuthCache } from './db';

import { Login } from './pages/Login';
import { PendingApproval } from './pages/PendingApproval';
import { Dashboard } from './pages/Dashboard';
import { DevoteesList } from './pages/DevoteesList';
import { DevoteeForm } from './pages/DevoteeForm';
import { DevoteeDetail } from './pages/DevoteeDetail';
import { DevoteePayments } from './pages/DevoteePayments';
import { Broadcast } from './pages/Broadcast';
import { CoverPrint } from './pages/CoverPrint';
import { Settings } from './pages/Settings';
import { ManageCategories } from './pages/ManageCategories';
import { MapHub } from './pages/MapHub';
import { ContactDeveloper } from './pages/ContactDeveloper';
import { AppLock } from './components/AppLock';
import { syncToGoogleDrive } from './utils/googleDrive';

import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/AppLayout';
import { ToastContainer } from './components/ToastContainer';

function App() {
  const { setCache, setLoading, plan } = useAuthStore();
  const { loadSettings, theme: appTheme, gDriveAutoSync, gDriveLinked, setGDriveSetting } = useSettingsStore();
  const { loadCategories } = useCategoryStore();
  const { devotees, load: loadDevotees } = useDevoteeStore();

  useEffect(() => {
    // ── Auto Sync Logic ──
    if (!gDriveAutoSync || !gDriveLinked || plan !== 'pro' || devotees.length === 0) return;

    const timer = setTimeout(async () => {
      try {
        const time = await syncToGoogleDrive();
        await setGDriveSetting('gDriveLastSync', time);
        console.log('✅ Auto-synced to Google Drive');
      } catch (e: any) {
        console.error('❌ Auto-sync failed', e);
      }
    }, 60000); // 1 minute debounce

    return () => clearTimeout(timer);
  }, [devotees.length, gDriveAutoSync, gDriveLinked, plan, setGDriveSetting]);

  useEffect(() => {
    // Initial app load: check cache
    const initApp = async () => {
      try {
        await loadSettings();
        await loadCategories();
        await loadDevotees();
        const cache = await getAuthCache();
        if (cache) {
          setCache(cache);
        }
      } catch (e) {
        console.error("Init error", e);
      } finally {
        setLoading(false);
      }
    };
    initApp();
  }, [setCache, setLoading, loadSettings, loadCategories]);

  useEffect(() => {
    // Apply theme
    const root = document.documentElement;
    if (appTheme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', isDark ? 'dark' : 'light');
    } else {
      root.setAttribute('data-theme', appTheme);
    }
  }, [appTheme]);

  return (
    <BrowserRouter basename="/kattalai">
      <AppLock>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/pending" element={<PendingApproval />} />
          <Route path="/contact" element={<ContactDeveloper />} />
          
          {/* Protected app routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/devotees" element={<DevoteesList />} />
              <Route path="/map" element={<MapHub />} />
              <Route path="/devotees/new" element={<DevoteeForm />} />
              <Route path="/devotees/:id" element={<DevoteeDetail />} />
              <Route path="/devotees/:id/edit" element={<DevoteeForm />} />
              <Route path="/devotees/:id/payments" element={<DevoteePayments />} />
              <Route path="/broadcast" element={<Broadcast />} />
              <Route path="/cover-print" element={<CoverPrint />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/settings/categories" element={<ManageCategories />} />
            </Route>
          </Route>
        </Routes>
        <ToastContainer />
      </AppLock>
    </BrowserRouter>
  );
}

export default App;
