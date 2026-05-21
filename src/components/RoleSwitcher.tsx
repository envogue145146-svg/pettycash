import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { UserRole } from "../types";

type RoleSwitcherProps = {
  role: UserRole;
  onChange: (role: UserRole) => void;
};

const options: { label: string; value: UserRole }[] = [
  { label: "Creator", value: "creator" },
  { label: "Checker", value: "checker" },
];

export function RoleSwitcher({ role, onChange }: RoleSwitcherProps) {
  return (
    <View style={styles.container}>
      {options.map((option) => {
        const selected = option.value === role;

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.option, selected && styles.optionSelected]}
          >
            <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 18,
    backgroundColor: "#10233A",
    gap: 6,
  },
  option: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: "center",
  },
  optionSelected: {
    backgroundColor: "#7FD1B9",
  },
  optionText: {
    color: "#8FA9C7",
    fontWeight: "700",
  },
  optionTextSelected: {
    color: "#07111F",
  },
});
