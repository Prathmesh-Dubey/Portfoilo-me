import type { Project } from './types';

/**
 * The Android app (ReuseMe.apk). "latest" always points at the newest GitHub release, so publishing a new
 * release — with the file still named ReuseMe.apk — updates every download button without a code change.
 */
export const APK_URL = 'https://github.com/Prathmesh-Dubey/Portfoilo-me/releases/latest/download/ReuseMe.apk';

/** Opens Gmail's compose window addressed to `email` (works without a desktop mail app). */
export const gmailCompose = (email: string, subject = '', body = '') =>
  `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}${subject ? `&su=${encodeURIComponent(subject)}` : ''}${body ? `&body=${encodeURIComponent(body)}` : ''}`;

/** A project's links in priority order: live site, GitHub repo, then any extra links. */
export function projectLinks(p: Pick<Project, 'demo' | 'repo' | 'links'>): { label: string; url: string }[] {
  return [
    ...(p.demo ? [{ label: 'Live site', url: p.demo }] : []),
    ...(p.repo ? [{ label: 'GitHub', url: p.repo }] : []),
    ...p.links,
  ];
}
