import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { PriceHistoryChart } from "@/components/PriceHistoryChart";
import { useColors } from "@/hooks/useColors";
import { findAirport, haversineMiles } from "@/lib/airports";
import { fmtPrice } from "@/lib/time";
import type { RouteMeta, RoutePriceHistory } from "@/lib/types";

type Props = {
  route: RouteMeta;
  history: RoutePriceHistory;
  onPress: () => void;
  pinned?: boolean;
  onTogglePin?: () => void;
};

export function RouteCard({
  route,
  history,
  onPress,
  pinned,
  onTogglePin,
}: Props) {
  const colors = useColors();
  const from = findAirport(route.fromCode);
  const to = findAirport(route.toCode);
  const dist =
    from && to ? `${Math.round(haversineMiles(from, to)).toLocaleString()} mi` : "";

  const trendColor =
    history.trend === "down"
      ? "#3DD68C"
      : history.trend === "up"
        ? "#FF6B6B"
        : colors.mutedForeground;
  const trendIcon =
    history.trend === "down"
      ? "trending-down"
      : history.trend === "up"
        ? "trending-up"
        : "minus";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.92 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
      ]}
    >
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <View style={styles.routeRow}>
            <Text style={[styles.code, { color: colors.foreground }]}>
              {route.fromCode}
            </Text>
            <Feather name="arrow-right" size={14} color={colors.mutedForeground} />
            <Text style={[styles.code, { color: colors.foreground }]}>
              {route.toCode}
            </Text>
          </View>
          <Text style={[styles.cities, { color: colors.mutedForeground }]} numberOfLines={1}>
            {from?.city} → {to?.city}
            {dist ? ` · ${dist}` : ""}
          </Text>
        </View>
        <View style={styles.priceCol}>
          <Text style={[styles.price, { color: colors.foreground }]}>
            {fmtPrice(history.current)}
          </Text>
          <View style={styles.trendRow}>
            <Feather name={trendIcon} size={11} color={trendColor} />
            <Text style={[styles.trendText, { color: trendColor }]}>
              {history.changePct >= 0 ? "+" : ""}
              {history.changePct.toFixed(1)}%
            </Text>
          </View>
        </View>
        {onTogglePin && (
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              onTogglePin();
            }}
            hitSlop={10}
            style={({ pressed }) => [
              styles.pinBtn,
              {
                backgroundColor: pinned ? colors.accent : "transparent",
                borderColor: pinned ? colors.accent : colors.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Feather
              name={pinned ? "bookmark" : "plus"}
              size={12}
              color={pinned ? "#fff" : colors.mutedForeground}
            />
          </Pressable>
        )}
      </View>

      <PriceHistoryChart history={history} height={70} />

      <View style={[styles.foot, { borderTopColor: colors.border }]}>
        <Stat
          icon="arrow-down-right"
          label="Low"
          value={fmtPrice(history.min)}
          color={colors.mutedForeground}
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Stat
          icon="bar-chart-2"
          label="Avg"
          value={fmtPrice(history.avg)}
          color={colors.mutedForeground}
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Stat
          icon="arrow-up-right"
          label="High"
          value={fmtPrice(history.max)}
          color={colors.mutedForeground}
        />
      </View>
    </Pressable>
  );
}

function Stat({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  value: string;
  color: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.stat}>
      <View style={styles.statTop}>
        <Feather name={icon} size={10} color={color} />
        <Text style={[styles.statLabel, { color }]}>{label}</Text>
      </View>
      <Text style={[styles.statValue, { color: colors.foreground }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  head: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  code: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  cities: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  priceCol: {
    alignItems: "flex-end",
  },
  price: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
  },
  trendText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
  foot: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    paddingTop: 10,
  },
  stat: {
    flex: 1,
    alignItems: "center",
  },
  statTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  statValue: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
  },
  pinBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginLeft: 8,
    marginTop: 2,
  },
});
