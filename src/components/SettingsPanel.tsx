import React from "react";
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

type SettingsPanelProps = {
  folioFrom: string;
  folioTo: string;
  onChangeFolioFrom: (value: string) => void;
  onChangeFolioTo: (value: string) => void;
  exportCount: number;
  onExportBulk: () => void;
  onPrintBulk: () => void;
};

export function SettingsPanel({
  folioFrom,
  folioTo,
  onChangeFolioFrom,
  onChangeFolioTo,
  exportCount,
  onExportBulk,
  onPrintBulk,
}: SettingsPanelProps) {
  const webProps = (handler: () => void | Promise<void>) =>
    Platform.OS === "web"
      ? ({
          onClick: handler,
        } as const)
      : {};

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Bulk vouchers</Text>
      <Text style={styles.helper}>
        Export or print A4 vouchers by the selected date filter and optional folio range.
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bulk voucher export</Text>
        <View style={styles.row}>
          <TextInput
            placeholder="Folio from"
            placeholderTextColor="#A38C77"
            style={[styles.input, styles.halfInput]}
            value={folioFrom}
            onChangeText={onChangeFolioFrom}
          />
          <TextInput
            placeholder="Folio to"
            placeholderTextColor="#A38C77"
            style={[styles.input, styles.halfInput]}
            value={folioTo}
            onChangeText={onChangeFolioTo}
          />
        </View>
        <Text style={styles.meta}>{exportCount} voucher{exportCount === 1 ? "" : "s"} selected for bulk export</Text>
        <View style={styles.actionRow}>
          <TouchableOpacity onPress={onExportBulk} style={styles.secondaryButton} {...webProps(onExportBulk)}>
            <Text style={styles.secondaryButtonText}>{Platform.OS === "web" ? "Open Print View" : "Download PDF"}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onPrintBulk} style={styles.primaryButton} {...webProps(onPrintBulk)}>
            <Text style={styles.primaryButtonText}>{Platform.OS === "web" ? "Print / Save as PDF" : "Print"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFF8EE",
    borderRadius: 28,
    padding: 20,
    gap: 18,
    borderWidth: 1,
    borderColor: "#E7D7C7",
    shadowColor: "#A06B3B",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  title: {
    color: "#2F241B",
    fontSize: 18,
    fontWeight: "800",
  },
  helper: {
    color: "#6F5E50",
    lineHeight: 20,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    color: "#9C5C24",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
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
  meta: {
    color: "#7A6858",
    fontSize: 13,
  },
  primaryButton: {
    backgroundColor: "#2E6A49",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    flex: 1,
  },
  primaryButtonText: {
    color: "#FFFDF9",
    fontWeight: "800",
    fontSize: 14,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#D7C2AE",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    flex: 1,
    backgroundColor: "#FFFDF9",
  },
  secondaryButtonText: {
    color: "#8A5A30",
    fontWeight: "700",
    fontSize: 14,
  },
});
