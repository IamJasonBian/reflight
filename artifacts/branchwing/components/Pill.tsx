import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

type Props = {
  label: string;
  color?: string;
  bg?: string;
  size?: "sm" | "md";
};

export function Pill({ label, color, bg, size = "md" }: Props) {
  const colors = useColors();
  const textColor = color ?? colors.foreground;
  const bgColor = bg ?? colors.muted;
  return (
    <View
      style={[
        styles.base,
        size === "sm" ? styles.sm : styles.md,
        { backgroundColor: bgColor },
      ]}
    >
      <Text
        style={[
          styles.text,
          size === "sm" ? styles.textSm : styles.textMd,
          { color: textColor },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: "flex-start",
    borderRadius: 999,
  },
  sm: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  md: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  text: {
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.3,
  },
  textSm: {
    fontSize: 10,
  },
  textMd: {
    fontSize: 11,
  },
});
