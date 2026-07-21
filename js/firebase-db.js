/**
 * firebase-db.js - Firebase (Firestore & Auth) Wrapper for Personal Finance Manager
 * Replaces db.js to provide cross-device sync and Google Authentication.
 */

(function () {
  // Firebase configuration
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
  let app;
  let auth;
  let db;

  try {
    app = firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
  } catch (err) {
    console.error("Firebase initialization error", err);
  }

  const FinanceDB = {
    async init() {
      // Firebase initializes synchronously in compat mode, so we just resolve.
      return Promise.resolve();
    },

    /**
     * Hash password (kept for backward compatibility with local register,
     * but usually Firebase handles passwords natively. We'll use Firebase Auth for custom email/pass if we want,
     * but here we adapt to the existing app flow, although it's better to use Firebase Auth fully.
     * To keep it simple and match the interface, we'll store local users in Firestore if they use the regular form,
     * OR we can use Firebase Auth for email/password.
     * Let's adapt to use Firebase Auth for everything!
     */

    // ================== AUTH ==================

    async registerUser(username, password) {
      // Because we used 'username' and Firebase uses 'email', we'll create a pseudo-email
      // if the user doesn't provide one, e.g., username@yourdomain.com.
      // Alternatively, we prompt the user to use email. Assuming username doesn't have @:
      const email = username.includes("@") ? username : username + "@moneymanager.local";

      try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Save user profile in firestore
        await db.collection("users").doc(user.uid).set({
          username: username,
          email: user.email,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });

        return {
          id: user.uid,
          username: username,
          email: user.email,
        };
      } catch (error) {
        throw new Error("Gagal mendaftar: " + error.message);
      }
    },

    async loginUser(username, password) {
      const email = username.includes("@") ? username : username + "@moneymanager.local";
      try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;

        const doc = await db.collection("users").doc(user.uid).get();
        let displayUsername = username;
        if (doc.exists) {
          displayUsername = doc.data().username;
        }

        return {
          id: user.uid,
          username: displayUsername,
          email: user.email,
        };
      } catch (error) {
        throw new Error("Login gagal. Periksa username dan password Anda.");
      }
    },

    async loginWithGoogle() {
      const provider = new firebase.auth.GoogleAuthProvider();
      try {
        const userCredential = await auth.signInWithPopup(provider);
        const user = userCredential.user;

        // Simpan profil di firestore jika belum ada
        const userRef = db.collection("users").doc(user.uid);
        const doc = await userRef.get();
        if (!doc.exists) {
          await userRef.set({
            username: user.displayName || user.email.split("@")[0],
            email: user.email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
        }

        return {
          id: user.uid,
          username: user.displayName || user.email.split("@")[0],
          email: user.email,
        };
      } catch (error) {
        throw new Error("Login Google gagal: " + error.message);
      }
    },

    async logoutUser() {
      await auth.signOut();
    },

    // Subscribe to Firebase auth state changes
    onAuthStateChanged(callback) {
      auth.onAuthStateChanged(callback);
    },

    // ================== TRANSACTIONS ==================

    async addTransaction(userId, type, amount, category, date, description = "") {
      if (!userId || !type || !amount || !category || !date) {
        throw new Error("Data transaksi tidak lengkap.");
      }

      const tx = {
        userId,
        type,
        amount: parseFloat(amount),
        category,
        date,
        description: description.trim(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      };

      try {
        const docRef = await db.collection("transactions").add(tx);
        return { ...tx, id: docRef.id };
      } catch (error) {
        throw new Error("Gagal menyimpan transaksi: " + error.message);
      }
    },

    async getTransactions(userId) {
      try {
        const snapshot = await db
          .collection("transactions")
          .where("userId", "==", userId)
          // Firebase requires index for multiple fields ordering.
          // We'll order by date locally to avoid forcing user to create composite index right away.
          .get();

        let list = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() });
        });

        list.sort((a, b) => new Date(b.date) - new Date(a.date));
        return list;
      } catch (error) {
        throw new Error("Gagal mengambil transaksi: " + error.message);
      }
    },

    async deleteTransaction(txId) {
      try {
        await db.collection("transactions").doc(txId).delete();
        return true;
      } catch (error) {
        throw new Error("Gagal menghapus transaksi: " + error.message);
      }
    },

    // ================== BUDGETS ==================

    async addBudget(userId, category, amount) {
      if (!userId || !category || !amount) {
        throw new Error("Data anggaran tidak lengkap.");
      }
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        throw new Error("Batas nominal harus berupa angka yang valid dan lebih dari 0.");
      }

      try {
        // Cek jika kategori sudah ada untuk user ini
        const snapshot = await db.collection("budgets").where("userId", "==", userId).where("category", "==", category).get();

        if (!snapshot.empty) {
          // Update yang sudah ada
          const docId = snapshot.docs[0].id;
          await db.collection("budgets").doc(docId).update({ limitAmount: numAmount });
          return { id: docId, userId, category, limitAmount: numAmount };
        } else {
          // Buat baru
          const budget = {
            userId,
            category,
            limitAmount: numAmount,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          };
          const docRef = await db.collection("budgets").add(budget);
          return { ...budget, id: docRef.id };
        }
      } catch (error) {
        throw new Error("Gagal memproses batas anggaran: " + error.message);
      }
    },

    async getBudgets(userId) {
      try {
        const snapshot = await db.collection("budgets").where("userId", "==", userId).get();
        let list = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() });
        });
        return list;
      } catch (error) {
        throw new Error("Gagal mengambil data anggaran: " + error.message);
      }
    },

    async deleteBudget(budgetId) {
      try {
        await db.collection("budgets").doc(budgetId).delete();
        return true;
      } catch (error) {
        throw new Error("Gagal menghapus batas anggaran: " + error.message);
      }
    },

    // ================== SAVING GOALS ==================

    async addSavingGoal(userId, name, targetAmount, description = "", emoji = "??") {
      const amount = parseFloat(targetAmount);

      if (!name || !name.trim()) {
        throw new Error("Nama target tidak boleh kosong.");
      }
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Nominal target harus lebih besar dari 0.");
      }

      const goal = {
        userId,
        name: name.trim(),
        targetAmount: amount,
        description: description.trim(),
        emoji: emoji || "??",
        achieved: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      };

      try {
        const docRef = await db.collection("savingGoals").add(goal);
        return { ...goal, id: docRef.id };
      } catch (error) {
        throw new Error("Gagal menyimpan target menabung: " + error.message);
      }
    },

    async getSavingGoals(userId) {
      try {
        const snapshot = await db.collection("savingGoals").where("userId", "==", userId).get();
        let list = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() });
        });
        // Sort
        list.sort((a, b) => {
          const timeA = a.createdAt ? a.createdAt.toMillis() : 0;
          const timeB = b.createdAt ? b.createdAt.toMillis() : 0;
          return timeA - timeB;
        });
        return list;
      } catch (error) {
        throw new Error("Gagal mengambil data target menabung: " + error.message);
      }
    },

    async deleteSavingGoal(goalId) {
      try {
        await db.collection("savingGoals").doc(goalId).delete();
        return true;
      } catch (error) {
        throw new Error("Gagal menghapus target menabung: " + error.message);
      }
    },
  };

  // Expose to window object
  window.FinanceDB = FinanceDB;
})();
