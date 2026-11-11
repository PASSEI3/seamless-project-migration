import { createServerFn } from '@tanstack/react-start';

/** OneSignal App ID is public (it is embedded in every page that asks for push permission). */
export const getPushConfig = createServerFn({ method: 'GET' }).handler(async () => {
  return { appId: process.env['ONESIGNAL_APP_ID'] ?? null };
});
