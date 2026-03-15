import { useEffect } from 'react';

import { notification } from 'antd';
import { useRegisterSW } from 'virtual:pwa-register/react';

const SW_UPDATE_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

const ReloadPrompt = (): null => {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      setInterval(() => {
        void registration.update();
      }, SW_UPDATE_INTERVAL_MS);
    },
  });

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
