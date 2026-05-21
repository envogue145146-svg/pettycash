import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import Papa from "papaparse";
import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as Sharing from "expo-sharing";
import { Alert, Platform } from "react-native";
import { initialExpenses, openingCashInHand } from "../data/mockData";
import { backendMode } from "../lib/backend";
import { getFriendlyErrorMessage } from "../lib/errorMessages";
import { googleSheetsFetchBootstrap } from "../lib/googleSheets";
import {
  getCsvValue,
  getSignedAmount,
  isRemoteImageUrl,
  normalizeImportedDate,
  normalizeImportedDriveUrl,
} from "../lib/pettyCashWebUtils";
import {
  clearSelectedBillImage,
  createAccountingHead as createStoredAccountingHead,
  createExpense,
  deleteExpense as deleteRemoteExpense,
  ensureDefaultLedger,
  ensureProfileForSession,
  fetchAccountingHeads,
  fetchExpenses,
  fetchLedger,
  getSavedDraftImageUri,
  pickBillImage,
  subscribeToRealtime,
  updateExpense as updateRemoteExpense,
  updateExpenseImage,
  updateLedgerSettings as updateRemoteLedgerSettings,
  updateExpenseStatus as updateRemoteExpenseStatus,
  uploadBillImage,
} from "../services/expenseService";
import { exportBulkVouchers, exportVoucher, VoucherExportMode } from "../services/voucherService";
import { AppSession, Expense, ExpenseDraft, ExpenseStatus, ImageSourceMode, Ledger, Profile, Summary, UserRole } from "../types";

type PettyCashContextValue = {
  expenses: Expense[];
  ledger: Ledger | null;
  accountingHeads: string[];
  role: UserRole;
  setRole: (role: UserRole) => Promise<void>;
  createAccountingHead: (label: string) => Promise<void>;
  updateLedgerSettings: (openingBalance: number, openingBalanceDate: string) => Promise<void>;
  summary: Summary;
  addExpense: (draft: ExpenseDraft) => Promise<boolean>;
  updateExpenseStatus: (expenseId: string, status: ExpenseStatus, checkerNote?: string) => Promise<void>;
  deleteExpense: (expenseId: string) => Promise<void>;
  editExpense: (expenseId: string, updates: Partial<ExpenseDraft>) => Promise<void>;
  exportExpensesCsv: () => Promise<void>;
  importExpensesCsv: () => Promise<void>;
  pickImage: (mode: ImageSourceMode) => Promise<void>;
  imageDraftUri: string;
  loading: boolean;
  profile: Profile | null;
  isRealtime: boolean;
  syncIssue: string | null;
  getExpenseFolioNumber: (expense: Expense) => string;
  exportExpenseVoucher: (expense: Expense) => Promise<void>;
  exportBulkExpenseVouchers: (selectedExpenses: Expense[], mode?: VoucherExportMode) => Promise<void>;
};

const PettyCashContext = createContext<PettyCashContextValue | undefined>(undefined);
const today = new Date().toISOString().slice(0, 10);

function getFinancialYearLabel(dateValue: string) {
  const parsedDate = new Date(dateValue);
  if (Number.isNaN(parsedDate.getTime())) {
    return "0000-00";
  }

  const year = parsedDate.getFullYear();
  const month = parsedDate.getMonth() + 1;
  const startYear = month >= 4 ? year : year - 1;
  const endYear = String((startYear + 1) % 100).padStart(2, "0");
  return `${startYear}-${endYear}`;
}

function buildExpenseFolioNumber(expense: Expense, allExpenses: Expense[]) {
  const targetFinancialYear = getFinancialYearLabel(expense.purchaseDate || expense.createdAt || today);
  const sameFinancialYearExpenses = [...allExpenses]
    .filter((entry) => getFinancialYearLabel(entry.purchaseDate || entry.createdAt || today) === targetFinancialYear)
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
    });

  const sequence = Math.max(
    1,
    sameFinancialYearExpenses.findIndex((entry) => entry.id === expense.id) + 1,
  );

  return `${String(sequence).padStart(2, "0")}/${targetFinancialYear}`;
}

export function PettyCashProvider({
  children,
  session,
  realtimeEnabled,
}: PropsWithChildren<{ session: AppSession | null; realtimeEnabled: boolean }>) {
  const [role, setRole] = useState<UserRole>("creator");
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(realtimeEnabled);
  const [imageDraftUri, setImageDraftUri] = useState("");
  const [accountingHeads, setAccountingHeads] = useState<string[]>(["Petty Cash"]);
  const [syncIssue, setSyncIssue] = useState<string | null>(null);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    getSavedDraftImageUri()
      .then((savedUri) => {
        if (savedUri) {
          setImageDraftUri(savedUri);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    fetchAccountingHeads()
      .then((savedHeads) => {
        if (savedHeads.length) {
          setAccountingHeads(savedHeads);
        }
      })
      .catch(() => undefined);
  }, []);

  const mergeAccountingHeads = (nextExpenses: Expense[], explicitHeads?: string[]) => {
    const expenseHeads = nextExpenses.map((expense) => expense.accountingHead ?? "");
    const merged = new Set<string>();
    [...accountingHeads, ...(explicitHeads ?? []), ...expenseHeads].forEach((head) => {
      const normalized = head.trim();
      if (normalized) {
        merged.add(normalized);
      }
    });
    setAccountingHeads(Array.from(merged));
  };

  const refreshRemoteData = async () => {
    if (!realtimeEnabled || !session) {
      return;
    }

    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }

    const refreshPromise = (async () => {
      const remoteProfilePromise = ensureProfileForSession(session, role);
      const existingHeadsPromise = fetchAccountingHeads();

      if (backendMode === "googleSheets") {
        const [remoteProfile, existingHeads, bootstrap] = await Promise.all([
          remoteProfilePromise,
          existingHeadsPromise,
          googleSheetsFetchBootstrap(),
        ]);

        const remoteLedger = bootstrap.ledger ?? (await ensureDefaultLedger());
        setExpenses(bootstrap.expenses);
        mergeAccountingHeads(bootstrap.expenses, existingHeads);
        setLedger(remoteLedger);
        if (remoteProfile) {
          setProfile(remoteProfile);
          setRole(remoteProfile.role);
        }
        setSyncIssue(null);
        return;
      }

      const [remoteProfile, existingHeads, existingLedger, remoteExpenses] = await Promise.all([
        remoteProfilePromise,
        existingHeadsPromise,
        fetchLedger(),
        fetchExpenses(),
      ]);

      const remoteLedger = existingLedger ?? (await ensureDefaultLedger());
      setExpenses(remoteExpenses);
      mergeAccountingHeads(remoteExpenses, existingHeads);
      setLedger(remoteLedger);
      if (remoteProfile) {
        setProfile(remoteProfile);
        setRole(remoteProfile.role);
      } else if (session?.user) {
        setProfile({
          id: session.user.id,
          email: session.user.email ?? "",
          fullName: session.user.user_metadata?.full_name?.trim() || session.user.email?.split("@")[0] || "Signed In User",
          role,
        });
      }
      setSyncIssue(null);
    })();

    refreshInFlightRef.current = refreshPromise;

    try {
      await refreshPromise;
    } finally {
      refreshInFlightRef.current = null;
    }
  };

  useEffect(() => {
    if (!realtimeEnabled || !session) {
      setLoading(false);
      return;
    }

    setLoading(true);

    refreshRemoteData()
      .catch((error: unknown) => {
        const message = getFriendlyErrorMessage(error, "Unable to load petty cash data.");
        setSyncIssue(message);
        Alert.alert("Sync error", message);
      })
      .finally(() => setLoading(false));
  }, [realtimeEnabled, session]);

  useEffect(() => {
    if (!realtimeEnabled || !session) {
      return;
    }

    return subscribeToRealtime(async () => {
      await refreshRemoteData();
    });
  }, [realtimeEnabled, session]);

  const addExpense = async (draft: ExpenseDraft): Promise<boolean> => {
    const accountingHead = draft.accountingHead.trim();
    const trimmedDescription = draft.description.trim();
    const amount = Number(String(draft.amount || "").replace(/[^0-9.-]+/g, ""));
    const trimmedBillImageUrl = draft.billImageUrl.trim();
    const transactionType = draft.transactionType === "credit" ? "credit" : "debit";

    if (!accountingHead || !trimmedDescription || Number.isNaN(amount) || amount <= 0) {
      Alert.alert("Invalid entry", "Please enter accounting head, description, and a valid amount.");
      return false;
    }

    if (realtimeEnabled && session) {
      try {
        const ensuredProfile = profile ?? (await ensureProfileForSession(session, "creator"));
        if (ensuredProfile.role !== "creator") {
          const { upsertProfile } = await import("../services/expenseService");
          await upsertProfile({ ...ensuredProfile, role: "creator" });
          setProfile({ ...ensuredProfile, role: "creator" });
          setRole("creator");
        } else {
          setProfile(ensuredProfile);
        }

        const ensuredLedger = ledger ?? (await ensureDefaultLedger());

        if (!ensuredLedger) {
          throw new Error("No petty cash ledger found.");
        }

        const expenseId = `sheet-expense-${Date.now()}`;
        const shouldDeferRemoteImageUpload =
          Boolean(imageDraftUri) && (backendMode === "googleSheets" || backendMode === "supabase");
        const uploadedPath = shouldDeferRemoteImageUpload
          ? trimmedBillImageUrl
          : trimmedBillImageUrl && isRemoteImageUrl(trimmedBillImageUrl)
            ? trimmedBillImageUrl
            : imageDraftUri
              ? await uploadBillImage(imageDraftUri, session.user.id)
              : trimmedBillImageUrl;

        const createdExpenseId =
          (await createExpense({
          id: expenseId,
          accountingHead,
          description: trimmedDescription,
          amount,
          purchaseDate: normalizeImportedDate(draft.purchaseDate),
          billImagePath: uploadedPath || undefined,
          transactionType,
          ledgerId: ensuredLedger.id,
          session,
        })) ?? expenseId;

        if (shouldDeferRemoteImageUpload) {
          const localImageUri = imageDraftUri;
          const currentUserId = session.user.id;
          setImageDraftUri("");
          await clearSelectedBillImage();
          setSyncIssue(null);

          setTimeout(() => {
            void (async () => {
              try {
                const remoteImageUrl = await uploadBillImage(localImageUri, currentUserId);
                await updateExpenseImage(createdExpenseId, remoteImageUrl);
                void refreshRemoteData();
              } catch (error) {
                const message = getFriendlyErrorMessage(error, "Entry saved, but the slip image could not be uploaded.");
                Alert.alert("Slip upload issue", message);
              }
            })();
          }, 0);
          void refreshRemoteData();
          return true;
        }

        await clearSelectedBillImage();
        setImageDraftUri("");
        if (!accountingHeads.some((head) => head.toLowerCase() === accountingHead.toLowerCase())) {
          const nextHeads = await createStoredAccountingHead(accountingHead);
          setAccountingHeads(nextHeads);
        }
        setSyncIssue(null);
        void refreshRemoteData();
        return true;
      } catch (error) {
        console.error("addExpense failed", error);
        const message = getFriendlyErrorMessage(error, "Unable to submit entry.");
        setSyncIssue(message);
        Alert.alert("Submission failed", message);
        return false;
      }
    }

    setExpenses((currentExpenses) => {
      const nextExpenses = [
        {
          id: `EXP-${1000 + currentExpenses.length + 1}`,
          accountingHead,
          description: trimmedDescription,
          amount,
          purchaseDate: normalizeImportedDate(draft.purchaseDate),
          billImageUrl:
            (trimmedBillImageUrl && isRemoteImageUrl(trimmedBillImageUrl) ? trimmedBillImageUrl : "") ||
            imageDraftUri ||
            trimmedBillImageUrl ||
            "https://images.unsplash.com/photo-1554224154-26032ffc0d07?auto=format&fit=crop&w=900&q=80",
          createdBy: "Current Creator",
          status: "pending" as const,
          transactionType,
          createdAt: new Date().toISOString(),
        } satisfies Expense,
        ...currentExpenses,
      ];
      mergeAccountingHeads(nextExpenses);
      return nextExpenses;
    });
    if (!accountingHeads.some((head) => head.toLowerCase() === accountingHead.toLowerCase())) {
      const nextHeads = await createStoredAccountingHead(accountingHead);
      setAccountingHeads(nextHeads);
    }
    void clearSelectedBillImage();
    setImageDraftUri("");
    return true;
  };

  const updateExpenseStatus = async (expenseId: string, status: ExpenseStatus, checkerNote?: string) => {
    if (realtimeEnabled && session && status !== "pending") {
      try {
        await updateRemoteExpenseStatus(expenseId, status, session, checkerNote);
        setSyncIssue(null);
        return;
      } catch (error) {
        const message = getFriendlyErrorMessage(error, "Unable to update entry status.");
        Alert.alert("Update failed", message);
        return;
      }
    }

    setExpenses((currentExpenses) =>
      currentExpenses.map((expense) =>
        expense.id === expenseId
          ? {
              ...expense,
              status,
              checkedBy: status === "pending" ? undefined : "Current Checker",
              checkerNote: checkerNote ?? expense.checkerNote,
            }
          : expense,
      ),
    );
  };

  const deleteExpense = async (expenseId: string) => {
    try {
      await deleteRemoteExpense(expenseId);
      if (!realtimeEnabled) {
        setExpenses((current) => {
          const nextExpenses = current.filter((expense) => expense.id !== expenseId);
          mergeAccountingHeads(nextExpenses);
          return nextExpenses;
        });
      } else {
        setSyncIssue(null);
      }
    } catch (error) {
      const message = getFriendlyErrorMessage(error, "Unable to delete entry.");
      setSyncIssue(message);
      Alert.alert("Delete failed", message);
    }
  };

  const editExpense = async (expenseId: string, updates: Partial<ExpenseDraft>) => {
    try {
      const nextUpdates = { ...updates };
      const nextBillImageUrl = updates.billImageUrl?.trim();

      if (
        realtimeEnabled &&
        session &&
        nextBillImageUrl &&
        !isRemoteImageUrl(nextBillImageUrl)
      ) {
        nextUpdates.billImageUrl = await uploadBillImage(nextBillImageUrl, session.user.id);
      }

      await updateRemoteExpense(expenseId, nextUpdates);
      if (!realtimeEnabled) {
        setExpenses((current) => {
          const nextExpenses = current.map((expense) =>
            expense.id === expenseId
              ? {
                  ...expense,
                  accountingHead: nextUpdates.accountingHead ?? expense.accountingHead,
                  description: nextUpdates.description ?? expense.description,
                  amount:
                    nextUpdates.amount !== undefined
                      ? Number(String(nextUpdates.amount).replace(/[^0-9.-]+/g, ""))
                      : expense.amount,
                  purchaseDate: nextUpdates.purchaseDate ?? expense.purchaseDate,
                  billImageUrl: nextUpdates.billImageUrl ?? expense.billImageUrl,
                  transactionType: nextUpdates.transactionType ?? expense.transactionType,
                }
              : expense,
          );
          mergeAccountingHeads(nextExpenses);
          return nextExpenses;
        });
      } else {
        setSyncIssue(null);
        await refreshRemoteData();
      }
    } catch (error) {
      const message = getFriendlyErrorMessage(error, "Unable to edit entry.");
      Alert.alert("Edit failed", message);
    }
  };

  const exportExpensesCsv = async () => {
    try {
      const reversedExpenses = [...expenses].sort(
        (left, right) => new Date(left.purchaseDate).getTime() - new Date(right.purchaseDate).getTime(),
      );

      let csvContent = "Date,Expense Head,Description,Debit Amount,Credit Amount,Running Balance,Slip Link\n";
      let currentBalance = ledger?.openingBalance ?? openingCashInHand;

      csvContent += `Initial Balance,Opening Balance,Opening Balance,,${currentBalance},${currentBalance},\n`;

      for (const expense of reversedExpenses) {
        const affectsBalance = expense.status === "approved" || expense.status === "pending";
        const debitAmount = expense.transactionType === "debit" ? expense.amount : 0;
        const creditAmount = expense.transactionType === "credit" ? expense.amount : 0;

        if (affectsBalance) {
          currentBalance += getSignedAmount(expense);
        }

        csvContent += `"${expense.purchaseDate}","${(expense.accountingHead || "Petty Cash").replace(/"/g, '""')}","${expense.description.replace(/"/g, '""')}",${debitAmount},${creditAmount},${currentBalance},"${(expense.billImageUrl || "").replace(/"/g, '""')}"\n`;
      }

      if (Platform.OS === "web") {
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `petty_cash_report_${Date.now()}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      const fileUri = `${FileSystem.documentDirectory}petty_cash_report_${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "text/csv",
          dialogTitle: "Export Petty Cash Report",
        });
      } else {
        Alert.alert("Export Saved", "CSV generated but sharing is not available on this device.");
      }
    } catch (error) {
      const message = getFriendlyErrorMessage(error, "Unable to export CSV.");
      Alert.alert("Export Failed", message);
    }
  };

  const importExpensesCsv = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "application/vnd.ms-excel", "text/comma-separated-values"],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const fileUri = result.assets[0].uri;
      let csvText = "";
      if (Platform.OS === "web") {
        csvText = await fetch(fileUri).then((response) => response.text());
      } else {
        csvText = await FileSystem.readAsStringAsync(fileUri);
      }

      Papa.parse(csvText.replace(/^\uFEFF/, ""), {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
        complete: async (results) => {
          let importedCount = 0;
          let creditRowCount = 0;

          for (const row of results.data as any[]) {
            const accountingHead = getCsvValue(row, [
              "Expense Head",
              "Expences Head",
              "Accounting Head",
              "Head",
              "head",
            ]);
            const description = getCsvValue(row, [
              "Expence description",
              "Expense description",
              "Description",
              "description",
              "Expense Head",
            ]);
            const debitAmount = Number(getCsvValue(row, ["Debit Amount", "Amount", "amount"]).replace(/[^0-9.-]+/g, ""));
            const creditAmount = Number(getCsvValue(row, ["Credit Amount", "credit amount", "Credit", "credit"]).replace(/[^0-9.-]+/g, ""));
            const purchaseDate = normalizeImportedDate(getCsvValue(row, ["Date", "date", "Purchase Date"]));
            const billImageUrl = normalizeImportedDriveUrl(
              getCsvValue(row, [
                "Image URL",
                "Slip Link",
                "Google Drive Link",
                "Receipt/Invoice/Cash Memo",
                "Receipt/Invoice/Cash Memo-2",
                "Receipt/Invoice/Cas",
                "billImageUrl",
              ]),
            );

            const transactionType = !Number.isNaN(creditAmount) && creditAmount > 0 && (Number.isNaN(debitAmount) || debitAmount <= 0)
              ? "credit"
              : "debit";
            const amount = transactionType === "credit" ? creditAmount : debitAmount;

            if (transactionType === "credit") {
              creditRowCount += 1;
            }

            if (description && !Number.isNaN(amount) && amount > 0) {
              const selectedHead = accountingHead || "Petty Cash";
              const success = await addExpense({
                accountingHead: selectedHead,
                description,
                amount: String(amount),
                purchaseDate,
                billImageUrl,
                transactionType,
              });
              if (success) {
                importedCount += 1;
              }
            }
          }

          if (importedCount > 0) {
            const creditNote = creditRowCount > 0 ? ` Included ${creditRowCount} cash receipt row(s).` : "";
            Alert.alert("Import Successful", `Successfully imported ${importedCount} entries.${creditNote}`);
          } else {
            Alert.alert(
              "Import Failed",
              "No valid rows were found in the CSV. The file should include a description plus either a debit or credit amount.",
            );
          }
        },
        error: (error: any) => {
          Alert.alert("Parse Error", error.message);
        },
      });
    } catch (error) {
      console.error("importExpensesCsv failed", error);
      const message = getFriendlyErrorMessage(error, "Unable to import CSV.");
      Alert.alert("Import Failed", message);
    }
  };

  const changeRole = async (nextRole: UserRole) => {
    setRole(nextRole);
    if (realtimeEnabled && session) {
      try {
        const ensuredProfile = profile ?? (await ensureProfileForSession(session, nextRole));
        const nextProfile = { ...ensuredProfile, role: nextRole };
        setProfile(nextProfile);
        const { upsertProfile } = await import("../services/expenseService");
        await upsertProfile(nextProfile);
        setSyncIssue(null);
      } catch (error) {
        const message = getFriendlyErrorMessage(error, "Unable to update profile role.");
        Alert.alert("Role update failed", message);
      }
    }
  };

  const createAccountingHead = async (label: string) => {
    try {
      const nextHeads = await createStoredAccountingHead(label);
      setAccountingHeads(nextHeads);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create accounting head.";
      Alert.alert("Accounting Head", message);
    }
  };

  const updateLedgerSettings = async (openingBalance: number, openingBalanceDate: string) => {
    try {
      const targetLedger = ledger ?? (await ensureDefaultLedger());
      if (!targetLedger) {
        throw new Error("No petty cash ledger found.");
      }
      const nextLedger = await updateRemoteLedgerSettings({
        ledgerId: targetLedger.id,
        openingBalance,
        openingBalanceDate,
      });

      setLedger(nextLedger);
      setSyncIssue(null);

      if (realtimeEnabled) {
        await refreshRemoteData();
      }
    } catch (error) {
      const message = getFriendlyErrorMessage(error, "Unable to update opening balance settings.");
      setSyncIssue(message);
      Alert.alert("Settings update failed", message);
    }
  };

  const pickImage = async (mode: ImageSourceMode) => {
    try {
      const asset = await pickBillImage(mode);
      if (asset?.uri) {
        setImageDraftUri(asset.uri);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to select image.";
      Alert.alert("Image selection failed", message);
    }
  };

  const exportExpenseVoucher = async (expense: Expense) => {
    try {
      const folioNumber = buildExpenseFolioNumber(expense, expenses);
      await exportVoucher(expense, folioNumber);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to export voucher.";
      Alert.alert("Voucher export failed", message);
    }
  };

  const getExpenseFolioNumber = (expense: Expense) => buildExpenseFolioNumber(expense, expenses);

  const exportBulkExpenseVouchers = async (selectedExpenses: Expense[], mode: VoucherExportMode = "share") => {
    try {
      if (!selectedExpenses.length) {
        Alert.alert("No vouchers", "No expenses matched the selected export range.");
        return;
      }

      const orderedExpenses = [...selectedExpenses].sort((left, right) => {
        const leftFolio = buildExpenseFolioNumber(left, expenses);
        const rightFolio = buildExpenseFolioNumber(right, expenses);
        return leftFolio.localeCompare(rightFolio);
      });

      await exportBulkVouchers(
        orderedExpenses.map((expense) => ({
          expense,
          folioNumber: buildExpenseFolioNumber(expense, expenses),
        })),
        mode,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to export bulk vouchers.";
      Alert.alert("Bulk voucher export failed", message);
    }
  };

  const summary = useMemo<Summary>(() => {
    const approvedAmount = expenses
      .filter((expense) => expense.status === "approved")
      .reduce((total, expense) => total + expense.amount, 0);

    const pendingAmount = expenses
      .filter((expense) => expense.status === "pending")
      .reduce((total, expense) => total + expense.amount, 0);

    const rejectedAmount = expenses
      .filter((expense) => expense.status === "rejected")
      .reduce((total, expense) => total + expense.amount, 0);

    const approvedNet = expenses
      .filter((expense) => expense.status === "approved")
      .reduce((total, expense) => total + getSignedAmount(expense), 0);

    return {
      cashInHand: (ledger?.openingBalance ?? openingCashInHand) + approvedNet,
      pendingAmount,
      approvedAmount,
      rejectedAmount,
    };
  }, [expenses, ledger]);

  return (
    <PettyCashContext.Provider
      value={{
        expenses,
        ledger,
        accountingHeads,
        role,
        setRole: changeRole,
        createAccountingHead,
        updateLedgerSettings,
        summary,
        addExpense,
        updateExpenseStatus,
        deleteExpense,
        editExpense,
        exportExpensesCsv,
        importExpensesCsv,
        pickImage,
        imageDraftUri,
        loading,
        profile,
        isRealtime: realtimeEnabled,
        syncIssue,
        getExpenseFolioNumber,
        exportExpenseVoucher,
        exportBulkExpenseVouchers,
      }}
    >
      {children}
    </PettyCashContext.Provider>
  );
}

export function usePettyCash() {
  const context = useContext(PettyCashContext);

  if (!context) {
    throw new Error("usePettyCash must be used within a PettyCashProvider");
  }

  return context;
}
