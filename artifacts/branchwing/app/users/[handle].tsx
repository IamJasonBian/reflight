import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PublicTripCard } from "@/components/PublicTripCard";
import { useColors } from "@/hooks/useColors";
import {
  fetchPublicProfile,
  type PublicProfilePage,
} from "@/services/discoverApi";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; page: PublicProfilePage }
  | { kind: "notFound" }
  | { kind: "error" };

// Public profile for one handle. Lists that author's public trips.
export default function UserProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const handleStr = (handle ?? "").toString();

  const [state, setState] = React.useState<LoadState>({ kind: "loading" });

  const load = React.useCallback(() => {
    if (!handleStr) return () => {};
    let cancelled = false;
    setState({ kind: "loading" });
    fetchPublicProfile(handleStr).then((r) => {
      if (cancelled) return;
      if (r.kind === "ok") setState({ kind: "ok", page: r.page });
      else if (r.kind === "notFound") setState({ kind: "notFound" });
      else setState({ kind: "error" });
    });
    return () => {
      cancelled = true;
    };
  }, [handleStr]);

  useFocusEffect(load);

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
        <View style={styles.titleBlock}>
          <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>
            Public profile
          </Text>
          <Text
            style={[styles.title, { color: colors.foreground }]}
            numberOfLines={1}
          >
            @{state.kind === "ok" ? state.page.profile.handle : handleStr}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {state.kind === "loading" ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : state.kind === "notFound" ? (
        <View style={styles.center}>
          <View
            style={[styles.emptyIcon, { backgroundColor: colors.muted }]}
          >
            <Feather name="user-x" size={26} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            No such traveler
          </Text>
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>
            We couldn't find a Branchwing user with handle @{handleStr}.
          </Text>
        </View>
      ) : state.kind === "error" ? (
        <View style={styles.center}>
          <View
            style={[styles.emptyIcon, { backgroundColor: colors.muted }]}
          >
            <Feather
              name="alert-triangle"
              size={26}
              color={colors.mutedForeground}
            />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Couldn't load profile
          </Text>
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>
            Something went wrong on our side. Try again in a moment.
          </Text>
          <Pressable
            onPress={load}
            style={({ pressed }) => [
              styles.retry,
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : state.page.trips.length === 0 ? (
        <View style={styles.center}>
          <View
            style={[
              styles.emptyIcon,
              { backgroundColor: `${colors.primary}22` },
            ]}
          >
            <Feather name="map" size={26} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Nothing public yet
          </Text>
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>
            @{state.page.profile.handle} hasn't shared any itineraries.
          </Text>
        </View>
      ) : (
        <FlatList
          data={state.page.trips}
          keyExtractor={(it) => it.trip.id}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 32 },
          ]}
          renderItem={({ item }) => (
            <PublicTripCard
              trip={item.trip}
              authorHandle={state.page.profile.handle}
              onPressTrip={() =>
                router.push(`/public-trips/${encodeURIComponent(item.trip.id)}`)
              }
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  titleBlock: { flex: 1 },
  eyebrow: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.4,
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.4,
  },
  list: { paddingHorizontal: 16, paddingTop: 8 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 14,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  empty: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  retry: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  retryText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
