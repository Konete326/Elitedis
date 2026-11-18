import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Smartphone, X } from 'lucide-react';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { useShell } from '../../context/ShellContext';

/**
 * Portal-mounted (z-[90]) responsive PWA install card (Chromium prompt + iOS Safari guide).
 * Automatically hides once installed or dismissed for the session.
 */
export function PwaInstallPrompt() {
  const { addToast } = useShell();
  const {
    canInstall,
    isInstalled,
    isIosInstallable,
    hasDeferredPrompt,
    isDismissed,
    dismissBanner,
    promptInstall,
  } = usePwaInstall();
  const [showIosSteps, setShowIosSteps] = useState(false);

  if (!canInstall || isInstalled || isDismissed || typeof document === 'undefined') {
    return null;
  }

  const isIosGuideOnly = isIosInstallable && !hasDeferredPrompt;

  const handleInstall = async () => {
    const result = await promptInstall();
    if (result.iosGuide) {
      setShowIosSteps((prev) => !prev);
      return;
    }
    if (result.outcome === 'accepted') {
      addToast?.({
        type: 'success',
        title: 'App Installed',
        message: 'ELITE DIST has been installed for quick launch.',
        duration: 5000,
      });
    }
  };

  return createPortal(
    <aside
      aria-label="Install ELITE DIST App"
      className="fixed bottom-3 left-3 right-3 sm:right-auto sm:bottom-4 sm:left-4 z-[90] sm:w-96 max-w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl p-3.5 sm:p-4 animate-slide-up transition-colors duration-200"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)] flex items-center justify-center">
          {isIosGuideOnly ? (
            <Smartphone className="w-5 h-5" strokeWidth={1.75} />
          ) : (
            <Download className="w-5 h-5" strokeWidth={1.75} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[var(--text-primary)]">Install ELITE DIST App</p>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)] leading-relaxed">
            {isIosGuideOnly
              ? 'Tap Share in Safari, then choose "Add to Home Screen".'
              : 'Add to your home screen or desktop for faster access.'}
          </p>

          {showIosSteps && isIosGuideOnly && (
            <div className="mt-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5 text-[11px] text-[var(--text-secondary)] space-y-1">
              <p>1. Tap the Share button at the bottom of Safari.</p>
              <p>2. Scroll down and tap &quot;Add to Home Screen&quot;.</p>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleInstall}
              className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5" strokeWidth={2} />
              <span>{isIosGuideOnly ? (showIosSteps ? 'Hide Steps' : 'How to Install') : 'Install App'}</span>
            </button>
            <button
              type="button"
              onClick={dismissBanner}
              className="min-h-[38px] px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-xs font-medium text-[var(--text-secondary)] transition-colors"
            >
              Later
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={dismissBanner}
          aria-label="Dismiss install banner"
          className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
        >
          <X className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>
    </aside>,
    document.body
  );
}

export default PwaInstallPrompt;
