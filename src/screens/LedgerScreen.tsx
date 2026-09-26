import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { DateField } from "../components/DateField";
import { usePettyCash } from "../context/PettyCashContext";
import { openingCashInHand } from "../data/mockData";
import { buildDaybook, formatLedgerDate, formatRupees } from "../lib/ledgerUtils";

type LedgerScreenProps = {
  onBack: () => void;
};

export function LedgerScreen({ onBack }: LedgerScreenProps) {
  const { expenses, ledger } = usePettyCash();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const daybook = useMemo(
    () => buildDaybook(expenses, ledger?.openingBalance ?? openingCashInHand, fromDate, toDate),
    [expenses, ledger, fromDate, toDate],
  );
  const pendingCount = useMemo(() => expenses.filter((expense) => expense.status === "pending").length, [expenses]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={onBack} style={styles.backButton} accessibilityRole="button">
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Ledger · Day Book</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.filterRow}>
          <DateField style={styles.dateInput} value={fromDate} onChange={setFromDate} placeholder="From date" allowClear />
          <DateField style={styles.dateInput} value={toDate} onChange={setToDate} placeholder="To date" allowClear />
        </View>
        <View style={styles.totalsGrid}>
          <Total label="Opening" value={daybook.openingBalance} />
          <Total label="Receipts (In)" value={daybook.totalReceipts} color="#1C6A3B" />
          <Total label="Payments (Out)" value={daybook.totalPayments} color="#A53A52" />
          <Total label="Closing" value={daybook.closingBalance} strong />
        </View>
        <Text style={styles.note}>
          Approved entries only{pendingCount ? ` · ${pendingCount} pending not included` : ""}
        </Text>
      </View>

      {daybook.days.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.empty}>No approved entries in this period.</Text>
        </View>
      ) : null}

      {daybook.days.map((day) => (
        <View key={day.date} style={styles.dayCard}>
          <View style={styles.dayHeader}>
            <Text style={styles.dayDate}>{formatLedgerDate(day.date, true)}</Text>
            <Text style={styles.dayOpening}>Opening {formatRupees(day.openingBalance)}</Text>
          </View>

          <View style={styles.columnHeader}>
            <Text style={[styles.colText, styles.colDesc]}>Particulars</Text>
            <Text style={[styles.colText, styles.colAmount]}>In</Text>
            <Text style={[styles.colText, styles.colAmount]}>Out</Text>
            <Text style={[styles.colText, styles.colAmount]}>Balance</Text>
          </View>

          {day.entries.map((entry) => (
            <View key={entry.expense.id} style={styles.entryRow}>
              <View style={styles.colDesc}>
                <Text style={styles.entryTitle} numberOfLines={2}>
                  {entry.expense.description}
                </Text>
                <Text style={styles.entryMeta} numberOfLines={1}>
                  {[entry.expense.accountingHead, entry.expense.createdBy].filter(Boolean).join(" · ")}
                </Text>
              </View>
              <Text style={[styles.amount, styles.colAmount, styles.inText]}>
                {entry.receipt ? formatRupees(entry.receipt) : ""}
              </Text>
              <Text style={[styles.amount, styles.colAmount, styles.outText]}>
                {entry.payment ? formatRupees(entry.payment) : ""}
              </Text>
              <Text style={[styles.amount, styles.colAmount]}>{formatRupees(entry.balance)}</Text>
            </View>
          ))}

          <View style={styles.dayFooter}>
            <Text style={[styles.footerLabel, styles.colDesc]}>Day total</Text>
            <Text style={[styles.amount, styles.colAmount, styles.inText]}>
              {day.totalReceipts ? formatRupees(day.totalReceipts) : ""}
            </Text>
            <Text style={[styles.amount, styles.colAmount, styles.outText]}>
              {day.totalPayments ? formatRupees(day.totalPayments) : ""}
            </Text>
            <Text style={[styles.amount, styles.colAmount, styles.closing]}>{formatRupees(day.closingBalance)}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function Total({ label, value, color, strong }: { label: string; value: number; color?: string; strong?: boolean }) {
  return (
    <View style={styles.totalBox}>
      <Text style={styles.totalLabel}>{label}</Text>
      <Text style={[styles.totalValue, color ? { color } : null, strong ? styles.totalStrong : null]}>{formatRupees(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 14,
    backgroundColor: "#F7F1E8",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#F7E7D8",
  },
  backText: {
    color: "#8A5A30",
    fontWeight: "700",
  },
  title: {
    color: "#2F241B",
    fontSize: 20,
    fontWeight: "800",
    flexShrink: 1,
  },
  card: {
    backgroundColor: "#FDF6EE",
    borderRadius: 20,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "#E7D7C7",
  },
  filterRow: {
    flexDirection: "row",
    gap: 10,
  },
  dateInput: {
    flex: 1,
  },
  totalsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  totalBox: {
    flexGrow: 1,
    flexBasis: "45%",
    backgroundColor: "#FFFDF9",
    borderRadius: 14,
    padding: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: "#EFE2D4",
  },
  totalLabel: {
    color: "#8A7462",
    fontSize: 12,
    fontWeight: "700",
  },
  totalValue: {
    color: "#2F241B",
    fontSize: 16,
    fontWeight: "700",
  },
  totalStrong: {
    color: "#215733",
    fontWeight: "800",
  },
  note: {
    color: "#8A7462",
    fontSize: 12,
  },
  empty: {
    color: "#6F5E50",
    textAlign: "center",
  },
  dayCard: {
    backgroundColor: "#FFFDF9",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E7D7C7",
    overflow: "hidden",
  },
  dayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#F5E7D9",
  },
  dayDate: {
    color: "#2F241B",
    fontWeight: "800",
    fontSize: 15,
  },
  dayOpening: {
    color: "#6F5E50",
    fontWeight: "700",
    fontSize: 13,
  },
  columnHeader: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#EFE2D4",
    gap: 6,
  },
  colText: {
    color: "#8A7462",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  colDesc: {
    flex: 1,
    minWidth: 0,
  },
  colAmount: {
    width: 78,
    textAlign: "right",
  },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#F4EADF",
    gap: 6,
  },
  entryTitle: {
    color: "#2F241B",
    fontSize: 14,
    fontWeight: "600",
  },
  entryMeta: {
    color: "#8A7462",
    fontSize: 12,
    marginTop: 2,
  },
  amount: {
    color: "#2F241B",
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  inText: {
    color: "#1C6A3B",
  },
  outText: {
    color: "#A53A52",
  },
  dayFooter: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#FBF3EA",
    gap: 6,
  },
  footerLabel: {
    color: "#6F5E50",
    fontWeight: "800",
    fontSize: 13,
  },
  closing: {
    fontWeight: "800",
    color: "#215733",
  },
});
