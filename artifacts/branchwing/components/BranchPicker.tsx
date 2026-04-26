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
import type { Branch } from "@/lib/types";

type Props = {
  branches: Branch[];
  activeBranchId: string;
  onSelect: (id: string) => void;
  onNewBranch: () => void;
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
            <Text
              style={[
                styles.chipText,
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
                styles.chipCount,
                {
                  color: active
                    ? "rgba(255,255,255,0.8)"
                    : colors.mutedForeground,
                },
              ]}
            >
              {b.segments.length}
            </Text>
          </Pressable>
        );
      })}

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
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  chipCount: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    marginLeft: 2,
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
