'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Подписка на CSS media query без рассинхронизации гидратации.
 * На сервере (и при первой гидратации) возвращает `serverFallback`,
 * затем React перерисовывает компонент с фактическим значением matchMedia.
 */
export function useMediaQuery(query: string, serverFallback = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query]
  );

  const getSnapshot = () =>
    typeof window !== 'undefined' && !!window.matchMedia
      ? window.matchMedia(query).matches
      : serverFallback;

  return useSyncExternalStore(subscribe, getSnapshot, () => serverFallback);
}

/** Мобильный брейкпоинт: экраны уже Tailwind `md` (< 768px). */
export const MOBILE_MEDIA_QUERY = '(max-width: 767.98px)';

export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_MEDIA_QUERY, false);
}
