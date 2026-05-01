import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { ClerkLoaded, ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments, type Href } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { TripsProvider } from "@/contexts/TripsContext";
import { setSyncAuthTokenGetter } from "@/services/tripsSync";
import {
  fetchMyProfile,
  setDiscoverAuthTokenGetter,
} from "@/services/discoverApi";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
const proxyUrl = process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined;

function AppStack() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0A0E27" },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="trip/[id]" />
      <Stack.Screen
        name="routes"
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="route/[od]"
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="new-trip"
        options={{ presentation: "modal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="add-segment"
        options={{ presentation: "modal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="search-flights"
        options={{ presentation: "modal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="fork-branch"
        options={{ presentation: "modal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="account"
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="discover"
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="users/[handle]"
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="public-trips/[id]"
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen name="sign-in" options={{ animation: "fade" }} />
      <Stack.Screen name="sign-up" options={{ animation: "fade" }} />
    </Stack>
  );
}

function LoadingScreen() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#0A0E27",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <ActivityIndicator color="#FF6B35" />
    </View>
  );
}

// Routes between auth screens and the app, and wires Clerk tokens into
// the sync/discover API helpers.
function AuthGate() {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    setSyncAuthTokenGetter(() => getToken());
    setDiscoverAuthTokenGetter(() => getToken());
    return () => {
      setSyncAuthTokenGetter(null);
      setDiscoverAuthTokenGetter(null);
    };
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    const first = segments[0];
    const inAuthScreen = first === "sign-in" || first === "sign-up";
    const inPublicScreen =
      first === "discover" || first === "users" || first === "public-trips";
    if (!isSignedIn && !inAuthScreen && !inPublicScreen) {
      router.replace("/sign-in" as Href);
    } else if (isSignedIn && inAuthScreen) {
      router.replace("/" as Href);
    }
  }, [isLoaded, isSignedIn, segments, router]);

  // Bootstrap the public profile once per signed-in user so a Discover
  // handle exists even for users who never make a trip public.
  useEffect(() => {
    if (!isSignedIn || !userId) return;
    let cancelled = false;
    fetchMyProfile()
      .catch(() => null)
      .then((p) => {
        if (cancelled) return;
        if (!p) {
          setTimeout(() => {
            if (!cancelled) fetchMyProfile().catch(() => null);
          }, 5000);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, userId]);

  if (!isLoaded) return <LoadingScreen />;

  // TripsProvider stays mounted across sign-in/out so the Stack never
  // unmounts (avoids blank screens on sign-out).
  return (
    <TripsProvider userId={userId ?? null}>
      <AppStack />
    </TripsProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  if (!publishableKey) {
    // Render a useful error in dev rather than a cryptic Clerk crash.
    return (
      <SafeAreaProvider>
        <View
          style={{
            flex: 1,
            backgroundColor: "#0A0E27",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <StatusBar style="light" />
          <ActivityIndicator color="#FF6B35" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      tokenCache={tokenCache}
      proxyUrl={proxyUrl}
    >
      <ClerkLoaded>
        <SafeAreaProvider>
          <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <KeyboardProvider>
                  <StatusBar style="light" />
                  <AuthGate />
                </KeyboardProvider>
              </GestureHandlerRootView>
            </QueryClientProvider>
          </ErrorBoundary>
        </SafeAreaProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
