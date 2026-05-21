import React, { useState } from "react";
import { Image, Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { getGoogleDriveOpenUrl } from "../lib/pettyCashWebUtils";
import { pickBillImage } from "../services/expenseService";
import { Expense, ExpenseDraft, ImageSourceMode, UserRole } from "../types";
import { StatusPill } from "./StatusPill";

type ExpenseCardProps = {
  expense: Expense;
  role: UserRole;
  onApprove: (checkerNote?: string) => void;
  onReject: (checkerNote?: string) => void;
  onExportVoucher: () => void;
  onDelete?: () => void;
  onEdit?: (updates: Partial<ExpenseDraft>) => void;
};

export function ExpenseCard({ expense, role, onApprove, onReject, onExportVoucher, onDelete, onEdit }: ExpenseCardProps) {
  const [checkerNote, setCheckerNote] = useState(expense.checkerNote ?? "");
  const [imageVisible, setImageVisible] = useState(Boolean(expense.billImageUrl));
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<ExpenseDraft>({
    accountingHead: expense.accountingHead ?? "",
    description: expense.description,
    amount: String(expense.amount),
    purchaseDate: expense.purchaseDate,
    billImageUrl: expense.billImageUrl,
    transactionType: expense.transactionType,
  });
  const [editImageUri, setEditImageUri] = useState(expense.billImageUrl);

  const handleSaveEdit = () => {
    if (onEdit) {
      onEdit({
        ...editDraft,
        billImageUrl: editImageUri,
      });
    }
    setIsEditing(false);
  };

  const handlePickEditImage = async (mode: ImageSourceMode) => {
    const asset = await pickBillImage(mode);
    if (!asset?.uri) {
      return;
    }

    setEditImageUri(asset.uri);
    setEditDraft((current) => ({ ...current, billImageUrl: asset.uri }));
  };

  const openSlipLink = async () => {
    if (!expense.billImageUrl) {
      return;
    }

    await Linking.openURL(getGoogleDriveOpenUrl(expense.billImageUrl));
  };

  return (
    <View style={styles.card}>
      {expense.billImageUrl && imageVisible ? (
        <Image source={{ uri: expense.billImageUrl }} style={styles.image} resizeMode="cover" onError={() => setImageVisible(false)} />
      ) : null}
      <View style={styles.content}>
        {isEditing ? (
          <View style={styles.editForm}>
            <TextInput
              style={styles.editInput}
              value={editDraft.accountingHead}
              onChangeText={(val) => setEditDraft((prev) => ({ ...prev, accountingHead: val }))}
              placeholder="Accounting head"
              placeholderTextColor="#A38C77"
            />
            <TextInput
              style={styles.editInput}
              value={editDraft.description}
              onChangeText={(val) => setEditDraft((prev) => ({ ...prev, description: val }))}
              placeholder="Description"
              placeholderTextColor="#A38C77"
            />
            <View style={styles.row}>
              <TextInput
                style={[styles.editInput, { flex: 1 }]}
                value={editDraft.amount}
                onChangeText={(val) => setEditDraft((prev) => ({ ...prev, amount: val }))}
                placeholder="Amount"
                placeholderTextColor="#A38C77"
                keyboardType="numeric"
              />
              <TextInput
                style={[styles.editInput, { flex: 1 }]}
                value={editDraft.purchaseDate}
                onChangeText={(val) => setEditDraft((prev) => ({ ...prev, purchaseDate: val }))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#A38C77"
              />
            </View>
            <TextInput
              style={styles.editInput}
              value={editImageUri}
              onChangeText={(val) => {
                setEditImageUri(val);
                setEditDraft((prev) => ({ ...prev, billImageUrl: val }));
              }}
              placeholder="Bill image URL"
              placeholderTextColor="#A38C77"
            />
            <View style={styles.actions}>
              <Pressable onPress={() => void handlePickEditImage("camera")} style={[styles.actionButton, styles.secondaryButton]}>
                <Text style={styles.secondaryText}>Camera</Text>
              </Pressable>
              <Pressable onPress={() => void handlePickEditImage("gallery")} style={[styles.actionButton, styles.secondaryButton]}>
                <Text style={styles.secondaryText}>Gallery</Text>
              </Pressable>
            </View>
            {editImageUri ? <Image source={{ uri: editImageUri }} style={styles.editPreview} resizeMode="cover" /> : null}
            <View style={styles.actions}>
              <Pressable onPress={() => setIsEditing(false)} style={[styles.actionButton, styles.secondaryButton]}>
                <Text style={styles.secondaryText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleSaveEdit} style={[styles.actionButton, styles.approveButton]}>
                <Text style={styles.approveText}>Save</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.header}>
              <View style={styles.headerText}>
                {expense.accountingHead ? <Text style={styles.headTag}>{expense.accountingHead}</Text> : null}
                <Text style={styles.description}>{expense.description}</Text>
                <Text style={styles.meta}>
                  {expense.purchaseDate} | {expense.createdBy} | {expense.transactionType === "credit" ? "Cash receipt" : "Expense"}
                </Text>
              </View>
              <StatusPill status={expense.status} />
            </View>

            <View style={styles.footer}>
              <Text style={[styles.amount, expense.transactionType === "credit" && styles.creditAmount]}>
                {expense.transactionType === "credit" ? "+ " : "- "}Rs. {expense.amount.toLocaleString("en-IN")}
              </Text>
              <Text style={styles.meta}>
                {expense.checkedBy ? `Checked by ${expense.checkedBy}` : "Awaiting checker"}
              </Text>
            </View>
          </>
        )}

        {expense.checkerNote ? <Text style={styles.comment}>Comment: {expense.checkerNote}</Text> : null}

        <View style={styles.utilityActions}>
          {expense.billImageUrl ? (
            <Pressable onPress={() => void openSlipLink()} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>Open Slip</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={onExportVoucher} style={styles.exportButton}>
            <Text style={styles.exportText}>Export A4 Voucher</Text>
          </Pressable>
        </View>

        {role === "creator" && expense.status === "pending" && !isEditing ? (
          <View style={styles.creatorActions}>
            <Pressable onPress={() => setIsEditing(true)} style={styles.editButton}>
              <Text style={styles.editText}>Edit</Text>
            </Pressable>
            <Pressable onPress={onDelete} style={styles.deleteButton}>
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
          </View>
        ) : null}

        {role === "checker" && expense.status === "pending" ? (
          <View style={styles.checkerPanel}>
            <TextInput
              placeholder="Add approval or rejection comment"
              placeholderTextColor="#A38C77"
              style={styles.noteInput}
              value={checkerNote}
              onChangeText={setCheckerNote}
            />
            <View style={styles.actions}>
              <Pressable onPress={() => onReject(checkerNote)} style={[styles.actionButton, styles.rejectButton]}>
                <Text style={styles.rejectText}>Reject</Text>
              </Pressable>
              <Pressable onPress={() => onApprove(checkerNote)} style={[styles.actionButton, styles.approveButton]}>
                <Text style={styles.approveText}>Approve</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFDF9",
    borderRadius: 26,
    overflow: "hidden",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E6D4C4",
    shadowColor: "#A06B3B",
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  editPreview: {
    width: "100%",
    height: 140,
    borderRadius: 14,
    backgroundColor: "#F5E7D9",
  },
  image: {
    width: "100%",
    height: 160,
    backgroundColor: "#F5E7D9",
  },
  content: {
    padding: 16,
    gap: 14,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  headerText: {
    flex: 1,
    gap: 6,
  },
  description: {
    color: "#2F241B",
    fontWeight: "800",
    fontSize: 17,
  },
  headTag: {
    color: "#9C5C24",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  meta: {
    color: "#8A745E",
    fontSize: 12,
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  amount: {
    color: "#2E6A49",
    fontSize: 22,
    fontWeight: "800",
  },
  creditAmount: {
    color: "#A66A2E",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  checkerPanel: {
    gap: 10,
  },
  editForm: {
    gap: 10,
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  editInput: {
    backgroundColor: "#FFF7F0",
    color: "#2F241B",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#E6D4C4",
  },
  actionButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  rejectButton: {
    backgroundColor: "#F7DCE2",
  },
  approveButton: {
    backgroundColor: "#D9F3DF",
  },
  rejectText: {
    color: "#A53A52",
    fontWeight: "800",
  },
  approveText: {
    color: "#1C6A3B",
    fontWeight: "800",
  },
  noteInput: {
    backgroundColor: "#FFF7F0",
    color: "#2F241B",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#E6D4C4",
  },
  comment: {
    color: "#6F5E50",
    lineHeight: 20,
  },
  utilityActions: {
    flexDirection: "row",
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#D9C7B7",
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: "center",
    backgroundColor: "#FFF7F0",
  },
  secondaryText: {
    color: "#8A5A30",
    fontWeight: "700",
  },
  exportButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#CFE1D4",
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: "center",
    backgroundColor: "#F4FBF6",
  },
  exportText: {
    color: "#2E6A49",
    fontWeight: "700",
  },
  creatorActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  editButton: {
    flex: 1,
    backgroundColor: "#F7EDC0",
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: "center",
  },
  editText: {
    color: "#7A5200",
    fontWeight: "700",
  },
  deleteButton: {
    flex: 1,
    backgroundColor: "#FBE5E7",
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: "center",
  },
  deleteText: {
    color: "#B04B5F",
    fontWeight: "700",
  },
});
