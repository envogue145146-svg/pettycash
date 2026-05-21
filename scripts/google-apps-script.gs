const EXPENSES_SHEET = "";
const LEDGER_SHEET = "Ledger";
const BILLS_FOLDER_NAME = "PettyCashBills";
const DEFAULT_EXPENSE_HEAD = "Petty Cash";
const APP_METADATA_HEADERS = ["App Expense ID", "App Status", "App Checker Note", "App Creator ID", "App Checker ID", "App Created At", "App Transaction Type"];

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || "bootstrap";

  try {
    if (action === "bootstrap") {
      return jsonResponse({
        ledger: readLedger(),
        expenses: readExpenses(),
      });
    }

    if (action === "ledger") {
      return jsonResponse(readLedger());
    }

    if (action === "expenses") {
      return jsonResponse(readExpenses());
    }

    return jsonResponse(null, false, "Unknown action.");
  } catch (error) {
    return jsonResponse(null, false, String(error));
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const action = payload.action;

    if (action === "ensureLedger") {
      const ledger = ensureLedger(payload.ledger || {});
      return jsonResponse(ledger);
    }

    if (action === "createExpense") {
      appendExpense(payload.expense || {});
      return jsonResponse({ created: true });
    }

    if (action === "updateExpenseStatus") {
      updateExpenseStatus(payload);
      return jsonResponse({ updated: true });
    }

    if (action === "updateExpenseImage") {
      updateExpenseImage(payload);
      return jsonResponse({ updated: true });
    }

    if (action === "updateExpense") {
      updateExpense(payload);
      return jsonResponse({ updated: true });
    }

    if (action === "uploadBillImage") {
      const url = saveBillImage(payload);
      return jsonResponse({ url: url });
    }

    return jsonResponse(null, false, "Unknown action.");
  } catch (error) {
    return jsonResponse(null, false, String(error));
  }
}

function jsonResponse(data, ok, errorMessage) {
  const payload = JSON.stringify({
    ok: ok !== false,
    data: data === undefined ? null : data,
    error: errorMessage || null,
  });

  return ContentService.createTextOutput(payload).setMimeType(ContentService.MimeType.JSON);
}

function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getExpensesSheet() {
  const spreadsheet = getSpreadsheet();
  if (EXPENSES_SHEET) {
    return spreadsheet.getSheetByName(EXPENSES_SHEET) || spreadsheet.getActiveSheet();
  }
  return spreadsheet.getActiveSheet();
}

function getOrCreateSheet(name, headers) {
  const spreadsheet = getSpreadsheet();
  let sheet = spreadsheet.getSheetByName(name);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  const lastColumn = headers.length;
  const headerRow = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const needsHeaders = headers.some(function (header, index) {
    return headerRow[index] !== header;
  });

  if (needsHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  return sheet;
}

function expenseHeaders() {
  return [
    "Timestamp",
    "Date",
    "Expence description",
    "Receipt/Invoice/Cash Memo",
    "Expence By",
    "Debit Amount",
    "Credit Amount",
    "Expences Head",
    "Receipt/Invoice/Cas",
    "Running Balan",
  ];
}

function ledgerHeaders() {
  return ["id", "label", "openingBalance", "currentBalance"];
}

function readSheetObjects(sheetName, headers) {
  const sheet = sheetName ? getOrCreateSheet(sheetName, headers) : getExpensesSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return [];
  }

  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values
    .filter(function (row) {
      return row.some(function (cell) {
        return cell !== "";
      });
    })
    .map(function (row) {
      var item = {};
      headers.forEach(function (header, index) {
        item[header] = row[index];
      });
      return item;
    });
}

function getHeaderMap(sheet) {
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const headerValues = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const headerMap = {};

  for (var index = 0; index < headerValues.length; index += 1) {
    const rawHeader = String(headerValues[index] || "").trim();
    if (rawHeader) {
      headerMap[rawHeader] = index + 1;
    }
  }

  return headerMap;
}

function ensureExpenseHeaders() {
  const sheet = getExpensesSheet();
  const headers = expenseHeaders();
  const headerMap = getHeaderMap(sheet);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  const refreshedHeaderMap = getHeaderMap(sheet);
  const metadataToAdd = APP_METADATA_HEADERS.filter(function (header) {
    return !refreshedHeaderMap[header];
  });

  if (metadataToAdd.length) {
    const startColumn = Math.max(sheet.getLastColumn(), 0) + 1;
    sheet.getRange(1, startColumn, 1, metadataToAdd.length).setValues([metadataToAdd]);
  }

  return {
    sheet: sheet,
    headerMap: getHeaderMap(sheet),
  };
}

function findHeaderColumn(headerMap, choices) {
  for (var index = 0; index < choices.length; index += 1) {
    if (headerMap[choices[index]]) {
      return headerMap[choices[index]];
    }
  }
  return 0;
}

function getCellValue(row, columnIndex) {
  if (!columnIndex) {
    return "";
  }
  return row[columnIndex - 1];
}

function formatDateValue(value) {
  if (!value) {
    return "";
  }

  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "dd/MM/yyyy");
  }

  return String(value);
}

function parseAmount(value) {
  if (value === "" || value === null || value === undefined) {
    return 0;
  }

  return Number(String(value).replace(/,/g, "")) || 0;
}

function readExpenses() {
  const context = ensureExpenseHeaders();
  const sheet = context.sheet;
  const headerMap = context.headerMap;
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return [];
  }

  const lastColumn = sheet.getLastColumn();
  const values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();

  return values
    .filter(function (row) {
      return row.some(function (cell) {
        return cell !== "";
      });
    })
    .map(function (row, rowIndex) {
      const debitAmount = parseAmount(getCellValue(row, findHeaderColumn(headerMap, ["Debit Amount"])));
      const creditAmount = parseAmount(getCellValue(row, findHeaderColumn(headerMap, ["Credit Amount"])));
      const storedId = String(getCellValue(row, findHeaderColumn(headerMap, ["App Expense ID"])) || "").trim();
      const createdAt = getCellValue(row, findHeaderColumn(headerMap, ["App Created At"])) || getCellValue(row, findHeaderColumn(headerMap, ["Timestamp"]));
      const status = String(
        getCellValue(row, findHeaderColumn(headerMap, ["App Status"])) || (debitAmount > 0 || creditAmount > 0 ? "approved" : "pending"),
      ).trim();
      const transactionType = String(
        getCellValue(row, findHeaderColumn(headerMap, ["App Transaction Type"])) || (creditAmount > 0 && debitAmount <= 0 ? "credit" : "debit"),
      ).trim();

      return {
        id: storedId || "sheet-row-" + (rowIndex + 2),
        accountingHead: String(getCellValue(row, findHeaderColumn(headerMap, ["Expences Head", "Expense Head", "Accounting Head"])) || ""),
        description: String(getCellValue(row, findHeaderColumn(headerMap, ["Expence description", "Expense description"])) || ""),
        amount: transactionType === "credit" ? creditAmount : debitAmount > 0 ? debitAmount : creditAmount,
        purchaseDate: formatDateValue(getCellValue(row, findHeaderColumn(headerMap, ["Date"]))),
        billImageUrl: String(
          getCellValue(row, findHeaderColumn(headerMap, ["Receipt/Invoice/Cash Memo", "Receipt/Invoice/Cas"])) || "",
        ),
        createdBy: String(getCellValue(row, findHeaderColumn(headerMap, ["Expence By", "Expense By"])) || ""),
        creatorId: String(getCellValue(row, findHeaderColumn(headerMap, ["App Creator ID"])) || ""),
        checkedBy: status === "approved" || status === "rejected" ? "Checker" : "",
        checkerId: String(getCellValue(row, findHeaderColumn(headerMap, ["App Checker ID"])) || ""),
        status: status === "rejected" ? "rejected" : status === "pending" ? "pending" : "approved",
        transactionType: transactionType === "credit" ? "credit" : "debit",
        checkerNote: String(getCellValue(row, findHeaderColumn(headerMap, ["App Checker Note"])) || ""),
        createdAt: String(createdAt || ""),
      };
    })
    .sort(function (left, right) {
      return String(right.createdAt).localeCompare(String(left.createdAt));
    });
}

function readLedger() {
  const expensesSheet = getExpensesSheet();
  const headerMap = getHeaderMap(expensesSheet);
  const runningBalanceColumn = findHeaderColumn(headerMap, ["Running Balan", "Running Balance"]);
  const lastRow = expensesSheet.getLastRow();
  var derivedCurrentBalance = 0;

  if (runningBalanceColumn && lastRow > 1) {
    for (var rowNumber = lastRow; rowNumber >= 2; rowNumber -= 1) {
      const value = expensesSheet.getRange(rowNumber, runningBalanceColumn).getValue();
      if (value !== "") {
        derivedCurrentBalance = parseAmount(value);
        break;
      }
    }
  }

  const rows = readSheetObjects(LEDGER_SHEET, ledgerHeaders());
  if (!rows.length) {
    return {
      id: "sheet-ledger-1",
      label: "Main Petty Cash",
      openingBalance: derivedCurrentBalance,
      currentBalance: derivedCurrentBalance,
    };
  }

  const row = rows[0];
  return {
    id: String(row.id || "sheet-ledger-1"),
    label: String(row.label || "Main Petty Cash"),
    openingBalance: Number(row.openingBalance || 0),
    currentBalance: derivedCurrentBalance || Number(row.currentBalance || 0),
  };
}

function ensureLedger(input) {
  const existing = readLedger();
  if (existing) {
    return existing;
  }

  const sheet = getOrCreateSheet(LEDGER_SHEET, ledgerHeaders());
  const ledger = {
    id: String(input.id || "sheet-ledger-1"),
    label: String(input.label || "Main Petty Cash"),
    openingBalance: Number(input.openingBalance || 0),
    currentBalance: Number(input.currentBalance || input.openingBalance || 0),
  };

  sheet.getRange(2, 1, 1, 4).setValues([[ledger.id, ledger.label, ledger.openingBalance, ledger.currentBalance]]);
  return ledger;
}

function appendExpense(expense) {
  const context = ensureExpenseHeaders();
  const sheet = context.sheet;
  const headerMap = context.headerMap;
  const lastRow = sheet.getLastRow();
  const runningBalanceColumn = findHeaderColumn(headerMap, ["Running Balan", "Running Balance"]);
  const previousRunningBalance =
    runningBalanceColumn && lastRow > 1 ? parseAmount(sheet.getRange(lastRow, runningBalanceColumn).getValue()) : 0;
  const isCredit = String(expense.transactionType || "debit") === "credit";
  const amount = Number(expense.amount || 0);
  const nextRunningBalance = isCredit ? previousRunningBalance + amount : previousRunningBalance - amount;
  const row = new Array(sheet.getLastColumn()).fill("");

  row[findHeaderColumn(headerMap, ["Timestamp"]) - 1] = String(expense.createdAt || new Date().toISOString());
  row[findHeaderColumn(headerMap, ["Date"]) - 1] = String(expense.purchaseDate || "");
  row[findHeaderColumn(headerMap, ["Expence description", "Expense description"]) - 1] = String(expense.description || "");
  row[findHeaderColumn(headerMap, ["Receipt/Invoice/Cash Memo", "Receipt/Invoice/Cas"]) - 1] = String(expense.billImageUrl || "");
  row[findHeaderColumn(headerMap, ["Expence By", "Expense By"]) - 1] = String(expense.createdBy || "");
  row[findHeaderColumn(headerMap, ["Debit Amount"]) - 1] = isCredit ? "" : amount;
  if (findHeaderColumn(headerMap, ["Credit Amount"])) {
    row[findHeaderColumn(headerMap, ["Credit Amount"]) - 1] = isCredit ? amount : "";
  }
  if (findHeaderColumn(headerMap, ["Expences Head"])) {
    row[findHeaderColumn(headerMap, ["Expences Head"]) - 1] = String(expense.accountingHead || DEFAULT_EXPENSE_HEAD);
  }
  if (runningBalanceColumn) {
    row[runningBalanceColumn - 1] = nextRunningBalance;
  }
  row[findHeaderColumn(headerMap, ["App Expense ID"]) - 1] = String(expense.id || "");
  row[findHeaderColumn(headerMap, ["App Status"]) - 1] = String(expense.status || "pending");
  if (findHeaderColumn(headerMap, ["App Transaction Type"])) {
    row[findHeaderColumn(headerMap, ["App Transaction Type"]) - 1] = isCredit ? "credit" : "debit";
  }
  row[findHeaderColumn(headerMap, ["App Checker Note"]) - 1] = String(expense.checkerNote || "");
  row[findHeaderColumn(headerMap, ["App Creator ID"]) - 1] = String(expense.creatorId || "");
  row[findHeaderColumn(headerMap, ["App Checker ID"]) - 1] = String(expense.checkerId || "");
  row[findHeaderColumn(headerMap, ["App Created At"]) - 1] = String(expense.createdAt || new Date().toISOString());

  sheet.appendRow(row);
}

function updateExpenseStatus(payload) {
  const context = ensureExpenseHeaders();
  const sheet = context.sheet;
  const headerMap = context.headerMap;
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    throw new Error("No expenses found.");
  }

  const appExpenseIdColumn = findHeaderColumn(headerMap, ["App Expense ID"]);
  if (!appExpenseIdColumn) {
    throw new Error("App Expense ID column is missing.");
  }

  const ids = sheet.getRange(2, appExpenseIdColumn, lastRow - 1, 1).getValues();
  for (var index = 0; index < ids.length; index += 1) {
    if (String(ids[index][0]) === String(payload.expenseId)) {
      const row = index + 2;
      if (findHeaderColumn(headerMap, ["App Status"])) {
        sheet.getRange(row, findHeaderColumn(headerMap, ["App Status"])).setValue(String(payload.status || "pending"));
      }
      if (findHeaderColumn(headerMap, ["App Checker Note"])) {
        sheet
          .getRange(row, findHeaderColumn(headerMap, ["App Checker Note"]))
          .setValue(String(payload.checkerNote || ""));
      }
      if (findHeaderColumn(headerMap, ["App Checker ID"])) {
        sheet.getRange(row, findHeaderColumn(headerMap, ["App Checker ID"])).setValue(String(payload.checkerId || ""));
      }
      return;
    }
  }

  throw new Error("Expense not found: " + payload.expenseId);
}

function updateExpenseImage(payload) {
  const context = ensureExpenseHeaders();
  const sheet = context.sheet;
  const headerMap = context.headerMap;
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    throw new Error("No expenses found.");
  }

  const appExpenseIdColumn = findHeaderColumn(headerMap, ["App Expense ID"]);
  const slipColumn = findHeaderColumn(headerMap, ["Receipt/Invoice/Cash Memo", "Receipt/Invoice/Cas"]);
  if (!appExpenseIdColumn || !slipColumn) {
    throw new Error("Required slip columns are missing.");
  }

  const ids = sheet.getRange(2, appExpenseIdColumn, lastRow - 1, 1).getValues();
  for (var index = 0; index < ids.length; index += 1) {
    if (String(ids[index][0]) === String(payload.expenseId)) {
      sheet.getRange(index + 2, slipColumn).setValue(String(payload.billImageUrl || ""));
      return;
    }
  }

  throw new Error("Expense not found: " + payload.expenseId);
}

function updateExpense(payload) {
  const context = ensureExpenseHeaders();
  const sheet = context.sheet;
  const headerMap = context.headerMap;
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    throw new Error("No expenses found.");
  }

  const appExpenseIdColumn = findHeaderColumn(headerMap, ["App Expense ID"]);
  if (!appExpenseIdColumn) {
    throw new Error("App Expense ID column is missing.");
  }

  const ids = sheet.getRange(2, appExpenseIdColumn, lastRow - 1, 1).getValues();
  for (var index = 0; index < ids.length; index += 1) {
    if (String(ids[index][0]) === String(payload.expenseId)) {
      const row = index + 2;
      const transactionType = String(payload.transactionType || "debit") === "credit" ? "credit" : "debit";
      const amount = Number(payload.amount || 0);
      const debitColumn = findHeaderColumn(headerMap, ["Debit Amount"]);
      const creditColumn = findHeaderColumn(headerMap, ["Credit Amount"]);
      const headColumn = findHeaderColumn(headerMap, ["Expences Head", "Expense Head", "Accounting Head"]);
      const descriptionColumn = findHeaderColumn(headerMap, ["Expence description", "Expense description"]);
      const purchaseDateColumn = findHeaderColumn(headerMap, ["Date"]);
      const slipColumn = findHeaderColumn(headerMap, ["Receipt/Invoice/Cash Memo", "Receipt/Invoice/Cas"]);
      const transactionTypeColumn = findHeaderColumn(headerMap, ["App Transaction Type"]);

      if (headColumn) {
        sheet.getRange(row, headColumn).setValue(String(payload.accountingHead || DEFAULT_EXPENSE_HEAD));
      }
      if (descriptionColumn) {
        sheet.getRange(row, descriptionColumn).setValue(String(payload.description || ""));
      }
      if (purchaseDateColumn) {
        sheet.getRange(row, purchaseDateColumn).setValue(String(payload.purchaseDate || ""));
      }
      if (slipColumn) {
        sheet.getRange(row, slipColumn).setValue(String(payload.billImageUrl || ""));
      }
      if (debitColumn) {
        sheet.getRange(row, debitColumn).setValue(transactionType === "credit" ? "" : amount);
      }
      if (creditColumn) {
        sheet.getRange(row, creditColumn).setValue(transactionType === "credit" ? amount : "");
      }
      if (transactionTypeColumn) {
        sheet.getRange(row, transactionTypeColumn).setValue(transactionType);
      }
      return;
    }
  }

  throw new Error("Expense not found: " + payload.expenseId);
}

function getBillsFolder() {
  const folders = DriveApp.getFoldersByName(BILLS_FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }

  return DriveApp.createFolder(BILLS_FOLDER_NAME);
}

function saveBillImage(payload) {
  if (!payload.base64Data) {
    return "";
  }

  const blob = Utilities.newBlob(
    Utilities.base64Decode(payload.base64Data),
    payload.mimeType || "image/jpeg",
    payload.fileName || "bill.jpg",
  );
  const file = getBillsFolder().createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w2000";
}
