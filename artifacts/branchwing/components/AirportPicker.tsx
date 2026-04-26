import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { AIRPORTS, type Airport } from "@/lib/airports";

type Props = {
  label: string;
  value: Airport | null;
  onChange: (a: Airport) => void;
};

export function AirportPicker({ label, value, onChange }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return AIRPORTS;
    return AIRPORTS.filter(
      (a) =>
        a.code.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q) ||
        a.country.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.field,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Text style={[styles.label, { color: colors.mutedForeground }]}>
          {label}
        </Text>
        {value ? (
          <View style={styles.valueRow}>
            <Text style={[styles.code, { color: colors.foreground }]}>
              {value.code}
            </Text>
            <Text style={[styles.city, { color: colors.mutedForeground }]}>
              {value.city}
            </Text>
          </View>
        ) : (
          <Text style={[styles.placeholder, { color: colors.mutedForeground }]}>
            Choose airport
          </Text>
        )}
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <View
          style={[
            styles.modalRoot,
            { backgroundColor: colors.background, paddingTop: insets.top + 8 },
          ]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Pick {label.toLowerCase()}
            </Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={12}>
              <Feather name="x" size={22} color={colors.foreground} />
            </Pressable>
          </View>

          <View
            style={[
              styles.searchWrap,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="City or airport code"
              placeholderTextColor={colors.mutedForeground}
              autoFocus
              style={[styles.searchInput, { color: colors.foreground }]}
            />
          </View>

          <FlatList
            data={results}
            keyExtractor={(a) => a.code}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => (
              <View style={[styles.sep, { backgroundColor: colors.border }]} />
            )}
            ListEmptyComponent={
              <Text
                style={[styles.emptyText, { color: colors.mutedForeground }]}
              >
                No matches
              </Text>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onChange(item);
                  setOpen(false);
                  setQuery("");
                }}
                style={({ pressed }) => [
                  styles.row,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Text style={[styles.rowCode, { color: colors.foreground }]}>
                  {item.code}
                </Text>
                <View style={styles.rowText}>
                  <Text style={[styles.rowCity, { color: colors.foreground }]}>
                    {item.city}
                  </Text>
                  <Text
                    style={[
                      styles.rowCountry,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {item.country}
                  </Text>
                </View>
              </Pressable>
            )}
            contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  label: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
  },
  code: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  city: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  placeholder: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  modalRoot: {
    flex: 1,
    paddingHorizontal: 16,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    padding: 0,
  },
  sep: {
    height: 1,
    marginLeft: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  rowCode: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
    width: 50,
  },
  rowText: {
    flex: 1,
  },
  rowCity: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  rowCountry: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  emptyText: {
    textAlign: "center",
    paddingVertical: 40,
    fontFamily: "Inter_500Medium",
  },
});
