import { getCsvValue, getSignedAmount, isRemoteImageUrl, normalizeImportedDate, normalizeImportedDriveUrl } from "../src/lib/pettyCashWebUtils";
import { Expense } from "../src/types";

describe("petty cash web helpers", () => {
  test("getCsvValue returns the first non-empty trimmed value", () => {
    const row = {
      Description: "   ",
      description: " Office tea ",
      fallback: "Ignored",
    };

    expect(getCsvValue(row, ["Description", "description", "fallback"])).toBe("Office tea");
  });

  test("normalizeImportedDate keeps ISO dates and converts day-first values", () => {
    expect(normalizeImportedDate("2026-05-07")).toBe("2026-05-07");
    expect(normalizeImportedDate("7-5-2026")).toBe("2026-05-07");
  });

  test("normalizeImportedDate falls back to today's ISO date for blanks", () => {
    const today = new Date().toISOString().slice(0, 10);

    expect(normalizeImportedDate("")).toBe(today);
  });

  test("normalizeImportedDriveUrl converts common Google Drive links to direct view URLs", () => {
    expect(normalizeImportedDriveUrl("https://drive.google.com/file/d/abc123/view?usp=sharing")).toBe(
      "https://drive.google.com/uc?export=view&id=abc123",
    );
    expect(normalizeImportedDriveUrl("https://drive.google.com/open?id=xyz789")).toBe(
      "https://drive.google.com/uc?export=view&id=xyz789",
    );
  });

  test("daybook csv field names map cleanly to description, head, date, and receipt image", () => {
    const row = {
      Date: "01-04-2026",
      "Expence description": "Press boot",
      "Receipt/Invoice/Cash Memo": "https://drive.google.com/open?id=1MtktIOrT6YfUReGZJli569joTZdFXJkc",
      "Expences Head": "Consumable Expenses",
      "Debit Amount": "400",
    };

    expect(getCsvValue(row, ["Expence description", "Expense description", "Description"])).toBe("Press boot");
    expect(getCsvValue(row, ["Expences Head", "Expense Head", "Accounting Head"])).toBe("Consumable Expenses");
    expect(normalizeImportedDate(getCsvValue(row, ["Date", "date", "Purchase Date"]))).toBe("2026-04-01");
    expect(
      normalizeImportedDriveUrl(
        getCsvValue(row, [
          "Image URL",
          "Slip Link",
          "Google Drive Link",
          "Receipt/Invoice/Cash Memo",
          "Receipt/Invoice/Cash Memo-2",
        ]),
      ),
    ).toBe("https://drive.google.com/uc?export=view&id=1MtktIOrT6YfUReGZJli569joTZdFXJkc");
  });

  test("isRemoteImageUrl only accepts http and https URLs", () => {
    expect(isRemoteImageUrl("https://example.com/bill.jpg")).toBe(true);
    expect(isRemoteImageUrl("http://example.com/bill.jpg")).toBe(true);
    expect(isRemoteImageUrl("file:///tmp/bill.jpg")).toBe(false);
  });

  test("getSignedAmount treats credit as positive and debit as negative", () => {
    const debitExpense: Expense = {
      id: "exp-1",
      description: "Stationery",
      amount: 300,
      purchaseDate: "2026-05-07",
      billImageUrl: "",
      createdBy: "Asha",
      status: "approved",
      transactionType: "debit",
      createdAt: "2026-05-07T10:00:00.000Z",
    };
    const creditExpense: Expense = {
      ...debitExpense,
      id: "exp-2",
      transactionType: "credit",
    };

    expect(getSignedAmount(debitExpense)).toBe(-300);
    expect(getSignedAmount(creditExpense)).toBe(300);
  });
});
