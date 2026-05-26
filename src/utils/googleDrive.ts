import JSZip from 'jszip';
import { getDB, PaymentEntry, Devotee } from '../db';
import { useAuthStore } from '../store';

/**
 * GOOGLE DRIVE SYNC UTILITY
 * -------------------------
 * Uses 'drive.appdata' scope — files are stored in the app's hidden
 * appDataFolder, which is accessible from ANY device the user signs
 * into, unlike 'drive.file' which is session/device-scoped.
 *
 * A single fixed filename 'kattalai_latest_backup.zip' is used so
 * there is always exactly one backup file — no search needed.
 */

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Fixed filename — overwritten on every sync, always findable cross-device
const BACKUP_FILENAME = 'kattalai_latest_backup.zip';

let accessToken: string | null = null;
let tokenExpiry: number = 0;

/**
 * Requests an OAuth 2.0 access token using drive.appdata scope.
 * Attempts to silently refresh if silent = true, falling back to popup if required.
 */
export async function getGoogleAccessToken(silent: boolean = false): Promise<string> {
  return new Promise((resolve, reject) => {
    // 1. Check memory cache
    if (accessToken && Date.now() < tokenExpiry - 60000) {
      return resolve(accessToken);
    }
    
    // 2. Check local storage cache
    const storedToken = localStorage.getItem('gdrive_token');
    const storedExpiry = localStorage.getItem('gdrive_token_expiry');
    
    if (storedToken && storedExpiry) {
      const expiryTime = parseInt(storedExpiry, 10);
      if (Date.now() < expiryTime - 60000) {
        accessToken = storedToken;
        tokenExpiry = expiryTime;
        return resolve(storedToken);
      }
    }

    // 3. Token missing or expired.
    const globalWindow = window as unknown as {
      google?: {
        accounts: {
          oauth2: {
            initTokenClient: (config: {
              client_id: string;
              scope: string;
              callback: (resp: {
                error?: string;
                error_description?: string;
                access_token: string;
                expires_in?: number;
              }) => void;
            }) => {
              requestAccessToken: (options?: { prompt?: string; hint?: string }) => void;
            };
          };
        };
      };
    };

    if (!globalWindow.google) {
      return reject(new Error('Google Identity Services not loaded.'));
    }

    const userState = useAuthStore.getState();
    const email = userState?.user?.email || '';

    const client = globalWindow.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      // drive.appdata: cross-device hidden folder, user's own data only
      // drive.file: needed to find legacy backups from older app versions
      scope: 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file',
      callback: (response) => {
        if (response.error || response.error_description) {
          console.warn('[Google Auth] Silent/Interactive token request failed:', response.error, response.error_description);
          reject(new Error('AUTH_REQUIRED'));
        } else {
          accessToken = response.access_token;
          tokenExpiry = Date.now() + (response.expires_in ?? 3600) * 1000;
          
          localStorage.setItem('gdrive_token', accessToken!);
          localStorage.setItem('gdrive_token_expiry', tokenExpiry.toString());
          
          resolve(response.access_token);
        }
      },
    });

    if (silent) {
      if (email) {
        // Attempt silent SSO token refresh without showing popups
        client.requestAccessToken({ prompt: 'none', hint: email });
      } else {
        reject(new Error('AUTH_REQUIRED'));
      }
    } else {
      // Interactive popup
      client.requestAccessToken();
    }
  });
}

/**
 * Clears the cached token (call on logout or re-link).
 */
export function clearAccessToken() {
  accessToken = null;
  tokenExpiry = 0;
  localStorage.removeItem('gdrive_token');
  localStorage.removeItem('gdrive_token_expiry');
}

/**
 * Generates a standard backup ZIP blob from current IndexedDB.
 */
async function generateBackupBlob(): Promise<Blob> {
  const db = await getDB();
  const devotees = await db.getAll('devotees');
  const categories = await db.getAll('categories');
  const payments = await db.getAll('payment_history') as PaymentEntry[];

  const backupObj = {
    meta: { app: 'Kattalai_CMS', version: '2.0', date: new Date().toISOString() },
    devotees,
    categories: categories.filter(c => !c.is_builtin),
    payments,
  };

  const zip = new JSZip();
  zip.file('kattalai_db_backup.json', JSON.stringify(backupObj, null, 2));

  // CSV for human readability
  const csvHeader = 'ID,Name,Phone,City,Category,Amount\n';
  const csvRows = (devotees as Devotee[]).map(
    d => `${d.id},"${d.name}","${d.phone}","${d.city}","${d.category}",${d.amount_paid}`
  );
  zip.file('devotees_readable.csv', csvHeader + csvRows.join('\n'));

  return zip.generateAsync({ type: 'blob' });
}

/**
 * Finds the backup file ID in appDataFolder by fixed filename.
 * Returns null if not found (first-time user).
 */
export async function fetchLatestBackup(token: string): Promise<{ id: string, modifiedTime: string } | null> {
  const query = encodeURIComponent(`name = '${BACKUP_FILENAME}' and trashed = false`);
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${query}&fields=files(id,name,modifiedTime)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || 'Failed to search backup');
  }
  const data = await res.json();
  return data.files && data.files.length > 0 ? { id: data.files[0].id, modifiedTime: data.files[0].modifiedTime } : null;
}

/**
 * Searches for the old legacy backup format stored in the user's main Drive using drive.file scope.
 * Used to migrate existing users to the new appData system smoothly.
 */
export async function fetchLegacyBackup(token: string): Promise<string | null> {
  // 1. Find the legacy folder
  const folderQuery = encodeURIComponent(`name = 'Kattalai Sync Data' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const folderRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${folderQuery}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!folderRes.ok) return null;
  const folderData = await folderRes.json();
  
  if (!folderData.files || folderData.files.length === 0) {
    return null;
  }
  
  const folderId = folderData.files[0].id;
  
  // 2. Find the latest backup file in that folder
  const fileQuery = encodeURIComponent(`'${folderId}' in parents and name contains 'Kattalai_AutoBackup' and trashed = false`);
  const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${fileQuery}&orderBy=createdTime desc&pageSize=1`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!fileRes.ok) return null;
  const fileData = await fileRes.json();
  
  return (fileData.files && fileData.files.length > 0) ? fileData.files[0].id : null;
}

/**
 * Downloads a backup file by ID.
 */
export async function downloadBackup(token: string, fileId: string): Promise<Blob> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error('Download failed — file may no longer exist');
  return res.blob();
}

/**
 * Main sync: upload backup to appDataFolder with fixed filename.
 * Deletes existing file first so there's always exactly one copy.
 */
export async function syncToGoogleDrive(silent: boolean = true): Promise<string> {
  const token = await getGoogleAccessToken(silent);
  const blob = await generateBackupBlob();

  // Delete existing backup (replace strategy — one file always)
  const existing = await fetchLatestBackup(token);
  if (existing) {
    await fetch(`https://www.googleapis.com/drive/v3/files/${existing.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  // Upload to appDataFolder
  const metadata = {
    name: BACKUP_FILENAME,
    parents: ['appDataFolder'],
    mimeType: 'application/zip',
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=modifiedTime',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || 'Upload failed');
  }
  const resData = await res.json();
  return resData.modifiedTime || new Date().toISOString();
}

// ── Legacy compat — getFolderId no longer needed with appDataFolder ──────────
export async function getFolderId(): Promise<string> {
  return 'appDataFolder';
}
