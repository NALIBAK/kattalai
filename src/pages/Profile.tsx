import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useToastStore, useDevoteeStore, useCategoryStore, useSettingsStore } from '../store';
import { verifyAccess } from '../auth';
import { getGoogleAccessToken, fetchLatestBackup, fetchLegacyBackup, downloadBackup, syncToGoogleDrive } from '../utils/googleDrive';
import { restoreFromBackupBlob, previewBackupBlob } from '../utils/backup';
import { blockPush } from '../utils/syncLock';
import type { Devotee } from '../db';

export function Profile() {
  const navigate = useNavigate();
  const { user, plan, setCache, logout } = useAuthStore();
  const { showToast } = useToastStore();
  const { refresh: refreshDevotees } = useDevoteeStore();
  const { loadCategories } = useCategoryStore();
  const { setGDriveSetting } = useSettingsStore();
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  if (!user) return null;

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      const newCache = await verifyAccess(user.email);
      
      if (newCache) {
        const oldPlan = plan;
        setCache(newCache);
        
        if (oldPlan !== newCache.plan) {
          showToast(`Subscription updated to ${newCache.plan.toUpperCase()}!`, 'success');
        } else {
          showToast('Subscription status is up to date.', 'success');
        }
      } else {
        showToast('Failed to refresh subscription. Please login again.', 'error');
      }
    } catch {
      showToast('Connection error during refresh.', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // ── Helper to compare devotees ──
  const compareDevotees = (source: Devotee[], target: Devotee[]) => {
    const targetMap = new Map(target.map(d => [d.id, d]));
    const sourceMap = new Map(source.map(d => [d.id, d]));
    const added: string[] = [];
    const removed: string[] = [];
    const changed: string[] = [];
    
    for (const s of source) {
      const t = targetMap.get(s.id);
      if (!t) added.push(s.name);
      else if (s.updated_at !== t.updated_at) changed.push(s.name);
    }
    for (const t of target) {
      if (!sourceMap.has(t.id)) removed.push(t.name);
    }
    return { added, removed, changed };
  };

  const truncate = (arr: string[]) => arr.length > 5 ? `${arr.slice(0, 5).join(', ')} ...and ${arr.length - 5} more` : arr.join(', ');

  const handlePush = async () => {
    setIsPushing(true);
    try {
      showToast('Connecting to Google Drive...', 'info');
      const token = await getGoogleAccessToken();
      const existing = await fetchLatestBackup(token);
      let cloudDevotees: Devotee[] = [];
      
      if (existing) {
        showToast('Fetching cloud version for comparison...', 'info');
        const blob = await downloadBackup(token, existing.id);
        const cloudPreview = await previewBackupBlob(blob);
        cloudDevotees = cloudPreview.rawData.devotees || [];
      }
      
      const localDevotees = useDevoteeStore.getState().devotees;
      const { added, removed, changed } = compareDevotees(localDevotees, cloudDevotees);
      
      let msg = 'Pushing your local data to the cloud will result in:\n\n';
      if (added.length) msg += `➕ Add: ${truncate(added)}\n`;
      if (removed.length) msg += `🗑️ Remove: ${truncate(removed)}\n`;
      if (changed.length) msg += `✏️ Update: ${truncate(changed)}\n`;
      
      if (!added.length && !removed.length && !changed.length) {
        msg = 'Local and Cloud data appear to be identical.\n\nForce Push anyway?';
      } else {
        msg += '\nAre you sure you want to OVERWRITE the cloud with local data?';
      }
      
      if (!window.confirm(msg)) return;
      
      showToast('Pushing to cloud...', 'info');
      const time = await syncToGoogleDrive(false);
      await setGDriveSetting('gDriveLastSync', time);
      showToast('✅ Push successful! Cloud now has your local data.', 'success');
    } catch(e) {
      const err = e as { message?: string };
      showToast(err.message || 'Push failed', 'error');
    } finally {
      setIsPushing(false);
    }
  };

  const handlePull = async () => {
    setIsPulling(true);
    blockPush(); // Prevent auto-push from racing with this pull
    try {
      showToast('Connecting to Google Drive...', 'info');
      const token = await getGoogleAccessToken();
      const existing = await fetchLatestBackup(token);
      
      let existingFileId: string | null | undefined = existing?.id;
      let isLegacy = false;

      if (!existingFileId) {
        existingFileId = await fetchLegacyBackup(token);
        if (existingFileId) isLegacy = true;
      }

      if (!existingFileId) {
        showToast('No cloud backup found for this account.', 'error');
        return;
      }
      
      showToast('Fetching cloud version for comparison...', 'info');
      const blob = await downloadBackup(token, existingFileId);
      const cloudPreview = await previewBackupBlob(blob);
      const cloudDevotees: Devotee[] = cloudPreview.rawData.devotees || [];
      const localDevotees = useDevoteeStore.getState().devotees;
      
      const { added, removed, changed } = compareDevotees(cloudDevotees, localDevotees);
      
      let msg = 'Pulling from the cloud will result in:\n\n';
      if (added.length) msg += `➕ Add: ${truncate(added)}\n`;
      if (removed.length) msg += `🗑️ Remove: ${truncate(removed)}\n`;
      if (changed.length) msg += `✏️ Update: ${truncate(changed)}\n`;
      
      if (!added.length && !removed.length && !changed.length) {
        msg = 'Cloud and Local data appear to be identical.\n\nForce Pull anyway?';
      } else {
        msg += '\nAre you sure you want to OVERWRITE your local data with cloud data?';
      }
      
      if (!window.confirm(msg)) return;
      
      showToast('Restoring local data...', 'info');
      await restoreFromBackupBlob(blob);
      await refreshDevotees();
      await loadCategories();
      
      if (existing) {
        await setGDriveSetting('gDriveLastSync', existing.modifiedTime || new Date().toISOString());
      }
      
      showToast('✅ Pull successful! This device now matches the cloud.', 'success');

      if (isLegacy) {
        showToast('Migrating legacy backup to new format...', 'info');
        await syncToGoogleDrive();
      }
    } catch(e) {
      const err = e as { message?: string };
      showToast(err.message || 'Pull failed', 'error');
    } finally {
      setIsPulling(false);
      // Keep push blocked — user must make a real edit to re-enable it
    }
  };

  return (
    <div className="section pt-16">
      <div className="flex-between mb-24">
        <button className="btn-icon" onClick={() => navigate(-1)}>
          ←
        </button>
        <h3 className="m-0">User Profile</h3>
        <div style={{ width: 40 }} /> {/* spacer */}
      </div>

      <div className="card text-center py-32 px-16 mb-24">
        <img 
          src={user.picture} 
          alt={user.name} 
          className="mb-16"
          style={{ width: 80, height: 80, borderRadius: '50%', border: '2px solid var(--gold)', objectFit: 'cover' }}
          referrerPolicy="no-referrer"
        />
        <h2 className="mb-4">{user.name}</h2>
        <p className="text-muted text-sm">{user.email}</p>
      </div>

      <div className="card mb-24">
        <h4 className="mb-16 text-2">Subscription Details</h4>
        <div className="flex-between mb-12">
          <span className="text-muted">Current Plan</span>
          <span className={`badge plan-${plan || 'free'}`}>
            {(plan || 'free').toUpperCase()}
          </span>
        </div>
        {plan !== 'free' && (
        <div className="flex-between mb-16">
          <span className="text-muted">Valid Until</span>
          <span className="fw-600">{user.real_expiry || 'Lifetime'}</span>
        </div>
        )}

        <button 
          className="btn btn-primary btn-full mt-8" 
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <><span className="nav-icon animate-spin">⟳</span> Refreshing...</>
          ) : (
            'Refresh Subscription'
          )}
        </button>
      </div>

      {/* Upgrade Promo (for free and plus users) */}
      {(plan === 'free' || plan === 'plus') && (
        <div className="card mb-24" style={{ 
          border: '1px solid var(--gold)', 
          background: 'linear-gradient(135deg, rgba(212,175,55,0.05), rgba(30,144,255,0.05))'
        }}>
          <div className="flex gap-12 mb-12" style={{ alignItems: 'center' }}>
            <span style={{ fontSize: '2rem' }}>🚀</span>
            <div>
              <h4 className="m-0" style={{ color: 'var(--gold)' }}>
                {plan === 'free' ? 'Upgrade Your Plan' : 'Upgrade to Pro'}
              </h4>
              <div className="text-xs text-muted mt-2">
                {plan === 'free' 
                  ? 'Unlock WhatsApp Broadcast, Map Hub, GPS & more' 
                  : 'Get Map Hub, GPS Tracking, OCR Scanning & more'}
              </div>
            </div>
          </div>
          <button 
            className="btn btn-full"
            style={{ 
              background: 'var(--gold)', 
              color: '#000', 
              border: 'none',
              fontWeight: 700
            }}
            onClick={() => navigate('/upgrade')}
          >
            View Plans & Upgrade
          </button>
        </div>
      )}

      <div className="card mb-24">
        <h4 className="mb-16 text-2">Manual Cloud Sync</h4>
        <p className="text-sm text-muted mb-16">
          Compare and synchronize your data. You can push local changes up, or pull cloud changes down.
        </p>
        <div className="grid-2">
          <button 
            className="btn btn-ghost w-full" 
            onClick={handlePush}
            disabled={isPushing || isPulling}
            style={{ border: '1px solid var(--gold)', color: 'var(--gold)' }}
          >
            {isPushing ? '⏳ Pushing...' : '📤 Push to Cloud'}
          </button>
          <button 
            className="btn btn-ghost w-full" 
            onClick={handlePull}
            disabled={isPulling || isPushing}
            style={{ border: '1px solid var(--gold)', color: 'var(--gold)' }}
          >
            {isPulling ? '⏳ Pulling...' : '📥 Pull from Cloud'}
          </button>
        </div>
      </div>

      <button className="btn btn-ghost btn-full" style={{ color: 'var(--red)', borderColor: 'var(--red)' }} onClick={handleLogout}>
         Log Out
      </button>

      <style>{`
        .badge {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 700;
        }
        .plan-free { background: var(--surface-2); color: var(--text-2); }
        .plan-plus { background: rgba(30,144,255,0.2); color: #1e90ff; }
        .plan-pro { background: rgba(212,175,55,0.2); color: var(--gold); }
        
        .animate-spin {
          display: inline-block;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
