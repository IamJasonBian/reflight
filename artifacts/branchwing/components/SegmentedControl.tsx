import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

type Option<V extends string> = {
  value: V;
  label: string;
};

type Props<V extends string> = {
  value: V;
  options: Option<V>[];
  onChange: (next: V) => void;
};

export function SegmentedControl<V extends string>({
  value,
  options,
  onChange,
}: Props<V>) {
  const colors = useColors();
  return (
    <View style={[styles.wrap, { backgroundColor: colors.muted }]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => {
              if (Platform.OS !== "web") {
                Haptics.selectionAsync().catch(() => {});
              }
              onChange(opt.value);
            }}
            style={({ pressed }) => [
              styles.tab,
              {
                backgroundColor: active ? colors.card : "transparent",
                opacity: pressed ? 0.85 : 1,
                shadowOpacity: active ? 0.18 : 0,
              },
            ]}
          >
            <Text
              style={[
                styles.label,
                {
                  color: active ? colors.foreground : colors.mutedForeground,
                  fontFamily: active ? "Inter_700Bold" : "Inter_500Medium",
                },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    padding: 3,
    borderRadius: 12,
    gap: 3,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 9,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  label: {
    fontSize: 13,
    letterSpacing: 0.2,
  },
});
