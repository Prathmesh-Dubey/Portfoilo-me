'use client';

import { useState, useSyncExternalStore } from 'react';
import { APK_URL } from '@/lib/links';
import { Icon } from './Icons';

const noSubscribe = () => () => {};
// The app's WebView adds "ReuseMeApp" to the user agent (capacitor.config.ts); the server never knows, so it renders the button.
const inApp = () => navigator.userAgent.includes('ReuseMeApp');

/** "Get the Android app" button. Hidden inside the app itself — people already running it don't need to download it. */
export function AppDownload({ className = 'btn btn-ghost', label = 'Download Android app' }: { className?: string; label?: string }) {
  if (useSyncExternalStore(noSubscribe, inApp, () => false)) return null;
  return (
    <a href={APK_URL} className={`${className} app-dl`} rel="noopener noreferrer">
      <Icon name="mobile" size={17} /> {label}
      <span className="app-dl-meta">APK · 6 MB</span>
    </a>
  );
}

/**
 * "Share app": opens the phone's share sheet (WhatsApp, Telegram, SMS…) with this site's /download link, which
 * starts the APK download for whoever opens it. Where the browser has no share sheet, the link is copied instead.
 * Shown inside the app too, so app users can pass it on.
 */
export function AppShare({ className = 'btn btn-ghost' }: { className?: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = `${location.origin}/download`;
    const text = 'ReuseMe: build a job-ready resume in minutes. Get the Android app:';
    if (navigator.share) {
      try {
        await navigator.share({ title: 'ReuseMe app', text, url });
      } catch {
        /* the person closed the share sheet */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      window.prompt('Copy this link to share the app:', url);
    }
  };
  return (
    <button type="button" className={className} onClick={share} aria-label="Share the app" title="Share the app">
      <Icon name={copied ? 'check' : 'share'} size={17} /> {copied ? 'Link copied' : 'Share app'}
    </button>
  );
}
