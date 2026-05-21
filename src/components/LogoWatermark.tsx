import React from "react";
import { Image, StyleProp, StyleSheet, View, ViewStyle } from "react-native";

type LogoWatermarkProps = {
  style?: StyleProp<ViewStyle>;
};

export function LogoWatermark({ style }: LogoWatermarkProps) {
  return (
    <View pointerEvents="none" style={[styles.wrapper, style]}>
      <Image source={require("../../assets/envogue-logo.png")} style={styles.logo} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.11,
  },
  logo: {
    width: 180,
    height: 72,
  },
});
