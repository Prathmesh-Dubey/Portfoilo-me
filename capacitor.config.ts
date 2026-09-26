import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.prathmesh.reuseme',
  appName: 'Reuse Me',
  webDir: 'public',
  // lets the site recognise the app (e.g. to hide Google sign-in, which Google blocks inside app WebViews)
  appendUserAgent: 'ReuseMeApp',
  server: {
    url: 'https://reuseme-zeta.vercel.app/',
    cleartext: false
  }
};

export default config;