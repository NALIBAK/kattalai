import React, { useState } from 'react';
import { useSettingsStore, useToastStore } from '../store';
import { getGoogleAccessToken, syncToGoogleDrive } from '../utils/googleDrive';

export function GDriveGate({ children }: { children: React.ReactNode }) {
  const { gDriveLinked, setGDriveSetting } = useSettingsStore();
  const { showToast } = useToastStore();
  const [isLinking, setIsLinking] = useState(false);

  const handleLink = async () => {
    setIsLinking(true);
    try {
      // 1. Get token (triggers OAuth popup)
      await getGoogleAccessToken();
      
      // 2. Perform an initial sync to verify permissions and create folder
      await syncToGoogleDrive();
      
      // 3. Update store
      await setGDriveSetting('gDriveLinked', true);
      await setGDriveSetting('gDriveAutoSync', true); // Mandatory auto-sync
      
      showToast('Cloud Sync enabled successfully!', 'success');
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'Linking failed', 'error');
    } finally {
      setIsLinking(false);
    }
  };

  if (gDriveLinked) {
    return <>{children}</>;
  }

  return (
    <div className="flex-center" style={{ 
      position: 'fixed', inset: 0, zIndex: 9999, 
      background: 'var(--bg)', padding: 24, textAlign: 'center' 
    }}>
      <div className="card-flat" style={{ maxWidth: 400, border: '2px solid var(--gold)' }}>
        <div style={{ fontSize: '4rem', marginBottom: 16 }}>☁️</div>
        <h2 className="text-gold">Mandatory Cloud Sync</h2>
        <p className="text-2 mb-24">
          To ensure your devotee records are never lost, Kattalai now requires a mandatory Google Drive link for all users.
        </p>
        
        <div className="flex-col gap-12 text-sm text-muted mb-24" style={{ textAlign: 'left' }}>
          <div className="flex gap-12">
            <span>🛡️</span>
            <span>Your data is stored securely in <b>your</b> Google Drive.</span>
          </div>
          <div className="flex gap-12">
            <span>🔄</span>
            <span>All changes will automatically sync to the cloud.</span>
          </div>
          <div className="flex gap-12">
            <span>📱</span>
            <span>Access your data from any device by logging in.</span>
          </div>
        </div>

        <button 
          className="btn btn-primary w-full" 
          onClick={handleLink}
          disabled={isLinking}
          style={{ height: 48, fontSize: '1rem' }}
        >
          {isLinking ? 'Linking Cloud Storage...' : 'Enable Cloud Sync & Storage'}
        </button>
        
        <p className="text-xs text-muted mt-16">
          Kattalai will only have access to files it creates. 
          We never see your other Drive files.
        </p>
      </div>
    </div>
  );
}
