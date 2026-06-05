import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AirportPicker } from "@/components/AirportPicker";
import { DateTimeField } from "@/components/DateTimeField";
import { useColors } from "@/hooks/useColors";
import { useTrips } from "@/contexts/TripsContext";
import { findAirport, type Airport } from "@/lib/airports";
import {
  searchFlights,
  sortFlights,
  type FlightOption,
  type SortMode,
} from "@/lib/flightSearch";
import { addHours, fmtDuration, fmtPrice, fmtTime } from "@/lib/time";

const SORT_OPTIONS: { id: SortMode; label: string; icon: React.ComponentProps<typeof Feather>["name"] }[] = [
  { id: "depart", label: "Departure", icon: "clock" },
  { id: "price", label: "Cheapest", icon: "dollar-sign" },
  { id: "duration", label: "Fastest", icon: "zap" },
];

export default function SearchFlightsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tripId, branchId } = useLocalSearchParams<{
    tripId: string;
    branchId: string;
  }>();
  const { getTrip, addSegment } = useTrips();

  const trip = tripId ? getTrip(tripId) : undefined;
  const branch = trip?.branches.find((b) => b.id === branchId);
  const lastSeg = branch?.segments[branch.segments.length - 1];

  const initialFrom = useMemo<Airport | null>(() => {
    if (lastSeg) return findAirport(lastSeg.toCode);
    if (trip) return findAirport(trip.originCode);
    return null;
  }, [lastSeg, trip]);

  const initialDate = useMemo(() => {
    if (lastSeg) return addHours(lastSeg.arrive, 2);
    if (trip) return trip.startDate;
    return new Date().toISOString();
  }, [lastSeg, trip]);

  const [from, setFrom] = useState<Airport | null>(initialFrom);
  const [to, setTo] = useState<Airport | null>(null);
  const [date, setDate] = useState<string>(initialDate);
  const [sort, setSort] = useState<SortMode>("depart");

  const results = useMemo(() => {
    if (!from || !to || from.code === to.code) return [];
    // Intentionally synthetic (not services/api.fetchFlights): this search is
    // date-specific, and the real Amadeus seed is a single-date snapshot that
    // can't answer an arbitrary `date`. Browsing real popular-route offers
    // lives in route/[od]; building a trip here stays on the synthetic catalog
    // until a live date-aware flight proxy exists. See lib/flags.ts.
    return sortFlights(
      searchFlights({
        originCode: from.code,
        destCode: to.code,
        date,
      }),
      sort,
    );
  }, [from, to, date, sort]);

  const onPickResult = (opt: FlightOption) => {
    if (!trip || !branch) return;
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
    }
    addSegment(trip.id, branch.id, {
      fromCode: opt.fromCode,
      fromCity: opt.fromCity,
      toCode: opt.toCode,
      toCity: opt.toCity,
      depart: opt.depart,
      arrive: opt.arrive,
      airline: opt.airline,
      flightNo: opt.flightNo,
      price: opt.price,
    });
    router.back();
  };

  const onManual = () => {
    if (!trip || !branch) return;
    router.replace({
      pathname: "/add-segment",
      params: { tripId: trip.id, branchId: branch.id },
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Feather name="x" size={22} color={colors.foreground} />
        </Pressable>
        <View style={{ alignItems: "center" }}>
          {branch && (
            <Text
              style={[styles.headerEyebrow, { color: colors.mutedForeground }]}
            >
              {branch.label}
            </Text>
          )}
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Find a flight
          </Text>
        </View>
        <Pressable onPress={onManual} hitSlop={10}>
          <Text style={[styles.manualLink, { color: colors.accent }]}>
            Manual
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.searchPanel}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <AirportPicker label="From" value={from} onChange={setFrom} />
            </View>
            <View style={styles.swap}>
              <Pressable
                onPress={() => {
                  const a = from;
                  setFrom(to);
                  setTo(a);
                }}
                hitSlop={10}
                style={[styles.swapBtn, { backgroundColor: colors.muted }]}
              >
                <Feather name="repeat" size={14} color={colors.foreground} />
              </Pressable>
            </View>
            <View style={{ flex: 1 }}>
              <AirportPicker label="To" value={to} onChange={setTo} />
            </View>
          </View>

          <DateTimeField
            label="Departing on"
            value={date}
            onChange={setDate}
          />
        </View>

        <View style={styles.sortRow}>
          {SORT_OPTIONS.map((opt) => {
            const active = sort === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => setSort(opt.id)}
                style={({ pressed }) => [
                  styles.sortChip,
                  {
                    backgroundColor: active ? colors.foreground : colors.card,
                    borderColor: active ? colors.foreground : colors.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Feather
                  name={opt.icon}
                  size={12}
                  color={active ? colors.background : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.sortText,
                    {
                      color: active ? colors.background : colors.mutedForeground,
                    },
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {!from || !to ? (
          <EmptyHint
            icon="search"
            title="Pick two airports"
            text="Choose origin and destination to see available flights for the day."
          />
        ) : from.code === to.code ? (
          <EmptyHint
            icon="alert-circle"
            title="Same airport"
            text="Choose a different destination to search."
          />
        ) : results.length === 0 ? (
          <EmptyHint
            icon="cloud-off"
            title="No flights"
            text="Try a different date or route."
          />
        ) : (
          <View style={styles.resultsList}>
            <Text
              style={[styles.resultsCount, { color: colors.mutedForeground }]}
            >
              {results.length} flights · {from.code} → {to.code}
            </Text>
            {results.map((r) => (
              <FlightResultCard
                key={r.id}
                option={r}
                accent={branch?.color ?? colors.primary}
                onAdd={() => onPickResult(r)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FlightResultCard({
  option,
  accent,
  onAdd,
}: {
  option: FlightOption;
  accent: string;
  onAdd: () => void;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.cardTop}>
        <Text style={[styles.cardTime, { color: colors.foreground }]}>
          {fmtTime(option.depart)}
        </Text>
        <View style={styles.cardSpine}>
          <View style={[styles.spineDot, { backgroundColor: accent }]} />
          <View style={[styles.spineLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.spineDur, { color: colors.mutedForeground }]}>
            {fmtDuration(option.durationMin * 60 * 1000)}
            {option.stops > 0
              ? ` · ${option.stops} stop`
              : " · nonstop"}
          </Text>
          <View style={[styles.spineLine, { backgroundColor: colors.border }]} />
          <View
            style={[
              styles.spineDot,
              { backgroundColor: accent, opacity: 0.6 },
            ]}
          />
        </View>
        <Text style={[styles.cardTime, { color: colors.foreground }]}>
          {fmtTime(option.arrive)}
        </Text>
      </View>

      <View style={styles.cardCodes}>
        <Text style={[styles.cardCode, { color: colors.mutedForeground }]}>
          {option.fromCode}
        </Text>
        <Text style={[styles.cardCode, { color: colors.mutedForeground }]}>
          {option.toCode}
        </Text>
      </View>

      <View style={[styles.cardFoot, { borderTopColor: colors.border }]}>
        <View style={styles.cardAirline}>
          <Feather name="navigation" size={11} color={colors.mutedForeground} />
          <Text
            style={[styles.cardAirlineText, { color: colors.mutedForeground }]}
          >
            {option.airline} · {option.flightNo}
          </Text>
        </View>
        <View style={styles.cardActions}>
          <Text style={[styles.cardPrice, { color: colors.foreground }]}>
            {fmtPrice(option.price)}
          </Text>
          <Pressable
            onPress={onAdd}
            style={({ pressed }) => [
              styles.addBtn,
              { backgroundColor: accent, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Feather name="plus" size={14} color="#fff" />
            <Text style={styles.addBtnText}>Add</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function EmptyHint({
  icon,
  title,
  text,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  text: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.emptyHint}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.card }]}>
        <Feather name={icon} size={20} color={colors.mutedForeground} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
        {title}
      </Text>
      <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerEyebrow: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  manualLink: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  searchPanel: {
    gap: 12,
    marginBottom: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  swap: {
    paddingTop: 24,
  },
  swapBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  sortRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  sortChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  sortText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  resultsList: {
    gap: 12,
  },
  resultsCount: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardTime: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    minWidth: 64,
  },
  cardSpine: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  spineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  spineLine: {
    flex: 1,
    height: 1,
  },
  spineDur: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.4,
  },
  cardCodes: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingTop: 2,
  },
  cardCode: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.6,
  },
  cardFoot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 12,
  },
  cardAirline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  cardAirlineText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardPrice: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  addBtnText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  emptyHint: {
    alignItems: "center",
    paddingTop: 36,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
});
