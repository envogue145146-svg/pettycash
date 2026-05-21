import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";

export function normalizeAssetExtension(uri: string, fallback = "jpg") {
  const lastSegment = uri.split("/").pop() ?? "";
  const extension = lastSegment.split("?")[0]?.split(".").pop()?.toLowerCase() ?? fallback;

  if (!/^[a-z0-9]{1,5}$/i.test(extension)) {
    return fallback;
  }

  return extension;
}

export function getImageMimeType(extension: string) {
  if (extension === "png") {
    return "image/png";
  }

  if (extension === "webp") {
    return "image/webp";
  }

  return "image/jpeg";
}

function decodeBase64(base64: string) {
  const decoder = globalThis.atob;
  if (!decoder) {
    throw new Error("Base64 decoding is not available on this device.");
  }

  const binary = decoder(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export async function readUploadBytes(uri: string) {
  if (Platform.OS === "web" || /^https?:\/\//i.test(uri) || uri.startsWith("blob:") || uri.startsWith("data:")) {
    const buffer = await fetch(uri).then((response) => response.arrayBuffer());
    return new Uint8Array(buffer);
  }

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return decodeBase64(base64);
}
