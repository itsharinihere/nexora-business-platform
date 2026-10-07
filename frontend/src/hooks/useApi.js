import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Data fetching with loading / error / refetch state.
 *
 * `deps` behaves like a useEffect dependency list: change it and the request
 * re-runs. An in-flight request is aborted when deps change or the component
 * unmounts, so a slow response can never overwrite fresher data.
 */
export function useApi(fetcher, deps = [], { enabled = true, initialData = null } = {}) {
  const [data, setData] = useState(initialData);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const controllerRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  const run = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const result = await fetcher({ signal: controller.signal });
      if (!mountedRef.current || controller.signal.aborted) return;

      // List endpoints resolve to `{ data, meta }`; single-record ones to the
      // payload itself. Handle both without the caller branching.
      if (result && typeof result === 'object' && 'data' in result && 'meta' in result) {
        setData(result.data);
        setMeta(result.meta);
      } else {
        setData(result);
        setMeta(null);
      }
    } catch (err) {
      if (err?.name === 'AbortError' || !mountedRef.current) return;
      setError(err);
    } finally {
      if (mountedRef.current && !controller.signal.aborted) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  useEffect(() => {
    run();
  }, [run]);

  return {
    data,
    meta,
    loading,
    error,
    refetch: run,
    setData,
    isEmpty: !loading && !error && (Array.isArray(data) ? data.length === 0 : data === null),
  };
}

/** Debounces a rapidly changing value, e.g. a search box. */
export function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}