import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from './ThemeContext';
import { ColorSet, Shadows, Spacing } from '../constants/theme';

type IoniconName = keyof typeof Ionicons.glyphMap;

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  icon?: IoniconName;
  iconColor?: string;
};

export type AlertOptions = {
  title: string;
  message?: string;
  icon?: IoniconName;
  iconColor?: string;
  dismissLabel?: string;
};

export type ActionSheetOption = {
  label: string;
  value: string;
  icon?: IoniconName;
  iconColor?: string;
  destructive?: boolean;
};

export type ActionSheetOptions = {
  title?: string;
  message?: string;
  options: ActionSheetOption[];
  cancelLabel?: string;
};

export type PromptOptions = {
  title: string;
  message?: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  icon?: IoniconName;
  multiline?: boolean;
};

type DialogState =
  | { kind: 'confirm'; options: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: 'alert'; options: AlertOptions; resolve: () => void }
  | {
      kind: 'action-sheet';
      options: ActionSheetOptions;
      resolve: (v: string | null) => void;
    }
  | {
      kind: 'prompt';
      options: PromptOptions;
      resolve: (v: string | null) => void;
    }
  | null;

type DialogAPI = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  alert: (options: AlertOptions) => Promise<void>;
  actionSheet: (options: ActionSheetOptions) => Promise<string | null>;
  prompt: (options: PromptOptions) => Promise<string | null>;
};

const DialogContext = createContext<DialogAPI | null>(null);

export function useDialog(): DialogAPI {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used inside <DialogProvider>');
  return ctx;
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DialogState>(null);
  const stateRef = useRef<DialogState>(null);
  stateRef.current = state;

  const close = useCallback(() => setState(null), []);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setState({ kind: 'confirm', options, resolve });
      }),
    [],
  );

  const alert = useCallback(
    (options: AlertOptions) =>
      new Promise<void>((resolve) => {
        setState({ kind: 'alert', options, resolve });
      }),
    [],
  );

  const actionSheet = useCallback(
    (options: ActionSheetOptions) =>
      new Promise<string | null>((resolve) => {
        setState({ kind: 'action-sheet', options, resolve });
      }),
    [],
  );

  const prompt = useCallback(
    (options: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        setState({ kind: 'prompt', options, resolve });
      }),
    [],
  );

  const api = useMemo<DialogAPI>(
    () => ({ confirm, alert, actionSheet, prompt }),
    [confirm, alert, actionSheet, prompt],
  );

  const handleDismiss = useCallback(() => {
    if (!stateRef.current) return;
    if (stateRef.current.kind === 'confirm') {
      stateRef.current.resolve(false);
    } else if (stateRef.current.kind === 'alert') {
      stateRef.current.resolve();
    } else if (stateRef.current.kind === 'action-sheet') {
      stateRef.current.resolve(null);
    } else if (stateRef.current.kind === 'prompt') {
      stateRef.current.resolve(null);
    }
    close();
  }, [close]);

  return (
    <DialogContext.Provider value={api}>
      {children}
      <DialogRenderer state={state} onDismiss={handleDismiss} close={close} />
    </DialogContext.Provider>
  );
}

function DialogRenderer({
  state,
  onDismiss,
  close,
}: {
  state: DialogState;
  onDismiss: () => void;
  close: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Modal
      visible={state !== null}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable
          style={styles.card}
          onPress={(e) => e.stopPropagation()}
        >
          {state?.kind === 'confirm' && (
            <ConfirmBody
              options={state.options}
              colors={colors}
              styles={styles}
              onChoose={(ok) => {
                state.resolve(ok);
                close();
              }}
            />
          )}
          {state?.kind === 'alert' && (
            <AlertBody
              options={state.options}
              colors={colors}
              styles={styles}
              onDismiss={() => {
                state.resolve();
                close();
              }}
            />
          )}
          {state?.kind === 'action-sheet' && (
            <ActionSheetBody
              options={state.options}
              colors={colors}
              styles={styles}
              onChoose={(value) => {
                state.resolve(value);
                close();
              }}
            />
          )}
          {state?.kind === 'prompt' && (
            <PromptBody
              options={state.options}
              colors={colors}
              styles={styles}
              onSubmit={(value) => {
                state.resolve(value);
                close();
              }}
              onCancel={() => {
                state.resolve(null);
                close();
              }}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ConfirmBody({
  options,
  colors,
  styles,
  onChoose,
}: {
  options: ConfirmOptions;
  colors: ColorSet;
  styles: ReturnType<typeof makeStyles>;
  onChoose: (ok: boolean) => void;
}) {
  const accent = options.destructive ? colors.error : colors.primary;
  const iconBg = options.destructive ? colors.error + '18' : accent + '18';
  const icon: IoniconName =
    options.icon ?? (options.destructive ? 'trash-outline' : 'help-circle-outline');

  return (
    <>
      <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={28} color={options.iconColor ?? accent} />
      </View>
      <Text style={styles.title}>{options.title}</Text>
      {options.message ? (
        <Text style={styles.message}>{options.message}</Text>
      ) : null}
      <View style={styles.confirmRow}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => onChoose(false)}
          style={[styles.btn, styles.btnCancel]}
        >
          <Text style={styles.btnCancelText}>
            {options.cancelLabel ?? 'Cancel'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => onChoose(true)}
          style={[
            styles.btn,
            { backgroundColor: accent },
          ]}
        >
          <Text style={styles.btnPrimaryText}>
            {options.confirmLabel ?? 'Confirm'}
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

function AlertBody({
  options,
  colors,
  styles,
  onDismiss,
}: {
  options: AlertOptions;
  colors: ColorSet;
  styles: ReturnType<typeof makeStyles>;
  onDismiss: () => void;
}) {
  const accent = options.iconColor ?? colors.primary;
  const icon: IoniconName = options.icon ?? 'information-circle';

  return (
    <>
      <View style={[styles.iconCircle, { backgroundColor: accent + '18' }]}>
        <Ionicons name={icon} size={28} color={accent} />
      </View>
      <Text style={styles.title}>{options.title}</Text>
      {options.message ? (
        <Text style={styles.message}>{options.message}</Text>
      ) : null}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onDismiss}
        style={[styles.btn, { backgroundColor: colors.primary, width: '100%' }]}
      >
        <Text style={styles.btnPrimaryText}>
          {options.dismissLabel ?? 'OK'}
        </Text>
      </TouchableOpacity>
    </>
  );
}

function ActionSheetBody({
  options,
  colors,
  styles,
  onChoose,
}: {
  options: ActionSheetOptions;
  colors: ColorSet;
  styles: ReturnType<typeof makeStyles>;
  onChoose: (value: string | null) => void;
}) {
  return (
    <>
      {options.title && <Text style={styles.title}>{options.title}</Text>}
      {options.message ? (
        <Text style={styles.message}>{options.message}</Text>
      ) : null}
      <View style={styles.actionList}>
        {options.options.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            activeOpacity={0.7}
            onPress={() => onChoose(opt.value)}
            style={styles.actionItem}
          >
            {opt.icon && (
              <View
                style={[
                  styles.actionIcon,
                  {
                    backgroundColor:
                      (opt.iconColor ??
                        (opt.destructive ? colors.error : colors.primary)) +
                      '18',
                  },
                ]}
              >
                <Ionicons
                  name={opt.icon}
                  size={18}
                  color={
                    opt.iconColor ??
                    (opt.destructive ? colors.error : colors.primary)
                  }
                />
              </View>
            )}
            <Text
              style={[
                styles.actionLabel,
                opt.destructive && { color: colors.error },
              ]}
            >
              {opt.label}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => onChoose(null)}
        style={[styles.btn, styles.btnCancel, { width: '100%' }]}
      >
        <Text style={styles.btnCancelText}>
          {options.cancelLabel ?? 'Cancel'}
        </Text>
      </TouchableOpacity>
    </>
  );
}

function PromptBody({
  options,
  colors,
  styles,
  onSubmit,
  onCancel,
}: {
  options: PromptOptions;
  colors: ColorSet;
  styles: ReturnType<typeof makeStyles>;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(options.initialValue ?? '');
  const accent = colors.primary;
  const icon: IoniconName = options.icon ?? 'create-outline';

  return (
    <>
      <View style={[styles.iconCircle, { backgroundColor: accent + '18' }]}>
        <Ionicons name={icon} size={28} color={accent} />
      </View>
      <Text style={styles.title}>{options.title}</Text>
      {options.message ? (
        <Text style={styles.message}>{options.message}</Text>
      ) : null}
      <TextInput
        style={[styles.promptInput, options.multiline && styles.promptInputMultiline]}
        value={value}
        onChangeText={setValue}
        placeholder={options.placeholder}
        placeholderTextColor={colors.textSecondary}
        autoFocus
        multiline={options.multiline}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <View style={styles.confirmRow}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onCancel}
          style={[styles.btn, styles.btnCancel]}
        >
          <Text style={styles.btnCancelText}>
            {options.cancelLabel ?? 'Cancel'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => onSubmit(value.trim())}
          style={[styles.btn, { backgroundColor: accent }]}
        >
          <Text style={styles.btnPrimaryText}>
            {options.confirmLabel ?? 'Save'}
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

function makeStyles(colors: ColorSet) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.lg,
    },
    card: {
      width: '100%',
      maxWidth: 380,
      backgroundColor: colors.cardBackground,
      borderRadius: 22,
      padding: Spacing.lg,
      alignItems: 'center',
      ...Shadows.lg,
    },
    iconCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.sm + 2,
    },
    title: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.2,
      textAlign: 'center',
    },
    message: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 6,
      marginBottom: Spacing.md,
      lineHeight: 19,
    },
    promptInput: {
      width: '100%',
      backgroundColor: colors.inputBackground,
      borderRadius: 12,
      paddingHorizontal: Spacing.md,
      paddingVertical: 10,
      fontSize: 15,
      color: colors.text,
      marginBottom: Spacing.sm,
    },
    promptInputMultiline: {
      minHeight: 80,
      textAlignVertical: 'top',
    },
    confirmRow: {
      flexDirection: 'row',
      gap: 10,
      width: '100%',
      marginTop: Spacing.sm,
    },
    btn: {
      flex: 1,
      height: 46,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnCancel: {
      backgroundColor: colors.sortPillInactive,
    },
    btnCancelText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    btnPrimaryText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    actionList: {
      width: '100%',
      marginTop: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    actionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: colors.surface,
      marginBottom: 6,
    },
    actionIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    actionLabel: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
  });
}
