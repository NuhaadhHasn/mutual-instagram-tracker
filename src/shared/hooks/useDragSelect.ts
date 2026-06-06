import { useCallback, useEffect, useRef } from 'react';
import { PanResponder, View } from 'react-native';

/**
 * Gallery-style drag-to-multi-select (C15d) using RN's built-in PanResponder —
 * no gesture-handler dependency. Attach the returned `wrapperRef` + `onLayout`
 * + `panHandlers` to a View wrapping the list, and `listRef` + `onScroll` to a
 * FlashList/FlatList inside it.
 *
 * Behaviour:
 *  - Only engages while `isActive` (i.e. already in select mode via long-press),
 *    and only once the finger moves vertically (>6px) — so taps still toggle a
 *    row and the long-press that enters select mode is untouched.
 *  - Captures the gesture from the list's scroll view during a vertical drag,
 *    maps the finger Y to a row index, and selects the range from the drag's
 *    anchor row, unioned with whatever was already selected when the drag began.
 *  - Auto-scrolls (and keeps extending the range) when the finger nears the top
 *    or bottom edge.
 *
 * Trade-off (documented): while in select mode a vertical drag selects rather
 * than free-scrolls; reach off-screen rows by dragging to an edge (auto-scroll),
 * or exit select mode to scroll normally.
 */
export function useDragSelect(opts: {
  isActive: boolean;
  selected: Set<string>;
  selectMany: (ids: string[]) => void;
  data: { username: string }[];
  itemHeight: number;
  paddingTop: number;
}) {
  const { isActive, selected, selectMany, data, itemHeight, paddingTop } = opts;

  // Live mirrors so the (once-created) PanResponder always reads current values.
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const selectManyRef = useRef(selectMany);
  selectManyRef.current = selectMany;
  const dataRef = useRef(data);
  dataRef.current = data;

  const listRef = useRef<any>(null);
  const wrapperRef = useRef<View>(null);
  const scrollYRef = useRef(0);
  const listTopRef = useRef(0);
  const listHeightRef = useRef(0);
  const anchorRef = useRef<number | null>(null);
  const baseRef = useRef<string[]>([]);
  const lastIndexRef = useRef<number | null>(null);
  const lastMoveYRef = useRef(0);
  const autoDirRef = useRef(0);
  const autoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const EDGE = 80;
  const STEP = 26;
  const INTERVAL = 40;

  const measure = useCallback(() => {
    wrapperRef.current?.measureInWindow((_x, y, _w, h) => {
      listTopRef.current = y;
      listHeightRef.current = h;
    });
  }, []);

  const indexFromMoveY = useCallback(
    (moveY: number) => {
      const offset = moveY - listTopRef.current + scrollYRef.current - paddingTop;
      let idx = Math.floor(offset / itemHeight);
      if (idx < 0) idx = 0;
      const max = dataRef.current.length - 1;
      if (idx > max) idx = max;
      return idx;
    },
    [itemHeight, paddingTop],
  );

  const applySelection = useCallback((idx: number) => {
    if (idx < 0) return;
    if (anchorRef.current === null) anchorRef.current = idx;
    if (idx === lastIndexRef.current) return;
    lastIndexRef.current = idx;
    const lo = Math.min(anchorRef.current, idx);
    const hi = Math.max(anchorRef.current, idx);
    const range = dataRef.current.slice(lo, hi + 1).map((u) => u.username);
    selectManyRef.current([...baseRef.current, ...range]);
  }, []);

  const stopAuto = useCallback(() => {
    autoDirRef.current = 0;
    if (autoTimerRef.current) {
      clearInterval(autoTimerRef.current);
      autoTimerRef.current = null;
    }
  }, []);

  const startAuto = useCallback(() => {
    if (autoTimerRef.current) return;
    autoTimerRef.current = setInterval(() => {
      if (autoDirRef.current === 0) return;
      const next = Math.max(0, scrollYRef.current + autoDirRef.current * STEP);
      scrollYRef.current = next;
      listRef.current?.scrollToOffset?.({ offset: next, animated: false });
      applySelection(indexFromMoveY(lastMoveYRef.current));
    }, INTERVAL);
  }, [applySelection, indexFromMoveY]);

  const updateAuto = useCallback(
    (moveY: number) => {
      const top = listTopRef.current;
      const bottom = top + listHeightRef.current;
      if (moveY < top + EDGE) {
        autoDirRef.current = -1;
        startAuto();
      } else if (moveY > bottom - EDGE) {
        autoDirRef.current = 1;
        startAuto();
      } else {
        autoDirRef.current = 0;
      }
    },
    [startAuto],
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_e, g) =>
        isActiveRef.current && Math.abs(g.dy) > 6,
      onMoveShouldSetPanResponderCapture: (_e, g) =>
        isActiveRef.current && Math.abs(g.dy) > 6,
      onPanResponderGrant: (_e, g) => {
        measure();
        baseRef.current = Array.from(selectedRef.current);
        anchorRef.current = null;
        lastIndexRef.current = null;
        lastMoveYRef.current = g.moveY || g.y0;
      },
      onPanResponderMove: (_e, g) => {
        lastMoveYRef.current = g.moveY;
        applySelection(indexFromMoveY(g.moveY));
        updateAuto(g.moveY);
      },
      onPanResponderRelease: () => {
        stopAuto();
        anchorRef.current = null;
        lastIndexRef.current = null;
      },
      onPanResponderTerminate: () => {
        stopAuto();
        anchorRef.current = null;
        lastIndexRef.current = null;
      },
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  const onScroll = useCallback((e: any) => {
    scrollYRef.current = e?.nativeEvent?.contentOffset?.y ?? 0;
  }, []);

  const onLayout = useCallback(() => {
    measure();
  }, [measure]);

  useEffect(() => () => stopAuto(), [stopAuto]);

  return {
    listRef,
    wrapperRef,
    panHandlers: panResponder.panHandlers,
    onScroll,
    onLayout,
  };
}
