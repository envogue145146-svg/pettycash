import React from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";

type LogoWatermarkProps = {
  style?: StyleProp<ViewStyle>;
};

export function LogoWatermark({ style }: LogoWatermarkProps) {
  return (
    <View pointerEvents="none" style={[styles.wrapper, style]}>
      <View style={styles.leafCluster}>
        <View style={[styles.leaf, styles.leafLeft]} />
        <View style={[styles.leaf, styles.leafCenter]} />
        <View style={[styles.leaf, styles.leafRight]} />
      </View>
      <View style={styles.ringArea}>
        <View style={styles.ringGreen} />
        <View style={styles.ringGold} />
        <View style={styles.center}>
          <Text style={styles.ec}>EC</Text>
        </View>
      </View>
      <Text style={styles.brand}>Envogue Clothing</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.11,
  },
  leafCluster: {
    width: 76,
    height: 30,
    position: "relative",
    marginBottom: -6,
    zIndex: 2,
  },
  leaf: {
    position: "absolute",
    backgroundColor: "#7EC242",
    borderRadius: 999,
  },
  leafLeft: {
    width: 18,
    height: 28,
    left: 8,
    top: 1,
    transform: [{ rotate: "-28deg" }],
  },
  leafCenter: {
    width: 16,
    height: 22,
    left: 28,
    top: -1,
  },
  leafRight: {
    width: 22,
    height: 34,
    right: 4,
    top: 1,
    transform: [{ rotate: "34deg" }],
  },
  ringArea: {
    width: 104,
    height: 104,
    alignItems: "center",
    justifyContent: "center",
  },
  ringGreen: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 999,
    borderWidth: 4,
    borderColor: "#77BE3B",
    borderRightColor: "transparent",
    transform: [{ rotate: "8deg" }],
  },
  ringGold: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: "#E5B519",
    borderLeftColor: "transparent",
    transform: [{ rotate: "-12deg" }],
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  ec: {
    color: "#0E9A8B",
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 1,
  },
  brand: {
    marginTop: -4,
    color: "#77BE3B",
    fontSize: 14,
    fontWeight: "500",
  },
});
