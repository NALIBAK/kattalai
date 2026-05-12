import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useToastStore, useDevoteeStore, useCategoryStore } from '../store';
import { verifyAccess } from '../auth';
import { getGoogleAccessToken, fetchLatestBackup, fetchLegacyBackup, downloadBackup, syncToGoogleDrive } from '../utils/googleDrive';
import { restoreFromBackupBlob } from '../utils/backup';

export function Profile() {
  const navigate = useNavigate();
  const { user, plan, setCache, logout } = useAuthStore();
  const { showToast } = useToastStore();
  const { refresh: refreshDevotees } = useDevoteeStore();
  const { loadCategories } = useCategoryStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

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
    } catch (e) {
      showToast('Connection error during refresh.', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleForceRestore = async () => {
    if (!window.confirm('⚠️ This will overwrite your current local data with the latest cloud backup. Continue?')) {
      return;
    }
    
    setIsRestoring(true);
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

      if (existingFileId) {
        showToast('Found cloud backup, downloading...', 'info');
        const blob = await downloadBackup(token, existingFileId);
        await restoreFromBackupBlob(blob);
        await refreshDevotees();
        await loadCategories();
        showToast('✅ Successfully restored from cloud!', 'success');

        if (isLegacy) {
          showToast('Migrating legacy backup to new format...', 'info');
          await syncToGoogleDrive();
        }
      } else {
        showToast('No cloud backup found for this account.', 'error');
      }
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'Failed to restore from cloud.', 'error');
    } finally {
      setIsRestoring(false);
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
        <div className="flex-between mb-16">
          <span className="text-muted">Valid Until</span>
          <span className="fw-600">{user.real_expiry || 'Lifetime'}</span>
        </div>

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

      <div className="card mb-24">
        <h4 className="mb-16 text-2">Cloud Sync</h4>
        <p className="text-sm text-muted mb-16">
          If your data is missing or out of sync, you can force a restore from your Google Drive backup. This will overwrite local changes.
        </p>
        <button 
          className="btn btn-ghost w-full" 
          onClick={handleForceRestore}
          disabled={isRestoring}
          style={{ border: '1px solid var(--gold)', color: 'var(--gold)' }}
        >
          {isRestoring ? '⏳ Restoring...' : '☁️ Force Restore from Cloud'}
        </button>
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
