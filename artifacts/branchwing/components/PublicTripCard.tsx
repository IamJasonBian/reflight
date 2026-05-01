import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Pill } from "@/components/Pill";
import { useColors } from "@/hooks/useColors";
import {
  branchHasAnyPrice,
  branchTotalPrice,
  fmtDate,
  fmtPrice,
} from "@/lib/time";
import type { Trip } from "@/lib/types";

/**
 * Read-only card used in the Discover feed and on public profile pages.
 * Visually mirrors the home `TripCard` but always shows the author's @handle
 * and never exposes any edit affordances. Tapping the card navigates to that
 * author's public profile so a viewer can see all of their public trips.
 */
export function PublicTripCard({
  trip,
  authorHandle,
  onPress,
}: {
  trip: Trip;
  authorHandle: string;
  onPress?: () => void;
}) {
  const colors = useColors();
  const active =
    trip.branches.find((b) => b.id === trip.activeBranchId) ?? trip.branches[0];
  const totalFlights = trip.branches.reduce(
    (n, b) => n + b.segments.length,
    0,
  );
  const destinations = new Set<string>();
  for (const b of trip.branches) {
    for (const s of b.segments) destinations.add(s.toCity);
  }
  const total = active ? branchTotalPrice(active.segments) : 0;
  const hasPrice = active ? branchHasAnyPrice(active.segments) : false;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      <View style={styles.row}>
        <View
          style={[
            styles.avatar,
            { backgroundColor: `${colors.primary}22` },
          ]}
        >
          <Feather name="user" size={14} color={colors.primary} />
        </View>
        <Text
          style={[styles.handle, { color: colors.primary }]}
          numberOfLines={1}
        >
          @{authorHandle}
        </Text>
      </View>
      <Text
        style={[styles.title, { color: colors.foreground }]}
        numberOfLines={1}
      >
        {trip.title}
      </Text>
      <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>
        {fmtDate(trip.startDate)} · from {trip.originCity}
      </Text>
      <View style={styles.metaRow}>
        <Pill
          label={`${trip.branches.length} branch${trip.branches.length === 1 ? "" : "es"}`}
          color={colors.primary}
          bg={`${colors.primary}22`}
        />
        {totalFlights > 0 && (
          <Pill
            label={`${totalFlights} flight${totalFlights === 1 ? "" : "s"}`}
            color={colors.accent}
            bg={`${colors.accent}22`}
          />
        )}
        {destinations.size > 0 && (
          <Pill
            label={`${destinations.size} stop${destinations.size === 1 ? "" : "s"}`}
            color={colors.mutedForeground}
            bg={colors.muted}
          />
        )}
        {hasPrice && (
          <Pill
            label={fmtPrice(total)}
            color="#fff"
            bg={active?.color ?? colors.primary}
          />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  handle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    flexShrink: 1,
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  eyebrow: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
});
