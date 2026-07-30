/**
 * firebase-db.js - Handles all Firebase (Firestore) related operations
 * with automatic fallback to local IndexedDB if Firestore fails or rules block access.
 */

const auth = firebase.auth();
const db = firebase.firestore();

function getCurrentUserUid() {
  const user = auth.currentUser;
  if (!user) {
    window.location.href = 'index.html';
    throw new Error("Tidak ada pengguna terautentikasi.");
  }
  return user.uid;
}

const FinanceDB = {
  init: async () => {
    if (window.FinanceDBLocal && typeof window.FinanceDBLocal.init === 'function') {
      try {
        await window.FinanceDBLocal.init();
      } catch (e) {
        console.warn("Inisialisasi database lokal mengalami masalah:", e);
      }
    }
    console.log("FinanceDB initialized.");
  },

  // Transactions
  addTransaction: async (userId, transaction) => {
    const cleanTx = { ...transaction };
    delete cleanTx.id;
    try {
      const docRef = await db.collection('users').doc(String(userId)).collection('transactions').add(cleanTx);
      return { ...cleanTx, id: docRef.id };
    } catch (error) {
      console.warn("Firestore addTransaction gagal, mencoba menyimpan ke database lokal IndexedDB:", error);
      if (window.FinanceDBLocal) {
        return await window.FinanceDBLocal.addTransaction(userId, cleanTx);
      }
      throw error;
    }
  },

  getTransactions: async (userId) => {
    try {
      const snapshot = await db.collection('users').doc(String(userId)).collection('transactions').orderBy('date', 'desc').get();
      const items = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      if (window.FinanceDBLocal) {
        const localItems = await window.FinanceDBLocal.getTransactions(userId).catch(() => []);
        if (items.length === 0 && localItems.length > 0) return localItems;
      }
      return items;
    } catch (error) {
      console.warn("Firestore getTransactions gagal, mengambil dari database lokal IndexedDB:", error);
      if (window.FinanceDBLocal) {
        return await window.FinanceDBLocal.getTransactions(userId);
      }
      throw error;
    }
  },

  updateTransaction: async (userId, transactionId, updates) => {
    const cleanUpdates = { ...updates };
    delete cleanUpdates.id;
    try {
      await db.collection('users').doc(String(userId)).collection('transactions').doc(String(transactionId)).update(cleanUpdates);
      return { ...cleanUpdates, id: transactionId };
    } catch (error) {
      console.warn("Firestore updateTransaction gagal, memperbarui di database lokal IndexedDB:", error);
      if (window.FinanceDBLocal) {
        return await window.FinanceDBLocal.updateTransaction(userId, transactionId, cleanUpdates);
      }
      throw error;
    }
  },

  deleteTransaction: async (userId, transactionId) => {
    try {
      await db.collection('users').doc(String(userId)).collection('transactions').doc(String(transactionId)).delete();
      if (window.FinanceDBLocal) {
        await window.FinanceDBLocal.deleteTransaction(userId, transactionId).catch(() => {});
      }
      return true;
    } catch (error) {
      console.warn("Firestore deleteTransaction gagal, menghapus di database lokal IndexedDB:", error);
      if (window.FinanceDBLocal) {
        return await window.FinanceDBLocal.deleteTransaction(userId, transactionId);
      }
      throw error;
    }
  },

  // Budgets
  addBudget: async (userId, budget) => {
    const cleanBudget = { ...budget };
    delete cleanBudget.id;
    try {
      const docRef = await db.collection('users').doc(String(userId)).collection('budgets').add(cleanBudget);
      return { ...cleanBudget, id: docRef.id };
    } catch (error) {
      console.warn("Firestore addBudget gagal, mencoba ke database lokal IndexedDB:", error);
      if (window.FinanceDBLocal) {
        return await window.FinanceDBLocal.addBudget(userId, cleanBudget);
      }
      throw error;
    }
  },

  getBudgets: async (userId) => {
    try {
      const snapshot = await db.collection('users').doc(String(userId)).collection('budgets').get();
      const items = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      if (window.FinanceDBLocal) {
        const localItems = await window.FinanceDBLocal.getBudgets(userId).catch(() => []);
        if (items.length === 0 && localItems.length > 0) return localItems;
      }
      return items;
    } catch (error) {
      console.warn("Firestore getBudgets gagal, mengambil dari database lokal IndexedDB:", error);
      if (window.FinanceDBLocal) {
        return await window.FinanceDBLocal.getBudgets(userId);
      }
      throw error;
    }
  },

  deleteBudget: async (userId, budgetId) => {
    try {
      await db.collection('users').doc(String(userId)).collection('budgets').doc(String(budgetId)).delete();
      if (window.FinanceDBLocal) {
        await window.FinanceDBLocal.deleteBudget(userId, budgetId).catch(() => {});
      }
      return true;
    } catch (error) {
      console.warn("Firestore deleteBudget gagal, menghapus di database lokal IndexedDB:", error);
      if (window.FinanceDBLocal) {
        return await window.FinanceDBLocal.deleteBudget(userId, budgetId);
      }
      throw error;
    }
  },

  // Saving Goals
  addSavingGoal: async (userId, goal) => {
    const cleanGoal = { ...goal };
    delete cleanGoal.id;
    try {
      const docRef = await db.collection('users').doc(String(userId)).collection('savingGoals').add(cleanGoal);
      return { ...cleanGoal, id: docRef.id };
    } catch (error) {
      console.warn("Firestore addSavingGoal gagal, mencoba ke database lokal IndexedDB:", error);
      if (window.FinanceDBLocal) {
        return await window.FinanceDBLocal.addSavingGoal(userId, cleanGoal);
      }
      throw error;
    }
  },

  getSavingGoals: async (userId) => {
    try {
      const snapshot = await db.collection('users').doc(String(userId)).collection('savingGoals').get();
      const items = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      if (window.FinanceDBLocal) {
        const localItems = await window.FinanceDBLocal.getSavingGoals(userId).catch(() => []);
        if (items.length === 0 && localItems.length > 0) return localItems;
      }
      return items;
    } catch (error) {
      console.warn("Firestore getSavingGoals gagal, mengambil dari database lokal IndexedDB:", error);
      if (window.FinanceDBLocal) {
        return await window.FinanceDBLocal.getSavingGoals(userId);
      }
      throw error;
    }
  },

  updateSavingGoal: async (userId, goalId, updates) => {
    const cleanUpdates = { ...updates };
    delete cleanUpdates.id;
    try {
      await db.collection('users').doc(String(userId)).collection('savingGoals').doc(String(goalId)).update(cleanUpdates);
      return { ...cleanUpdates, id: goalId };
    } catch (error) {
      console.warn("Firestore updateSavingGoal gagal, memperbarui di database lokal IndexedDB:", error);
      if (window.FinanceDBLocal) {
        return await window.FinanceDBLocal.updateSavingGoal(userId, goalId, cleanUpdates);
      }
      throw error;
    }
  },

  deleteSavingGoal: async (userId, goalId) => {
    try {
      await db.collection('users').doc(String(userId)).collection('savingGoals').doc(String(goalId)).delete();
      if (window.FinanceDBLocal) {
        await window.FinanceDBLocal.deleteSavingGoal(userId, goalId).catch(() => {});
      }
      return true;
    } catch (error) {
      console.warn("Firestore deleteSavingGoal gagal, menghapus di database lokal IndexedDB:", error);
      if (window.FinanceDBLocal) {
        return await window.FinanceDBLocal.deleteSavingGoal(userId, goalId);
      }
      throw error;
    }
  }
};

// Expose to window object
window.FinanceDB = FinanceDB;


