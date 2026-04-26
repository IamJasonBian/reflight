import React, { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { fmtDateLong, fmtTime } from "@/lib/time";

type Props = {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  minDate?: string;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];

function buildDayOptions(start: Date, count: number): Date[] {
  const arr: Date[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    d.setHours(0, 0, 0, 0);
    arr.push(d);
  }
  return arr;
}

export function DateTimeField({ label, value, onChange, minDate }: Props) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);

  const baseDate = useMemo(() => {
    const min = minDate ? new Date(minDate) : new Date();
    min.setHours(0, 0, 0, 0);
    return min;
  }, [minDate]);

  const days = useMemo(() => buildDayOptions(baseDate, 60), [baseDate]);

  const selected = new Date(value);
  const selectedDay = new Date(selected);
  selectedDay.setHours(0, 0, 0, 0);

  const onSelectDay = (d: Date) => {
    const next = new Date(selected);
    next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
    onChange(next.toISOString());
  };

  const onSelectHour = (h: number) => {
    const next = new Date(selected);
    next.setHours(h, next.getMinutes(), 0, 0);
    onChange(next.toISOString());
  };

  const onSelectMin = (m: number) => {
    const next = new Date(selected);
    next.setMinutes(m, 0, 0);
    onChange(next.toISOString());
  };

  return (
    <View>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        style={({ pressed }) => [
          styles.field,
          {
            backgroundColor: colors.card,
            borderColor: expanded ? colors.primary : colors.border,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Text style={[styles.label, { color: colors.mutedForeground }]}>
          {label}
        </Text>
        <View style={styles.row}>
          <Text style={[styles.date, { color: colors.foreground }]}>
            {fmtDateLong(value)}
          </Text>
          <Text style={[styles.time, { color: colors.primary }]}>
            {fmtTime(value)}
          </Text>
        </View>
      </Pressable>

      {expanded && (
        <View
          style={[
            styles.picker,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.section, { color: colors.mutedForeground }]}>
            Day
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.dayRow}>
              {days.map((d) => {
                const isSel = d.getTime() === selectedDay.getTime();
                return (
                  <Pressable
                    key={d.toISOString()}
                    onPress={() => onSelectDay(d)}
                    style={[
                      styles.dayChip,
                      {
                        backgroundColor: isSel ? colors.primary : colors.muted,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayChipDow,
                        {
                          color: isSel
                            ? "rgba(255,255,255,0.8)"
                            : colors.mutedForeground,
                        },
                      ]}
                    >
                      {d.toLocaleDateString([], { weekday: "short" })}
                    </Text>
                    <Text
                      style={[
                        styles.dayChipNum,
                        { color: isSel ? "#fff" : colors.foreground },
                      ]}
                    >
                      {d.getDate()}
                    </Text>
                    <Text
                      style={[
                        styles.dayChipMon,
                        {
                          color: isSel
                            ? "rgba(255,255,255,0.8)"
                            : colors.mutedForeground,
                        },
                      ]}
                    >
                      {d.toLocaleDateString([], { month: "short" })}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <Text
            style={[
              styles.section,
              { color: colors.mutedForeground, marginTop: 14 },
            ]}
          >
            Time
          </Text>
          <View style={styles.timeRow}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.timeCol}
              contentContainerStyle={styles.timeColInner}
              nestedScrollEnabled
            >
              {HOURS.map((h) => {
                const isSel = h === selected.getHours();
                return (
                  <Pressable
                    key={h}
                    onPress={() => onSelectHour(h)}
                    style={[
                      styles.timeCell,
                      {
                        backgroundColor: isSel ? colors.primary : "transparent",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.timeCellText,
                        {
                          color: isSel ? "#fff" : colors.foreground,
                          fontFamily: isSel
                            ? "Inter_700Bold"
                            : "Inter_500Medium",
                        },
                      ]}
                    >
                      {h.toString().padStart(2, "0")}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Text style={[styles.colon, { color: colors.foreground }]}>:</Text>
            <View style={styles.timeColMin}>
              {MINUTES.map((m) => {
                const isSel = m === selected.getMinutes();
                return (
                  <Pressable
                    key={m}
                    onPress={() => onSelectMin(m)}
                    style={[
                      styles.timeCell,
                      styles.timeCellMin,
                      {
                        backgroundColor: isSel ? colors.primary : colors.muted,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.timeCellText,
                        {
                          color: isSel ? "#fff" : colors.foreground,
                          fontFamily: isSel
                            ? "Inter_700Bold"
                            : "Inter_500Medium",
                        },
                      ]}
                    >
                      {m.toString().padStart(2, "0")}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  label: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  date: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  time: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  picker: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  section: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  dayRow: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 4,
  },
  dayChip: {
    width: 56,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: "center",
  },
  dayChipDow: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  dayChipNum: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    marginVertical: 2,
  },
  dayChipMon: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 160,
  },
  timeCol: {
    flex: 1,
  },
  timeColInner: {
    paddingVertical: 4,
  },
  timeColMin: {
    flex: 1,
    gap: 6,
  },
  colon: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  timeCell: {
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 2,
  },
  timeCellMin: {
    paddingVertical: 10,
    marginBottom: 0,
  },
  timeCellText: {
    fontSize: 16,
  },
});
