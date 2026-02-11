/**
 * Capacitor Native Services
 * Handles push notifications, geolocation, and status bar for the mobile app.
 * Falls back gracefully on web — no errors if Capacitor isn't present.
 */

const isNative = () => {
  try {
    return window.Capacitor?.isNativePlatform() === true;
  } catch {
    return false;
  }
};

// ==================== PUSH NOTIFICATIONS ====================

export const initPushNotifications = async (onTokenReceived, onNotificationReceived) => {
  if (!isNative()) return;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    const permResult = await PushNotifications.requestPermissions();
    if (permResult.receive !== 'granted') {
      console.warn('Push notification permission denied');
      return;
    }

    await PushNotifications.register();

    PushNotifications.addListener('registration', (token) => {
      console.log('FCM Token:', token.value);
      if (onTokenReceived) onTokenReceived(token.value);
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.error('Push registration error:', err);
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push received:', notification);
      if (onNotificationReceived) onNotificationReceived(notification);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('Push action:', action);
      const link = action.notification?.data?.link;
      if (link) window.location.href = link;
    });
  } catch (err) {
    console.log('Push notifications not available:', err.message);
  }
};

// ==================== GEOLOCATION ====================

export const getCurrentPosition = async () => {
  if (isNative()) {
    try {
      const { Geolocation } = await import('@capacitor/geolocation');
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch (err) {
      console.error('Native geolocation error:', err);
      throw err;
    }
  }

  // Web fallback
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      reject,
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
};

// ==================== STATUS BAR ====================

export const configureStatusBar = async () => {
  if (!isNative()) return;
  try {
    const { StatusBar } = await import('@capacitor/status-bar');
    await StatusBar.setBackgroundColor({ color: '#0a0a14' });
  } catch {}
};

export { isNative };
