/**
 * SYNC LOCK — Prevents auto-push from overwriting cloud data
 * during pull/restore operations.
 *
 * The problem: When Device B opens the app, the auto-push effect fires
 * after 5 seconds and overwrites the cloud with its stale local data,
 * before the user can even pull the correct version from Device A.
 *
 * The fix: Auto-push is only allowed after genuine user edits. It is
 * blocked during initial load and after any pull/restore operation.
 */

let _pushBlocked = true; // blocked by default (safe on app load)

/**
 * Call this to allow auto-push (e.g., after user adds/edits/deletes a devotee).
 */
export function allowPush() {
  _pushBlocked = false;
}

/**
 * Call this to block auto-push (e.g., before a pull/restore operation).
 */
export function blockPush() {
  _pushBlocked = true;
}

/**
 * Returns true if auto-push is currently blocked.
 */
export function isPushBlocked() {
  return _pushBlocked;
}
