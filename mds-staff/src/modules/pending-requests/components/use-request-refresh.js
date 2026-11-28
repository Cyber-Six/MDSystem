import { useEffect } from 'react';

export default function useRequestRefresh(refresh) {
  useEffect(() => {
    const update = () => {
      if (document.visibilityState === 'visible') refresh({ force: true, silent: true });
    };
    const timer = window.setInterval(update, 30000);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('focus', update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('focus', update);
    };
  }, [refresh]);
}
