// Notificações push no navegador/PWA: inscrever, cancelar e consultar este aparelho.
const toBytes = (b64) => Uint8Array.from(atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0));

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

export async function currentSub() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function enablePush(api, topics) {
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('Permissão negada. Libere as notificações nas configurações do aparelho.');
  const { key } = await api('/push/config');
  if (!key) throw new Error('As notificações ainda não foram configuradas no servidor.');
  await navigator.serviceWorker.register('/sw.js');
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(key) });
  const j = sub.toJSON();
  return api('/push/subscribe', { body: { endpoint: j.endpoint, keys: j.keys, topics } });
}

export async function disablePush(api) {
  const sub = await currentSub();
  if (!sub) return;
  await api('/push/unsubscribe', { body: { endpoint: sub.endpoint } }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}
