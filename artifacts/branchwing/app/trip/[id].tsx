import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
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
  } = useTrips();
  const [view, setView] = useState<ViewMode>("spine");

  const trip = id ? getTrip(id) : undefined;
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

  const handleAddFlight = (forkFromSegmentId?: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    router.push({
      pathname: "/add-segment",
      params: {
        tripId: trip.id,
        branchId: activeBranch.id,
        forkFromSegmentId: forkFromSegmentId ?? "",
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
