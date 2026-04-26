import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useTrips } from "@/contexts/TripsContext";
import {
  branchHasAnyPrice,
  branchTotalPrice,
  fmtDate,
  fmtPrice,
} from "@/lib/time";
import type { Trip } from "@/lib/types";

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { trips, loading } = useTrips();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? Math.max(insets.top, 67) : insets.top;
  const bottomPad = isWeb ? Math.max(insets.bottom, 34) : insets.bottom;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["rgba(255,107,53,0.15)", "transparent"]}
        style={[styles.glow, { height: 280 + topPad }]}
        pointerEvents="none"
      />

      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <View>
          <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>
            Your itineraries
          </Text>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Branchwing
          </Text>
        </View>
        <Pressable
          onPress={() => {
            if (Platform.OS !== "web") {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                () => {},
              );
            }
            router.push("/new-trip");
          }}
          style={({ pressed }) => [
            styles.newBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Feather name="plus" size={18} color="#fff" />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : trips.length === 0 ? (
        <EmptyState onCreate={() => router.push("/new-trip")} />
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(t) => t.id}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: bottomPad + 32 },
          ]}
          renderItem={({ item }) => (
            <TripCard
              trip={item}
              onPress={() => router.push(`/trip/${item.id}`)}
            />
          )}
        />
      )}
    </View>
  );
}

function TripCard({ trip, onPress }: { trip: Trip; onPress: () => void }) {
  const colors = useColors();
  const active = trip.branches.find((b) => b.id === trip.activeBranchId) ??
    trip.branches[0];
  const totalFlights = trip.branches.reduce(
    (n, b) => n + b.segments.length,
    0,
  );
  const destinations = new Set<string>();
  for (const b of trip.branches) {
    for (const s of b.segments) destinations.add(s.toCity);
  }

  const pricedBranches = trip.branches.filter((b) =>
    branchHasAnyPrice(b.segments),
  );
  const branchTotals = pricedBranches.map((b) => branchTotalPrice(b.segments));
  const minPrice = branchTotals.length ? Math.min(...branchTotals) : null;
  const maxPrice = branchTotals.length ? Math.max(...branchTotals) : null;

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
      <View style={styles.cardHead}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardEyebrow, { color: colors.mutedForeground }]}>
            {fmtDate(trip.startDate)} · from {trip.originCity}
          </Text>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>
            {trip.title}
          </Text>
        </View>
        <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
      </View>

      <View style={styles.cardStats}>
        <Stat
          icon="git-branch"
          value={trip.branches.length.toString()}
          label="branches"
          color={colors.primary}
        />
        <Stat
          icon="navigation"
          value={totalFlights.toString()}
          label="flights"
          color={colors.accent}
        />
        <Stat
          icon="map-pin"
          value={destinations.size.toString()}
          label="cities"
          color="#9D7BFF"
        />
      </View>

      <View style={styles.branchStrip}>
        {trip.branches.slice(0, 6).map((b) => (
          <View
            key={b.id}
            style={[
              styles.branchPip,
              {
                backgroundColor:
                  b.id === active?.id ? b.color : "transparent",
                borderColor: b.color,
              },
            ]}
          />
        ))}
        {trip.branches.length > 6 && (
          <Text style={[styles.branchMore, { color: colors.mutedForeground }]}>
            +{trip.branches.length - 6}
          </Text>
        )}
        <View style={{ flex: 1 }} />
        {active && active.segments.length > 0 && (
          <Text style={[styles.activeLabel, { color: active.color }]}>
            {active.label}
          </Text>
        )}
      </View>

      {minPrice != null && maxPrice != null && (
        <View
          style={[
            styles.priceFooter,
            { borderTopColor: colors.border },
          ]}
        >
          <Feather name="tag" size={12} color={colors.primary} />
          <Text style={[styles.priceFooterLabel, { color: colors.mutedForeground }]}>
            Branch range
          </Text>
          <View style={{ flex: 1 }} />
          <Text style={[styles.priceFooterValue, { color: colors.foreground }]}>
            {minPrice === maxPrice
              ? fmtPrice(minPrice)
              : `${fmtPrice(minPrice)} – ${fmtPrice(maxPrice)}`}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function Stat({
  icon,
  value,
  label,
  color,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  value: string;
  label: string;
  color: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.stat}>
      <Feather name={icon} size={13} color={color} />
      <Text style={[styles.statValue, { color: colors.foreground }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
    </View>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  const colors = useColors();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.card }]}>
        <Feather name="git-branch" size={28} color={colors.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
        Plot your first journey
      </Text>
      <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
        Sketch a trip, then fork it into all the routes you're considering.
      </Text>
      <Pressable
        onPress={onCreate}
        style={({ pressed }) => [
          styles.emptyBtn,
          { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Feather name="plus" size={16} color="#fff" />
        <Text style={styles.emptyBtnText}>New trip</Text>
      </Pressable>
    </View>
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
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  title: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.8,
  },
  newBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 14,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    marginBottom: 14,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  cardEyebrow: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.4,
  },
  cardStats: {
    flexDirection: "row",
    gap: 18,
    marginBottom: 14,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statValue: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  branchStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  branchPip: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  branchMore: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    marginLeft: 4,
  },
  activeLabel: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  priceFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  priceFooterLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.3,
  },
  priceFooterValue: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginBottom: 22,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
  },
  emptyBtnText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
