import { Feather } from "@expo/vector-icons";
import { useSignUp } from "@clerk/expo";
import { LinearGradient } from "expo-linear-gradient";
import { Link, useRouter, type Href } from "expo-router";
import React from "react";
import {
  KeyboardAvoidingView,
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

export default function SignUpScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signUp, errors, fetchStatus } = useSignUp();

  const [emailAddress, setEmailAddress] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const isFetching = fetchStatus === "fetching";

  const needsCode =
    signUp.status === "missing_requirements" &&
    signUp.unverifiedFields.includes("email_address") &&
    signUp.missingFields.length === 0;

  const handleSignUp = async () => {
    setSubmitError(null);
    const { error } = await signUp.password({ emailAddress, password });
    if (error) {
      setSubmitError(error.message ?? "Sign-up failed.");
      return;
    }
    await signUp.verifications.sendEmailCode();
  };

  const handleVerify = async () => {
    setSubmitError(null);
    await signUp.verifications.verifyEmailCode({ code });
    if (signUp.status === "complete") {
      await signUp.finalize({
        navigate: ({ session }) => {
          if (session?.currentTask) return;
          router.replace("/" as Href);
        },
      });
    } else {
      setSubmitError("Verification failed. Try again.");
    }
  };

  const renderCodeStep = () => (
    <>
      <Text style={[styles.title, { color: colors.foreground }]}>Check your inbox</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        We sent a verification code to {emailAddress}.
      </Text>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>
          Verification code
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              color: colors.foreground,
              backgroundColor: colors.input,
              borderColor: colors.border,
              letterSpacing: 8,
              textAlign: "center",
              fontSize: 22,
            },
          ]}
          keyboardType="numeric"
          placeholder="••••••"
          placeholderTextColor={colors.mutedForeground}
          value={code}
          onChangeText={setCode}
          maxLength={8}
        />
        {errors.fields.code ? (
          <Text style={[styles.error, { color: colors.destructive }]}>
            {errors.fields.code.message}
          </Text>
        ) : null}
      </View>

      {submitError ? (
        <Text style={[styles.error, { color: colors.destructive, marginTop: 4 }]}>
          {submitError}
        </Text>
      ) : null}

      <Pressable
        style={({ pressed }) => [
          styles.cta,
          {
            backgroundColor: colors.primary,
            opacity: code.length >= 4 && !isFetching ? (pressed ? 0.85 : 1) : 0.5,
          },
        ]}
        onPress={handleVerify}
        disabled={code.length < 4 || isFetching}
      >
        <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>
          {isFetching ? "Verifying…" : "Verify"}
        </Text>
      </Pressable>

      <Pressable
        style={styles.linkBtn}
        onPress={() => signUp.verifications.sendEmailCode()}
      >
        <Text style={[styles.linkBtnText, { color: colors.accent }]}>
          Send a new code
        </Text>
      </Pressable>
    </>
  );

  const renderSignUpStep = () => {
    const canSubmit =
      emailAddress.length > 0 && password.length >= 8 && !isFetching;
    return (
      <>
        <Text style={[styles.title, { color: colors.foreground }]}>Create account</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Sync your trips across devices in seconds.
        </Text>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Email</Text>
          <TextInput
            style={[
              styles.input,
              {
                color: colors.foreground,
                backgroundColor: colors.input,
                borderColor: colors.border,
              },
            ]}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor={colors.mutedForeground}
            value={emailAddress}
            onChangeText={setEmailAddress}
          />
          {errors.fields.emailAddress ? (
            <Text style={[styles.error, { color: colors.destructive }]}>
              {errors.fields.emailAddress.message}
            </Text>
          ) : null}
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Password{" "}
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>
              (8+ characters)
            </Text>
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: colors.foreground,
                backgroundColor: colors.input,
                borderColor: colors.border,
              },
            ]}
            autoComplete="new-password"
            secureTextEntry
            placeholder="Create a password"
            placeholderTextColor={colors.mutedForeground}
            value={password}
            onChangeText={setPassword}
          />
          {errors.fields.password ? (
            <Text style={[styles.error, { color: colors.destructive }]}>
              {errors.fields.password.message}
            </Text>
          ) : null}
        </View>

        {submitError ? (
          <Text style={[styles.error, { color: colors.destructive, marginTop: 4 }]}>
            {submitError}
          </Text>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.cta,
            {
              backgroundColor: colors.primary,
              opacity: canSubmit ? (pressed ? 0.85 : 1) : 0.5,
            },
          ]}
          onPress={handleSignUp}
          disabled={!canSubmit}
        >
          <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>
            {isFetching ? "Creating…" : "Create account"}
          </Text>
        </Pressable>

        {/* Required for sign-up flows. Clerk's bot sign-up protection is enabled by default */}
        <View nativeID="clerk-captcha" />

        <View style={styles.footerRow}>
          <Text style={{ color: colors.mutedForeground }}>Already have an account?</Text>
          <Link href={"/sign-in" as Href} asChild>
            <Pressable>
              <Text style={[styles.footerLink, { color: colors.primary }]}>Sign in</Text>
            </Pressable>
          </Link>
        </View>
      </>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["#1F2A6B", colors.background]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brandRow}>
            <View
              style={[
                styles.brandMark,
                { backgroundColor: colors.primary, shadowColor: colors.primary },
              ]}
            >
              <Feather name="git-branch" size={22} color={colors.primaryForeground} />
            </View>
            <Text style={[styles.brand, { color: colors.foreground }]}>Branchwing</Text>
          </View>

          {needsCode ? renderCodeStep() : renderSignUpStep()}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 24, flexGrow: 1 },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 40,
  },
  brandMark: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  brand: { fontFamily: "Inter_700Bold", fontSize: 22, letterSpacing: -0.5 },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 32,
    letterSpacing: -0.8,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 32,
  },
  field: { marginBottom: 16 },
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontFamily: "Inter_500Medium",
    fontSize: 16,
  },
  error: { fontFamily: "Inter_500Medium", fontSize: 13, marginTop: 6 },
  cta: {
    marginTop: 24,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  ctaText: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  linkBtn: { alignItems: "center", marginTop: 16, padding: 8 },
  linkBtnText: { fontFamily: "Inter_500Medium", fontSize: 14 },
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 24,
  },
  footerLink: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
});
