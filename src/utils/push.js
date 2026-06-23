import { Capacitor } from '@capacitor/core';
import api from './api';

// Tracks the FCM token this device registered, so we can unregister it on logout.
let registeredToken = null;
let initialized = false;

/**
 * Initialise mobile push notifications. No-op on web (browser) — only runs inside
 * the native app. Asks permission, registers with FCM, and sends the device token
 * to the backend so the agent can receive lead-assignment pushes.
 */
export async function initPush() {
  if (initialized || !Capacitor.isNativePlatform()) return;
  initialized = true;

  const { PushNotifications } = await import('@capacitor/push-notifications');

  // High-importance channel → heads-up banner + default ringtone + vibration (Android 8+).
  try {
    await PushNotifications.createChannel({
      id: 'leads',
      name: 'Lead alerts',
      description: 'New and reassigned leads',
      importance: 5, // MAX → heads-up + sound
      sound: 'default',
      vibration: true,
      visibility: 1,
      lights: true,
    });
  } catch {
    /* channel API is Android-only; ignore on iOS */
  }

  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== 'granted') {
    initialized = false; // allow a retry on next login
    return;
  }

  // Device token arrives here → save it to the backend for this user.
  PushNotifications.addListener('registration', async (token) => {
    registeredToken = token.value;
    try {
      await api.post('/users/me/device-token', { token: token.value });
    } catch {
      /* best-effort */
    }
  });

  PushNotifications.addListener('registrationError', (err) => {
    console.error('[push] registration error', err);
  });

  await PushNotifications.register();
}

/**
 * Unregister this device's token on logout so a shared phone doesn't keep getting
 * the previous user's lead notifications.
 */
export async function teardownPush() {
  if (!Capacitor.isNativePlatform() || !registeredToken) return;
  try {
    await api.delete('/users/me/device-token', { data: { token: registeredToken } });
  } catch {
    /* best-effort */
  }
  registeredToken = null;
  initialized = false;
}
