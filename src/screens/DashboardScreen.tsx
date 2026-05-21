import React, { useMemo, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ExpenseCard } from "../components/ExpenseCard";
import { ExpenseForm } from "../components/ExpenseForm";
import { LogoWatermark } from "../components/LogoWatermark";
import { ReportFilters } from "../components/ReportFilters";
import { SectionTitle } from "../components/SectionTitle";
import { SettingsPanel } from "../components/SettingsPanel";
import { SummaryCard } from "../components/SummaryCard";
import { usePettyCash } from "../context/PettyCashContext";
import { useSession } from "../context/SessionContext";
import { signOut } from "../services/expenseService";

export function DashboardScreen() {
  const { session } = useSession();
  const {
    addExpense,
    accountingHeads,
    createAccountingHead,
    expenses,
    imageDraftUri,
    syncIssue,
    loading,
    profile,
    role,
    summary,
    updateExpenseStatus,
    deleteExpense,
    editExpense,
    exportExpensesCsv,
    importExpensesCsv,
    pickImage,
    getExpenseFolioNumber,
    exportExpenseVoucher,
    exportBulkExpenseVouchers,
  } = usePettyCash();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [folioFrom, setFolioFrom] = useState("");
  const [folioTo, setFolioTo] = useState("");

  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      if (fromDate && expense.purchaseDate < fromDate) {
        return false;
      }
      if (toDate && expense.purchaseDate > toDate) {
        return false;
      }
      return true;
    });
  }, [expenses, fromDate, toDate]);

  const filteredTotal = useMemo(
    () =>
      filteredExpenses.reduce(
        (total, expense) => total + (expense.transactionType === "credit" ? expense.amount : -expense.amount),
        0,
      ),
    [filteredExpenses],
  );

  const folioNumberByExpenseId = useMemo(() => {
    const byFinancialYear = new Map<string, typeof expenses>();

    for (const expense of expenses) {
      const sourceDate = expense.purchaseDate || expense.createdAt || "";
      const parsedDate = new Date(sourceDate || new Date().toISOString());
      const year = parsedDate.getFullYear();
      const month = parsedDate.getMonth() + 1;
      const startYear = month >= 4 ? year : year - 1;
      const financialYear = `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
      const current = byFinancialYear.get(financialYear) ?? [];
      current.push(expense);
      byFinancialYear.set(financialYear, current);
    }

    const nextMap = new Map<string, string>();
    for (const [financialYear, yearExpenses] of byFinancialYear.entries()) {
      yearExpenses
        .sort((left, right) => {
          const leftPrimary = left.purchaseDate || left.createdAt || "";
          const rightPrimary = right.purchaseDate || right.createdAt || "";
          const primaryCompare = leftPrimary.localeCompare(rightPrimary);
          if (primaryCompare !== 0) {
            return primaryCompare;
          }

          const createdCompare = (left.createdAt || "").localeCompare(right.createdAt || "");
          if (createdCompare !== 0) {
            return createdCompare;
          }

          return left.id.localeCompare(right.id);
        })
        .forEach((expense, index) => {
          nextMap.set(expense.id, `${String(index + 1).padStart(2, "0")}/${financialYear}`);
        });
    }

    return nextMap;
  }, [expenses]);

  const voucherExportExpenses = useMemo(() => {
    return filteredExpenses.filter((expense) => {
      const folio = folioNumberByExpenseId.get(expense.id) ?? getExpenseFolioNumber(expense);
      if (folioFrom && folio.localeCompare(folioFrom) < 0) {
        return false;
      }
      if (folioTo && folio.localeCompare(folioTo) > 0) {
        return false;
      }
      return true;
    });
  }, [filteredExpenses, folioFrom, folioNumberByExpenseId, folioTo, getExpenseFolioNumber]);

  const signedInLabel = useMemo(() => {
    if (profile) {
      return `${profile.fullName} / ${profile.role.toUpperCase()}`;
    }

    if (session?.user) {
      const displayName =
        session.user.user_metadata?.full_name?.trim() || session.user.email?.split("@")[0] || "Signed In User";
      const displayRole = session.user.user_metadata?.role?.toUpperCase() || role.toUpperCase();
      return `${displayName} / ${displayRole}`;
    }

    return "Demo mode";
  }, [profile, role, session]);

  const webProps = (handler: () => void | Promise<void>) =>
    Platform.OS === "web"
      ? ({
          onClick: handler,
        } as const)
      : {};

  const handleBulkVoucherExport = (mode: "share" | "print") => {
    void exportBulkExpenseVouchers(voucherExportExpenses, mode);
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color="#2E6A49" size="large" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <LogoWatermark style={styles.watermark} />
        <SectionTitle eyebrow="Petty Cash Control" title="Daily purchase approvals in real time" />
        <Text style={styles.subtitle}>
          Creators submit expenses with bill images, while checkers approve or reject them from iPhone
          or Android with the same live dashboard.
        </Text>
        <View style={styles.heroFooter}>
          <Text style={styles.badge}>{signedInLabel}</Text>
          {session ? (
            <TouchableOpacity onPress={() => void signOut()} style={styles.signOutButton} {...webProps(() => void signOut())}>
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={styles.summaryGrid}>
        <SummaryCard label="Cash In Hand" amount={summary.cashInHand} accent="#2E6A49" backgroundColor="#EAF6EE" amountColor="#215733" />
        <SummaryCard label="Pending Approval" amount={summary.pendingAmount} accent="#D4A43D" backgroundColor="#FFF5D8" amountColor="#8A6300" />
        <SummaryCard label="Approved" amount={summary.approvedAmount} accent="#4AAE73" backgroundColor="#E9F8EF" amountColor="#1C6A3B" />
        <SummaryCard label="Rejected" amount={summary.rejectedAmount} accent="#D46A7D" backgroundColor="#FCE9ED" amountColor="#A53A52" />
      </View>

      {syncIssue ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerTitle}>Backend issue</Text>
          <Text style={styles.errorBannerText}>{syncIssue}</Text>
        </View>
      ) : null}

      {role === "creator" ? (
        <View style={styles.creatorSection}>
          <ExpenseForm
            accountingHeads={accountingHeads}
            onCreateAccountingHead={createAccountingHead}
            onSubmit={addExpense}
            onPickImage={pickImage}
            selectedImageUri={imageDraftUri}
          />
          <View style={styles.dataActions}>
            <TouchableOpacity onPress={importExpensesCsv} style={styles.dataButton} {...webProps(importExpensesCsv)}>
              <Text style={styles.dataButtonText}>Import CSV</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={exportExpensesCsv} style={styles.dataButton} {...webProps(exportExpensesCsv)}>
              <Text style={styles.dataButtonText}>Export CSV</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.dataActions}>
          <TouchableOpacity onPress={exportExpensesCsv} style={[styles.dataButton, styles.singleDataButton]} {...webProps(exportExpensesCsv)}>
            <Text style={styles.dataButtonText}>Export CSV</Text>
          </TouchableOpacity>
        </View>
      )}

      <ReportFilters
        fromDate={fromDate}
        toDate={toDate}
        onChangeFromDate={setFromDate}
        onChangeToDate={setToDate}
        totalAmount={filteredTotal}
        itemCount={filteredExpenses.length}
      />

      <SettingsPanel
        folioFrom={folioFrom}
        folioTo={folioTo}
        onChangeFolioFrom={setFolioFrom}
        onChangeFolioTo={setFolioTo}
        exportCount={voucherExportExpenses.length}
        onExportBulk={() => handleBulkVoucherExport("share")}
        onPrintBulk={() => handleBulkVoucherExport("print")}
      />

      <View style={styles.listHeader}>
        <SectionTitle eyebrow="Expense Queue" title={role === "checker" ? "Review and approve" : "Track submitted expenses"} />
      </View>

      {filteredExpenses.map((expense) => (
        <ExpenseCard
          key={expense.id}
          expense={expense}
          role={role}
          onApprove={(checkerNote) => void updateExpenseStatus(expense.id, "approved", checkerNote)}
          onReject={(checkerNote) => void updateExpenseStatus(expense.id, "rejected", checkerNote)}
          onExportVoucher={() => void exportExpenseVoucher(expense)}
          onDelete={() => void deleteExpense(expense.id)}
          onEdit={(updates) => void editExpense(expense.id, updates)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 18,
    backgroundColor: "#F7F1E8",
  },
  hero: {
    backgroundColor: "#FDF6EE",
    borderRadius: 28,
    padding: 22,
    gap: 12,
    borderWidth: 1,
    borderColor: "#E7D7C7",
    overflow: "hidden",
  },
  subtitle: {
    color: "#6F5E50",
    fontSize: 14,
    lineHeight: 21,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  listHeader: {
    marginTop: 6,
  },
  errorBanner: {
    backgroundColor: "#FCE8EB",
    borderRadius: 18,
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: "#E3A6B1",
  },
  errorBannerTitle: {
    color: "#A53A52",
    fontWeight: "800",
    fontSize: 14,
  },
  errorBannerText: {
    color: "#8A4E5E",
    lineHeight: 20,
  },
  heroFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  badge: {
    color: "#8A5A30",
    fontWeight: "700",
    backgroundColor: "#FFF7F0",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    overflow: "hidden",
  },
  creatorSection: {
    gap: 16,
  },
  dataActions: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 8,
  },
  dataButton: {
    backgroundColor: "#A66A2E",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: "center",
    flex: 1,
  },
  singleDataButton: {
    alignSelf: "flex-start",
  },
  dataButtonText: {
    color: "#FFFDF9",
    fontWeight: "700",
    fontSize: 14,
  },
  signOutButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#F7E7D8",
  },
  signOutText: {
    color: "#8A5A30",
    fontWeight: "700",
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F7F1E8",
  },
  watermark: {
    position: "absolute",
    right: -4,
    top: 2,
  },
});
