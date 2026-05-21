import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { DateField } from "./DateField";

type ReportFiltersProps = {
  fromDate: string;
  toDate: string;
  onChangeFromDate: (value: string) => void;
  onChangeToDate: (value: string) => void;
  totalAmount: number;
  itemCount: number;
};

export function ReportFilters({
  fromDate,
  toDate,
  onChangeFromDate,
  onChangeToDate,
  totalAmount,
  itemCount,
}: ReportFiltersProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Date-wise report</Text>
      <View style={styles.row}>
        <DateField style={styles.input} value={fromDate} onChange={onChangeFromDate} placeholder="From date" allowClear />
        <DateField style={styles.input} value={toDate} onChange={onChangeToDate} placeholder="To date" allowClear />
      </View>
      <Text style={styles.meta}>{itemCount} expenses in range</Text>
      <Text style={styles.total}>Rs. {totalAmount.toLocaleString("en-IN")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#F9F3EC",
    borderRadius: 24,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: "#E7D7C7",
  },
  title: {
    color: "#2F241B",
    fontSize: 16,
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  input: {
    flex: 1,
  },
  meta: {
    color: "#7A6858",
  },
  total: {
    color: "#2E6A49",
    fontSize: 22,
    fontWeight: "800",
  },
});
