import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'vn.bot68.mobile',
  appName: 'BOT 68',
  webDir: 'dist',
  server: { androidScheme: 'https' },
  android: {
    backgroundColor: '#08111f',
    allowMixedContent: false
  }
};

export default config;
