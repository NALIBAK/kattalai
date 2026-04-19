import JSZip from 'jszip';
import { getDB, PaymentEntry, Devotee } from '../db';

/**
 * GOOGLE DRIVE SYNC UTILITY
 * -------------------------
 * This utility handles OAuth 2.0 authentication and file uploads to Google Drive.
 * It uses the 'drive.file' scope to only access files created by this app.
 */

// REPLACE THIS WITH YOUR ACTUAL CLIENT ID FROM GOOGLE CLOUD CONSOLE
export const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';

const DRIVE_FOLDER_NAME = 'Kattalai CMS Backups';
let accessToken: string | null = null;

/**
 * Requests an OAuth 2.0 access token from Google using Identity Services.
 */
export async function getGoogleAccessToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (accessToken) return resolve(accessToken);

    if (!(window as any).google) {
      reject(new Error('Google Identity Services script not loaded. Check index.html.'));
      return;
    }

    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: (response: any) => {
        if (response.error_description) {
          reject(new Error(response.error_description));
        } else {
          accessToken = response.access_token;
          resolve(response.access_token);
        }
      },
    });

    client.requestAccessToken();
  });
}

/**
 * Generates a standard backup ZIP blob.
 */
async function generateBackupBlob(): Promise<Blob> {
  const db = await getDB();
  const devotees = await db.getAll('devotees');
  const categories = await db.getAll('categories');
  const payments = await db.getAll('payment_history') as PaymentEntry[];

  const backupObj = {
    meta: { app: 'Kattalai_CMS', version: '1.0', date: new Date().toISOString() },
    devotees,
    categories: categories.filter(c => !c.is_builtin),
    payments
  };

  const zip = new JSZip();
  zip.file('kattalai_db_backup.json', JSON.stringify(backupObj, null, 2));
  
  // CSV for readability
  const csvHeader = 'ID,Name,Phone,City,Category,Amount\n';
  const csvRows = (devotees as Devotee[]).map(d => `${d.id},"${d.name}","${d.phone}","${d.city}","${d.category}",${d.amount_paid}`);
  zip.file('devotees_readable.csv', csvHeader + csvRows.join('\n'));

  return await zip.generateAsync({ type: 'blob' });
}

/**
 * Finds or creates the "Kattalai CMS Backups" folder.
 */
async function getFolderId(token: string): Promise<string> {
  // 1. Search for existing folder
  const query = encodeURIComponent(`name = '${DRIVE_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const searchData = await searchRes.json();

  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // 2. Create if not found
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: DRIVE_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder'
    })
  });
  const createData = await createRes.json();
  return createData.id;
}

/**
 * Main function to sync data to Google Drive.
 */
export async function syncToGoogleDrive(): Promise<string> {
  const token = await getGoogleAccessToken();
  const folderId = await getFolderId(token);
  const blob = await generateBackupBlob();
  
  const fileName = `Kattalai_AutoBackup_${new Date().toISOString().slice(0, 10)}.zip`;

  // Multipart upload (Metadata + Content)
  const metadata = {
    name: fileName,
    parents: [folderId],
    mimeType: 'application/zip'
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || 'Upload failed');
  }

  return new Date().toLocaleString();
}
