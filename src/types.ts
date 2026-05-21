export type UserRole = "creator" | "checker";

export type ExpenseStatus = "pending" | "approved" | "rejected";

export type TransactionType = "debit" | "credit";

export type Expense = {
  id: string;
  accountingHead?: string;
  description: string;
  amount: number;
  purchaseDate: string;
  billImageUrl: string;
  createdBy: string;
  creatorId?: string;
  checkedBy?: string;
  checkerId?: string;
  status: ExpenseStatus;
  transactionType: TransactionType;
  checkerNote?: string;
  createdAt: string;
};

export type ExpenseDraft = {
  accountingHead: string;
  description: string;
  amount: string;
  purchaseDate: string;
  billImageUrl: string;
  transactionType: TransactionType;
};

export type Summary = {
  cashInHand: number;
  pendingAmount: number;
  approvedAmount: number;
  rejectedAmount: number;
};

export type Profile = {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
};

export type Ledger = {
  id: string;
  label: string;
  openingBalance: number;
  currentBalance: number;
  openingBalanceDate?: string;
};

export type AuthFormMode = "signIn" | "signUp";

export type ImageSourceMode = "camera" | "gallery";

export type AppSession = {
  user: {
    id: string;
    email: string;
    user_metadata?: {
      full_name?: string;
      role?: UserRole;
    };
  };
};

export type BackendMode = "firebase" | "supabase" | "googleSheets" | "local";
