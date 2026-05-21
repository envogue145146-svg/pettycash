const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add WASM to asset extensions for expo-sqlite web support
config.resolver.assetExts.push('wasm');

module.exports = config;
