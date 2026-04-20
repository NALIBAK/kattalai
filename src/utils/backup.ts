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

  // Restore Payments (faster via transaction)
  if (data.payments) {
    const db = await getDB();
    const tx = db.transaction('payment_history', 'readwrite');
    for (const pay of data.payments) {
      tx.store.put(pay as PaymentEntry);
    }
    await tx.done;
  }
}
