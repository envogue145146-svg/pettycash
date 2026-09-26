import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { DateField } from "../components/DateField";
import { usePettyCash } from "../context/PettyCashContext";
import { buildUserSummaries, formatLedgerDate, formatRupees, UserSummary } from "../lib/ledgerUtils";

type UserExpensesScreenProps = {
  onBack: () => void;
};

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function UserExpensesScreen({ onBack }: UserExpensesScreenProps) {
  const { expenses, userPayments, role } = usePettyCash();
  const summaries = useMemo(() => buildUserSummaries(expenses, userPayments), [expenses, userPayments]);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const totals = useMemo(
    () =>
      summaries.reduce(
        (acc, summary) => ({
          approved: acc.approved + summary.approvedExpenses,
          paid: acc.paid + summary.paidTillDate,
          balance: acc.balance + summary.balance,
        }),
        { approved: 0, paid: 0, balance: 0 },
      ),
    [summaries],
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={onBack} style={styles.backButton} accessibilityRole="button">
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>User-wise Expenses</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.statRow}>
          <Stat label="Expenses" value={totals.approved} />
          <Stat label="Paid till date" value={totals.paid} color="#1C6A3B" />
          <Stat label="Balance due" value={totals.balance} color="#A53A52" />
        </View>
        <Text style={styles.note}>
          Balance = expenses recorded by the user (approved + pending, rejected excluded) − amount paid to them. Payments here don't change Cash In Hand.
        </Text>
      </View>

      {summaries.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.empty}>No expenses recorded yet.</Text>
        </View>
      ) : null}

      {summaries.map((summary) => (
        <UserCard
          key={summary.key}
          summary={summary}
          open={openKey === summary.key}
          onToggle={() => setOpenKey((current) => (current === summary.key ? null : summary.key))}
          canRecordPayment={role === "checker"}
        />
      ))}
    </ScrollView>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : null]}>{formatRupees(value)}</Text>
    </View>
  );
}

function UserCard({
  summary,
  open,
  onToggle,
  canRecordPayment,
}: {
  summary: UserSummary;
  open: boolean;
  onToggle: () => void;
  canRecordPayment: boolean;
}) {
  const { recordUserPayment, removeUserPayment } = usePettyCash();
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(todayIso());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleSave = async () => {
    if (!summary.userId) {
      return;
    }
    setSaving(true);
    const saved = await recordUserPayment({
      userId: summary.userId,
      amount: Number(amount.replace(/[^0-9.]/g, "")),
      paidOn,
      note,
    });
    setSaving(false);
    if (saved) {
      setAmount("");
      setNote("");
    }
  };

  return (
    <View style={styles.userCard}>
      <Pressable onPress={onToggle} style={styles.userHeader} accessibilityRole="button">
        <View style={styles.userNameRow}>
          <Text style={styles.userName}>{summary.name}</Text>
          <Text style={styles.chevron}>{open ? "▲" : "▼"}</Text>
        </View>
        <View style={styles.statRow}>
          <MiniStat label="Expenses" value={summary.approvedExpenses} />
          <MiniStat label="Paid" value={summary.paidTillDate} color="#1C6A3B" />
          <MiniStat label="Balance" value={summary.balance} color={summary.balance > 0 ? "#A53A52" : "#215733"} />
        </View>
        {summary.pendingExpenses > 0 ? (
          <Text style={styles.pending}>Includes {formatRupees(summary.pendingExpenses)} pending approval</Text>
        ) : null}
      </Pressable>

      {open ? (
        <View style={styles.userBody}>
          {canRecordPayment && summary.userId ? (
            <View style={styles.payForm}>
              <Text style={styles.sectionLabel}>Record payment to {summary.name}</Text>
              <View style={styles.payRow}>
                <TextInput
                  style={[styles.input, styles.amountInput]}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="Amount"
                  keyboardType="decimal-pad"
                  placeholderTextColor="#A8927F"
                />
                <DateField style={styles.dateInput} value={paidOn} onChange={setPaidOn} placeholder="Paid on" />
              </View>
              <TextInput
                style={styles.input}
                value={note}
                onChangeText={setNote}
                placeholder="Note (optional) e.g. cash / UPI"
                placeholderTextColor="#A8927F"
              />
              <Pressable
                onPress={() => void handleSave()}
                disabled={saving}
                style={[styles.payButton, saving ? styles.disabled : null]}
                accessibilityRole="button"
              >
                <Text style={styles.payButtonText}>{saving ? "Saving…" : "Record Payment"}</Text>
              </Pressable>
            </View>
          ) : null}

          <Text style={styles.sectionLabel}>Payments ({summary.payments.length})</Text>
          {summary.payments.length === 0 ? <Text style={styles.muted}>No payments yet.</Text> : null}
          {summary.payments.map((payment) => (
            <View key={payment.id} style={styles.listRow}>
              <View style={styles.listMain}>
                <Text style={styles.listTitle}>{formatLedgerDate(payment.paidOn)}</Text>
                {payment.note ? <Text style={styles.listMeta}>{payment.note}</Text> : null}
              </View>
              <Text style={[styles.listAmount, styles.paidText]}>{formatRupees(payment.amount)}</Text>
              {canRecordPayment ? (
                confirmDeleteId === payment.id ? (
                  <Pressable
                    onPress={() => {
                      setConfirmDeleteId(null);
                      void removeUserPayment(payment.id);
                    }}
                    style={styles.deleteConfirm}
                  >
                    <Text style={styles.deleteConfirmText}>Delete?</Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={() => setConfirmDeleteId(payment.id)} style={styles.deleteButton}>
                    <Text style={styles.deleteText}>✕</Text>
                  </Pressable>
                )
              ) : null}
            </View>
          ))}

          <Text style={styles.sectionLabel}>Expenses ({summary.expenses.length})</Text>
          {summary.expenses.map((expense) => (
            <View key={expense.id} style={styles.listRow}>
              <View style={styles.listMain}>
                <Text style={styles.listTitle} numberOfLines={2}>
                  {expense.description}
                </Text>
                <Text style={styles.listMeta}>
                  {formatLedgerDate(expense.purchaseDate)} · {expense.status}
                  {expense.transactionType === "credit" ? " · cash received" : ""}
                </Text>
              </View>
              <Text
                style={[
                  styles.listAmount,
                  expense.status === "rejected" ? styles.rejectedText : null,
                  expense.transactionType === "credit" ? styles.paidText : null,
                ]}
              >
                {formatRupees(expense.amount)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.miniValue, color ? { color } : null]}>{formatRupees(value)}</Text>
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
    gap: 10,
    borderWidth: 1,
    borderColor: "#E7D7C7",
  },
  statRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statBox: {
    flexGrow: 1,
    flexBasis: "30%",
    backgroundColor: "#FFFDF9",
    borderRadius: 14,
    padding: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: "#EFE2D4",
  },
  statLabel: {
    color: "#8A7462",
    fontSize: 11,
    fontWeight: "700",
  },
  statValue: {
    color: "#2F241B",
    fontSize: 15,
    fontWeight: "800",
  },
  note: {
    color: "#8A7462",
    fontSize: 12,
    lineHeight: 17,
  },
  empty: {
    color: "#6F5E50",
    textAlign: "center",
  },
  userCard: {
    backgroundColor: "#FFFDF9",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E7D7C7",
    overflow: "hidden",
  },
  userHeader: {
    padding: 14,
    gap: 10,
  },
  userNameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  userName: {
    color: "#2F241B",
    fontSize: 17,
    fontWeight: "800",
  },
  chevron: {
    color: "#8A5A30",
    fontSize: 12,
  },
  miniStat: {
    flexGrow: 1,
    flexBasis: "30%",
    gap: 2,
  },
  miniValue: {
    color: "#2F241B",
    fontSize: 14,
    fontWeight: "700",
  },
  pending: {
    color: "#8A6300",
    fontSize: 12,
    fontWeight: "600",
  },
  userBody: {
    borderTopWidth: 1,
    borderTopColor: "#EFE2D4",
    padding: 14,
    gap: 10,
    backgroundColor: "#FDF9F4",
  },
  payForm: {
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#EAF6EE",
    borderWidth: 1,
    borderColor: "#BFE0CB",
  },
  payRow: {
    flexDirection: "row",
    gap: 10,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0D2C3",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#2F241B",
    fontSize: 14,
  },
  amountInput: {
    flex: 1,
  },
  dateInput: {
    flex: 1,
  },
  payButton: {
    backgroundColor: "#2E6A49",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  payButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  disabled: {
    opacity: 0.6,
  },
  sectionLabel: {
    color: "#6F5E50",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    marginTop: 4,
  },
  muted: {
    color: "#8A7462",
    fontSize: 13,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1E6DA",
  },
  listMain: {
    flex: 1,
    minWidth: 0,
  },
  listTitle: {
    color: "#2F241B",
    fontSize: 14,
    fontWeight: "600",
  },
  listMeta: {
    color: "#8A7462",
    fontSize: 12,
    marginTop: 2,
    textTransform: "capitalize",
  },
  listAmount: {
    color: "#2F241B",
    fontSize: 14,
    fontWeight: "700",
  },
  paidText: {
    color: "#1C6A3B",
  },
  rejectedText: {
    color: "#A8927F",
    textDecorationLine: "line-through",
  },
  deleteButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  deleteText: {
    color: "#A53A52",
    fontWeight: "800",
  },
  deleteConfirm: {
    backgroundColor: "#FCE9ED",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  deleteConfirmText: {
    color: "#A53A52",
    fontWeight: "800",
    fontSize: 12,
  },
});
