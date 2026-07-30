/**
 * firebase-config.js
 * Konfigurasi Firebase — hanya Auth yang diinisialisasi di sini.
 * Firestore dikelola terpisah di firebase-db.js untuk menghindari konflik deklarasi variabel.
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

