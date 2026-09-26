import type { MetadataRoute } from 'next';

// Makes the site installable as the "ReuseMe" app (Add to Home Screen / Install app).
// background_color matches the launch splash, so the phone's own start screen blends straight into it.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ReuseMe',
    short_name: 'ReuseMe',
    description: 'Prathmesh Dubey: portfolio and free resume builder.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#2f6df0',
    theme_color: '#2f6df0',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
