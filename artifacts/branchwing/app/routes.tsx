import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RouteCard } from "@/components/RouteCard";
import { useColors } from "@/hooks/useColors";
import { fetchPopularRoutes, fetchPriceHistory } from "@/services/api";
import {
  loadSavedRoutes,
  routeId,
  saveSavedRoutes,
} from "@/services/routeService";
import type { RouteMeta, RoutePriceHistory, SavedRoute } from "@/lib/types";
import { fmtPrice } from "@/lib/time";

type Loaded = {
  route: RouteMeta;
  history: RoutePriceHistory;
};

export default function RoutesScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Loaded[]>([]);
  const [saved, setSaved] = useState<SavedRoute[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "saved">("all");

  const load = async () => {
    const routes = await fetchPopularRoutes();
    const histories = await Promise.all(
      routes.map((r) => fetchPriceHistory(r.fromCode, r.toCode, r.basePrice)),
    );
    setItems(routes.map((r, i) => ({ route: r, history: histories[i] })));
    setSaved(await loadSavedRoutes());
  };

  useEffect(() => {
    load();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const onTogglePin = async (route: RouteMeta) => {
    const id = routeId(route.fromCode, route.toCode);
    const exists = saved.find((s) => s.id === id);
    const next = exists
      ? saved.filter((s) => s.id !== id)
      : [
          ...saved,
          {
            id,
            fromCode: route.fromCode,
            toCode: route.toCode,
            pinnedAt: new Date().toISOString(),
          },
        ];
    setSaved(next);
    await saveSavedRoutes(next);
  };

  const visible =
    filter === "saved"
      ? items.filter((i) =>
          saved.some((s) => s.id === routeId(i.route.fromCode, i.route.toCode)),
        )
      : items;

  const cheapest = items.reduce<Loaded | null>(
    (best, cur) =>
      best == null || cur.history.current < best.history.current ? cur : best,
    null,
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Feather name="chevron-left" size={26} color={colors.foreground} />
        </Pressable>
        <View style={{ alignItems: "center" }}>
          <Text style={[styles.headerEyebrow, { color: colors.mutedForeground }]}>
            Routes
          </Text>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Popular flights
          </Text>
        </View>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 32 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroRow}>
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>
            {items.length} routes
          </Text>
          {cheapest && (
            <View style={[styles.heroBadge, { backgroundColor: colors.muted }]}>
              <Feather name="zap" size={11} color={colors.primary} />
              <Text style={[styles.heroBadgeText, { color: colors.foreground }]}>
                Cheapest {fmtPrice(cheapest.history.current)} ·{" "}
                {cheapest.route.fromCode} → {cheapest.route.toCode}
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.filterRow, { backgroundColor: colors.muted }]}>
          {(["all", "saved"] as const).map((f) => {
            const active = filter === f;
            return (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={({ pressed }) => [
                  styles.filterTab,
                  {
                    backgroundColor: active ? colors.card : "transparent",
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Feather
                  name={f === "all" ? "globe" : "bookmark"}
                  size={12}
                  color={
                    active ? colors.foreground : colors.mutedForeground
                  }
                />
                <Text
                  style={[
                    styles.filterText,
                    {
                      color: active ? colors.foreground : colors.mutedForeground,
                      fontFamily: active
                        ? "Inter_700Bold"
                        : "Inter_500Medium",
                    },
                  ]}
                >
                  {f === "all"
                    ? "All routes"
                    : `Saved${saved.length ? ` · ${saved.length}` : ""}`}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {visible.length === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.card }]}>
              <Feather name="bookmark" size={20} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No saved routes yet
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Tap the bookmark on any route to pin it here for quick access.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {visible.map((item) => {
              const id = routeId(item.route.fromCode, item.route.toCode);
              const pinned = saved.some((s) => s.id === id);
              return (
                <RouteCard
                  key={id}
                  route={item.route}
                  history={item.history}
                  pinned={pinned}
                  onTogglePin={() => onTogglePin(item.route)}
                  onPress={() =>
                    router.push({
                      pathname: "/route/[od]",
                      params: { od: id },
                    })
                  }
                />
              );
            })}
          </View>
        )}
      </ScrollView>
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
  headerTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  scroll: { paddingHorizontal: 16, paddingTop: 4 },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  heroTitle: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  heroBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  filterRow: {
    flexDirection: "row",
    padding: 3,
    borderRadius: 12,
    gap: 3,
    marginBottom: 16,
  },
  filterTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
    borderRadius: 9,
  },
  filterText: { fontSize: 12, letterSpacing: 0.2 },
  list: { gap: 12 },
  empty: {
    alignItems: "center",
    paddingTop: 56,
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
  emptyTitle: { fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 4 },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
});
