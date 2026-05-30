import { useCallback, useMemo, useState } from 'react';

export function useMultiSelect<T extends string = string>() {
  const [selected, setSelected] = useState<Set<T>>(new Set());

  const isActive = selected.size > 0;
  const count = selected.size;

  const toggle = useCallback((id: T) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const select = useCallback((id: T) => {
    setSelected((s) => {
      if (s.has(id)) return s;
      const next = new Set(s);
      next.add(id);
      return next;
    });
  }, []);

  const selectMany = useCallback((ids: T[]) => {
    setSelected(new Set(ids));
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  const has = useCallback((id: T) => selected.has(id), [selected]);

  const api = useMemo(
    () => ({ selected, isActive, count, toggle, select, selectMany, clear, has }),
    [selected, isActive, count, toggle, select, selectMany, clear, has],
  );

  return api;
}
