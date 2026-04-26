import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { branchPalette } from "@/constants/colors";
import { useColors } from "@/hooks/useColors";
import { useTrips } from "@/contexts/TripsContext";
import { fmtTime } from "@/lib/time";

const SUGGESTIONS = [
  "Cheaper option",
  "Faster route",
  "Add a stopover",
  "Different dates",
  "Premium cabin",
  "Red-eye",
];

export default function ForkBranchScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tripId, parentBranchId, forkAfterSegmentId } = useLocalSearchParams<{
    tripId: string;
    parentBranchId: string;
    forkAfterSegmentId?: string;
  }>();
  const { getTrip, forkBranch } = useTrips();

  const trip = tripId ? getTrip(tripId) : undefined;
  const parent = trip?.branches.find((b) => b.id === parentBranchId);
  const forkSeg = forkAfterSegmentId
    ? parent?.segments.find((s) => s.id === forkAfterSegmentId)
    : null;

  const usedColors = useMemo(
    () => new Set(trip?.branches.map((b) => b.color) ?? []),
    [trip],
  );
  const suggestedColor =
    branchPalette.find((c) => !usedColors.has(c)) ?? branchPalette[0];

  const [label, setLabel] = useState<string>(
    forkSeg ? `After ${forkSeg.toCity}` : "",
  );

  const canSave = label.trim().length > 0 && trip && parent;

  const onSave = () => {
    if (!canSave || !trip || !parent) return;
    forkBranch(
      trip.id,
      parent.id,
      label.trim(),
      forkAfterSegmentId && forkAfterSegmentId.length > 0
        ? forkAfterSegmentId
        : null,
    );
    router.back();
  };

  if (!trip || !parent) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Feather name="x" size={22} color={colors.foreground} />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Feather name="x" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          New branch
        </Text>
        <Pressable
          onPress={onSave}
          disabled={!canSave}
          hitSlop={12}
          style={({ pressed }) => [
            styles.saveBtn,
            {
              backgroundColor: canSave ? suggestedColor : colors.muted,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text
            style={[
              styles.saveBtnText,
              { color: canSave ? "#fff" : colors.mutedForeground },
            ]}
          >
            Fork
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.parentBlock,
            {
              backgroundColor: colors.card,
              borderLeftColor: parent.color,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.parentLabel, { color: colors.mutedForeground }]}>
            Forking from
          </Text>
          <Text style={[styles.parentName, { color: colors.foreground }]}>
            {parent.label}
          </Text>
          {forkSeg ? (
            <View style={styles.parentForkRow}>
              <Feather name="git-branch" size={12} color={parent.color} />
              <Text
                style={[
                  styles.parentForkText,
                  { color: colors.mutedForeground },
                ]}
              >
                After {forkSeg.fromCode} → {forkSeg.toCode} ·{" "}
                {fmtTime(forkSeg.arrive)}
              </Text>
            </View>
          ) : (
            <View style={styles.parentForkRow}>
              <Feather name="play-circle" size={12} color={parent.color} />
              <Text
                style={[
                  styles.parentForkText,
                  { color: colors.mutedForeground },
                ]}
              >
                Fresh from origin · no inherited flights
              </Text>
            </View>
          )}
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Branch name
          </Text>
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder="What makes this different?"
            placeholderTextColor={colors.mutedForeground}
            style={[
              styles.input,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                color: colors.foreground,
              },
            ]}
            autoFocus
          />
          <View style={styles.suggestions}>
            {SUGGESTIONS.map((s) => (
              <Pressable
                key={s}
                onPress={() => setLabel(s)}
                style={({ pressed }) => [
                  styles.suggestion,
                  {
                    backgroundColor: colors.muted,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.suggestionText,
                    { color: colors.foreground },
                  ]}
                >
                  {s}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View
          style={[
            styles.colorBlock,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={[styles.colorSwatch, { backgroundColor: suggestedColor }]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.colorTitle, { color: colors.foreground }]}>
              Branch color
            </Text>
            <Text
              style={[
                styles.colorSub,
                { color: colors.mutedForeground },
              ]}
            >
              Auto-assigned for clarity on the timeline.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  saveBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
  },
  body: {
    padding: 20,
    gap: 16,
  },
  parentBlock: {
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  parentLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  parentName: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    marginBottom: 6,
  },
  parentForkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  parentForkText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  field: {
    gap: 10,
  },
  label: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginLeft: 2,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: "Inter_500Medium",
  },
  suggestions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  suggestion: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  suggestionText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  colorBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  colorSwatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  colorTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  colorSub: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
});
