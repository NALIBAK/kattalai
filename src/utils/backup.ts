import JSZip from 'jszip';
import { getDB, upsertCategory, upsertDevotee, Category, Devotee, PaymentEntry } from '../db';

/**
 * REUSABLE BACKUP RESTORATION UTILITY
 * ----------------------------------
 * Handles parsing Kattalai ZIP backups and updating the local IndexedDB.
 */
export async function restoreFromBackupBlob(blob: Blob): Promise<void> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(blob);
  const jsonFile = loadedZip.file('kattalai_db_backup.json');
  
  if (!jsonFile) throw new Error('Valid JSON backup file not found in ZIP');
  
  const jsonStr = await jsonFile.async('string');
  const data = JSON.parse(jsonStr);

  const db = await getDB();

  // ── FULL REPLACEMENT: Clear existing data first ──
  // This prevents "ghost" records from piling up across devices.
  {
    const clearTx = db.transaction(['devotees', 'family_members', 'payment_history', 'categories', 'deleted_devotees'], 'readwrite');
    await clearTx.objectStore('devotees').clear();
    await clearTx.objectStore('family_members').clear();
    await clearTx.objectStore('payment_history').clear();
    await clearTx.objectStore('deleted_devotees').clear();
    // Only clear non-builtin categories (builtins are seeded on app init)
    const allCats = await clearTx.objectStore('categories').getAll();
    for (const cat of allCats) {
      if (!cat.is_builtin) {
        await clearTx.objectStore('categories').delete(cat.id);
      }
    }
    await clearTx.done;
  }

  // ── Write cloud data into the now-empty stores ──

  // Restore Categories
  if (data.categories) {
    for (const cat of data.categories) {
      await upsertCategory(cat as Category);
    }
  }

  // Restore Devotees
  if (data.devotees) {
    for (const dev of data.devotees) {
      await upsertDevotee(dev as Devotee);
    }
  }

  // Restore Payments
  if (data.payments) {
    const tx = db.transaction('payment_history', 'readwrite');
    for (const pay of data.payments) {
      tx.store.put(pay as PaymentEntry);
    }
    await tx.done;
  }

  // Restore Deleted Devotees (Recycle Bin)
  if (data.deleted_devotees) {
    const tx = db.transaction('deleted_devotees', 'readwrite');
    for (const dd of data.deleted_devotees) {
      tx.store.put(dd);
    }
    await tx.done;
  }
}

/**
 * Previews the contents of a backup blob without restoring it.
 */
export async function previewBackupBlob(blob: Blob): Promise<{ devoteeCount: number, date: string, rawData: any }> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(blob);
  const jsonFile = loadedZip.file('kattalai_db_backup.json');
  
  if (!jsonFile) throw new Error('Valid JSON backup file not found in ZIP');
  
  const jsonStr = await jsonFile.async('string');
  const data = JSON.parse(jsonStr);
  
  return {
    devoteeCount: data.devotees ? data.devotees.length : 0,
    date: data.meta?.date || new Date().toISOString(),
    rawData: data
  };
}
