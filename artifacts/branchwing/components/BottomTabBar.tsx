import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

type TabKey = "trips" | "discover";

const TABS: {
  key: TabKey;
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  href: string;
}[] = [
  { key: "trips", label: "Trips", icon: "map", href: "/" },
  { key: "discover", label: "Discover", icon: "compass", href: "/discover" },
];

export function BottomTabBar({ active }: { active: TabKey }) {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const bottomPad = isWeb ? Math.max(insets.bottom, 16) : insets.bottom;

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          paddingBottom: bottomPad + 8,
        },
      ]}
    >
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        const tint = isActive ? colors.primary : colors.mutedForeground;
        return (
          <Pressable
            key={tab.key}
            onPress={() => {
              if (isActive) return;
              router.replace(tab.href as never);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
            style={({ pressed }) => [
              styles.tab,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Feather name={tab.icon} size={22} color={tint} />
            <Text
              style={[
                styles.label,
                {
                  color: tint,
                  fontFamily: isActive ? "Inter_700Bold" : "Inter_500Medium",
                },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const BOTTOM_TAB_BAR_HEIGHT = 56;

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingVertical: 4,
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.2,
  },
});
