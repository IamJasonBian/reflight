import { Alert, Platform } from "react-native";

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

/**
 * Cross-platform two-button confirmation dialog.
 *
 * `Alert.alert` from `react-native` works fine on iOS/Android, but on
 * `react-native-web` multi-button alerts are not implemented — calls become
 * silent no-ops, which would let destructive actions like flipping a trip
 * Public→Private go through with zero confirmation. We therefore branch by
 * platform and fall back to the browser's `window.confirm` on web, which
 * (a) actually appears, (b) is keyboard-accessible, and (c) is what
 * Playwright-based testing harnesses expect.
 *
 * Resolves to `true` if the user confirmed, `false` if they cancelled.
 */
export function confirmAction(opts: ConfirmOptions): Promise<boolean> {
  const {
    title,
    message,
    confirmLabel = "OK",
    cancelLabel = "Cancel",
    destructive = false,
  } = opts;

  if (Platform.OS === "web") {
    // window.confirm doesn't render the labels we passed, but it still asks
    // the right yes/no question. The dialog text combines title + message so
    // both are visible (and assertable in tests). Fail-CLOSED if window is
    // missing (SSR, test harness without a real browser): never silently
    // confirm a destructive privacy or delete action.
    if (typeof window === "undefined" || typeof window.confirm !== "function") {
      return Promise.resolve(false);
    }
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      {
        text: cancelLabel,
        style: "cancel",
        onPress: () => resolve(false),
      },
      {
        text: confirmLabel,
        style: destructive ? "destructive" : "default",
        onPress: () => resolve(true),
      },
    ]);
  });
}
