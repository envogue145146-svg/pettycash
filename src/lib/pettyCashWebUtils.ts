import { Expense } from "../types";

const today = new Date().toISOString().slice(0, 10);

export function getGoogleDriveFileId(url: string) {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return "";
  }

  const driveFileMatch = trimmedUrl.match(/\/file\/d\/([^/]+)/i);
  if (driveFileMatch?.[1]) {
    return driveFileMatch[1];
  }

  const openIdMatch = trimmedUrl.match(/[?&]id=([^&]+)/i);
  if (trimmedUrl.includes("drive.google.com") && openIdMatch?.[1]) {
    return openIdMatch[1];
  }

  const ucMatch = trimmedUrl.match(/\/uc(?:\?.*?[?&]id=|\/)([^&/]+)/i);
  if (trimmedUrl.includes("drive.google.com") && ucMatch?.[1]) {
    return ucMatch[1];
  }

  const thumbnailMatch = trimmedUrl.match(/\/thumbnail\?.*?[?&]id=([^&]+)/i);
  if (trimmedUrl.includes("drive.google.com") && thumbnailMatch?.[1]) {
    return thumbnailMatch[1];
  }

  return "";
}

export function getCsvValue(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

export function normalizeImportedDriveUrl(url: string) {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return "";
  }

  const fileId = getGoogleDriveFileId(trimmedUrl);
  if (fileId) {
    if (/\/thumbnail\?/i.test(trimmedUrl)) {
      return trimmedUrl;
    }
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  }

  return trimmedUrl;
}

export function getGoogleDriveOpenUrl(url: string) {
  const fileId = getGoogleDriveFileId(url);
  if (!fileId) {
    return url.trim();
  }

  return `https://drive.google.com/file/d/${fileId}/view`;
}

export function getGoogleDriveDownloadUrl(url: string) {
  const fileId = getGoogleDriveFileId(url);
  if (!fileId) {
    return url.trim();
  }

  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

export function normalizeImportedDate(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return today;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
    return trimmedValue;
  }

  const slashMatch = trimmedValue.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (slashMatch) {
    const [, year, month, day] = slashMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const dayFirstMatch = trimmedValue.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dayFirstMatch) {
    const [, part1, part2, year] = dayFirstMatch;
    let month = part2;
    let day = part1;
    if (Number(part1) > 12) {
      day = part1;
      month = part2;
    } else if (Number(part2) > 12) {
      month = part1;
      day = part2;
    }
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const parsed = new Date(trimmedValue);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return today;
}

export function isRemoteImageUrl(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

export function getSignedAmount(expense: Expense) {
  return expense.transactionType === "credit" ? expense.amount : -expense.amount;
}
