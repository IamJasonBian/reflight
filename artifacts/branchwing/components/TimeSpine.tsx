import { Feather } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import {
  durationMs,
  fmtDayLabel,
  fmtDuration,
  fmtPrice,
  fmtTime,
} from "@/lib/time";
import type { Branch, Segment } from "@/lib/types";

type Props = {
  branch: Branch;
  onPressSegment?: (seg: Segment) => void;
  onAddFlight?: () => void;
  onForkAfter?: (seg: Segment) => void;
  startCity?: string;
  startCode?: string;
};

const SPINE_X = 28;

export function TimeSpine({
  branch,
  onPressSegment,
  onAddFlight,
  onForkAfter,
  startCity,
  startCode,
}: Props) {
  const colors = useColors();

  const grouped = useMemo(() => {
    const map = new Map<string, Segment[]>();
    for (const s of branch.segments) {
      const key = new Date(s.depart).toDateString();
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort(
      (a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime(),
    );
  }, [branch.segments]);

  if (branch.segments.length === 0) {
    return (
      <View style={styles.empty}>
        <View
          style={[
            styles.emptyIcon,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Feather name="navigation-2" size={20} color={branch.color} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
          No flights on this branch
        </Text>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          Add the first leg to start plotting your timeline.
        </Text>
        {onAddFlight && (
          <Pressable
            onPress={onAddFlight}
            style={({ pressed }) => [
              styles.emptyBtn,
              { backgroundColor: branch.color, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Feather name="plus" size={16} color="#fff" />
            <Text style={styles.emptyBtnText}>Add first flight</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Origin pin */}
      <View style={styles.row}>
        <View style={styles.gutter}>
          <View
            style={[
              styles.originDot,
              { borderColor: branch.color, backgroundColor: colors.background },
            ]}
          />
        </View>
        <View style={styles.originContent}>
          <Text
            style={[styles.originLabel, { color: colors.mutedForeground }]}
          >
            Departing
          </Text>
          <Text style={[styles.originCity, { color: colors.foreground }]}>
            {startCity ?? branch.segments[0].fromCity}
          </Text>
          <Text style={[styles.originCode, { color: colors.mutedForeground }]}>
            {startCode ?? branch.segments[0].fromCode}
          </Text>
        </View>
      </View>

      {grouped.map(([dayKey, daySegs], dayIdx) => (
        <View key={dayKey} style={styles.dayBlock}>
          <View style={styles.dayHeaderRow}>
            <View style={styles.gutter}>
              <View
                style={[
                  styles.dayDot,
                  { backgroundColor: branch.color, borderColor: colors.background },
                ]}
              />
            </View>
            <View style={styles.dayHeader}>
              <Text style={[styles.dayLabel, { color: branch.color }]}>
                {fmtDayLabel(dayKey)}
              </Text>
            </View>
          </View>

          {daySegs.map((seg, i) => {
            const isLast =
              dayIdx === grouped.length - 1 && i === daySegs.length - 1;
            const next =
              i < daySegs.length - 1
                ? daySegs[i + 1]
                : grouped[dayIdx + 1]?.[1]?.[0];
            const layoverMs = next ? durationMs(seg.arrive, next.depart) : 0;
            const flightMs = durationMs(seg.depart, seg.arrive);

            return (
              <View key={seg.id}>
                <View style={styles.segRow}>
                  <View style={styles.gutter}>
                    <View
                      style={[
                        styles.segLineTop,
                        { backgroundColor: branch.color },
                      ]}
                    />
                    <View
                      style={[
                        styles.segDot,
                        {
                          backgroundColor: colors.background,
                          borderColor: branch.color,
                        },
                      ]}
                    />
                    {!isLast && (
                      <View
                        style={[
                          styles.segLineBottom,
                          { backgroundColor: branch.color },
                        ]}
                      />
                    )}
                  </View>

                  <Pressable
                    onPress={() => onPressSegment?.(seg)}
                    style={({ pressed }) => [
                      styles.segCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        opacity: pressed ? 0.9 : 1,
                      },
                    ]}
                  >
                    <View style={styles.segHeader}>
                      <View style={styles.segTimes}>
                        <Text
                          style={[
                            styles.segTime,
                            { color: colors.foreground },
                          ]}
                        >
                          {fmtTime(seg.depart)}
                        </Text>
                        <View style={styles.segTimeRule}>
                          <View
                            style={[
                              styles.segTimeRuleLine,
                              { backgroundColor: colors.border },
                            ]}
                          />
                          <Text
                            style={[
                              styles.segDuration,
                              { color: colors.mutedForeground },
                            ]}
                          >
                            {fmtDuration(flightMs)}
                          </Text>
                          <View
                            style={[
                              styles.segTimeRuleLine,
                              { backgroundColor: colors.border },
                            ]}
                          />
                        </View>
                        <Text
                          style={[
                            styles.segTime,
                            { color: colors.foreground },
                          ]}
                        >
                          {fmtTime(seg.arrive)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.segRoute}>
                      <View style={styles.segPort}>
                        <Text
                          style={[
                            styles.segCode,
                            { color: colors.foreground },
                          ]}
                        >
                          {seg.fromCode}
                        </Text>
                        <Text
                          style={[
                            styles.segCity,
                            { color: colors.mutedForeground },
                          ]}
                        >
                          {seg.fromCity}
                        </Text>
                      </View>
                      <View style={styles.segArrow}>
                        <Feather
                          name="arrow-right"
                          size={16}
                          color={branch.color}
                        />
                      </View>
                      <View style={[styles.segPort, styles.segPortRight]}>
                        <Text
                          style={[
                            styles.segCode,
                            { color: colors.foreground },
                          ]}
                        >
                          {seg.toCode}
                        </Text>
                        <Text
                          style={[
                            styles.segCity,
                            { color: colors.mutedForeground },
                          ]}
                        >
                          {seg.toCity}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.segFooter,
                        { borderTopColor: colors.border },
                      ]}
                    >
                      <View style={styles.segMeta}>
                        <Feather
                          name="navigation"
                          size={11}
                          color={colors.mutedForeground}
                        />
                        <Text
                          style={[
                            styles.segMetaText,
                            { color: colors.mutedForeground },
                          ]}
                        >
                          {seg.airline} · {seg.flightNo}
                        </Text>
                        {typeof seg.price === "number" && seg.price > 0 && (
                          <View
                            style={[
                              styles.segPrice,
                              { backgroundColor: `${branch.color}22` },
                            ]}
                          >
                            <Text
                              style={[
                                styles.segPriceText,
                                { color: branch.color },
                              ]}
                            >
                              {fmtPrice(seg.price)}
                            </Text>
                          </View>
                        )}
                      </View>
                      {onForkAfter && (
                        <Pressable
                          onPress={() => onForkAfter(seg)}
                          hitSlop={8}
                          style={({ pressed }) => [
                            styles.forkBtn,
                            {
                              borderColor: branch.color,
                              opacity: pressed ? 0.7 : 1,
                            },
                          ]}
                        >
                          <Feather
                            name="git-branch"
                            size={11}
                            color={branch.color}
                          />
                          <Text
                            style={[styles.forkBtnText, { color: branch.color }]}
                          >
                            Fork
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </Pressable>
                </View>

                {!isLast && layoverMs > 0 && (
                  <View style={styles.layoverRow}>
                    <View style={styles.gutter}>
                      <View style={styles.layoverSpine}>
                        {Array.from({ length: 6 }).map((_, idx) => (
                          <View
                            key={idx}
                            style={[
                              styles.layoverDash,
                              { backgroundColor: branch.color, opacity: 0.5 },
                            ]}
                          />
                        ))}
                      </View>
                    </View>
                    <View
                      style={[
                        styles.layoverChip,
                        {
                          backgroundColor: colors.muted,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Feather
                        name="clock"
                        size={11}
                        color={colors.mutedForeground}
                      />
                      <Text
                        style={[
                          styles.layoverText,
                          { color: colors.mutedForeground },
                        ]}
                      >
                        {fmtDuration(layoverMs)} layover in {seg.toCity}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      ))}

      {/* Arrival pin */}
      {(() => {
        const last = branch.segments[branch.segments.length - 1];
        return (
          <View style={[styles.row, styles.arrivalRow]}>
            <View style={styles.gutter}>
              <View
                style={[
                  styles.arrivalDot,
                  { backgroundColor: branch.color },
                ]}
              />
            </View>
            <View style={styles.originContent}>
              <Text
                style={[styles.originLabel, { color: colors.mutedForeground }]}
              >
                Arriving
              </Text>
              <Text style={[styles.originCity, { color: branch.color }]}>
                {last.toCity}
              </Text>
              <Text
                style={[styles.originCode, { color: colors.mutedForeground }]}
              >
                {last.toCode} · {fmtTime(last.arrive)}
              </Text>
            </View>
          </View>
        );
      })()}

      {onAddFlight && (
        <View style={styles.addRow}>
          <View style={styles.gutter} />
          <Pressable
            onPress={onAddFlight}
            style={({ pressed }) => [
              styles.addBtn,
              {
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Feather name="plus" size={14} color={colors.mutedForeground} />
            <Text style={[styles.addBtnText, { color: colors.mutedForeground }]}>
              Add another flight
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export function ScrollableTimeSpine(props: Props) {
  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <TimeSpine {...props} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 4,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  gutter: {
    width: SPINE_X * 2,
    alignItems: "center",
    position: "relative",
  },
  originDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    marginTop: 4,
  },
  originContent: {
    flex: 1,
    paddingBottom: 16,
  },
  originLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  originCity: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  originCode: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  dayBlock: {
    marginBottom: 4,
  },
  dayHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  dayDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
  },
  dayHeader: {
    flex: 1,
    paddingVertical: 2,
  },
  dayLabel: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  segRow: {
    flexDirection: "row",
    alignItems: "stretch",
    minHeight: 110,
  },
  segLineTop: {
    position: "absolute",
    top: 0,
    width: 2,
    height: 18,
    left: SPINE_X - 1,
  },
  segDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
    marginTop: 12,
  },
  segLineBottom: {
    position: "absolute",
    top: 26,
    bottom: 0,
    width: 2,
    left: SPINE_X - 1,
  },
  segCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginVertical: 6,
    marginRight: 16,
  },
  segHeader: {
    marginBottom: 10,
  },
  segTimes: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  segTime: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    minWidth: 70,
  },
  segTimeRule: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  segTimeRuleLine: {
    flex: 1,
    height: 1,
  },
  segDuration: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  segRoute: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  segPort: {
    flex: 1,
  },
  segPortRight: {
    alignItems: "flex-end",
  },
  segCode: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  segCity: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  segArrow: {
    paddingHorizontal: 10,
  },
  segFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    borderTopWidth: 1,
  },
  segMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  segMetaText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  segPrice: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    marginLeft: 4,
  },
  segPriceText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  forkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  forkBtnText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  layoverRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  layoverSpine: {
    height: 32,
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 2,
    paddingBottom: 2,
  },
  layoverDash: {
    width: 2,
    height: 3,
  },
  layoverChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 16,
  },
  layoverText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  arrivalRow: {
    marginTop: 4,
  },
  arrivalDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginTop: 4,
  },
  addRow: {
    flexDirection: "row",
    marginTop: 8,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "dashed",
    marginRight: 16,
  },
  addBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  empty: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginBottom: 18,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  emptyBtnText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
});
