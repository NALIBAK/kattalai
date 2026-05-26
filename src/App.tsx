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
import { RecycleBin } from './pages/RecycleBin';
import { BulkImport } from './pages/BulkImport';
import { MapHub } from './pages/MapHub';
import { ContactDeveloper } from './pages/ContactDeveloper';
import { syncToGoogleDrive, getGoogleAccessToken, fetchLatestBackup, downloadBackup } from './utils/googleDrive';
import { restoreFromBackupBlob, previewBackupBlob } from './utils/backup';
import { GDriveGate } from './components/GDriveGate';
import { isPushBlocked, blockPush } from './utils/syncLock';

import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/AppLayout';
import { ToastContainer } from './components/ToastContainer';
import { Profile } from './pages/Profile';
import { UpgradePlan } from './pages/UpgradePlan';
import { SubscriptionExpired } from './pages/SubscriptionExpired';
import { verifyAccess } from './auth';
import { clearAuthCache } from './db';
import { useToastStore } from './store';

function App() {
  const { setCache, setLoading, plan, user } = useAuthStore();
  const { showToast } = useToastStore();
  const { loadSettings, theme: appTheme, gDriveAutoSync, gDriveLinked, setGDriveSetting } = useSettingsStore();
  const { loadCategories } = useCategoryStore();
  const { devotees, load: loadDevotees } = useDevoteeStore();

  const [cloudUpdateAvailable, setCloudUpdateAvailable] = useState(false);
  const [cloudDevoteeCount, setCloudDevoteeCount] = useState<number | null>(null);
  const [syncPaused, setSyncPaused] = useState(false);
  const isPullingRef = useRef(false);

  useEffect(() => {
    // ── Mandatory Auto Sync Logic (Push to Cloud) ──
    // ONLY pushes when the user has actually edited something.
    // isPushBlocked() returns true on app load and after any pull/restore.
    if (!gDriveLinked || devotees.length === 0 || isPullingRef.current || cloudUpdateAvailable || isPushBlocked()) return;

    const timer = setTimeout(async () => {
      // Double-check the lock hasn't been set while we waited
      if (isPushBlocked() || isPullingRef.current) return;
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
             // Fetch cloud devotee count for the banner
             try {
               const blob = await downloadBackup(token, existing.id);
               const preview = await previewBackupBlob(blob);
               setCloudDevoteeCount(preview.devoteeCount);
             } catch { setCloudDevoteeCount(null); }
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
    blockPush(); // Lock auto-push
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
        showToast('✅ App synced with cloud!', 'success');
      }
    } catch (e: any) {
      showToast('Update failed', 'error');
    } finally {
      // Keep push blocked for 15 seconds to prevent race conditions
      setTimeout(() => { isPullingRef.current = false; }, 15000);
    }
  };

  useEffect(() => {
    // Initial app load: check cache & ALWAYS re-verify against sheet
    const initApp = async () => {
      try {
        await loadSettings();
        await loadCategories();
        await loadDevotees();
        const cache = await getAuthCache();
        if (cache) {
          setCache(cache);
          
          // Always re-verify against the Google Sheet on every app load
          verifyAccess(cache.email, cache.name, cache.picture).then(async newCache => {
            if (newCache) {
              // Always update cache with latest data from sheet
              setCache(newCache);
            } else {
              // User removed from sheet — clear cache and force login
              await clearAuthCache();
              useAuthStore.getState().logout();
            }
          }).catch(() => {
            // Offline — keep existing cache (will be validated by ProtectedRoute)
            console.log('[App] Offline: using cached auth');
          });
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
    // Periodic auto-refresh interval (every 4 hours)
    if (!user?.email) return;
    
    const interval = setInterval(async () => {
      try {
        const newCache = await verifyAccess(user.email);
        if (newCache) {
          const oldPlan = useAuthStore.getState().cache?.plan;
          setCache(newCache);
          if (oldPlan && oldPlan !== newCache.plan) {
            showToast(`Subscription updated to ${newCache.plan.toUpperCase()}!`, 'success');
          }
        } else {
          // User removed from sheet
          await clearAuthCache();
          useAuthStore.getState().logout();
        }
      } catch (e) {
        console.error("Interval refresh failed", e);
      }
    }, 4 * 60 * 60 * 1000); // Every 4 hours

    return () => clearInterval(interval);
  }, [user?.email, plan, setCache, showToast]);

  useEffect(() => {
    // Apply theme
    document.documentElement.setAttribute('data-theme', appTheme);
  }, [appTheme]);

  return (
    <BrowserRouter basename="/kattalai">
      {/* ── Cloud Update Banner (Conflict Resolver) ── */}
      {cloudUpdateAvailable && !syncPaused && (
        <div style={{
          background: 'var(--gold)', color: '#000', padding: '16px',
          textAlign: 'center', fontWeight: 600, fontSize: '0.9rem',
          zIndex: 10000, position: 'relative'
        }}>
          <div style={{ marginBottom: '12px' }}>
            ☁️ Cloud has a different version
          </div>
          <div style={{ marginBottom: '12px', fontSize: '0.82rem', fontWeight: 400, lineHeight: 1.5 }}>
            📱 <b>This device:</b> {devotees.length} devotees
            <br/>
            ☁️ <b>Cloud:</b> {cloudDevoteeCount !== null ? `${cloudDevoteeCount} devotees` : 'unknown count'}
          </div>
          <div className="flex-center gap-12 text-sm">
             <button 
                onClick={handleCloudUpdate}
                style={{ background: '#000', color: 'var(--gold)', border: 'none', padding: '8px 20px', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}
             >
                ☁️ Use Cloud ({cloudDevoteeCount ?? '?'})
             </button>
             <button 
                onClick={async () => {
                   setCloudUpdateAvailable(false);
                   showToast('Pushing local data to cloud...', 'info');
                   try {
                     const time = await syncToGoogleDrive(false);
                     await setGDriveSetting('gDriveLastSync', time);
                   } catch(e) {}
                }}
                style={{ background: 'transparent', color: '#000', border: '1px solid #000', padding: '7px 20px', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}
             >
                📱 Use Local ({devotees.length})
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
          zIndex: 10000, position: 'relative'
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
        <Route path="/expired" element={<SubscriptionExpired />} />
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
            <Route path="/settings/recycle-bin" element={<RecycleBin />} />
            <Route path="/bulk-import" element={<BulkImport />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/upgrade" element={<UpgradePlan />} />
          </Route>
        </Route>
      </Routes>
      <ToastContainer />
    </BrowserRouter>
  );
}

export default App;
