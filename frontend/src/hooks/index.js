import { useCallback, useEffect, useRef, useState } from 'react';

// `useDebounce` and `useApi` live in `useApi.js` but are part of the public hook
// surface, so re-exported here to keep one import path.
export { useApi, useDebounce } from './useApi';

/** Subscribes to a CSS media query. */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const media = window.matchMedia(query);
    const listener = (event) => setMatches(event.matches);
    setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);

  return matches;
}

/** Breakpoints that match the Tailwind config, in one place. */
export const useIsMobile = () => useMediaQuery('(max-width: 767px)');
export const useIsTablet = () => useMediaQuery('(min-width: 768px) and (max-width: 1279px)');
export const useIsDesktop = () => useMediaQuery('(min-width: 1280px)');

/** Calls `handler` on outside pointer/touch interaction. */
export function useClickOutside(ref, handler, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;

    const listener = (event) => {
      const element = ref.current;
      if (!element || element.contains(event.target)) return;
      handler(event);
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener, { passive: true });
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler, enabled]);
}

/** Invokes `handler` on Escape. */
export function useEscapeKey(handler, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;
    const listener = (event) => {
      if (event.key === 'Escape') handler(event);
    };
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, [handler, enabled]);
}

/** Traps Tab focus inside a container while `active`. */
export function useFocusTrap(ref, active = true) {
  useEffect(() => {
    if (!active || !ref.current) return undefined;
    const container = ref.current;
    const previouslyFocused = document.activeElement;

    const focusables = () =>
      Array.from(
        container.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);

    const first = focusables()[0];
    first?.focus();

    const listener = (event) => {
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (!items.length) return;

      const firstItem = items[0];
      const lastItem = items.at(-1);

      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    container.addEventListener('keydown', listener);
    return () => {
      container.removeEventListener('keydown', listener);
      previouslyFocused?.focus?.();
    };
  }, [ref, active]);
}

/** Locks body scroll while an overlay is open. */
export function useScrollLock(locked) {
  useEffect(() => {
    if (!locked) return undefined;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [locked]);
}

/** A ref that always holds the latest value, for use inside other callbacks. */
export function useLatest(value) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

/** Persisted state backed by localStorage. */
export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initialValue : JSON.parse(raw);
    } catch {
      return initialValue;
    }
  });

  const set = useCallback(
    (next) => {
      setValue((current) => {
        const resolved = typeof next === 'function' ? next(current) : next;
        try {
          localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          /* storage unavailable */
        }
        return resolved;
      });
    },
    [key],
  );

  return [value, set];
}

/** Sets `document.title`, restoring it on unmount. */
export function useDocumentTitle(title) {
  useEffect(() => {
    if (!title) return undefined;
    const previous = document.title;
    document.title = `${title} · NEXORA`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}