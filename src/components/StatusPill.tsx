import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { ExpenseStatus } from "../types";

type StatusPillProps = {
  status: ExpenseStatus;
};

const statusPalette: Record<ExpenseStatus, { backgroundColor: string; textColor: string }> = {
  approved: { backgroundColor: "#D9F3DF", textColor: "#1C6A3B" },
  pending: { backgroundColor: "#FFF1CC", textColor: "#996B00" },
  rejected: { backgroundColor: "#FADADF", textColor: "#A53A52" },
};

export function StatusPill({ status }: StatusPillProps) {
  const palette = statusPalette[status];

  return (
    <View style={[styles.pill, { backgroundColor: palette.backgroundColor }]}>
      <Text style={[styles.text, { color: palette.textColor }]}>{status.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  text: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
});
