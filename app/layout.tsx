import type { Metadata, Viewport } from 'next';
import { connection } from 'next/server';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/sora/500.css';
import '@fontsource/sora/600.css';
import '@fontsource/sora/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import './globals.css';
import { AppShell } from '@/components/AppShell';
import { Splash } from '@/components/Splash';
import { readPortfolio } from '@/lib/store';

export const metadata: Metadata = {
  title: 'Portfolio',
  description: 'Personal portfolio',
  applicationName: 'ReuseMe',
  appleWebApp: { capable: true, title: 'ReuseMe', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#2f6df0',
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  // Applies the visitor's saved light/dark choice (or the owner's default) before first paint — no flash.
  await connection(); // read the owner's theme per request, never at build time (the database isn't reachable then)
  const fallback = JSON.stringify(await readPortfolio().then((d) => d.settings.site.theme, () => 'light'));
  const themeScript = `(function(){var t;try{t=localStorage.getItem('pf-theme')}catch(e){}document.documentElement.dataset.theme=t||${fallback}})()`;
  // Launch splash: plays on app launch / first view of a browser session, skipped (before paint) afterwards.
  const splashScript = `try{if(sessionStorage.getItem('rm-splash'))document.documentElement.classList.add('no-splash');else sessionStorage.setItem('rm-splash','1');if(sessionStorage.getItem('rm-preview'))document.documentElement.classList.add('rm-preview')}catch(e){}`;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript + ';' + splashScript }} />
      </head>
      <body>
        <Splash />
        {children}
        <AppShell />
      </body>
    </html>
  );
}
