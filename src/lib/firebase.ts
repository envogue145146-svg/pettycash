import { Platform } from "react-native";
import { initializeApp, getApp, getApps } from "firebase/app";
import {
  Auth,
  User,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  inMemoryPersistence,
  initializeAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseAuthSignOut,
} from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { getImageMimeType, normalizeAssetExtension, readUploadBytes } from "./fileUploads";
import { AppSession, Expense, Ledger, Profile, TransactionType, UserRole } from "../types";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.storageBucket &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId,
);

const firebaseApp = isFirebaseConfigured ? (getApps().length ? getApp() : initializeApp(firebaseConfig)) : null;

let firebaseAuth: Auth | null = null;

function mapUserToSession(user: User | null): AppSession | null {
  if (!user) {
    return null;
  }

  return {
    user: {
      id: user.uid,
      email: user.email ?? "",
      user_metadata: {
        full_name: user.displayName ?? undefined,
      },
    },
  };
}

export function getFirebaseAuth() {
  if (!firebaseApp) {
    return null;
  }

  if (firebaseAuth) {
    return firebaseAuth;
  }

  if (Platform.OS === "web") {
    firebaseAuth = getAuth(firebaseApp);
    void firebaseAuth.setPersistence(browserLocalPersistence);
    return firebaseAuth;
  }

  firebaseAuth = initializeAuth(firebaseApp, {
    // This Firebase package build does not expose the old react-native auth entrypoint,
    // so we fall back to bundler-safe in-memory persistence for native builds.
    persistence: inMemoryPersistence,
  });

  return firebaseAuth;
}

export function getFirebaseDb() {
  return firebaseApp ? getFirestore(firebaseApp) : null;
}

export function getFirebaseStorage() {
  return firebaseApp ? getStorage(firebaseApp) : null;
}

export async function firebaseGetSession() {
  const auth = getFirebaseAuth();
  return mapUserToSession(auth?.currentUser ?? null);
}

export function firebaseOnAuthStateChange(listener: (session: AppSession | null) => void) {
  const auth = getFirebaseAuth();
  if (!auth) {
    return () => undefined;
  }

  return onAuthStateChanged(auth, (user) => {
    listener(mapUserToSession(user));
  });
}

export async function firebaseFetchProfile(userId: string) {
  const db = getFirebaseDb();
  if (!db) {
    return null;
  }

  const snapshot = await getDoc(doc(db, "profiles", userId));
  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();
  return {
    id: snapshot.id,
    fullName: String(data.fullName ?? ""),
    email: String(data.email ?? ""),
    role: (data.role === "checker" ? "checker" : "creator") as UserRole,
  } satisfies Profile;
}

export async function firebaseUpsertProfile(profile: Profile) {
  const db = getFirebaseDb();
  if (!db) {
    return;
  }

  await setDoc(
    doc(db, "profiles", profile.id),
    {
      fullName: profile.fullName,
      email: profile.email,
      role: profile.role,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function firebaseEnsureProfileForSession(session: AppSession, fallbackRole: UserRole = "creator") {
  const existingProfile = await firebaseFetchProfile(session.user.id);
  if (existingProfile) {
    return existingProfile;
  }

  const profile: Profile = {
    id: session.user.id,
    email: session.user.email,
    fullName: session.user.user_metadata?.full_name?.trim() || session.user.email.split("@")[0] || "Petty Cash User",
    role: fallbackRole,
  };

  await firebaseUpsertProfile(profile);
  return profile;
}

export async function firebaseEnsureDefaultLedger() {
  const db = getFirebaseDb();
  if (!db) {
    return null;
  }

  const ledgerRef = doc(db, "cash_ledgers", "main");
  const snapshot = await getDoc(ledgerRef);
  if (!snapshot.exists()) {
    await setDoc(ledgerRef, {
      label: "Main Petty Cash",
      openingBalance: 0,
      currentBalance: 0,
      updatedAt: serverTimestamp(),
    });
  }

  const nextSnapshot = await getDoc(ledgerRef);
  const data = nextSnapshot.data();
  if (!data) {
    return null;
  }

  return {
    id: nextSnapshot.id,
    label: String(data.label ?? "Main Petty Cash"),
    openingBalance: Number(data.openingBalance ?? 0),
    currentBalance: Number(data.currentBalance ?? 0),
  } satisfies Ledger;
}

export async function firebaseFetchLedger() {
  const db = getFirebaseDb();
  if (!db) {
    return null;
  }

  const snapshot = await getDoc(doc(db, "cash_ledgers", "main"));
  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();
  return {
    id: snapshot.id,
    label: String(data.label ?? "Main Petty Cash"),
    openingBalance: Number(data.openingBalance ?? 0),
    currentBalance: Number(data.currentBalance ?? 0),
  } satisfies Ledger;
}

export async function firebaseFetchExpenses() {
  const db = getFirebaseDb();
  if (!db) {
    return [];
  }

  const snapshot = await getDocs(query(collection(db, "expenses"), orderBy("createdAt", "desc")));
  return snapshot.docs.map((item) => {
    const data = item.data();
    const createdAtValue = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString();

    return {
      id: item.id,
      accountingHead: data.accountingHead ? String(data.accountingHead) : undefined,
      description: String(data.description ?? ""),
      amount: Number(data.amount ?? 0),
      purchaseDate: String(data.purchaseDate ?? ""),
      billImageUrl: String(data.billImageUrl ?? ""),
      createdBy: String(data.createdBy ?? "Unknown"),
      creatorId: String(data.creatorId ?? ""),
      checkedBy: data.checkedBy ? String(data.checkedBy) : undefined,
      checkerId: data.checkerId ? String(data.checkerId) : undefined,
      checkerNote: data.checkerNote ? String(data.checkerNote) : undefined,
      status: (data.status ?? "pending") as Expense["status"],
      transactionType: (data.transactionType === "credit" ? "credit" : "debit") as TransactionType,
      createdAt: createdAtValue,
    } satisfies Expense;
  });
}

export async function firebaseCreateExpense(input: {
  accountingHead?: string;
  description: string;
  amount: number;
  purchaseDate: string;
  billImagePath?: string;
  transactionType?: TransactionType;
  session: AppSession;
}) {
  const db = getFirebaseDb();
  if (!db) {
    return;
  }

  const profile = await firebaseEnsureProfileForSession(input.session);
  await addDoc(collection(db, "expenses"), {
    accountingHead: input.accountingHead ?? "",
    description: input.description,
    amount: input.amount,
    purchaseDate: input.purchaseDate,
    billImageUrl: input.billImagePath ?? "",
    createdBy: profile.fullName,
    creatorId: profile.id,
    status: "pending",
    transactionType: input.transactionType === "credit" ? "credit" : "debit",
    createdAt: serverTimestamp(),
  });
}

export async function firebaseUpdateExpenseStatus(
  expenseId: string,
  status: "approved" | "rejected",
  session: AppSession,
  checkerNote?: string,
) {
  const db = getFirebaseDb();
  if (!db) {
    return;
  }

  const profile = await firebaseEnsureProfileForSession(session, "checker");
  await updateDoc(doc(db, "expenses", expenseId), {
    status,
    checkerId: profile.id,
    checkedBy: profile.fullName,
    checkerNote: checkerNote ?? "",
    updatedAt: serverTimestamp(),
  });
}

export async function firebaseUpdateExpense(
  expenseId: string,
  updates: {
    accountingHead?: string;
    description?: string;
    amount?: number;
    purchaseDate?: string;
    billImageUrl?: string;
    transactionType?: TransactionType;
  },
) {
  const db = getFirebaseDb();
  if (!db) {
    return;
  }

  const payload: Record<string, any> = {
    updatedAt: serverTimestamp(),
  };

  if (updates.accountingHead !== undefined) payload.accountingHead = updates.accountingHead;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.amount !== undefined) payload.amount = updates.amount;
  if (updates.purchaseDate !== undefined) payload.purchaseDate = updates.purchaseDate;
  if (updates.billImageUrl !== undefined) payload.billImageUrl = updates.billImageUrl;
  if (updates.transactionType !== undefined) payload.transactionType = updates.transactionType;

  await updateDoc(doc(db, "expenses", expenseId), payload);
}

export async function firebaseUploadBillImage(imageUri: string, userId: string) {
  const storage = getFirebaseStorage();
  if (!storage) {
    return imageUri;
  }

  const fileExt = normalizeAssetExtension(imageUri);
  const path = `expense-bills/${userId}/${Date.now()}.${fileExt}`;
  const fileRef = ref(storage, path);
  const bytes = await readUploadBytes(imageUri);

  await uploadBytes(fileRef, bytes, {
    contentType: getImageMimeType(fileExt),
  });

  return getDownloadURL(fileRef);
}

export function firebaseSubscribeToRealtime(refresh: () => Promise<void>) {
  const db = getFirebaseDb();
  if (!db) {
    return () => undefined;
  }

  const unsubscribeExpenses = onSnapshot(collection(db, "expenses"), () => {
    void refresh();
  });
  const unsubscribeLedger = onSnapshot(doc(db, "cash_ledgers", "main"), () => {
    void refresh();
  });

  return () => {
    unsubscribeExpenses();
    unsubscribeLedger();
  };
}

export async function firebaseSignOut() {
  const auth = getFirebaseAuth();
  if (!auth) {
    return;
  }

  await firebaseAuthSignOut(auth);
}

export async function firebaseSignIn(email: string, password: string) {
  const auth = getFirebaseAuth();
  if (!auth) {
    return;
  }

  await signInWithEmailAndPassword(auth, email, password);
}

export async function firebaseSignUp(email: string, password: string, fullName: string, role: UserRole) {
  const auth = getFirebaseAuth();
  if (!auth) {
    return;
  }

  const credentials = await createUserWithEmailAndPassword(auth, email, password);
  await firebaseUpsertProfile({
    id: credentials.user.uid,
    email,
    fullName,
    role,
  });
}

export async function firebaseSavePushToken(userId: string, token: string) {
  const db = getFirebaseDb();
  if (!db) {
    return;
  }

  await setDoc(
    doc(db, "push_tokens", `${userId}_${token.replace(/[^a-zA-Z0-9]/g, "_")}`),
    {
      userId,
      expoPushToken: token,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
