import React from "react";
import { StyleSheet, Text, View } from "react-native";

type SummaryCardProps = {
  label: string;
  amount: number;
  accent: string;
  backgroundColor?: string;
  amountColor?: string;
};

export function SummaryCard({
  label,
  amount,
  accent,
  backgroundColor = "#FFF9F3",
  amountColor = "#2F241B",
}: SummaryCardProps) {
  return (
    <View style={[styles.card, { borderColor: accent, backgroundColor }]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.amount, { color: amountColor }]}>Rs. {amount.toLocaleString("en-IN")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "48%",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    gap: 8,
    shadowColor: "#A06B3B",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  label: {
    color: "#7A6858",
    fontSize: 13,
    fontWeight: "700",
  },
  amount: {
    fontSize: 22,
    fontWeight: "800",
  },
});
