import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
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

import { AirportPicker } from "@/components/AirportPicker";
import { DateTimeField } from "@/components/DateTimeField";
import { useColors } from "@/hooks/useColors";
import { useTrips } from "@/contexts/TripsContext";
import { type Airport } from "@/lib/airports";

export default function NewTripScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { createTrip } = useTrips();

  const [title, setTitle] = useState<string>("");
  const [origin, setOrigin] = useState<Airport | null>(null);
  const [date, setDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setHours(9, 0, 0, 0);
    return d.toISOString();
  });

  const canSave = title.trim().length > 0 && origin;

  const onSave = () => {
    if (!canSave || !origin) return;
    const trip = createTrip({
      title: title.trim(),
      originCity: origin.city,
      originCode: origin.code,
      startDate: date,
    });
    router.replace(`/trip/${trip.id}`);
  };

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
          New trip
        </Text>
        <Pressable
          onPress={onSave}
          disabled={!canSave}
          hitSlop={12}
          style={({ pressed }) => [
            styles.saveBtn,
            {
              backgroundColor: canSave ? colors.primary : colors.muted,
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
            Create
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Trip name
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Paris in spring"
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
            returnKeyType="next"
          />
        </View>

        <View style={styles.field}>
          <AirportPicker
            label="Departing from"
            value={origin}
            onChange={setOrigin}
          />
        </View>

        <View style={styles.field}>
          <DateTimeField
            label="Earliest departure"
            value={date}
            onChange={setDate}
          />
        </View>

        <View
          style={[
            styles.hint,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Feather name="git-branch" size={16} color={colors.primary} />
          <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
            You can fork this trip into alternate routes any time after
            creating it.
          </Text>
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
  field: {
    gap: 8,
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
  hint: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "flex-start",
    marginTop: 8,
  },
  hintText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    lineHeight: 18,
  },
});
