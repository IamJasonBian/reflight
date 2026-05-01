import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
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
import { useTrips } from "@/contexts/TripsContext";
import { fetchMyProfile } from "@/services/discoverApi";
import { confirmAction } from "@/lib/confirm";
import {
  branchHasAnyPrice,
  branchTotalPrice,
  durationMs,
  fmtDate,
  fmtDuration,
  fmtPrice,
} from "@/lib/time";
import type { Segment } from "@/lib/types";

type ViewMode = "spine" | "tree";

export default function TripScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    getTrip,
    setActiveBranch,
    deleteTrip,
    deleteBranch,
    setTripPublic,
  } = useTrips();
  const [view, setView] = useState<ViewMode>("spine");
  // Cached so the privacy-toggle confirmation can name the user's handle in
  // the copy ("This trip will appear in Discover under @handle") AND so the
  // post-confirm public-state row can render a tappable @handle pill linking
  // to the public profile. Lazy-fetched the first time we need it, then
  // cached for subsequent toggles within the same screen.
  const [myHandle, setMyHandle] = useState<string | null>(null);

  const trip = id ? getTrip(id) : undefined;

  // Pre-fetch the handle whenever the trip is already public, so the pill
  // below the toggle row can render on initial mount without waiting for
  // the user to interact. Cheap (single GET) and only runs once per id.
  useEffect(() => {
    if (!trip?.isPublic || myHandle) return;
    let cancelled = false;
    fetchMyProfile().then((me) => {
      if (!cancelled && me) setMyHandle(me.handle);
    });
    return () => {
      cancelled = true;
    };
  }, [trip?.isPublic, myHandle]);
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? Math.max(insets.top, 67) : insets.top;
  const bottomPad = isWeb ? Math.max(insets.bottom, 34) : insets.bottom;

  const activeBranch = useMemo(() => {
    if (!trip) return undefined;
    return (
      trip.branches.find((b) => b.id === trip.activeBranchId) ??
      trip.branches[0]
    );
  }, [trip]);

  if (!trip || !activeBranch) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 8 }]}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>
        </View>
        <View style={styles.missing}>
          <Text style={[styles.missingText, { color: colors.mutedForeground }]}>
            Trip not found.
          </Text>
        </View>
      </View>
    );
  }

  const totalDuration = activeBranch.segments.reduce((sum, s) => {
    return sum + durationMs(s.depart, s.arrive);
  }, 0);
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

  const handleSelectBranch = (branchId: string) => {
    setActiveBranch(trip.id, branchId);
  };

  const handleAddFlight = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    router.push({
      pathname: "/search-flights",
      params: {
        tripId: trip.id,
        branchId: activeBranch.id,
      },
    });
  };

  const handleForkAfter = (seg: Segment) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    router.push({
      pathname: "/fork-branch",
      params: {
        tripId: trip.id,
        parentBranchId: activeBranch.id,
        forkAfterSegmentId: seg.id,
      },
    });
  };

  const handleNewBranch = () => {
    router.push({
      pathname: "/fork-branch",
      params: {
        tripId: trip.id,
        parentBranchId: activeBranch.id,
        forkAfterSegmentId: "",
      },
    });
  };

  const confirmDeleteBranch = () => {
    if (trip.branches.length <= 1) {
      Alert.alert("Cannot delete", "A trip needs at least one branch.");
      return;
    }
    Alert.alert(
      "Delete branch?",
      `Remove "${activeBranch.label}"? This also removes any sub-branches forked from it.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteBranch(trip.id, activeBranch.id),
        },
      ],
    );
  };

  // The privacy toggle is destructive in both directions: going public
  // exposes a private trip to the world, and going private removes a trip
  // that strangers may have already bookmarked. Always confirm, and name
  // the author's handle in the copy so they know exactly which public
  // identity the trip will be associated with.
  const confirmTogglePublic = async () => {
    if (!trip) return;
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => {});
    }
    const goingPublic = !(trip.isPublic === true);

    let handle = myHandle;
    if (goingPublic && !handle) {
      // Fetch handle on the fly so we can mention it in the dialog. If it
      // fails (offline, server hiccup) we still allow the toggle but with a
      // generic copy — the server-side ensureUserProfile path will derive
      // and persist the handle on the next sync.
      const me = await fetchMyProfile();
      if (me) {
        handle = me.handle;
        setMyHandle(me.handle);
      }
    }

    if (goingPublic) {
      const handleSuffix = handle ? ` under @${handle}` : "";
      const ok = await confirmAction({
        title: "Make trip public?",
        message: `"${trip.title}" will appear in Discover${handleSuffix} and on your public profile. Anyone — even people without an account — will be able to view its branches and flights. You can switch back to Private anytime.`,
        confirmLabel: "Make public",
        cancelLabel: "Cancel",
      });
      if (ok) setTripPublic(trip.id, true);
    } else {
      const ok = await confirmAction({
        title: "Make trip private?",
        message: `"${trip.title}" will be removed from Discover and your public profile. Only you will be able to see it.`,
        confirmLabel: "Make private",
        cancelLabel: "Cancel",
        destructive: true,
      });
      if (ok) setTripPublic(trip.id, false);
    }
  };

  const confirmDeleteTrip = () => {
    Alert.alert("Delete trip?", `Remove "${trip.title}" and all branches?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteTrip(trip.id);
          router.back();
        },
      },
    ]);
  };

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

        <Pressable
          onPress={confirmDeleteTrip}
          hitSlop={12}
          style={({ pressed }) => [
            styles.iconBtn,
            { backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="trash-2" size={18} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <View style={styles.titleBlock}>
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

        <Pressable
          onPress={confirmTogglePublic}
          accessibilityRole="switch"
          accessibilityState={{ checked: trip.isPublic === true }}
          accessibilityLabel={
            trip.isPublic ? "Make trip private" : "Make trip public"
          }
          style={({ pressed }) => [
            styles.publicRow,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Feather
            name={trip.isPublic ? "globe" : "lock"}
            size={16}
            color={trip.isPublic ? colors.primary : colors.mutedForeground}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.publicTitle, { color: colors.foreground }]}>
              {trip.isPublic ? "Public" : "Private"}
            </Text>
            <Text
              style={[styles.publicSub, { color: colors.mutedForeground }]}
            >
              {trip.isPublic
                ? "Visible in Discover and on your public profile."
                : "Only you can see this trip."}
            </Text>
          </View>
          <View
            style={[
              styles.switch,
              {
                backgroundColor: trip.isPublic
                  ? colors.primary
                  : colors.muted,
              },
            ]}
          >
            <View
              style={[
                styles.switchKnob,
                {
                  backgroundColor: "#fff",
                  alignSelf: trip.isPublic ? "flex-end" : "flex-start",
                },
              ]}
            />
          </View>
        </Pressable>

        {trip.isPublic && myHandle ? (
          <Pressable
            onPress={() =>
              router.push(`/users/${encodeURIComponent(myHandle)}` as Href)
            }
            accessibilityRole="link"
            accessibilityLabel={`See your public profile @${myHandle}`}
            style={({ pressed }) => [
              styles.publicHandlePill,
              {
                backgroundColor: `${colors.primary}1F`,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Feather name="user" size={12} color={colors.primary} />
            <Text
              style={[styles.publicHandleText, { color: colors.primary }]}
            >
              View as @{myHandle}
            </Text>
            <Feather
              name="external-link"
              size={11}
              color={colors.primary}
            />
          </Pressable>
        ) : null}
      </View>

      <View
        style={[
          styles.divider,
          { backgroundColor: colors.border },
        ]}
      />

      <BranchPicker
        branches={trip.branches}
        activeBranchId={activeBranch.id}
        onSelect={handleSelectBranch}
        onNewBranch={handleNewBranch}
      />

      <View
        style={[
          styles.divider,
          { backgroundColor: colors.border },
        ]}
      />

      {view === "spine" ? (
        <ScrollView
          contentContainerStyle={[
            styles.spineScroll,
            { paddingBottom: bottomPad + 100 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.branchHeaderRow}>
            <View
              style={[styles.branchSwatch, { backgroundColor: activeBranch.color }]}
            />
            <Text style={[styles.branchHeaderText, { color: colors.foreground }]}>
              {activeBranch.label}
            </Text>
            {trip.branches.length > 1 && (
              <Pressable onPress={confirmDeleteBranch} hitSlop={10}>
                <Feather
                  name="trash-2"
                  size={14}
                  color={colors.mutedForeground}
                />
              </Pressable>
            )}
          </View>

          <TimeSpine
            branch={activeBranch}
            onAddFlight={() => handleAddFlight()}
            onForkAfter={handleForkAfter}
            startCity={trip.originCity}
            startCode={trip.originCode}
          />
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.treeScrollV,
            { paddingBottom: bottomPad + 100 },
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
              onSelect={(id) => {
                handleSelectBranch(id);
                setView("spine");
              }}
            />
          </ScrollView>
        </ScrollView>
      )}

      <View
        style={[
          styles.fab,
          {
            bottom: bottomPad + 20,
            backgroundColor: activeBranch.color,
          },
        ]}
      >
        <Pressable
          onPress={() => handleAddFlight()}
          style={styles.fabPressable}
        >
          <Feather name="plus" size={22} color="#fff" />
          <Text style={styles.fabText}>Add flight</Text>
        </Pressable>
      </View>
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
  root: {
    flex: 1,
  },
  glow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
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
  toggleWrap: {
    flex: 1,
    alignItems: "center",
  },
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
  titleBlock: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 16,
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
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  publicRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  publicTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  publicSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  publicHandlePill: {
    marginTop: 8,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  publicHandleText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  switch: {
    width: 38,
    height: 22,
    borderRadius: 11,
    padding: 2,
    justifyContent: "center",
  },
  switchKnob: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  divider: {
    height: 1,
    opacity: 0.5,
  },
  spineScroll: {
    paddingTop: 12,
  },
  branchHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 8,
  },
  branchSwatch: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  branchHeaderText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  treeScrollV: {
    paddingTop: 24,
    paddingHorizontal: 20,
  },
  treeIntro: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginBottom: 24,
  },
  treeScrollH: {
    paddingRight: 40,
  },
  fab: {
    position: "absolute",
    right: 20,
    borderRadius: 999,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 8,
  },
  fabPressable: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  fabText: {
    color: "#fff",
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },
  missing: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  missingText: {
    fontFamily: "Inter_500Medium",
  },
});
