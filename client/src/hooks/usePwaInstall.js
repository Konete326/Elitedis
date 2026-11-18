import { useCallback, useEffect, useState } from 'react';

const INSTALLED_KEY = 'elitedist_pwa_installed';
const DISMISSED_KEY = 'elitedist_pwa_prompt_dismissed';
const PWA_EVENT = 'elitedist:pwa-change';

function checkStandalone() {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    window.navigator?.standalone === true
  );
}

function checkIos() {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent || '');
}

function readPwaSnapshot() {
  if (typeof window === 'undefined') {
    return {
      isStandalone: false,
      hasDeferredPrompt: false,
      isIosInstallable: false,
      isInstalled: false,
      isDismissed: false,
    };
  }
  const isStandalone = checkStandalone();
  const hasDeferredPrompt = Boolean(window.__deferredPwaPrompt);
  const isIosInstallable = checkIos() && !isStandalone;
  let storedInstalled = false;
  let isDismissed = false;
  try {
    storedInstalled = localStorage.getItem(INSTALLED_KEY) === 'true';
    isDismissed = sessionStorage.getItem(DISMISSED_KEY) === 'true';
  } catch {
    // Ignore storage access errors
  }
  const isInstalled = isStandalone || (storedInstalled && !hasDeferredPrompt);
  return { isStandalone, hasDeferredPrompt, isIosInstallable, isInstalled, isDismissed };
}

/**
 * Tracks browser PWA installability (Chromium beforeinstallprompt + iOS Safari)
 * and syncs across all UI triggers via `elitedist:pwa-change`.
 */
export function usePwaInstall() {
  const [snapshot, setSnapshot] = useState(readPwaSnapshot);

  useEffect(() => {
    const sync = () => setSnapshot(readPwaSnapshot());
    sync();
    window.addEventListener(PWA_EVENT, sync);
    const mq = window.matchMedia?.('(display-mode: standalone)');
    if (mq?.addEventListener) mq.addEventListener('change', sync);
    else if (mq?.addListener) mq.addListener(sync);
    return () => {
      window.removeEventListener(PWA_EVENT, sync);
      if (mq?.removeEventListener) mq.removeEventListener('change', sync);
      else if (mq?.removeListener) mq.removeListener(sync);
    };
  }, []);

  const dismissBanner = useCallback(() => {
    try {
      sessionStorage.setItem(DISMISSED_KEY, 'true');
    } catch {
      // Ignore storage access errors
    }
    setSnapshot((prev) => ({ ...prev, isDismissed: true }));
    window.dispatchEvent(new Event(PWA_EVENT));
  }, []);

  const promptInstall = useCallback(async () => {
    const deferred = typeof window !== 'undefined' ? window.__deferredPwaPrompt : null;
    if (deferred && typeof deferred.prompt === 'function') {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      const outcome = choice?.outcome || 'dismissed';
      window.__deferredPwaPrompt = null;
      if (outcome === 'accepted') {
        try {
          localStorage.setItem(INSTALLED_KEY, 'true');
        } catch {
          // Ignore storage access errors
        }
      }
      window.dispatchEvent(new Event(PWA_EVENT));
      return { outcome, iosGuide: false };
    }

    if (snapshot.isIosInstallable) {
      return { outcome: 'ios-guide', iosGuide: true };
    }
    return { outcome: 'unavailable', iosGuide: false };
  }, [snapshot.isIosInstallable]);

  const canInstall =
    !snapshot.isInstalled && (snapshot.hasDeferredPrompt || snapshot.isIosInstallable);

  return {
    canInstall,
    isInstalled: snapshot.isInstalled,
    isIosInstallable: snapshot.isIosInstallable,
    hasDeferredPrompt: snapshot.hasDeferredPrompt,
    isDismissed: snapshot.isDismissed,
    dismissBanner,
    promptInstall,
  };
}

export default usePwaInstall;
