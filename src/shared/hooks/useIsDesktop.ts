import { Platform, useWindowDimensions } from 'react-native';

/**
 * Width at which Mutual switches from the phone layout to the desktop shell:
 * side navigation instead of bottom tabs, and grids that use the extra room.
 * 900 is comfortably past a tablet in portrait, so the change only happens
 * when there is genuinely space for a sidebar plus real content beside it.
 */
export const DESKTOP_MIN_WIDTH = 900;

/**
 * True when the app should render its desktop layout.
 *
 * Deliberately web-only. An Android tablet keeps the phone layout that was
 * designed, shipped and device-tested for it — widening the breakpoint to
 * native would change the released app's behaviour, and this exists to make
 * the browser build feel native to a desktop, not to redesign Android.
 *
 * Measured through `useWindowDimensions`, so resizing a browser window flips
 * the layout live rather than only at load.
 */
export function useIsDesktop(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= DESKTOP_MIN_WIDTH;
}
