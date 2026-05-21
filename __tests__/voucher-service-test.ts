import { buildVoucherHtml, escapeHtml, numberToWords } from "../src/services/voucherService";
import { Expense } from "../src/types";

describe("voucher service", () => {
  test("escapeHtml sanitizes reserved characters", () => {
    expect(escapeHtml(`<cash & "carry">`)).toBe("&lt;cash &amp; &quot;carry&quot;&gt;");
  });

  test("numberToWords formats Indian-style values", () => {
    expect(numberToWords(105)).toBe("One Hundred and Five");
    expect(numberToWords(1520)).toBe("One Thousand Five Hundred and Twenty");
  });

  test("buildVoucherHtml formats core voucher content and escapes user input", async () => {
    const expense: Expense = {
      id: "EXP-100123",
      description: `Tea <script>alert("x")</script>`,
      amount: 120.5,
      purchaseDate: "2026-05-07",
      billImageUrl: "",
      createdBy: "Riya & Co",
      checkerNote: `approved "today"`,
      status: "approved",
      transactionType: "debit",
      createdAt: "2026-05-07T10:00:00.000Z",
    };

    const html = await buildVoucherHtml(expense);

    expect(html).toContain("Dated: <b>07/05/2026</b>");
    expect(html).toContain("Tea &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(html).toContain("Riya &amp; Co");
    expect(html).toContain("approved &quot;today&quot;");
    expect(html).toContain("No bill attached");
    expect(html).toContain("RUPEES: One Hundred and Twenty Only");
  });

  test("buildVoucherHtml renders an image tag when a bill URL exists", async () => {
    const expense: Expense = {
      id: "EXP-200123",
      description: "Taxi",
      amount: 450,
      purchaseDate: "2026-05-07",
      billImageUrl: "https://example.com/bill.jpg",
      createdBy: "Aman",
      status: "pending",
      transactionType: "debit",
      createdAt: "2026-05-07T10:00:00.000Z",
    };

    const html = await buildVoucherHtml(expense);

    expect(html).toContain('<img src="https://example.com/bill.jpg" alt="Bill" class="bill-image" />');
  });
});
