import { useCallback } from 'react';
import { useDialog, ActionSheetOption } from '../context/DialogContext';
import { InstagramUser } from '../types';
import { isLikelyBot } from '../utils/botHeuristic';
import {
  buildUserCsv,
  filterByRecency,
  writeAndShareCsv,
} from '../../services/exportCsv';

type ExportArgs = {
  /** The full list for this screen (e.g. all followers). */
  base: InstagramUser[];
  /** The currently-shown list (search/recency/toggles already applied). */
  visible: InstagramUser[];
  /** File name stem, e.g. `mutual-followers`. */
  fileBase: string;
  /** Share-sheet + scope-sheet title, e.g. `Export Followers`. */
  dialogTitle: string;
  /** Lowercase noun for empty-state copy, e.g. `followers`. */
  listLabel: string;
  /** Whether the list carries timestamps (gates the recency options). */
  hasTimestamps: boolean;
};

type Scope = 'visible' | 'all' | '7' | '30' | 'nospam';

const SCOPE_ICON: Record<Scope, ActionSheetOption['icon']> = {
  visible: 'eye-outline',
  all: 'albums-outline',
  '7': 'calendar-outline',
  '30': 'calendar-outline',
  nospam: 'shield-checkmark-outline',
};

const SCOPE_SUFFIX: Record<Scope, string> = {
  visible: '-visible',
  all: '',
  '7': '-last7',
  '30': '-last30',
  nospam: '-nospam',
};

/**
 * Shared "smart export" flow (C14) used by the per-list screens. Presents a
 * scope chooser (Visible now / Everything / Last 7 / Last 30 / hide spam, each
 * labelled with its count) then the Plain/Hashed format chooser, and writes +
 * shares the resulting CSV. "Visible now" is the respect-on-screen-filters path.
 */
export function useExportUsers() {
  const dialog = useDialog();

  return useCallback(
    async (args: ExportArgs) => {
      const { base, visible, fileBase, dialogTitle, listLabel, hasTimestamps } =
        args;

      if (base.length === 0) {
        dialog.alert({
          title: 'Nothing to export',
          message: `Your ${listLabel} list is empty.`,
          icon: 'information-circle',
        });
        return;
      }

      const noBots = base.filter((u) => !isLikelyBot(u.username));
      const isFiltered = visible.length !== base.length;

      const options: ActionSheetOption[] = [];
      if (isFiltered) {
        options.push({
          label: `Visible now (${visible.length})`,
          value: 'visible',
          icon: SCOPE_ICON.visible,
        });
      }
      options.push({
        label: `Everything (${base.length})`,
        value: 'all',
        icon: SCOPE_ICON.all,
      });
      if (hasTimestamps) {
        options.push({
          label: `Last 7 days (${filterByRecency(base, '7').length})`,
          value: '7',
          icon: SCOPE_ICON['7'],
        });
        options.push({
          label: `Last 30 days (${filterByRecency(base, '30').length})`,
          value: '30',
          icon: SCOPE_ICON['30'],
        });
      }
      if (noBots.length < base.length) {
        options.push({
          label: `Hide possible spam (${noBots.length})`,
          value: 'nospam',
          icon: SCOPE_ICON.nospam,
        });
      }

      // With only "Everything" available there's nothing to choose — skip ahead.
      let scope: Scope;
      if (options.length === 1) {
        scope = 'all';
      } else {
        const chosen = await dialog.actionSheet({
          title: dialogTitle,
          message: 'Choose which entries to include.',
          options,
        });
        if (!chosen) return;
        scope = chosen as Scope;
      }

      let subset: InstagramUser[];
      switch (scope) {
        case 'visible':
          subset = visible;
          break;
        case '7':
          subset = filterByRecency(base, '7');
          break;
        case '30':
          subset = filterByRecency(base, '30');
          break;
        case 'nospam':
          subset = noBots;
          break;
        default:
          subset = base;
      }

      if (subset.length === 0) {
        dialog.alert({
          title: 'Nothing to export',
          message: 'No entries match that filter.',
          icon: 'information-circle',
        });
        return;
      }

      const format = await dialog.actionSheet({
        title: 'Username format',
        message: 'Choose how usernames are written to the file.',
        options: [
          { label: 'Plain usernames', value: 'plain', icon: 'person-outline' },
          {
            label: 'Hashed (private)',
            value: 'hashed',
            icon: 'lock-closed-outline',
          },
        ],
      });
      if (!format) return;
      const hashed = format === 'hashed';

      try {
        const csv = await buildUserCsv(subset, { hashed });
        const res = await writeAndShareCsv(
          `${fileBase}${SCOPE_SUFFIX[scope]}${hashed ? '-hashed' : ''}`,
          csv,
          dialogTitle,
        );
        if (!res.shared) {
          dialog.alert({
            title: 'Saved',
            message: `File saved to ${res.fileUri}`,
            icon: 'document-text',
          });
        }
      } catch (err: any) {
        dialog.alert({
          title: 'Export failed',
          message: err?.message || 'Could not export.',
          icon: 'alert-circle',
        });
      }
    },
    [dialog],
  );
}
