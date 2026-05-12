import { useEffect, useState, useRef } from 'react';
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
import { BulkImport } from './pages/BulkImport';
import { MapHub } from './pages/MapHub';
import { ContactDeveloper } from './pages/ContactDeveloper';
import { syncToGoogleDrive, getGoogleAccessToken, fetchLatestBackup, downloadBackup } from './utils/googleDrive';
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

  const [cloudUpdateAvailable, setCloudUpdateAvailable] = useState(false);
  const [syncPaused, setSyncPaused] = useState(false);
  const isPullingRef = useRef(false);
  const isInitialMountRef = useRef(true);

  useEffect(() => {
    // Skip the very first render trigger (which happens during loadDevotees)
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    // ── Mandatory Auto Sync Logic (Push to Cloud) ──
    // Block pushing if a conflict is waiting to be resolved
    if (!gDriveLinked || devotees.length === 0 || isPullingRef.current || cloudUpdateAvailable) return;

    const timer = setTimeout(async () => {
      try {
        const time = await syncToGoogleDrive(true);
        await setGDriveSetting('gDriveLastSync', time);
        setSyncPaused(false);
        console.log('✅ Background sync success (Pushed local edits)');
      } catch (e: any) {
        if (e.message === 'AUTH_REQUIRED') {
          setSyncPaused(true);
        } else {
          console.error('❌ Background sync failed', e);
        }
      }
    }, 5000); // 5 seconds debounce

    return () => clearTimeout(timer);
  }, [devotees, gDriveAutoSync, gDriveLinked, plan, setGDriveSetting, cloudUpdateAvailable]);

  useEffect(() => {
    // ── Real-time Polling (Pull from Cloud) ──
    if (!gDriveLinked || !user) return;
    let isChecking = false;

    const checkCloud = async () => {
      if (isChecking) return;
      isChecking = true;
      try {
        const token = await getGoogleAccessToken(true);
        setSyncPaused(false);
        const existing = await fetchLatestBackup(token);
        if (existing) {
           const localTime = useSettingsStore.getState().gDriveLastSync;
           // If we have no local sync time, OR cloud is newer, show banner
           if (!localTime || existing.modifiedTime > localTime) {
             setCloudUpdateAvailable(true);
           }
        }
      } catch (e: any) {
         if (e.message === 'AUTH_REQUIRED') {
           setSyncPaused(true);
         } else {
           console.error('Cloud polling error:', e);
         }
      } finally {
        isChecking = false;
      }
    };

    checkCloud(); // Fire immediately on app load
    const interval = setInterval(checkCloud, 60000); // Then every 60 seconds
    return () => clearInterval(interval);
  }, [gDriveLinked, user]);

  const handleCloudUpdate = async () => {
    setCloudUpdateAvailable(false);
    isPullingRef.current = true;
    showToast('Downloading updates...', 'info');
    try {
      const token = await getGoogleAccessToken(false);
      const existing = await fetchLatestBackup(token);
      if (existing) {
        const blob = await downloadBackup(token, existing.id);
        await restoreFromBackupBlob(blob);
        await loadDevotees();
        await loadCategories();
        await setGDriveSetting('gDriveLastSync', existing.modifiedTime);
        showToast('✅ App synced with other device!', 'success');
      }
    } catch (e: any) {
      showToast('Update failed', 'error');
    } finally {
      setTimeout(() => { isPullingRef.current = false; }, 2000);
    }
  };

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
          
          // Silent background plan refresh
          verifyAccess(cache.email).then(newCache => {
            if (newCache && newCache.plan !== cache.plan) {
              setCache(newCache);
            }
          }).catch(() => {});
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
      {/* ── NEW: Cloud Update Banner (Conflict Resolver) ── */}
      {cloudUpdateAvailable && !syncPaused && (
        <div style={{
          background: 'var(--gold)', color: '#000', padding: '16px',
          textAlign: 'center', fontWeight: 600, fontSize: '0.9rem',
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
          <div className="mb-8" style={{ marginBottom: '12px' }}>☁️ Difference detected! Another device updated the cloud.</div>
          <div className="flex-center gap-12 text-sm">
             <button 
                onClick={handleCloudUpdate}
                style={{ background: '#000', color: 'var(--gold)', border: 'none', padding: '6px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}
             >
                Keep Cloud Data
             </button>
             <button 
                onClick={async () => {
                   setCloudUpdateAvailable(false);
                   showToast('Pushing local data to cloud...', 'info');
                   try {
                     const time = await syncToGoogleDrive(true);
                     await setGDriveSetting('gDriveLastSync', time);
                   } catch(e) {}
                }}
                style={{ background: 'transparent', color: '#000', border: '1px solid #000', padding: '5px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}
             >
                Keep Local Data
             </button>
          </div>
        </div>
      )}

      {/* ── NEW: Sync Paused Banner ── */}
      {syncPaused && (
        <div style={{
          background: 'var(--red)', color: '#fff', padding: '10px 16px',
          textAlign: 'center', fontWeight: 600, fontSize: '0.85rem',
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12,
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
          <span>⚠️ Sync Paused (Session Expired)</span>
          <button 
            onClick={async () => {
              try {
                 await getGoogleAccessToken(false);
                 setSyncPaused(false);
              } catch (e) {}
            }}
            style={{ 
              background: '#fff', color: 'var(--red)', border: 'none', 
              padding: '4px 12px', borderRadius: 4, cursor: 'pointer', fontWeight: 700 
            }}>
            Reconnect
          </button>
        </div>
      )}

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
            <Route path="/bulk-import" element={<BulkImport />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
        </Route>
      </Routes>
      <ToastContainer />
    </BrowserRouter>
  );
}

export default App;
