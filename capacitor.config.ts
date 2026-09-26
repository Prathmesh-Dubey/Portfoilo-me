import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.prathmesh.reuseme',
  appName: 'Reuse Me',
  webDir: 'public',
  server: {
    url: 'https://portfoilo-me.vercel.app/',
    cleartext: false
  }
};

export default config;