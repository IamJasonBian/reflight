import { Feather } from "@expo/vector-icons";
import { useClerk, useReverification, useSession, useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { dropUserCache } from "@/lib/storage";
import { purgeRemoteTrips } from "@/services/tripsSync";

type ReverifyState = {
  resolve: () => void;
  reject: () => void;
};

export default function AccountScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut } = useClerk();
  const { user } = useUser();
  const { session } = useSession();
  const [busy, setBusy] = React.useState<null | "signout" | "delete">(null);

  // Custom reverification: when Clerk says the session is too old to perform
  // a sensitive action like `user.delete()`, we show our own password modal,
  // re-verify with `session.startVerification` + `attemptFirstFactorVerification`,
  // and then resume the original action. This avoids depending on Clerk's
  // built-in modal UI (which doesn't render in @clerk/expo's web build).
  const [reverify, setReverify] = React.useState<ReverifyState | null>(null);
  const [reverifyPassword, setReverifyPassword] = React.useState("");
  const [reverifyError, setReverifyError] = React.useState<string | null>(null);
  const [reverifyBusy, setReverifyBusy] = React.useState(false);

  const deleteUser = useReverification(
    async () => {
      if (!user) throw new Error("Not signed in");
      await user.delete();
    },
    {
      onNeedsReverification: ({ complete, cancel }) => {
        setReverifyError(null);
        setReverifyPassword("");
        setReverify({ resolve: complete, reject: cancel });
      },
    },
  );

  const submitReverify = React.useCallback(async () => {
    if (!session) {
      setReverifyError("Session unavailable. Please sign in again.");
      return;
    }
    if (reverifyPassword.length === 0) {
      setReverifyError("Enter your password.");
      return;
    }
    setReverifyBusy(true);
    setReverifyError(null);
    try {
      await session.startVerification({ level: "first_factor" });
      const result = await session.attemptFirstFactorVerification({
        strategy: "password",
        password: reverifyPassword,
      });
      if (result.status !== "complete") {
        throw new Error("Verification failed.");
      }
      const r = reverify;
      setReverify(null);
      setReverifyPassword("");
      r?.resolve();
    } catch (err) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : "Wrong password. Try again.";
      setReverifyError(msg);
    } finally {
      setReverifyBusy(false);
    }
  }, [session, reverifyPassword, reverify]);

  const cancelReverify = React.useCallback(() => {
    const r = reverify;
    setReverify(null);
    setReverifyPassword("");
    setReverifyError(null);
    r?.reject();
  }, [reverify]);

  const userEmail = user?.primaryEmailAddress?.emailAddress ?? "";

  const confirm = React.useCallback(
    (
      title: string,
      message: string,
      destructiveLabel: string,
      onConfirm: () => void,
    ) => {
      if (Platform.OS === "web") {
        if (
          typeof window !== "undefined" &&
          window.confirm(`${title}\n\n${message}`)
        ) {
          onConfirm();
        }
        return;
      }
      Alert.alert(title, message, [
        { text: "Cancel", style: "cancel" },
        { text: destructiveLabel, style: "destructive", onPress: onConfirm },
      ]);
    },
    [],
  );

  const onSignOut = React.useCallback(() => {
    confirm(
      "Sign out",
      userEmail ? `Sign out of ${userEmail}?` : "Sign out of Branchwing?",
      "Sign out",
      () => {
        setBusy("signout");
        signOut().catch(() => setBusy(null));
      },
    );
  }, [confirm, signOut, userEmail]);

  const onDelete = React.useCallback(() => {
    confirm(
      "Delete account",
      "This permanently deletes your Branchwing account and removes every trip and branch we have stored for you. This cannot be undone.",
      "Delete account",
      () => {
        (async () => {
          setBusy("delete");
          try {
            // 1. Purge trips on the server while we still hold a valid Clerk
            //    session/token. We MUST verify the purge succeeded; if it
            //    fails (network/server) we abort before touching the Clerk
            //    user so we never end up with the user record gone but their
            //    trip data still retained on the backend (App Privacy /
            //    Guideline 5.1.1(v) requires both go together).
            const purged = await purgeRemoteTrips();
            if (!purged) {
              throw new Error(
                "Couldn't reach Branchwing's servers to delete your trips. Please check your connection and try again.",
              );
            }
            // 2. Drop this user's local cache so re-signup on the same device
            //    doesn't see ghost trips before reconcile.
            if (user?.id) await dropUserCache(user.id);
            // 3. Delete the Clerk user (handles reverification challenge via
            //    the password modal above if needed). Then sign out so the
            //    AuthGate redirect to /sign-in fires immediately.
            //
            //    If this rejects after the server purge has already succeeded,
            //    the user's data is already gone; only the auth record remains.
            //    Surface that explicitly so they know what to retry.
            try {
              await deleteUser();
            } catch (err) {
              if (err instanceof Error && /cancel/i.test(err.message)) {
                // User cancelled the password modal — re-throw so the outer
                // catch swallows silently.
                throw err;
              }
              throw new Error(
                "Your trips were deleted, but we couldn't finish removing your account. Please try Delete account again.",
              );
            }
            await signOut().catch(() => {});
          } catch (err) {
            setBusy(null);
            const msg =
              err instanceof Error ? err.message : "Could not delete account.";
            // Cancellation from the password modal is expected; don't yell.
            if (!/cancel/i.test(msg)) {
              if (Platform.OS === "web") {
                if (typeof window !== "undefined") window.alert(msg);
              } else {
                Alert.alert("Delete failed", msg);
              }
            }
          }
        })();
      },
    );
  }, [confirm, deleteUser, signOut, user]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Back"
          style={({ pressed }) => [
            styles.backBtn,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Feather name="chevron-left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Account</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingBottom: insets.bottom + 32 },
        ]}
      >
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Signed in as
          </Text>
          <Text style={[styles.email, { color: colors.foreground }]}>
            {userEmail || "—"}
          </Text>
        </View>

        <Pressable
          onPress={busy ? undefined : onSignOut}
          accessibilityLabel="Sign out"
          style={({ pressed }) => [
            styles.action,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: pressed || busy ? 0.85 : 1,
            },
          ]}
        >
          <Feather name="log-out" size={18} color={colors.foreground} />
          <Text style={[styles.actionText, { color: colors.foreground }]}>
            Sign out
          </Text>
          {busy === "signout" ? (
            <ActivityIndicator color={colors.mutedForeground} />
          ) : (
            <Feather
              name="chevron-right"
              size={18}
              color={colors.mutedForeground}
            />
          )}
        </Pressable>

        <Text style={[styles.section, { color: colors.mutedForeground }]}>
          Danger zone
        </Text>
        <Pressable
          onPress={busy ? undefined : onDelete}
          accessibilityLabel="Delete account"
          style={({ pressed }) => [
            styles.action,
            {
              backgroundColor: colors.card,
              borderColor: "#5a1f24",
              opacity: pressed || busy ? 0.85 : 1,
            },
          ]}
        >
          <Feather name="trash-2" size={18} color="#ff4d5a" />
          <Text style={[styles.actionText, { color: "#ff4d5a" }]}>
            Delete account
          </Text>
          {busy === "delete" ? (
            <ActivityIndicator color="#ff4d5a" />
          ) : (
            <Feather name="chevron-right" size={18} color="#ff4d5a" />
          )}
        </Pressable>
        <Text style={[styles.helper, { color: colors.mutedForeground }]}>
          Deletes your Branchwing account and every trip, branch, and segment
          stored for you. This cannot be undone.
        </Text>
      </ScrollView>

      <Modal
        visible={reverify !== null}
        transparent
        animationType="fade"
        onRequestClose={cancelReverify}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalRoot}
        >
          <Pressable style={styles.modalBackdrop} onPress={cancelReverify} />
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Confirm your password
            </Text>
            <Text
              style={[styles.modalBody, { color: colors.mutedForeground }]}
            >
              For your security, re-enter your Branchwing password to delete
              your account.
            </Text>
            <TextInput
              accessibilityLabel="Password"
              placeholder="Password"
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry
              autoFocus
              value={reverifyPassword}
              onChangeText={setReverifyPassword}
              onSubmitEditing={submitReverify}
              style={[
                styles.modalInput,
                {
                  borderColor: colors.border,
                  color: colors.foreground,
                  backgroundColor: colors.background,
                },
              ]}
            />
            {reverifyError ? (
              <Text style={styles.modalError}>{reverifyError}</Text>
            ) : null}
            <View style={styles.modalRow}>
              <Pressable
                onPress={cancelReverify}
                accessibilityLabel="Cancel"
                style={({ pressed }) => [
                  styles.modalBtn,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text
                  style={[styles.modalBtnText, { color: colors.foreground }]}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={reverifyBusy ? undefined : submitReverify}
                accessibilityLabel="Confirm delete"
                style={({ pressed }) => [
                  styles.modalBtn,
                  styles.modalBtnDanger,
                  { opacity: pressed || reverifyBusy ? 0.85 : 1 },
                ]}
              >
                {reverifyBusy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: "#fff" }]}>
                    Delete account
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  title: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  body: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 4,
  },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", letterSpacing: 0.4 },
  email: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  section: {
    marginTop: 18,
    marginBottom: 4,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  actionText: { flex: 1, fontSize: 16, fontFamily: "Inter_500Medium" },
  helper: {
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 4,
    fontFamily: "Inter_400Regular",
  },
  modalRoot: { flex: 1, justifyContent: "center", alignItems: "center" },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  modalCard: {
    width: "86%",
    maxWidth: 400,
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  modalTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  modalBody: { fontSize: 13, lineHeight: 18, fontFamily: "Inter_400Regular" },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  modalError: {
    fontSize: 12,
    color: "#ff4d5a",
    fontFamily: "Inter_500Medium",
  },
  modalRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  modalBtnDanger: {
    backgroundColor: "#d6263a",
    borderColor: "#d6263a",
  },
  modalBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
