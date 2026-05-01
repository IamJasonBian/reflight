import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BranchPicker } from "@/components/BranchPicker";
import { BranchTree } from "@/components/BranchTree";
import { Pill } from "@/components/Pill";
import { TimeSpine } from "@/components/TimeSpine";
import { useColors } from "@/hooks/useColors";
import {
  branchHasAnyPrice,
  branchTotalPrice,
  durationMs,
  fmtDate,
  fmtDuration,
  fmtPrice,
} from "@/lib/time";
import {
  fetchPublicTrip,
  type FetchPublicTripResult,
} from "@/services/discoverApi";

type ViewMode = "spine" | "tree";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; result: Extract<FetchPublicTripResult, { kind: "ok" }> }
  | { kind: "notFound" }
  | { kind: "error" };

// Read-only Trip viewer for public trips, reached from /discover or
// /users/<handle>. The endpoint returns 404 for both missing and private
// trips, both shown as the same "Trip unavailable" empty state.
export default function PublicTripScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = (id ?? "").toString();

  const [state, setState] = React.useState<LoadState>({ kind: "loading" });
  const [view, setView] = React.useState<ViewMode>("spine");
  const [activeBranchId, setActiveBranchId] = React.useState<string | null>(
    null,
  );

  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? Math.max(insets.top, 67) : insets.top;
  const bottomPad = isWeb ? Math.max(insets.bottom, 34) : insets.bottom;

  const load = React.useCallback(() => {
    if (!tripId) return () => {};
    let cancelled = false;
    setState({ kind: "loading" });
    fetchPublicTrip(tripId).then((r) => {
      if (cancelled) return;
      if (r.kind === "ok") {
        setState({ kind: "ok", result: r });
        setActiveBranchId(r.item.trip.activeBranchId);
      } else if (r.kind === "notFound") {
        setState({ kind: "notFound" });
      } else {
        setState({ kind: "error" });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  useFocusEffect(load);

  if (state.kind === "loading") {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <SimpleHeader topPad={topPad} onBack={() => router.back()} />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  if (state.kind === "notFound") {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <SimpleHeader topPad={topPad} onBack={() => router.back()} />
        <View style={styles.center}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
            <Feather name="eye-off" size={26} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Trip unavailable
          </Text>
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>
            This itinerary may have been deleted or made private by its author.
          </Text>
        </View>
      </View>
    );
  }

  if (state.kind === "error") {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <SimpleHeader topPad={topPad} onBack={() => router.back()} />
        <View style={styles.center}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
            <Feather
              name="alert-triangle"
              size={26}
              color={colors.mutedForeground}
            />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Couldn't load this trip
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
      </View>
    );
  }

  const { trip, author } = state.result.item;
  const activeBranch =
    trip.branches.find((b) => b.id === activeBranchId) ??
    trip.branches.find((b) => b.id === trip.activeBranchId) ??
    trip.branches[0];

  if (!activeBranch) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <SimpleHeader topPad={topPad} onBack={() => router.back()} />
        <View style={styles.center}>
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>
            This trip has no branches.
          </Text>
        </View>
      </View>
    );
  }

  const totalDuration = activeBranch.segments.reduce(
    (sum, s) => sum + durationMs(s.depart, s.arrive),
    0,
  );
  const branchEnd =
    activeBranch.segments.length > 0
      ? activeBranch.segments[activeBranch.segments.length - 1].arrive
      : trip.startDate;
  const tripSpan =
    activeBranch.segments.length > 0
      ? durationMs(activeBranch.segments[0].depart, branchEnd)
      : 0;
  const branchTotal = branchTotalPrice(activeBranch.segments);
  const branchHasPrice = branchHasAnyPrice(activeBranch.segments);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[`${activeBranch.color}33`, "transparent"]}
        style={[styles.glow, { height: 240 + topPad }]}
        pointerEvents="none"
      />

      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [
            styles.iconBtn,
            { backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>

        <View style={styles.toggleWrap}>
          <View style={[styles.toggle, { backgroundColor: colors.card }]}>
            <ToggleBtn
              active={view === "spine"}
              icon="bar-chart-2"
              onPress={() => setView("spine")}
              activeColor={activeBranch.color}
            />
            <ToggleBtn
              active={view === "tree"}
              icon="git-merge"
              onPress={() => setView("tree")}
              activeColor={activeBranch.color}
            />
          </View>
        </View>

        <View style={styles.iconBtn} />
      </View>

      <View style={styles.titleBlock}>
        <Pressable
          onPress={() =>
            router.push(`/users/${encodeURIComponent(author.handle)}`)
          }
          accessibilityRole="link"
          accessibilityLabel={`See @${author.handle}'s public profile`}
          style={({ pressed }) => [
            styles.authorPill,
            {
              backgroundColor: `${colors.primary}1A`,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Feather name="user" size={12} color={colors.primary} />
          <Text style={[styles.authorPillText, { color: colors.primary }]}>
            @{author.handle}
          </Text>
          <Feather name="chevron-right" size={12} color={colors.primary} />
        </Pressable>
        <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>
          {fmtDate(trip.startDate)} · from {trip.originCity}
        </Text>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {trip.title}
        </Text>
        <View style={styles.metaRow}>
          <Pill
            label={`${trip.branches.length} branch${trip.branches.length === 1 ? "" : "es"}`}
            color={colors.primary}
            bg={`${colors.primary}22`}
          />
          {tripSpan > 0 && (
            <Pill
              label={`${fmtDuration(tripSpan)} window`}
              color={colors.accent}
              bg={`${colors.accent}22`}
            />
          )}
          {totalDuration > 0 && (
            <Pill
              label={`${fmtDuration(totalDuration)} airborne`}
              color={colors.mutedForeground}
              bg={colors.muted}
            />
          )}
          {branchHasPrice && (
            <Pill
              label={`${fmtPrice(branchTotal)} total`}
              color="#fff"
              bg={activeBranch.color}
            />
          )}
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <BranchPicker
        branches={trip.branches}
        activeBranchId={activeBranch.id}
        onSelect={setActiveBranchId}
      />

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {view === "spine" ? (
        <ScrollView
          contentContainerStyle={[
            styles.spineScroll,
            { paddingBottom: bottomPad + 32 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.branchHeaderRow}>
            <View
              style={[
                styles.branchSwatch,
                { backgroundColor: activeBranch.color },
              ]}
            />
            <Text
              style={[styles.branchHeaderText, { color: colors.foreground }]}
            >
              {activeBranch.label}
            </Text>
          </View>
          <TimeSpine
            branch={activeBranch}
            startCity={trip.originCity}
            startCode={trip.originCode}
          />
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.treeScrollV,
            { paddingBottom: bottomPad + 32 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.treeIntro, { color: colors.mutedForeground }]}>
            Each fork shows where this trip could split. Tap a branch to
            inspect it.
          </Text>
          <ScrollView
            horizontal
            contentContainerStyle={styles.treeScrollH}
            showsHorizontalScrollIndicator={false}
          >
            <BranchTree
              branches={trip.branches}
              activeBranchId={activeBranch.id}
              onSelect={(b) => {
                setActiveBranchId(b);
                setView("spine");
              }}
            />
          </ScrollView>
        </ScrollView>
      )}
    </View>
  );
}

function SimpleHeader({
  topPad,
  onBack,
}: {
  topPad: number;
  onBack: () => void;
}) {
  const colors = useColors();
  return (
    <View style={[styles.header, { paddingTop: topPad + 8 }]}>
      <Pressable
        onPress={onBack}
        hitSlop={12}
        style={({ pressed }) => [
          styles.iconBtn,
          { backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Feather name="arrow-left" size={20} color={colors.foreground} />
      </Pressable>
      <View style={{ flex: 1 }} />
      <View style={styles.iconBtn} />
    </View>
  );
}

function ToggleBtn({
  active,
  icon,
  onPress,
  activeColor,
}: {
  active: boolean;
  icon: React.ComponentProps<typeof Feather>["name"];
  onPress: () => void;
  activeColor: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.toggleBtn,
        {
          backgroundColor: active ? activeColor : "transparent",
        },
      ]}
    >
      <Feather
        name={icon}
        size={16}
        color={active ? "#fff" : colors.mutedForeground}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  glow: { position: "absolute", top: 0, left: 0, right: 0 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleWrap: { flex: 1, alignItems: "center" },
  toggle: {
    flexDirection: "row",
    borderRadius: 999,
    padding: 4,
    gap: 2,
  },
  toggleBtn: {
    width: 44,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  titleBlock: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16 },
  authorPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 10,
  },
  authorPillText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.6,
    marginBottom: 12,
  },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  divider: { height: 1, opacity: 0.5 },
  spineScroll: { paddingTop: 12 },
  branchHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 8,
  },
  branchSwatch: { width: 8, height: 8, borderRadius: 4 },
  branchHeaderText: { flex: 1, fontSize: 14, fontFamily: "Inter_700Bold" },
  treeScrollV: { paddingTop: 24, paddingHorizontal: 20 },
  treeIntro: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginBottom: 24,
  },
  treeScrollH: { paddingRight: 40 },
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
