import JSZip from 'jszip';
import { getDB, PaymentEntry, Devotee } from '../db';

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
 * drive.appdata = hidden per-app folder, accessible from all devices.
 */
export async function getGoogleAccessToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    // Return cached token if still valid (with 60s buffer)
    if (accessToken && Date.now() < tokenExpiry - 60000) {
      return resolve(accessToken);
    }

    if (!(window as any).google) {
      reject(new Error('Google Identity Services not loaded.'));
      return;
    }

    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      // drive.appdata: cross-device hidden folder, user's own data only
      scope: 'https://www.googleapis.com/auth/drive.appdata',
      callback: (response: any) => {
        if (response.error || response.error_description) {
          reject(new Error(response.error_description || response.error));
        } else {
          accessToken = response.access_token;
          // Google tokens expire in 3600s; cache with expiry
          tokenExpiry = Date.now() + (response.expires_in ?? 3600) * 1000;
          resolve(response.access_token);
        }
      },
    });

    client.requestAccessToken();
  });
}

/**
 * Clears the cached token (call on logout or re-link).
 */
export function clearAccessToken() {
  accessToken = null;
  tokenExpiry = 0;
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
export async function fetchLatestBackup(token: string): Promise<string | null> {
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
  return data.files && data.files.length > 0 ? data.files[0].id : null;
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
export async function syncToGoogleDrive(): Promise<string> {
  const token = await getGoogleAccessToken();
  const blob = await generateBackupBlob();

  // Delete existing backup (replace strategy — one file always)
  const existingId = await fetchLatestBackup(token);
  if (existingId) {
    await fetch(`https://www.googleapis.com/drive/v3/files/${existingId}`, {
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
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
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

  return new Date().toLocaleString();
}

// ── Legacy compat — getFolderId no longer needed with appDataFolder ──────────
export async function getFolderId(_token: string): Promise<string> {
  return 'appDataFolder';
}
