import React, { useState } from 'react';
import { useSettingsStore, useDevoteeStore, useCategoryStore, useToastStore } from '../store';
import { getGoogleAccessToken, syncToGoogleDrive, fetchLatestBackup, fetchLegacyBackup, downloadBackup } from '../utils/googleDrive';
import { restoreFromBackupBlob } from '../utils/backup';

export function GDriveGate({ children }: { children: React.ReactNode }) {
  const { gDriveLinked, setGDriveSetting } = useSettingsStore();
  const { refresh: refreshDevotees, devotees } = useDevoteeStore();
  const { loadCategories } = useCategoryStore();
  const { showToast } = useToastStore();

  const [isLinking, setIsLinking] = useState(false);
  const [linkStep, setLinkStep] = useState<'idle' | 'auth' | 'checking' | 'restoring' | 'syncing' | 'conflict'>('idle');
  const [conflictData, setConflictData] = useState<{ cloudCount: number, cloudBlob: Blob } | null>(null);

  const handleLink = async () => {
    setIsLinking(true);
    setLinkStep('auth');
    try {
      // Step 1: Get OAuth token (user popup)
      const token = await getGoogleAccessToken();

      // Step 2: Check if a backup exists on Drive (new device scenario)
      setLinkStep('checking');
      const existing = await fetchLatestBackup(token);
      let existingFileId: string | null | undefined = existing?.id;
      let isLegacy = false;

      if (!existingFileId) {
        existingFileId = await fetchLegacyBackup(token);
        if (existingFileId) {
          isLegacy = true;
          console.log('[GDriveGate] Found legacy backup from older version');
        }
      }

      if (existingFileId && devotees.length === 0) {
        // ── NEW DEVICE: restore existing backup ──────────────────
        setLinkStep('restoring');
        showToast('Found your cloud backup — restoring...', 'info');
        const blob = await downloadBackup(token, existingFileId);
        await restoreFromBackupBlob(blob);
        await refreshDevotees();
        await loadCategories();
        showToast('✅ All your data has been restored from cloud!', 'success');

        if (isLegacy) {
          // Re-upload to the new appData folder so it works flawlessly next time
          setLinkStep('syncing');
          await syncToGoogleDrive();
        }
      } else if (existingFileId && devotees.length > 0) {
        // ── EXISTING DEVICE: has both local + cloud — check for differences ──
        setLinkStep('checking');
        showToast('Checking for data differences...', 'info');
        const blob = await downloadBackup(token, existingFileId);
        const { previewBackupBlob } = await import('../utils/backup');
        const preview = await previewBackupBlob(blob);
        
        if (preview.devoteeCount !== devotees.length) {
            setConflictData({ cloudCount: preview.devoteeCount, cloudBlob: blob });
            setLinkStep('conflict');
            return; // pause link flow to let user choose
        } else {
            // Same length, assume merge/sync
            setLinkStep('syncing');
            await syncToGoogleDrive(false);
            showToast('Cloud Sync enabled — data saved!', 'success');
        }
      } else {
        // ── FIRST TIME: no backup exists yet — create initial backup ──
        setLinkStep('syncing');
        await syncToGoogleDrive(false);
        showToast('Cloud Sync enabled — initial backup created!', 'success');
      }

      // Step 3: Mark as linked
      await setGDriveSetting('gDriveLinked', true);
      await setGDriveSetting('gDriveAutoSync', true);

    } catch (e: any) {
      console.error('[GDriveGate] Link failed:', e);
      showToast(e.message || 'Cloud sync setup failed. Please try again.', 'error');
    } finally {
      setIsLinking(false);
      setLinkStep('idle');
    }
  };

  // Already linked — render app normally
  if (gDriveLinked) {
    return <>{children}</>;
  }

  const stepLabel = () => {
    if (linkStep === 'auth')      return 'Connecting to Google...';
    if (linkStep === 'checking')  return 'Checking for existing backup...';
    if (linkStep === 'restoring') return 'Restoring your data...';
    if (linkStep === 'syncing')   return 'Saving to cloud...';
    return 'Enable Cloud Sync & Storage';
  };

  return (
    <div className="flex-center" style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'var(--bg)', padding: 24, textAlign: 'center',
    }}>
      {linkStep === 'conflict' && conflictData ? (
        <div className="card-flat" style={{ maxWidth: 400, border: '2px solid var(--gold)', width: '100%' }}>
           <h2 className="text-gold mb-16" style={{ fontSize: '1.25rem' }}>Data Difference Detected</h2>
           <p className="text-sm text-muted mb-24">
             Your local device and your Google Drive have different amounts of data. Please choose which version you want to keep.
           </p>
           
           <div className="flex-col gap-12 mb-24">
              <div style={{ padding: 12, border: '1px solid #333', borderRadius: 8, textAlign: 'left' }}>
                <div className="fw-600 mb-4">📱 This Device (Local Data)</div>
                <div className="text-sm text-muted">{devotees.length} Devotees</div>
              </div>
              <div style={{ padding: 12, border: '1px solid var(--gold)', borderRadius: 8, textAlign: 'left' }}>
                <div className="fw-600 text-gold mb-4">☁️ Google Drive (Cloud Data)</div>
                <div className="text-sm text-muted">{conflictData.cloudCount} Devotees</div>
              </div>
           </div>

           <div className="flex-col gap-8">
              <button className="btn btn-primary w-full" onClick={async () => {
                 setLinkStep('restoring');
                 await restoreFromBackupBlob(conflictData.cloudBlob);
                 await refreshDevotees();
                 await loadCategories();
                 await setGDriveSetting('gDriveLinked', true);
                 await setGDriveSetting('gDriveAutoSync', true);
                 showToast('✅ Restored from cloud!', 'success');
              }}>
                Keep Cloud Data
              </button>
              <button className="btn btn-ghost w-full" style={{ border: '1px solid var(--text-2)' }} onClick={async () => {
                 setLinkStep('syncing');
                 await syncToGoogleDrive(false);
                 await setGDriveSetting('gDriveLinked', true);
                 await setGDriveSetting('gDriveAutoSync', true);
                 showToast('Cloud Sync enabled — local data saved!', 'success');
              }}>
                Keep Local Data
              </button>
           </div>
        </div>
      ) : (
        <div className="card-flat" style={{ maxWidth: 400, border: '2px solid var(--gold)' }}>
          <div style={{ fontSize: '4rem', marginBottom: 16 }}>☁️</div>
          <h2 className="text-gold">Cloud Sync Required</h2>
          <p className="text-2 mb-24">
            Your devotee records are backed up to your personal Google Drive.
            Sign in on any device to restore all your data instantly.
          </p>

          <div className="flex-col gap-12 text-sm text-muted mb-24" style={{ textAlign: 'left' }}>
            <div className="flex gap-12">
              <span>🛡️</span>
              <span>Stored in <b>your</b> Google Drive — private to you.</span>
            </div>
            <div className="flex gap-12">
              <span>🔄</span>
              <span>Auto-syncs after every change.</span>
            </div>
            <div className="flex gap-12">
              <span>📱</span>
              <span><b>New device?</b> Your data will be restored automatically.</span>
            </div>
          </div>

          <button
            className="btn btn-primary w-full"
            onClick={handleLink}
            disabled={isLinking}
            style={{ height: 48, fontSize: '1rem' }}
          >
            {isLinking ? `⏳ ${stepLabel()}` : '☁️ Enable Cloud Sync & Storage'}
          </button>

          <p className="text-xs text-muted mt-16">
            Kattalai only accesses its own hidden app folder. We never see your other Drive files.
          </p>
        </div>
      )}
    </div>
  );
}
