/**
 * firebase-db.js - Database layer dengan IndexedDB lokal sebagai primary storage.
 * Firebase Firestore digunakan sebagai opsional cloud backup jika tersedia.
 * Strategi ini memastikan aplikasi bekerja 100% tanpa bergantung pada Firestore rules/index.
 */

(function () {
  // Gunakan nama berbeda untuk menghindari konflik dengan firebase-config.js
  const _fbAuth = typeof firebase !== 'undefined' ? firebase.auth() : null;
  const _fbDb = typeof firebase !== 'undefined' ? firebase.firestore() : null;

  const FinanceDB = {
    init: async () => {
      // Prioritas utama: inisialisasi IndexedDB lokal
      if (window.FinanceDBLocal && typeof window.FinanceDBLocal.init === 'function') {
        try {
          await window.FinanceDBLocal.init();
          console.log("FinanceDB (IndexedDB lokal) berhasil diinisialisasi.");
        } catch (e) {
          console.warn("Inisialisasi IndexedDB lokal mengalami masalah:", e);
        }
      }
    },

    // ===== TRANSACTIONS =====
    addTransaction: async (userId, transaction) => {
      const cleanTx = { ...transaction };
      delete cleanTx.id;

      // PRIORITAS: Simpan ke IndexedDB lokal dulu (pasti berhasil)
      if (window.FinanceDBLocal) {
        const result = await window.FinanceDBLocal.addTransaction(userId, cleanTx);
        // Opsional: sinkronisasi ke Firestore di background (tidak blokir UI)
        if (_fbDb) {
          const firestoreData = { ...cleanTx };
          _fbDb.collection('users').doc(String(userId)).collection('transactions')
            .add(firestoreData)
            .catch(e => console.warn("Sinkronisasi Firestore (add tx) gagal (tidak kritis):", e.message));
        }
        return result;
      }
      throw new Error("Database lokal tidak tersedia.");
    },

    getTransactions: async (userId) => {
      // PRIORITAS: Ambil dari IndexedDB lokal
      if (window.FinanceDBLocal) {
        return await window.FinanceDBLocal.getTransactions(userId);
      }
      throw new Error("Database lokal tidak tersedia.");
    },

    updateTransaction: async (userId, transactionId, updates) => {
      const cleanUpdates = { ...updates };
      delete cleanUpdates.id;

      if (window.FinanceDBLocal) {
        const result = await window.FinanceDBLocal.updateTransaction(userId, transactionId, cleanUpdates);
        if (_fbDb) {
          _fbDb.collection('users').doc(String(userId)).collection('transactions')
            .doc(String(transactionId)).update(cleanUpdates)
            .catch(e => console.warn("Sinkronisasi Firestore (update tx) gagal (tidak kritis):", e.message));
        }
        return result;
      }
      throw new Error("Database lokal tidak tersedia.");
    },

    deleteTransaction: async (userId, transactionId) => {
      if (window.FinanceDBLocal) {
        const result = await window.FinanceDBLocal.deleteTransaction(userId, transactionId);
        if (_fbDb) {
          _fbDb.collection('users').doc(String(userId)).collection('transactions')
            .doc(String(transactionId)).delete()
            .catch(e => console.warn("Sinkronisasi Firestore (delete tx) gagal (tidak kritis):", e.message));
        }
        return result;
      }
      throw new Error("Database lokal tidak tersedia.");
    },

    // ===== BUDGETS =====
    addBudget: async (userId, budget) => {
      const cleanBudget = { ...budget };
      delete cleanBudget.id;

      if (window.FinanceDBLocal) {
        const result = await window.FinanceDBLocal.addBudget(userId, cleanBudget);
        if (_fbDb) {
          _fbDb.collection('users').doc(String(userId)).collection('budgets')
            .add(cleanBudget)
            .catch(e => console.warn("Sinkronisasi Firestore (add budget) gagal (tidak kritis):", e.message));
        }
        return result;
      }
      throw new Error("Database lokal tidak tersedia.");
    },

    getBudgets: async (userId) => {
      if (window.FinanceDBLocal) {
        return await window.FinanceDBLocal.getBudgets(userId);
      }
      throw new Error("Database lokal tidak tersedia.");
    },

    deleteBudget: async (userId, budgetId) => {
      if (window.FinanceDBLocal) {
        const result = await window.FinanceDBLocal.deleteBudget(userId, budgetId);
        if (_fbDb) {
          _fbDb.collection('users').doc(String(userId)).collection('budgets')
            .doc(String(budgetId)).delete()
            .catch(e => console.warn("Sinkronisasi Firestore (delete budget) gagal (tidak kritis):", e.message));
        }
        return result;
      }
      throw new Error("Database lokal tidak tersedia.");
    },

    // ===== SAVING GOALS =====
    addSavingGoal: async (userId, goal) => {
      const cleanGoal = { ...goal };
      delete cleanGoal.id;

      if (window.FinanceDBLocal) {
        const result = await window.FinanceDBLocal.addSavingGoal(userId, cleanGoal);
        if (_fbDb) {
          _fbDb.collection('users').doc(String(userId)).collection('savingGoals')
            .add(cleanGoal)
            .catch(e => console.warn("Sinkronisasi Firestore (add goal) gagal (tidak kritis):", e.message));
        }
        return result;
      }
      throw new Error("Database lokal tidak tersedia.");
    },

    getSavingGoals: async (userId) => {
      if (window.FinanceDBLocal) {
        return await window.FinanceDBLocal.getSavingGoals(userId);
      }
      throw new Error("Database lokal tidak tersedia.");
    },

    updateSavingGoal: async (userId, goalId, updates) => {
      const cleanUpdates = { ...updates };
      delete cleanUpdates.id;

      if (window.FinanceDBLocal) {
        const result = await window.FinanceDBLocal.updateSavingGoal(userId, goalId, cleanUpdates);
        if (_fbDb) {
          _fbDb.collection('users').doc(String(userId)).collection('savingGoals')
            .doc(String(goalId)).update(cleanUpdates)
            .catch(e => console.warn("Sinkronisasi Firestore (update goal) gagal (tidak kritis):", e.message));
        }
        return result;
      }
      throw new Error("Database lokal tidak tersedia.");
    },

    deleteSavingGoal: async (userId, goalId) => {
      if (window.FinanceDBLocal) {
        const result = await window.FinanceDBLocal.deleteSavingGoal(userId, goalId);
        if (_fbDb) {
          _fbDb.collection('users').doc(String(userId)).collection('savingGoals')
            .doc(String(goalId)).delete()
            .catch(e => console.warn("Sinkronisasi Firestore (delete goal) gagal (tidak kritis):", e.message));
        }
        return result;
      }
      throw new Error("Database lokal tidak tersedia.");
    }
  };

  // Expose ke window
  window.FinanceDB = FinanceDB;
})();



