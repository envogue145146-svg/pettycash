import React, { useEffect, useState } from "react";
import { Image, Platform, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { DateField } from "./DateField";
import { ExpenseDraft } from "../types";

type ExpenseFormProps = {
  accountingHeads: string[];
  onCreateAccountingHead: (label: string) => Promise<void>;
  onSubmit: (draft: ExpenseDraft) => Promise<boolean>;
  onPickImage: (mode: "camera" | "gallery") => Promise<void>;
  selectedImageUri: string;
};

function createInitialDraft(defaultHead: string): ExpenseDraft {
  return {
    accountingHead: defaultHead,
    description: "",
    amount: "",
    purchaseDate: new Date().toISOString().slice(0, 10),
    billImageUrl: "",
    transactionType: "debit",
  };
}

export function ExpenseForm({
  accountingHeads,
  onCreateAccountingHead,
  onSubmit,
  onPickImage,
  selectedImageUri,
}: ExpenseFormProps) {
  const [draft, setDraft] = useState<ExpenseDraft>(createInitialDraft(accountingHeads[0] ?? "Petty Cash"));
  const [newAccountingHead, setNewAccountingHead] = useState("");
  const [headSelectorOpen, setHeadSelectorOpen] = useState(false);

  useEffect(() => {
    if (!draft.accountingHead && accountingHeads.length) {
      setDraft((current) => ({ ...current, accountingHead: accountingHeads[0] }));
    }
  }, [accountingHeads, draft.accountingHead]);

  const handleSubmit = async () => {
    const success = await onSubmit(draft);
    if (success !== false) {
      setDraft(createInitialDraft(draft.accountingHead || accountingHeads[0] || "Petty Cash"));
    }
  };

  const handleCreateAccountingHead = async () => {
    const nextHead = newAccountingHead.trim();
    if (!nextHead) {
      return;
    }

    await onCreateAccountingHead(nextHead);
    setDraft((current) => ({ ...current, accountingHead: nextHead }));
    setNewAccountingHead("");
    setHeadSelectorOpen(false);
  };

  const webProps = (handler: () => void | Promise<void>) =>
    Platform.OS === "web"
      ? ({
          onClick: handler,
        } as const)
      : {};

  return (
    <View style={styles.card}>
      <Text style={styles.helper}>Create daily cash expense</Text>
      <Text style={styles.label}>Accounting Head</Text>
      <Pressable onPress={() => setHeadSelectorOpen((current) => !current)} style={styles.dropdownButton}>
        <Text style={styles.dropdownButtonText}>{draft.accountingHead || "Select accounting head"}</Text>
        <Text style={styles.dropdownButtonIcon}>{headSelectorOpen ? "^" : "v"}</Text>
      </Pressable>
      {headSelectorOpen ? (
        <View style={styles.dropdownPanel}>
          <View style={styles.headsWrap}>
            {accountingHeads.map((head) => (
              <Pressable
                key={head}
                onPress={() => {
                  setDraft((current) => ({ ...current, accountingHead: head }));
                  setHeadSelectorOpen(false);
                }}
                style={[styles.headChip, draft.accountingHead === head && styles.headChipActive]}
              >
                <Text style={[styles.headChipText, draft.accountingHead === head && styles.headChipTextActive]}>
                  {head}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.row}>
            <TextInput
              placeholder="Create new accounting head"
              placeholderTextColor="#A38C77"
              style={[styles.input, styles.halfInput]}
              value={newAccountingHead}
              onChangeText={setNewAccountingHead}
            />
            <TouchableOpacity onPress={handleCreateAccountingHead} style={styles.addHeadButton} {...webProps(handleCreateAccountingHead)}>
              <Text style={styles.addHeadButtonText}>Add Head</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
      <TextInput
        placeholder="Description"
        placeholderTextColor="#A38C77"
        style={styles.input}
        value={draft.description}
        onChangeText={(value) => setDraft((current) => ({ ...current, description: value }))}
      />
      <View style={styles.row}>
        <Pressable
          onPress={() => setDraft((current) => ({ ...current, transactionType: "debit" }))}
          style={[styles.typeButton, draft.transactionType === "debit" && styles.typeButtonActive]}
        >
          <Text style={[styles.typeButtonText, draft.transactionType === "debit" && styles.typeButtonTextActive]}>
            Expense
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setDraft((current) => ({ ...current, transactionType: "credit" }))}
          style={[styles.typeButton, draft.transactionType === "credit" && styles.typeButtonActive]}
        >
          <Text style={[styles.typeButtonText, draft.transactionType === "credit" && styles.typeButtonTextActive]}>
            Cash Receipt
          </Text>
        </Pressable>
      </View>
      <View style={styles.row}>
        <TextInput
          placeholder="Amount"
          placeholderTextColor="#A38C77"
          keyboardType="numeric"
          style={[styles.input, styles.halfInput]}
          value={draft.amount}
          onChangeText={(value) => setDraft((current) => ({ ...current, amount: value }))}
        />
        <DateField
          value={draft.purchaseDate}
          onChange={(value) => setDraft((current) => ({ ...current, purchaseDate: value }))}
          placeholder="Purchase Date"
          style={styles.halfInput}
        />
      </View>
      <TextInput
        placeholder="Bill image URL"
        placeholderTextColor="#A38C77"
        style={styles.input}
        value={draft.billImageUrl}
        onChangeText={(value) => setDraft((current) => ({ ...current, billImageUrl: value }))}
      />
      <View style={styles.imageButtonRow}>
        <TouchableOpacity onPress={() => void onPickImage("camera")} style={styles.secondaryButton} {...webProps(() => void onPickImage("camera"))}>
          <Text style={styles.secondaryButtonText}>Use Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => void onPickImage("gallery")} style={styles.secondaryButton} {...webProps(() => void onPickImage("gallery"))}>
          <Text style={styles.secondaryButtonText}>
            {selectedImageUri ? "Change Gallery Photo" : "Choose Gallery Photo"}
          </Text>
        </TouchableOpacity>
      </View>
      {selectedImageUri ? <Image source={{ uri: selectedImageUri }} style={styles.preview} /> : null}
      <TouchableOpacity onPress={handleSubmit} style={styles.button} {...webProps(handleSubmit)}>
        <Text style={styles.buttonText}>
          {draft.transactionType === "credit" ? "Submit Cash Receipt" : "Submit For Approval"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFF8EE",
    borderRadius: 28,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: "#E7D7C7",
    shadowColor: "#A06B3B",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  helper: {
    color: "#7A5200",
    fontSize: 16,
    fontWeight: "700",
  },
  label: {
    color: "#9C5C24",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  dropdownButton: {
    borderWidth: 1,
    borderColor: "#E0CCB8",
    borderRadius: 16,
    backgroundColor: "#FFFDF9",
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dropdownButtonText: {
    color: "#2F241B",
    fontWeight: "700",
    flex: 1,
  },
  dropdownButtonIcon: {
    color: "#8A745E",
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 10,
  },
  dropdownPanel: {
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E6D4C4",
    backgroundColor: "#FDF6EE",
    padding: 12,
  },
  headsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  headChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#DDC5AF",
    backgroundColor: "#FFFDF9",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headChipActive: {
    borderColor: "#D4B04E",
    backgroundColor: "#F7EDC0",
  },
  headChipText: {
    color: "#7A6858",
    fontWeight: "700",
    fontSize: 12,
  },
  headChipTextActive: {
    color: "#7A5200",
  },
  input: {
    backgroundColor: "#FFFDF9",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#2F241B",
    flex: 1,
    borderWidth: 1,
    borderColor: "#E6D4C4",
  },
  halfInput: {
    flex: 1,
  },
  typeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#DFC8B5",
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#FFFDF9",
  },
  typeButtonActive: {
    backgroundColor: "#F7EDC0",
    borderColor: "#D4B04E",
  },
  typeButtonText: {
    color: "#7A6858",
    fontWeight: "700",
  },
  typeButtonTextActive: {
    color: "#7A5200",
  },
  button: {
    backgroundColor: "#2E6A49",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFDF9",
    fontWeight: "800",
    fontSize: 15,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#D7C2AE",
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
    flex: 1,
    backgroundColor: "#FFFDF9",
  },
  secondaryButtonText: {
    color: "#8A5A30",
    fontWeight: "700",
  },
  preview: {
    width: "100%",
    height: 160,
    borderRadius: 18,
  },
  imageButtonRow: {
    flexDirection: "row",
    gap: 10,
  },
  addHeadButton: {
    minWidth: 110,
    borderRadius: 16,
    backgroundColor: "#A66A2E",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  addHeadButtonText: {
    color: "#FFFDF9",
    fontWeight: "800",
  },
});
