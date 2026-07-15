import { registerSW } from "virtual:pwa-register";

const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000;

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  const updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) {
        return;
      }

      window.setInterval(() => {
        if (!registration.installing && navigator.onLine) {
          void registration.update();
        }
      }, UPDATE_CHECK_INTERVAL);
    },
    onNeedRefresh() {
      void updateSW(true);
    },
  });
}
