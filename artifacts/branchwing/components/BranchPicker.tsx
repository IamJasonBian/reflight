import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { branchHasAnyPrice, branchTotalPrice, fmtPrice } from "@/lib/time";
import type { Branch } from "@/lib/types";

type Props = {
  branches: Branch[];
  activeBranchId: string;
  onSelect: (id: string) => void;
  onNewBranch?: () => void;
};

export function BranchPicker({
  branches,
  activeBranchId,
  onSelect,
  onNewBranch,
}: Props) {
  const colors = useColors();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {branches.map((b) => {
        const active = b.id === activeBranchId;
        const hasPrice = branchHasAnyPrice(b.segments);
        const total = branchTotalPrice(b.segments);
        return (
          <Pressable
            key={b.id}
            onPress={() => {
              if (Platform.OS !== "web") {
                Haptics.selectionAsync().catch(() => {});
              }
              onSelect(b.id);
            }}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: active ? b.color : colors.card,
                borderColor: active ? b.color : colors.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: active ? "#fff" : b.color,
                  borderColor: active ? "#fff" : b.color,
                },
              ]}
            />
            <View style={styles.chipText}>
              <Text
                style={[
                  styles.chipLabel,
                  {
                    color: active ? "#fff" : colors.foreground,
                  },
                ]}
                numberOfLines={1}
              >
                {b.label}
              </Text>
              <Text
                style={[
                  styles.chipMeta,
                  {
                    color: active
                      ? "rgba(255,255,255,0.85)"
                      : colors.mutedForeground,
                  },
                ]}
                numberOfLines={1}
              >
                {b.segments.length} flight
                {b.segments.length === 1 ? "" : "s"}
                {hasPrice ? ` · ${fmtPrice(total)}` : ""}
              </Text>
            </View>
          </Pressable>
        );
      })}

      {onNewBranch ? (
        <Pressable
          onPress={onNewBranch}
          style={({ pressed }) => [
            styles.newBtn,
            {
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Feather name="git-branch" size={13} color={colors.mutedForeground} />
          <Text style={[styles.newBtnText, { color: colors.mutedForeground }]}>
            New branch
          </Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 200,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
  },
  chipText: {
    flexShrink: 1,
  },
  chipLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  chipMeta: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    marginTop: 1,
    letterSpacing: 0.3,
  },
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  newBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});
