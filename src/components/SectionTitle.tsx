import React from "react";
import { StyleSheet, Text, View } from "react-native";

type SectionTitleProps = {
  eyebrow: string;
  title: string;
};

export function SectionTitle({ eyebrow, title }: SectionTitleProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 4,
  },
  eyebrow: {
    color: "#9C5C24",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    color: "#2F241B",
    fontSize: 22,
    fontWeight: "800",
  },
});
