'use client';

import { useEffect } from 'react';

/**
 * Self-hosted Next.js deploys (unlike Vercel, which has built-in "skew protection") have no
 * automatic recovery when a browser tab stays open across a redeploy: its already-loaded JS
 * still references the *previous* build's action IDs and chunk hashes, so any interaction that
 * round-trips through the server — clicking Add to Cart, navigating, submitting a form — fails
 * with "Failed to find Server Action" or "ChunkLoadError" even though the site itself is fine
 * for anyone loading it fresh. This silently reloads the page once when that happens, so an
 * affected visitor just sees a brief refresh and lands on the current build instead of a broken
 * button with no obvious explanation.
 */
const STALE_DEPLOY_PATTERNS = [
  /Failed to find Server Action/i,
  /ChunkLoadError/i,
  /Loading chunk [\w.-]+ failed/i,
  /Importing a module script failed/i,
];

const RELOAD_GUARD_KEY = 'gr_stale_reload_at';
const RELOAD_COOLDOWN_MS = 60_000; // never more than one auto-reload per minute, even if it keeps firing

function isStaleDeployError(message: unknown): boolean {
  if (typeof message !== 'string' || !message) return false;
  return STALE_DEPLOY_PATTERNS.some((pattern) => pattern.test(message));
}

function reloadOnce() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0);
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return; // already just reloaded — avoid a loop
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
  } catch {
    // sessionStorage unavailable — reload anyway, worst case is one extra reload
  }
  window.location.reload();
}

export default function StaleDeployRecovery() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      if (isStaleDeployError(event.message) || isStaleDeployError(event.error?.message)) {
        reloadOnce();
      }
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = typeof reason === 'string' ? reason : reason?.message;
      if (isStaleDeployError(message)) {
        reloadOnce();
      }
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
