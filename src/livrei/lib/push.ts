import { getPushConfig } from '@/livrei/push.functions';

export type PushStatus = 'enabled' | 'not-configured' | 'open-in-new-tab' | 'unsupported' | 'error';

type OneSignalApi = {
  init: (o: Record<string, unknown>) => Promise<void>;
  login: (externalId: string) => Promise<void>;
  logout: () => Promise<void>;
};
type OneSignalWindow = Window & { OneSignalDeferred?: ((os: OneSignalApi) => void | Promise<void>)[] };

let initialized: Promise<PushStatus> | null = null;

/**
 * Links this device to the signed-in reader in OneSignal (external_id = user id),
 * so database triggers can reach them with push. No-op until the OneSignal keys exist.
 */
export function initPush(userId: string): Promise<PushStatus> {
  if (typeof window === 'undefined') return Promise.resolve('unsupported');
  if (window.top !== window.self) return Promise.resolve('open-in-new-tab');
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return Promise.resolve('unsupported');

  initialized ??= (async () => {
    const { appId } = await getPushConfig();
    if (!appId) return 'not-configured';
    const w = window as OneSignalWindow;
    w.OneSignalDeferred = w.OneSignalDeferred || [];
    const script = document.createElement('script');
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
    script.defer = true;
    document.head.appendChild(script);
    await new Promise<void>((resolve) => {
      w.OneSignalDeferred!.push(async (os) => {
        await os.init({ appId, serviceWorkerPath: '/OneSignalSDKWorker.js', allowLocalhostAsSecureOrigin: true });
        resolve();
      });
    });
    return 'enabled' as const;
  })().catch(() => 'error' as const);

  return initialized.then(async (status) => {
    if (status === 'enabled') {
      (window as OneSignalWindow).OneSignalDeferred!.push((os) => os.login(userId));
    }
    return status;
  });
}

export function logoutPush() {
  if (typeof window === 'undefined') return;
  const w = window as OneSignalWindow;
  if (initialized && w.OneSignalDeferred) w.OneSignalDeferred.push((os) => os.logout());
}
