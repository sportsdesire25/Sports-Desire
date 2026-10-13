// Sports Desire - Firebase Authentication Configuration
// -------------------------------------------------------------
// Instructions to get your keys in 2 minutes:
// 1. Visit https://console.firebase.google.com/ and click "Add project" (Name it "Sports Desire")
// 2. Click the Web icon (</>) to register a web app.
// 3. Copy your firebaseConfig credentials and paste them below.
// 4. In the Firebase Console, go to "Build" -> "Authentication" -> "Sign-in method"
//    and enable:
//    - Google
//    - Email/Password
//    - Phone
// -------------------------------------------------------------

export const firebaseConfig = {
  apiKey: "AIzaSyCxv4rdvtTlKqysEhDrcGbxNBi553zzkv0",
  authDomain: "sports-desire.firebaseapp.com",
  projectId: "sports-desire",
  storageBucket: "sports-desire.firebasestorage.app",
  messagingSenderId: "895495466899",
  appId: "1:895495466899:web:7d558dea1eca8be15c0266",
  measurementId: "G-ZC08XMJ128"
};

// Returns true if the user has inserted their real Firebase credentials
export function isFirebaseConfigured() {
  return firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("YOUR_API_KEY");
}
