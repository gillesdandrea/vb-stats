import { useEffect, useRef } from 'react';

import { notification } from 'antd';
import { useRegisterSW } from 'virtual:pwa-register/react';

const SW_UPDATE_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const SW_UPDATE_THROTTLE_MS = 60 * 1000; // avoid a check on every alt-tab

const ReloadPrompt = (): null => {
  const registrationRef = useRef<ServiceWorkerRegistration | undefined>(undefined);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      registrationRef.current = registration;
      setInterval(() => {
        void registration.update();
      }, SW_UPDATE_INTERVAL_MS);
    },
  });

  // A desktop tab can stay open for days; without this the hourly timer is the
  // only thing that ever notices a new deploy.
  useEffect(() => {
    let lastCheck = 0;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastCheck < SW_UPDATE_THROTTLE_MS) return;
      lastCheck = now;
      void registrationRef.current?.update();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  useEffect(() => {
    if (!needRefresh) return;

    const key = 'sw-update';
    notification.info({
      key,
      message: 'Update available',
      description: 'A new version is available. Reload to update.',
      btn: (
        <button
          type="button"
          onClick={() => {
            notification.destroy(key);
            void updateServiceWorker(true);
          }}
          style={{
            background: '#1668dc',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '4px 16px',
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          Reload
        </button>
      ),
      duration: 0,
      placement: 'bottomRight',
    });
  }, [needRefresh, updateServiceWorker]);

  return null;
};

export default ReloadPrompt;
