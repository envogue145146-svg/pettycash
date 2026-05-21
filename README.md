# Petty Cash Mobile App

Cross-platform Expo React Native app for daily petty cash purchases, approval workflow, and real-time balance visibility across Android and iOS.

## Included now

- Email login and account creation for `creator` and `checker`
- Creator expense submission with description, date, amount, and bill image selection or camera capture
- Checker approval and rejection actions with comment
- Live dashboard totals for cash in hand, approved, pending, and rejected
- Date-wise report filters and A4 voucher PDF export with attached bill image
- Device push token registration for organization-wide notifications
- Firebase-ready shared backend for browser/mobile manager access
- Supabase-ready backend integration for auth, database, storage, and realtime updates
- Google Sheets sync through a Google Apps Script web app for teams already working from Sheets
- Built-in local device mode with zero hosting cost using Expo SQLite key-value storage

## Environment setup

Create `.env` from `.env.example` only if you want cloud sync.

For Firebase browser/mobile access:

- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`

For Supabase cloud sync:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

For Google Sheets sync:

- `EXPO_PUBLIC_GOOGLE_SHEETS_WEB_APP_URL`

## Recommended setup for manager link

1. Configure Firebase keys in `.env`
2. Copy `.firebaserc.example` to `.firebaserc` and replace the placeholder project id
3. Install Firebase CLI with `npm install -g firebase-tools` or use `npx firebase-tools`
4. Sign in with `firebase login`
5. Build the web app with `npm run build:web`
6. Deploy with `npm run deploy:firebase`
7. Share the Firebase Hosting URL with your manager
8. On iPhone Safari, they can use `Share > Add to Home Screen`

## Local mode

1. Leave both Firebase and Supabase variables empty
2. Run the app
3. Create an account on the device
4. Expenses, approvals, roles, and bill image paths will persist locally on that device

## Google Sheets setup

1. Open your Google Sheet
2. Open `Extensions > Apps Script`
3. Paste the code from [scripts/google-apps-script.gs](D:/New%20folder/PETTY%20CASH/scripts/google-apps-script.gs)
4. Save and deploy it as a Web App
5. Set access to `Anyone with the link`
6. Copy the Web App URL into `.env` as `EXPO_PUBLIC_GOOGLE_SHEETS_WEB_APP_URL`
7. Leave Firebase and Supabase variables empty if you want Sheets mode only
8. Start the app and create local phone accounts

This mode keeps sign-in accounts on the phone, while expenses and ledger sync through Google Sheets.

## Firebase setup

1. Create a Firebase project
2. Enable Email/Password sign-in in Firebase Authentication
3. Create a Firestore database
4. Create a Storage bucket
5. Add a Firebase web app in Project Settings and copy its keys into `.env`
6. Publish the included [firestore.rules](D:/New%20folder/PETTY%20CASH/firestore.rules) and [storage.rules](D:/New%20folder/PETTY%20CASH/storage.rules)
7. Build the Expo web app with `npm run build:web`
8. Deploy with `npm run deploy:firebase`

## Supabase setup

1. Run `supabase/schema.sql` in the Supabase SQL editor
2. Create a public storage bucket named `expense-bills`
3. Deploy the Edge Function in `supabase/functions/notify-expense-users`
4. Add the `EXPO_ACCESS_TOKEN` secret to Supabase Edge Functions
5. Add storage policies so authenticated users can upload and read bill images
6. If email confirmation is enabled, confirm new users before sign-in
7. If your app was already deployed before May 8, 2026, re-run `supabase/schema.sql` so the first signed-in user can create the default ledger

## Run

1. Install dependencies with `npm install`
2. Start Expo with `npm run start`
3. Press `a` for Android or `i` for iOS simulator
4. For browser testing, run `npm run web`

## Notes

- Firebase is the best fit when you want a shareable browser link for managers
- Google Sheets mode is the best fit when you already track petty cash in Sheets and want the app to read and write the same data
- Without cloud keys, the app uses local device storage instead of shared sync
- Realtime refresh listens to both `expenses` and `cash_ledgers` when Supabase is enabled
- Realtime refresh listens to Firestore changes when Firebase is enabled
- Google Sheets mode polls for updates periodically because Sheets does not provide app realtime subscriptions here
- Role changes are stored in local storage, Firebase `profiles`, or the Supabase `profiles` table, depending on backend mode
- In Google Sheets mode, phone account login stays local to each device
- Push notifications need a real device and an Expo development build, not an Android emulator or iOS simulator
