/**
 * firebase-config.js
 * Konfigurasi asli Firebase.
 *
 * PENTING: Ganti konfigurasi di bawah ini dengan config dari Firebase Console Anda!
 */

const firebaseConfig = {
  apiKey: "AIzaSyANymNoR7UapOad3nzlah-lGgCsex85cGw",
  authDomain: "dompetku-finance-e63a9.firebaseapp.com",
  projectId: "dompetku-finance-e63a9",
  storageBucket: "dompetku-finance-e63a9.firebasestorage.app",
  messagingSenderId: "764015136610",
  appId: "1:764015136610:web:5e98afdfb55d743c9d263b",
  measurementId: "G-9XZ0N2Y7XV",
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Inisialisasi service agar siap dipakai di file lain
const auth = firebase.auth();
const db = firebase.firestore();

// Aktifkan mode offline sementara (opsional) agar saat offline data masih bisa diakses
db.enablePersistence().catch((err) => {
  if (err.code == "failed-precondition") {
    // Multiple tabs open, persistence can only be cleared in one tab at a a time.
    console.warn("Multiple tabs open, persistence failed.");
  } else if (err.code == "unimplemented") {
    // The current browser does not support all of the features required to enable persistence
    console.warn("Browser tidak mendukung persistence offline.");
  }
});
