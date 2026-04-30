import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Stop,
} from "react-native-svg";

import { useColors } from "@/hooks/useColors";
import { fmtPrice } from "@/lib/time";
import type { RoutePriceHistory } from "@/lib/types";

type Props = {
  history: RoutePriceHistory;
  height?: number;
  accent?: string;
  showAxis?: boolean;
};

export function PriceHistoryChart({
  history,
  height = 140,
  accent,
  showAxis = false,
}: Props) {
  const colors = useColors();
  const stroke = accent ?? colors.primary;

  const { pathD, areaD, dotX, dotY } = useMemo(() => {
    const w = 320;
    const h = height;
    const padX = 8;
    const padTop = 14;
    const padBot = 18;
    const innerW = w - padX * 2;
    const innerH = h - padTop - padBot;
    const range = Math.max(1, history.max - history.min);
    const points = history.points.map((p, i) => {
      const x = padX + (i / (history.points.length - 1)) * innerW;
      const y = padTop + (1 - (p.price - history.min) / range) * innerH;
      return { x, y };
    });
    if (points.length === 0) {
      return { pathD: "", areaD: "", dotX: 0, dotY: 0 };
    }
    let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cx = (prev.x + curr.x) / 2;
      d += ` Q ${cx.toFixed(2)} ${prev.y.toFixed(2)} ${cx.toFixed(2)} ${(
        (prev.y + curr.y) /
        2
      ).toFixed(2)}`;
      d += ` T ${curr.x.toFixed(2)} ${curr.y.toFixed(2)}`;
    }
    const last = points[points.length - 1];
    const a =
      d +
      ` L ${last.x.toFixed(2)} ${(h - padBot).toFixed(2)}` +
      ` L ${points[0].x.toFixed(2)} ${(h - padBot).toFixed(2)} Z`;
    return { pathD: d, areaD: a, dotX: last.x, dotY: last.y };
  }, [history, height]);

  return (
    <View>
      <View style={{ height, width: "100%" }}>
        <Svg
          width="100%"
          height={height}
          viewBox={`0 0 320 ${height}`}
          preserveAspectRatio="none"
        >
          <Defs>
            <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
              <Stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {areaD && <Path d={areaD} fill="url(#fill)" />}
          {pathD && (
            <Path
              d={pathD}
              stroke={stroke}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          <Circle cx={dotX} cy={dotY} r={5} fill={stroke} />
          <Circle cx={dotX} cy={dotY} r={2.2} fill="#fff" />
        </Svg>
      </View>
      {showAxis && (
        <View style={styles.axis}>
          <Text style={[styles.axisLabel, { color: colors.mutedForeground }]}>
            {history.points[0]?.date.slice(5)}
          </Text>
          <Text style={[styles.axisLabel, { color: colors.mutedForeground }]}>
            {fmtPrice(history.min)} — {fmtPrice(history.max)}
          </Text>
          <Text style={[styles.axisLabel, { color: colors.mutedForeground }]}>
            today
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  axis: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    marginTop: 4,
  },
  axisLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.4,
  },
});
