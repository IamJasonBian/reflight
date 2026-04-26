import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { useColors } from "@/hooks/useColors";
import type { Branch } from "@/lib/types";

type Props = {
  branches: Branch[];
  activeBranchId: string;
  onSelect: (id: string) => void;
};

const NODE_W = 132;
const NODE_H = 64;
const COL_GAP = 24;
const ROW_GAP = 28;

type Layout = {
  branch: Branch;
  col: number;
  row: number;
  x: number;
  y: number;
};

export function BranchTree({ branches, activeBranchId, onSelect }: Props) {
  const colors = useColors();

  const layout = useMemo<Layout[]>(() => {
    // Build a tree from branches by parentId
    const childrenOf = new Map<string | null, Branch[]>();
    for (const b of branches) {
      const list = childrenOf.get(b.parentId) ?? [];
      list.push(b);
      childrenOf.set(b.parentId, list);
    }

    const positions: Layout[] = [];
    const colCounter = { value: 0 };

    function place(branch: Branch, row: number) {
      const kids = childrenOf.get(branch.id) ?? [];
      if (kids.length === 0) {
        const col = colCounter.value++;
        positions.push({
          branch,
          col,
          row,
          x: col * (NODE_W + COL_GAP),
          y: row * (NODE_H + ROW_GAP),
        });
        return col;
      }
      const childCols = kids.map((k) => place(k, row + 1));
      const minCol = Math.min(...childCols);
      const maxCol = Math.max(...childCols);
      const col = (minCol + maxCol) / 2;
      positions.push({
        branch,
        col,
        row,
        x: col * (NODE_W + COL_GAP),
        y: row * (NODE_H + ROW_GAP),
      });
      return col;
    }

    const roots = childrenOf.get(null) ?? [];
    roots.forEach((r) => place(r, 0));

    return positions;
  }, [branches]);

  const width = useMemo(() => {
    const maxCol = layout.reduce((m, l) => Math.max(m, l.col), 0);
    return Math.max(NODE_W, (maxCol + 1) * (NODE_W + COL_GAP));
  }, [layout]);

  const height = useMemo(() => {
    const maxRow = layout.reduce((m, l) => Math.max(m, l.row), 0);
    return (maxRow + 1) * (NODE_H + ROW_GAP);
  }, [layout]);

  const lookup = useMemo(() => {
    const m = new Map<string, Layout>();
    for (const l of layout) m.set(l.branch.id, l);
    return m;
  }, [layout]);

  return (
    <View style={[styles.wrap, { width, height }]}>
      <Svg
        width={width}
        height={height}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        {layout.map((l) => {
          if (!l.branch.parentId) return null;
          const parent = lookup.get(l.branch.parentId);
          if (!parent) return null;
          const x1 = parent.x + NODE_W / 2;
          const y1 = parent.y + NODE_H;
          const x2 = l.x + NODE_W / 2;
          const y2 = l.y;
          const midY = (y1 + y2) / 2;
          const d = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
          return (
            <Path
              key={l.branch.id}
              d={d}
              stroke={l.branch.color}
              strokeWidth={2}
              strokeLinecap="round"
              fill="none"
              opacity={0.7}
            />
          );
        })}
      </Svg>

      {layout.map((l) => {
        const active = l.branch.id === activeBranchId;
        return (
          <Pressable
            key={l.branch.id}
            onPress={() => onSelect(l.branch.id)}
            style={({ pressed }) => [
              styles.node,
              {
                left: l.x,
                top: l.y,
                width: NODE_W,
                height: NODE_H,
                backgroundColor: active ? l.branch.color : colors.card,
                borderColor: active ? l.branch.color : colors.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <View style={styles.nodeRow}>
              <View
                style={[
                  styles.nodeDot,
                  {
                    backgroundColor: active ? "#fff" : l.branch.color,
                  },
                ]}
              />
              <Text
                style={[
                  styles.nodeLabel,
                  { color: active ? "#fff" : colors.foreground },
                ]}
                numberOfLines={1}
              >
                {l.branch.label}
              </Text>
            </View>
            <Text
              style={[
                styles.nodeMeta,
                {
                  color: active
                    ? "rgba(255,255,255,0.85)"
                    : colors.mutedForeground,
                },
              ]}
            >
              {l.branch.segments.length} flight
              {l.branch.segments.length === 1 ? "" : "s"}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
  },
  node: {
    position: "absolute",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: "center",
  },
  nodeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  nodeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  nodeLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  nodeMeta: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    marginTop: 4,
    letterSpacing: 0.4,
  },
});
