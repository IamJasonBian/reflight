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

import { AirportPicker } from "@/components/AirportPicker";
import { DateTimeField } from "@/components/DateTimeField";
import { useColors } from "@/hooks/useColors";
import { useTrips } from "@/contexts/TripsContext";
import { AIRLINES, findAirport, type Airport } from "@/lib/airports";
import { addHours } from "@/lib/time";

export default function AddSegmentScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tripId, branchId } = useLocalSearchParams<{
    tripId: string;
    branchId: string;
  }>();
  const { getTrip, addSegment } = useTrips();

  const trip = tripId ? getTrip(tripId) : undefined;
  const branch = trip?.branches.find((b) => b.id === branchId);

  const lastSeg = branch?.segments[branch.segments.length - 1];

  const initialFrom = useMemo<Airport | null>(() => {
    if (lastSeg) return findAirport(lastSeg.toCode);
    if (trip) return findAirport(trip.originCode);
    return null;
  }, [lastSeg, trip]);

  const initialDepart = useMemo(() => {
    if (lastSeg) return addHours(lastSeg.arrive, 2);
    if (trip) return trip.startDate;
    return new Date().toISOString();
  }, [lastSeg, trip]);

  const [from, setFrom] = useState<Airport | null>(initialFrom);
  const [to, setTo] = useState<Airport | null>(null);
  const [depart, setDepart] = useState<string>(initialDepart);
  const [arrive, setArrive] = useState<string>(addHours(initialDepart, 3));
  const [airline, setAirline] = useState<string>(AIRLINES[0]);
  const [flightNo, setFlightNo] = useState<string>("");
  const [priceText, setPriceText] = useState<string>("");

  const canSave =
    from &&
    to &&
    from.code !== to.code &&
    new Date(arrive).getTime() > new Date(depart).getTime();

  const parsedPrice = (() => {
    const cleaned = priceText.replace(/[^0-9.]/g, "");
    if (!cleaned) return undefined;
    const n = parseFloat(cleaned);
    if (!Number.isFinite(n) || n <= 0) return undefined;
    return n;
  })();

  const onSave = () => {
    if (!canSave || !from || !to || !trip || !branch) return;
    addSegment(trip.id, branch.id, {
      fromCode: from.code,
      fromCity: from.city,
      toCode: to.code,
      toCity: to.city,
      depart,
      arrive,
      airline,
      flightNo: flightNo.trim() || `${airline.slice(0, 2).toUpperCase()}---`,
      price: parsedPrice,
    });
    router.back();
  };

  if (!trip || !branch) {
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
        <View style={{ alignItems: "center" }}>
          <Text
            style={[
              styles.headerEyebrow,
              { color: colors.mutedForeground },
            ]}
          >
            {branch.label}
          </Text>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Add flight
          </Text>
        </View>
        <Pressable
          onPress={onSave}
          disabled={!canSave}
          hitSlop={12}
          style={({ pressed }) => [
            styles.saveBtn,
            {
              backgroundColor: canSave ? branch.color : colors.muted,
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
            Save
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <AirportPicker label="From" value={from} onChange={setFrom} />
          </View>
          <View style={styles.swap}>
            <Pressable
              onPress={() => {
                const a = from;
                setFrom(to);
                setTo(a);
              }}
              hitSlop={10}
              style={[styles.swapBtn, { backgroundColor: colors.muted }]}
            >
              <Feather name="repeat" size={14} color={colors.foreground} />
            </Pressable>
          </View>
          <View style={{ flex: 1 }}>
            <AirportPicker label="To" value={to} onChange={setTo} />
          </View>
        </View>

        <DateTimeField
          label="Departs"
          value={depart}
          onChange={(iso) => {
            setDepart(iso);
            if (new Date(arrive).getTime() <= new Date(iso).getTime()) {
              setArrive(addHours(iso, 3));
            }
          }}
        />

        <DateTimeField
          label="Arrives"
          value={arrive}
          onChange={setArrive}
          minDate={depart}
        />

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Airline
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.airlineRow}>
              {AIRLINES.map((a) => {
                const active = a === airline;
                return (
                  <Pressable
                    key={a}
                    onPress={() => setAirline(a)}
                    style={({ pressed }) => [
                      styles.airlineChip,
                      {
                        backgroundColor: active ? branch.color : colors.card,
                        borderColor: active ? branch.color : colors.border,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.airlineText,
                        { color: active ? "#fff" : colors.foreground },
                      ]}
                    >
                      {a}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              Flight no.
            </Text>
            <TextInput
              value={flightNo}
              onChangeText={setFlightNo}
              placeholder="DL264"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="characters"
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
            />
          </View>
          <View style={{ width: 130 }}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              Price (USD)
            </Text>
            <View
              style={[
                styles.priceWrap,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.priceSymbol, { color: colors.mutedForeground }]}>
                $
              </Text>
              <TextInput
                value={priceText}
                onChangeText={setPriceText}
                placeholder="0"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="decimal-pad"
                inputMode="decimal"
                style={[styles.priceInput, { color: colors.foreground }]}
              />
            </View>
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
  headerEyebrow: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 16,
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
    gap: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  swap: {
    paddingTop: 24,
  },
  swapBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
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
  airlineRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 2,
  },
  airlineChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  airlineText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    letterSpacing: 1.2,
  },
  priceWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
  },
  priceSymbol: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    marginRight: 4,
  },
  priceInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: "Inter_500Medium",
  },
});
