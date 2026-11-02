import { DaybookDay } from "../lib/ledgerUtils";
import { formatLedgerDate, formatRupees } from "../lib/ledgerUtils";
import { escapeHtml, renderVoucherDocument } from "./voucherService";

type LedgerPrintInput = {
  days: DaybookDay[]; // in the order they should appear (same as the screen)
  openingBalance: number;
  totalReceipts: number;
  totalPayments: number;
  closingBalance: number;
  fromDate: string;
  toDate: string;
};

function money(value: number) {
  return value ? escapeHtml(formatRupees(value)) : "";
}

export function buildLedgerHtml(input: LedgerPrintInput) {
  const companyName = process.env.EXPO_PUBLIC_COMPANY_NAME || "ENVOGUE CLOTHING";
  const address = process.env.EXPO_PUBLIC_COMPANY_ADDRESS || "E 145 & 146, EPIP SITE-V, KASNA, GREATER NOIDA-201308";
  const period =
    input.fromDate || input.toDate
      ? `${input.fromDate ? formatLedgerDate(input.fromDate) : "Start"} to ${input.toDate ? formatLedgerDate(input.toDate) : "Today"}`
      : "All dates";
  const printedOn = new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

  const rows = input.days
    .map((day) => {
      const entries = day.entries
        .map((entry) => {
          const e = entry.expense;
          const pending = e.status === "pending" ? ' <span class="tag">Pending</span>' : "";
          return `<tr>
            <td class="desc">${escapeHtml(e.description)}${pending}</td>
            <td>${escapeHtml(e.accountingHead ?? "")}</td>
            <td>${escapeHtml(e.createdBy ?? "")}</td>
            <td class="num in">${money(entry.receipt)}</td>
            <td class="num out">${money(entry.payment)}</td>
            <td class="num">${escapeHtml(formatRupees(entry.balance))}</td>
          </tr>`;
        })
        .join("");

      return `<tbody class="day">
        <tr class="day-head">
          <td colspan="3">${escapeHtml(formatLedgerDate(day.date, true))}</td>
          <td colspan="3" class="num">Opening ${escapeHtml(formatRupees(day.openingBalance))}</td>
        </tr>
        ${entries}
        <tr class="day-total">
          <td colspan="3">Day total</td>
          <td class="num in">${money(day.totalReceipts)}</td>
          <td class="num out">${money(day.totalPayments)}</td>
          <td class="num">${escapeHtml(formatRupees(day.closingBalance))}</td>
        </tr>
      </tbody>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Petty Cash Ledger</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #222; font-size: 11px; margin: 0; }
  .header { text-align: center; border-bottom: 2px solid #222; padding-bottom: 6px; margin-bottom: 8px; }
  .company { font-size: 16px; font-weight: 700; letter-spacing: 0.5px; }
  .address { font-size: 10px; color: #555; margin-top: 2px; }
  .title { font-size: 14px; font-weight: 700; margin-top: 6px; }
  .meta { display: flex; justify-content: space-between; font-size: 10px; color: #555; margin-bottom: 8px; }
  .summary { display: flex; gap: 6px; margin-bottom: 10px; }
  .summary div { flex: 1; border: 1px solid #bbb; padding: 5px 6px; }
  .summary span { display: block; font-size: 9px; color: #666; text-transform: uppercase; }
  .summary b { font-size: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #eee; text-align: left; font-size: 10px; text-transform: uppercase; padding: 5px 6px; border: 1px solid #bbb; }
  td { padding: 4px 6px; border: 1px solid #ddd; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; }
  .in { color: #1c6a3b; }
  .out { color: #a53a52; }
  .desc { width: 34%; }
  tbody.day { page-break-inside: avoid; }
  .day-head td { background: #f3ece4; font-weight: 700; border-top: 2px solid #999; }
  .day-total td { background: #faf7f3; font-weight: 700; }
  .tag { font-size: 8px; font-weight: 700; color: #8a6300; border: 1px solid #d4a43d; padding: 0 3px; border-radius: 3px; }
  .footer { margin-top: 24px; display: flex; justify-content: space-between; font-size: 10px; }
  .sign { border-top: 1px solid #222; padding-top: 3px; width: 160px; text-align: center; }
</style>
</head>
<body>
  <div class="header">
    <div class="company">${escapeHtml(companyName)}</div>
    <div class="address">${escapeHtml(address)}</div>
    <div class="title">Petty Cash Ledger (Day Book)</div>
  </div>
  <div class="meta">
    <div>Period: ${escapeHtml(period)}</div>
    <div>Printed: ${escapeHtml(printedOn)}</div>
  </div>
  <div class="summary">
    <div><span>Opening${input.fromDate ? ` on ${escapeHtml(formatLedgerDate(input.fromDate))}` : ""}</span><b>${escapeHtml(formatRupees(input.openingBalance))}</b></div>
    <div><span>Receipts (In)</span><b class="in">${escapeHtml(formatRupees(input.totalReceipts))}</b></div>
    <div><span>Payments (Out)</span><b class="out">${escapeHtml(formatRupees(input.totalPayments))}</b></div>
    <div><span>Closing${input.toDate ? ` on ${escapeHtml(formatLedgerDate(input.toDate))}` : ""}</span><b>${escapeHtml(formatRupees(input.closingBalance))}</b></div>
  </div>
  <table>
    <thead>
      <tr><th>Particulars</th><th>Head</th><th>By</th><th class="num">In</th><th class="num">Out</th><th class="num">Balance</th></tr>
    </thead>
    ${rows || '<tbody><tr><td colspan="6" style="text-align:center;padding:16px">No entries in this period.</td></tr></tbody>'}
  </table>
  <div class="footer">
    <div class="sign">Prepared by</div>
    <div class="sign">Checked by</div>
    <div class="sign">Approved by</div>
  </div>
</body>
</html>`;
}

export async function printLedger(input: LedgerPrintInput) {
  return renderVoucherDocument(buildLedgerHtml(input), "Petty Cash Ledger", "print");
}
