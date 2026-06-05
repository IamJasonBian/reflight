import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PriceHistoryChart } from "@/components/PriceHistoryChart";
import { SegmentedControl } from "@/components/SegmentedControl";
import { useColors } from "@/hooks/useColors";
import { findAirport, haversineMiles } from "@/lib/airports";
import { DEFAULT_ROUTES } from "@/lib/defaultRoutes";
import {
  fetchFlights,
  fetchPriceHistory,
} from "@/services/api";
import { sortFlights, type SortMode } from "@/services/flightService";
import type { FlightOption } from "@/lib/flightSearch";
import type { RoutePriceHistory } from "@/lib/types";
import {
  estimateFlightMinutes,
} from "@/lib/flightSearch";
import { fmtDate, fmtDuration, fmtPrice, fmtTime } from "@/lib/time";
import { isPast } from "@/lib/validity";

type Tab = "flights" | "trends";

export default function RouteDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { od } = useLocalSearchParams<{ od: string }>();

  const [fromCode, toCode] = (od || "").split("-");
  const from = findAirport(fromCode);
  const to = findAirport(toCode);

  const [tab, setTab] = useState<Tab>("flights");
  const [sort, setSort] = useState<SortMode>("depart");
  const [history, setHistory] = useState<RoutePriceHistory | null>(null);
  const [flights, setFlights] = useState<FlightOption[] | null>(null);

  const todayIso = useMemo(() => {
    const d = new Date();
    d.setHours(8, 0, 0, 0);
    return d.toISOString();
  }, []);

  useEffect(() => {
    if (!fromCode || !toCode) return;
    const base = DEFAULT_ROUTES.find(
      (r) => r.fromCode === fromCode && r.toCode === toCode,
    )?.basePrice;
    fetchPriceHistory(fromCode, toCode, base).then(setHistory);
    fetchFlights({
      originCode: fromCode,
      destCode: toCode,
      date: todayIso,
    }).then(setFlights);
  }, [fromCode, toCode, todayIso]);

  if (!from || !to) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Feather name="chevron-left" size={26} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Route
          </Text>
          <View style={{ width: 26 }} />
        </View>
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Unknown route.
          </Text>
        </View>
      </View>
    );
  }

  const dist = Math.round(haversineMiles(from, to));
  const flightMin = estimateFlightMinutes(dist);
  const sortedFlights = flights ? sortFlights(flights, sort) : [];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Feather name="chevron-left" size={26} color={colors.foreground} />
        </Pressable>
        <View style={{ alignItems: "center" }}>
          <Text
            style={[styles.headerEyebrow, { color: colors.mutedForeground }]}
          >
            {dist.toLocaleString()} mi · {fmtDuration(flightMin * 60 * 1000)}
          </Text>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            {from.code} → {to.code}
          </Text>
        </View>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.cities}>
          <Text style={[styles.city, { color: colors.foreground }]}>
            {from.city}
          </Text>
          <Feather
            name="arrow-right"
            size={18}
            color={colors.mutedForeground}
          />
          <Text style={[styles.city, { color: colors.foreground }]}>
            {to.city}
          </Text>
        </View>

        {history && (
          <View
            style={[
              styles.summaryCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.summaryHead}>
              <View>
                <Text
                  style={[
                    styles.summaryEyebrow,
                    { color: colors.mutedForeground },
                  ]}
                >
                  Today
                </Text>
                <Text style={[styles.summaryPrice, { color: colors.foreground }]}>
                  {fmtPrice(history.current)}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text
                  style={[
                    styles.summaryEyebrow,
                    { color: colors.mutedForeground },
                  ]}
                >
                  90-day range
                </Text>
                <Text
                  style={[styles.summaryRange, { color: colors.foreground }]}
                >
                  {fmtPrice(history.min)} – {fmtPrice(history.max)}
                </Text>
              </View>
            </View>
            <PriceHistoryChart
              history={history}
              height={90}
              accent={colors.primary}
            />
            <View style={[styles.summaryFoot, { borderTopColor: colors.border }]}>
              <TrendBadge
                trend={history.trend}
                changePct={history.changePct}
              />
              <Text
                style={[styles.summaryAvg, { color: colors.mutedForeground }]}
              >
                Avg {fmtPrice(history.avg)} · vs 7d ago
              </Text>
            </View>
          </View>
        )}

        <View style={styles.tabsRow}>
          <SegmentedControl
            value={tab}
            options={[
              { value: "flights", label: "Flights" },
              { value: "trends", label: "Price trends" },
            ]}
            onChange={setTab}
          />
        </View>

        {tab === "flights" ? (
          <FlightsTab
            flights={sortedFlights}
            sort={sort}
            onChangeSort={setSort}
          />
        ) : (
          <TrendsTab history={history} />
        )}
      </ScrollView>
    </View>
  );
}

function TrendBadge({
  trend,
  changePct,
}: {
  trend: "up" | "down" | "flat";
  changePct: number;
}) {
  const colors = useColors();
  const c =
    trend === "down"
      ? "#3DD68C"
      : trend === "up"
        ? "#FF6B6B"
        : colors.mutedForeground;
  const icon =
    trend === "down"
      ? "trending-down"
      : trend === "up"
        ? "trending-up"
        : "minus";
  const label =
    trend === "down"
      ? "Falling"
      : trend === "up"
        ? "Rising"
        : "Stable";
  return (
    <View style={[styles.trend, { backgroundColor: `${c}22` }]}>
      <Feather name={icon} size={11} color={c} />
      <Text style={[styles.trendText, { color: c }]}>
        {label} · {changePct >= 0 ? "+" : ""}
        {changePct.toFixed(1)}%
      </Text>
    </View>
  );
}

function FlightsTab({
  flights,
  sort,
  onChangeSort,
}: {
  flights: FlightOption[];
  sort: SortMode;
  onChangeSort: (s: SortMode) => void;
}) {
  const colors = useColors();
  const SORTS: { id: SortMode; label: string; icon: React.ComponentProps<typeof Feather>["name"] }[] = [
    { id: "depart", label: "Depart", icon: "clock" },
    { id: "price", label: "Cheapest", icon: "dollar-sign" },
    { id: "duration", label: "Fastest", icon: "zap" },
  ];
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.sortChips}>
        {SORTS.map((s) => {
          const active = s.id === sort;
          return (
            <Pressable
              key={s.id}
              onPress={() => onChangeSort(s.id)}
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
                name={s.icon}
                size={11}
                color={active ? colors.background : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.sortText,
                  {
                    color: active
                      ? colors.background
                      : colors.mutedForeground,
                  },
                ]}
              >
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {flights.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          Loading flights…
        </Text>
      ) : (
        flights.map((f) => {
          const departed = isPast(f.depart);
          return (
            <View
              key={f.id}
              style={[
                styles.flightRow,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: departed ? 0.55 : 1,
                },
              ]}
            >
              <View style={styles.flightTimeCol}>
                <Text style={[styles.flightTime, { color: colors.foreground }]}>
                  {fmtTime(f.depart)}
                </Text>
                <Text style={[styles.flightSub, { color: colors.mutedForeground }]}>
                  {fmtTime(f.arrive)}
                </Text>
              </View>
              <View style={styles.flightMid}>
                <View style={styles.flightAirlineRow}>
                  <Text
                    style={[styles.flightAirline, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    {f.airline}
                  </Text>
                  {departed && (
                    <View style={styles.departedBadge}>
                      <Text style={styles.departedText}>Departed</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.flightSub, { color: colors.mutedForeground }]}>
                  {fmtDate(f.depart)} · {f.flightNo} ·{" "}
                  {fmtDuration(f.durationMin * 60 * 1000)} ·{" "}
                  {f.stops > 0 ? `${f.stops} stop` : "nonstop"}
                </Text>
              </View>
              <Text style={[styles.flightPrice, { color: colors.foreground }]}>
                {fmtPrice(f.price)}
              </Text>
            </View>
          );
        })
      )}
    </View>
  );
}

function TrendsTab({ history }: { history: RoutePriceHistory | null }) {
  const colors = useColors();
  if (!history) {
    return (
      <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
        Loading…
      </Text>
    );
  }
  const cheapestPoint = history.points.reduce((best, p) =>
    p.price < best.price ? p : best,
  );
  const priciestPoint = history.points.reduce((worst, p) =>
    p.price > worst.price ? p : worst,
  );
  return (
    <View style={{ gap: 12 }}>
      <View
        style={[
          styles.trendCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <PriceHistoryChart
          history={history}
          height={180}
          accent={colors.primary}
          showAxis
        />
      </View>
      <View
        style={[
          styles.detailGrid,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <DetailRow label="Lowest" value={fmtPrice(history.min)} sub={cheapestPoint.date} />
        <DetailRow label="Average" value={fmtPrice(history.avg)} sub="last 90 days" />
        <DetailRow label="Highest" value={fmtPrice(priciestPoint.price)} sub={priciestPoint.date} />
        <DetailRow
          label="Today"
          value={fmtPrice(history.current)}
          sub={`vs 7d ago ${history.changePct >= 0 ? "+" : ""}${history.changePct.toFixed(1)}%`}
        />
      </View>
    </View>
  );
}

function DetailRow({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  const colors = useColors();
  return (
    <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[styles.detailValue, { color: colors.foreground }]}>
          {value}
        </Text>
        <Text style={[styles.detailSub, { color: colors.mutedForeground }]}>
          {sub}
        </Text>
      </View>
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
    paddingBottom: 14,
  },
  headerEyebrow: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1.4,
    marginBottom: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  scroll: { paddingHorizontal: 16, paddingTop: 4, gap: 14 },
  cities: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  city: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  summaryCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  summaryHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  summaryEyebrow: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  summaryPrice: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    letterSpacing: -1,
  },
  summaryRange: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  summaryFoot: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    paddingTop: 10,
  },
  summaryAvg: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  trend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  trendText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  tabsRow: { paddingTop: 4 },
  sortChips: {
    flexDirection: "row",
    gap: 6,
  },
  sortChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  sortText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  flightRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 12,
  },
  flightTimeCol: { width: 60 },
  flightTime: { fontSize: 16, fontFamily: "Inter_700Bold" },
  flightSub: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2 },
  flightMid: { flex: 1 },
  flightAirlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  flightAirline: { fontSize: 13, fontFamily: "Inter_600SemiBold", flexShrink: 1 },
  departedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: "#8893B822",
  },
  departedText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "#8893B8",
  },
  flightPrice: { fontSize: 15, fontFamily: "Inter_700Bold" },
  trendCard: { borderRadius: 18, borderWidth: 1, padding: 12 },
  detailGrid: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 14 },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  detailLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  detailValue: { fontSize: 15, fontFamily: "Inter_700Bold" },
  detailSub: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2 },
  emptyState: { padding: 40, alignItems: "center" },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
});
