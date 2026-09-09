/**
 * Contract for "let the user choose their Instagram export, then hand me its
 * bytes" — the one step of the import that is genuinely platform-specific.
 *
 * Native reads the picked file off disk as base64 through expo-file-system.
 * Web never touches the filesystem: the browser hands back a real DOM `File`,
 * which JSZip accepts directly, so the base64 round-trip disappears entirely.
 *
 * Splitting it this way keeps `instagramParser` free of platform branches, and
 * keeps `expo-file-system/legacy` — which has no working web implementation of
 * `readAsStringAsync` — out of the web import path.
 */

/** What JSZip should be handed, and whether it needs decoding first. */
export interface ZipPayload {
  data: string | Blob;
  /** True when `data` is a base64 string rather than raw bytes. */
  base64: boolean;
}

export interface PickedZip {
  /**
   * Size in bytes, when the platform can report it without reading the file.
   * Checked against the zip-bomb cap BEFORE `load()` pulls anything into
   * memory. Undefined when the platform cannot say, in which case the guard is
   * skipped rather than guessed at.
   */
  size?: number;
  /** Pull the archive into memory. Only called once the size guard has passed. */
  load(): Promise<ZipPayload>;
}

/** Resolves null when the user dismissed the picker — a normal action, not an error. */
export type PickZip = () => Promise<PickedZip | null>;
