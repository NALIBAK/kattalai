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
import { syncToGoogleDrive, getGoogleAccessToken, getFolderId, fetchLatestBackup, downloadBackup } from './utils/googleDrive';
import { restoreFromBackupBlob } from './utils/backup';
import { GDriveGate } from './components/GDriveGate';

import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/AppLayout';
import { ToastContainer } from './components/ToastContainer';
import { Profile } from './pages/Profile';
import { verifyAccess } from './auth';
import { useToastStore } from './store';

function App() {
  const { setCache, setLoading, plan, user } = useAuthStore();
  const { showToast } = useToastStore();
  const { loadSettings, theme: appTheme, gDriveAutoSync, gDriveLinked, setGDriveSetting } = useSettingsStore();
  const { loadCategories } = useCategoryStore();
  const { devotees, load: loadDevotees } = useDevoteeStore();

  useEffect(() => {
    // ── Mandatory Auto Sync Logic (5s delay) ──
    if (!gDriveLinked || devotees.length === 0) return;

    const timer = setTimeout(async () => {
      try {
        const time = await syncToGoogleDrive();
        await setGDriveSetting('gDriveLastSync', time);
        console.log('✅ Background sync success');
      } catch (e: any) {
        console.error('❌ Background sync failed', e);
      }
    }, 5000); // 5 seconds debounce

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
          
          // Silent refresh in background
          verifyAccess(cache.email).then(newCache => {
            if (newCache && newCache.plan !== cache.plan) {
              setCache(newCache);
            }
          }).catch(() => {});

          // ── Silent Cloud Restore on Init if Local DB Empty ──
          const currentDevotees = useDevoteeStore.getState().devotees;
          if (currentDevotees.length === 0) {
            try {
              const token = await getGoogleAccessToken();
              const folderId = await getFolderId(token);
              const latestFileId = await fetchLatestBackup(token, folderId);
              
              if (latestFileId) {
                console.log('📦 Found cloud backup, restoring silently...');
                const blob = await downloadBackup(token, latestFileId);
                await restoreFromBackupBlob(blob);
                await loadDevotees();
                await loadCategories();
                showToast('Welcome back! Your data has been synced from the cloud.', 'success');
              }
            } catch (err) {
              console.error("Cloud restore failed", err);
            }
          }
        }
      } catch (e) {
        console.error("Init error", e);
      } finally {
        setLoading(false);
      }
    };
    initApp();
  }, [setCache, setLoading, loadSettings, loadCategories, showToast]);

  useEffect(() => {
    // 24-hour auto-refresh interval
    if (!user?.email) return;
    
    const interval = setInterval(async () => {
      try {
        const newCache = await verifyAccess(user.email);
        if (newCache && newCache.plan !== plan) {
          setCache(newCache);
          showToast(`Subscription updated to ${newCache.plan.toUpperCase()}!`, 'success');
        }
      } catch (e) {
        console.error("Interval refresh failed", e);
      }
    }, 24 * 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user?.email, plan, setCache, showToast]);

  useEffect(() => {
    // Apply theme
    document.documentElement.setAttribute('data-theme', appTheme);
  }, [appTheme]);

  return (
    <BrowserRouter basename="/kattalai">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/pending" element={<PendingApproval />} />
        <Route path="/contact" element={<ContactDeveloper />} />
        
        {/* Protected app routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<GDriveGate><AppLayout /></GDriveGate>}>
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
            <Route path="/profile" element={<Profile />} />
          </Route>
        </Route>
      </Routes>
      <ToastContainer />
    </BrowserRouter>
  );
}

export default App;
