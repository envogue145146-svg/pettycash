import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";
import { getGoogleDriveDownloadUrl } from "../lib/pettyCashWebUtils";
import { Expense } from "../types";

export type VoucherExportMode = "share" | "print";

export type VoucherExportEntry = {
  expense: Expense;
  folioNumber?: string;
};

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function numberToWords(num: number): string {
  const a = ["", "One ", "Two ", "Three ", "Four ", "Five ", "Six ", "Seven ", "Eight ", "Nine ", "Ten ", "Eleven ", "Twelve ", "Thirteen ", "Fourteen ", "Fifteen ", "Sixteen ", "Seventeen ", "Eighteen ", "Nineteen "];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const numText = Math.floor(num).toString();
  if (numText.length > 9) return "overflow";
  const parts = (`000000000${numText}`).slice(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!parts) return "";
  let str = "";
  str += parts[1] !== "00" ? (a[Number(parts[1])] || `${b[Number(parts[1][0])]} ${a[Number(parts[1][1])]}`) + "Crore " : "";
  str += parts[2] !== "00" ? (a[Number(parts[2])] || `${b[Number(parts[2][0])]} ${a[Number(parts[2][1])]}`) + "Lakh " : "";
  str += parts[3] !== "00" ? (a[Number(parts[3])] || `${b[Number(parts[3][0])]} ${a[Number(parts[3][1])]}`) + "Thousand " : "";
  str += parts[4] !== "0" ? (a[Number(parts[4])] || `${b[Number(parts[4][0])]} ${a[Number(parts[4][1])]}`) + "Hundred " : "";
  str += parts[5] !== "00" ? (str !== "" ? "and " : "") + (a[Number(parts[5])] || `${b[Number(parts[5][0])]} ${a[Number(parts[5][1])]}`) : "";
  return str.trim();
}

async function toDataUrl(uri: string) {
  if (!uri.trim()) {
    return "";
  }

  try {
    if (uri.startsWith("data:")) {
      return uri;
    }

    let localUri = uri;

    if (/^https?:\/\//i.test(uri)) {
      const sourceUrl = uri.includes("drive.google.com") ? getGoogleDriveDownloadUrl(uri) : uri;
      const extensionMatch = sourceUrl.match(/\.([a-zA-Z0-9]+)(?:[?#]|$)/);
      const extension = extensionMatch?.[1]?.toLowerCase() || "jpg";
      const downloadTarget = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory}voucher-slip-${Date.now()}.${extension}`;
      const result = await FileSystem.downloadAsync(sourceUrl, downloadTarget);
      localUri = result.uri;
    }

    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const normalizedUri = localUri.toLowerCase();
    const mimeType = normalizedUri.endsWith(".png") ? "image/png" : "image/jpeg";
    return `data:${mimeType};base64,${base64}`;
  } catch {
    return /^https?:\/\//i.test(uri) ? uri : "";
  }
}

function getVoucherDocumentStyles() {
  return `
    @page { size: A4; margin: 15mm; }
    body { font-family: 'Arial', sans-serif; color: #000; margin: 0; padding: 0; }
    .voucher-page { page-break-after: always; }
    .voucher-page:last-child { page-break-after: auto; }
    .voucher-container { border: 2px solid #000; padding: 20px; position: relative; margin-bottom: 30px; }
    .header { text-align: center; margin-bottom: 20px; }
    .company-name { font-size: 28px; font-weight: bold; letter-spacing: 1px; }
    .address { font-size: 14px; margin-top: 4px; }
    .gstin { font-size: 14px; font-weight: bold; margin-top: 4px; }
    .meta-row { display: flex; justify-content: space-between; margin-bottom: 10px; padding-left: 30px; }
    table { width: 100%; border-collapse: collapse; border: 2px solid #000; }
    th, td { border: 1px solid #000; padding: 8px 12px; }
    th { text-align: left; }
    .col-rs { width: 80px; text-align: right; }
    .col-p { width: 30px; text-align: center; }
    .content-row { height: 120px; vertical-align: top; }
    .expense-head { font-size: 16px; font-weight: bold; }
    .expense-description { margin-top: 10px; font-size: 14px; color: #222; }
    .narration { margin-top: 15px; font-size: 14px; color: #333; }
    .footer-table { border-top: 2px solid #000; }
    .rupees-row { display: flex; border: 2px solid #000; border-top: none; padding: 10px; font-weight: bold; }
    .signatures { display: flex; justify-content: space-between; margin-top: 50px; padding: 0 20px; }
    .sig-line { border-top: 1px solid #000; width: 150px; text-align: center; padding-top: 5px; }
    .image-section { text-align: center; margin: 30px 0; }
    .bill-image { max-width: 100%; max-height: 400px; border: 1px solid #ccc; object-fit: contain; }
    .image-placeholder { padding: 40px; border: 1px dashed #ccc; color: #666; margin-top: 20px; }
  `;
}

async function buildVoucherMarkup(expense: Expense, folioNumber?: string) {
  const companyName = process.env.EXPO_PUBLIC_COMPANY_NAME || "ENVOGUE CLOTHING";
  const address = process.env.EXPO_PUBLIC_COMPANY_ADDRESS || "E 145 & 146, EPIP SITE-V, KASNA, GREATER NOIDA-201308";
  const gstin = process.env.EXPO_PUBLIC_COMPANY_GSTIN || "09AABFE2079A1ZU";

  const dateParts = expense.purchaseDate.split("-");
  const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : expense.purchaseDate;
  const amountStr = expense.amount.toFixed(2);
  const [rupees, paise] = amountStr.split(".");
  const words = numberToWords(Math.floor(expense.amount));
  const embeddedImageUrl = Platform.OS === "web" ? expense.billImageUrl : await toDataUrl(expense.billImageUrl);
  const expenseHead = expense.accountingHead?.trim() || "Petty Cash";

  const imageSection = embeddedImageUrl
    ? `<img src="${embeddedImageUrl}" alt="Bill" class="bill-image" />`
    : `<div class="image-placeholder">No bill attached</div>`;

  return `
    <div class="voucher-page">
      <div class="voucher-container">
        <div class="header">
          <div class="company-name">${escapeHtml(companyName)}</div>
          <div class="address">${escapeHtml(address)}</div>
          <div class="gstin">GSTIN: ${escapeHtml(gstin)}</div>
        </div>

        <div class="meta-row">
          <div>Folio No. <b>${escapeHtml(folioNumber || expense.id.slice(-6))}</b></div>
          <div>Dated: <b>${escapeHtml(formattedDate)}</b></div>
        </div>

        <table>
          <tr>
            <th>DEBIT</th>
            <th class="col-rs">Rs.</th>
            <th class="col-p">P.</th>
          </tr>
          <tr>
            <td class="content-row">
              <div class="expense-head">${escapeHtml(expenseHead)}</div>
              <div class="expense-description">${escapeHtml(expense.description)}</div>
              <div class="narration">
                Being expense submitted by ${escapeHtml(expense.createdBy)}
                ${expense.checkerNote ? '<br/><br/>Checker Note: ' + escapeHtml(expense.checkerNote) : ''}
              </div>
            </td>
            <td class="content-row col-rs">${escapeHtml(rupees)}</td>
            <td class="content-row col-p">${escapeHtml(paise)}</td>
          </tr>
          <tr class="footer-table">
            <td style="text-align: right; font-weight: bold;">CREDIT Cash &nbsp;&nbsp;&nbsp;&nbsp; Total Rs.</td>
            <td class="col-rs" style="font-weight: bold;">${escapeHtml(rupees)}</td>
            <td class="col-p" style="font-weight: bold;">${escapeHtml(paise)}</td>
          </tr>
        </table>

        <div class="rupees-row">
          RUPEES: ${escapeHtml(words)} Only
        </div>

        <div class="image-section">
          ${imageSection}
        </div>

        <div class="signatures">
          <div class="sig-line">Receiver's Signature</div>
          <div class="sig-line">Manager</div>
        </div>
      </div>
    </div>
  `;
}

function buildVoucherDocument(body: string) {
  return `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>${getVoucherDocumentStyles()}</style>
      </head>
      <body>${body}</body>
    </html>
  `;
}

export async function buildVoucherHtml(expense: Expense, folioNumber?: string) {
  return buildVoucherDocument(await buildVoucherMarkup(expense, folioNumber));
}

export async function buildBulkVoucherHtml(entries: VoucherExportEntry[]) {
  const sections: string[] = [];
  for (const entry of entries) {
    sections.push(await buildVoucherMarkup(entry.expense, entry.folioNumber));
  }
  return buildVoucherDocument(sections.join("\n"));
}

function openPrintPreviewOnWeb(htmlContent: string) {
  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  document.body.appendChild(iframe);

  if (iframe.contentDocument) {
    iframe.contentDocument.write(htmlContent);
    iframe.contentDocument.close();
  }

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();

    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 2000);
  }, 500);
}

async function renderVoucherDocument(htmlContent: string, title: string, mode: VoucherExportMode) {
  if (Platform.OS === "web") {
    openPrintPreviewOnWeb(htmlContent);
    return "";
  }

  const { uri } = await Print.printToFileAsync({
    html: htmlContent,
    base64: false,
    width: 794,
    height: 1123,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: mode === "print" ? `${title} - choose Print in the share sheet` : title,
      UTI: "com.adobe.pdf",
    });
  }

  return uri;
}

export async function exportVoucher(expense: Expense, folioNumber?: string) {
  const htmlContent = await buildVoucherHtml(expense, folioNumber);
  return renderVoucherDocument(htmlContent, `Petty Cash Voucher ${expense.id}`, "share");
}

export async function exportBulkVouchers(entries: VoucherExportEntry[], mode: VoucherExportMode = "share") {
  const htmlContent = await buildBulkVoucherHtml(entries);
  return renderVoucherDocument(
    htmlContent,
    `Petty Cash Vouchers ${entries.length} item${entries.length === 1 ? "" : "s"}`,
    mode,
  );
}
