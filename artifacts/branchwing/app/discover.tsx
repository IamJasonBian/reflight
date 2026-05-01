import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PublicTripCard } from "@/components/PublicTripCard";
import { useColors } from "@/hooks/useColors";
import {
  fetchDiscoverFeed,
  type DiscoverItem,
} from "@/services/discoverApi";

// Cursor-paginated public feed of trips authors have marked public.
export default function DiscoverScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = React.useState<DiscoverItem[]>([]);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [refreshing, setRefreshing] = React.useState<boolean>(false);
  const [loadingMore, setLoadingMore] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadFirstPage = React.useCallback(async () => {
    setError(null);
    const feed = await fetchDiscoverFeed({ limit: 20 });
    if (feed === null) {
      setError("Couldn't load Discover. Check your connection and try again.");
      setItems([]);
      setCursor(null);
    } else {
      setItems(feed.items);
      setCursor(feed.nextCursor);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      setLoading(true);
      loadFirstPage().finally(() => {
        if (!cancelled) setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, [loadFirstPage]),
  );

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await loadFirstPage();
    setRefreshing(false);
  }, [loadFirstPage]);

  const onEndReached = React.useCallback(async () => {
    if (loadingMore) return;
    if (!cursor) return;
    setLoadingMore(true);
    const feed = await fetchDiscoverFeed({ cursor, limit: 20 });
    if (feed) {
      setItems((prev) => [...prev, ...feed.items]);
      setCursor(feed.nextCursor);
    }
    setLoadingMore(false);
  }, [cursor, loadingMore]);

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
            Public itineraries
          </Text>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Discover
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>
            {error}
          </Text>
          <Pressable
            onPress={() => {
              setLoading(true);
              loadFirstPage().finally(() => setLoading(false));
            }}
            style={({ pressed }) => [
              styles.retry,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <View
            style={[
              styles.emptyIcon,
              { backgroundColor: `${colors.primary}22` },
            ]}
          >
            <Feather name="compass" size={26} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Nothing public yet
          </Text>
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>
            When travelers mark a trip public, it lands here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => `${it.author.handle}-${it.trip.id}`}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 32 },
          ]}
          renderItem={({ item }) => (
            <PublicTripCard
              trip={item.trip}
              authorHandle={item.author.handle}
              updatedAt={item.updatedAt}
              onPressTrip={() =>
                router.push(`/public-trips/${encodeURIComponent(item.trip.id)}`)
              }
              onPressHandle={() =>
                router.push(`/users/${encodeURIComponent(item.author.handle)}`)
              }
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator color={colors.mutedForeground} />
              </View>
            ) : null
          }
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
  footer: { padding: 16 },
});
