/**
 * firebase-db.js - Handles all Firebase (Firestore) related operations.
 * Authentication logic is now handled in auth.js.
 */

// Firebase `auth` and `db` are initialized in `auth.js` or `index.html` for redirection
// For home.html, we just need to access the already initialized firebase app and firestore.
const auth = firebase.auth();
const db = firebase.firestore();

// Function to get the current user's UID safely
function getCurrentUserUid() {
  const user = auth.currentUser;
  if (!user) {
    console.error("No authenticated user found for DB operation.");
    // In home.html, this should ideally not happen due to the auth check and redirect.
    // However, as a fallback, we might redirect to index.html or login.html
    window.location.href = 'index.html'; // Redirect to initial loader/login
    throw new Error("No authenticated user.");
  }
  return user.uid;
}

// Firestore Operations
const FinanceDB = {
  // Initialize FinanceDB (ensure Firebase is initialized before calling this)
  init: async () => {
    // This function is now mainly for ensuring Firestore access is ready.
    // No specific initialization needed here if Firebase is already set up globally.
    // We can use it to perform any initial checks or setup if necessary.
    console.log("FinanceDB initialized.");
  },

  // Transactions
  addTransaction: async (userId, transaction) => {
    try {
      const docRef = await db.collection('users').doc(userId).collection('transactions').add(transaction);
      return { id: docRef.id, ...transaction };
    } catch (error) {
      console.error("Error adding transaction:", error);
      throw error;
    }
  },

  getTransactions: async (userId) => {
    try {
      const snapshot = await db.collection('users').doc(userId).collection('transactions').orderBy('date', 'desc').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error("Error getting transactions:", error);
      throw error;
    }
  },

  updateTransaction: async (userId, transactionId, updates) => {
    try {
      await db.collection('users').doc(userId).collection('transactions').doc(transactionId).update(updates);
    } catch (error) {
      console.error("Error updating transaction:", error);
      throw error;
    }
  },

  deleteTransaction: async (userId, transactionId) => {
    try {
      await db.collection('users').doc(userId).collection('transactions').doc(transactionId).delete();
    } catch (error) {
      console.error("Error deleting transaction:", error);
      throw error;
    }
  },

  // Budgets
  addBudget: async (userId, budget) => {
    try {
      const docRef = await db.collection('users').doc(userId).collection('budgets').add(budget);
      return { id: docRef.id, ...budget };
    } catch (error) {
      console.error("Error adding budget:", error);
      throw error;
    }
  },

  getBudgets: async (userId) => {
    try {
      const snapshot = await db.collection('users').doc(userId).collection('budgets').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error("Error getting budgets:", error);
      throw error;
    }
  },

  deleteBudget: async (userId, budgetId) => {
    try {
      await db.collection('users').doc(userId).collection('budgets').doc(budgetId).delete();
    } catch (error) {
      console.error("Error deleting budget:", error);
      throw error;
    }
  },

  // Saving Goals
  addSavingGoal: async (userId, goal) => {
    try {
      const docRef = await db.collection('users').doc(userId).collection('savingGoals').add(goal);
      return { id: docRef.id, ...goal };
    } catch (error) {
      console.error("Error adding saving goal:", error);
      throw error;
    }
  },

  getSavingGoals: async (userId) => {
    try {
      const snapshot = await db.collection('users').doc(userId).collection('savingGoals').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error("Error getting saving goals:", error);
      throw error;
    }
  },

  updateSavingGoal: async (userId, goalId, updates) => {
    try {
      await db.collection('users').doc(userId).collection('savingGoals').doc(goalId).update(updates);
    } catch (error) {
      console.error("Error updating saving goal:", error);
      throw error;
    }
  },

  deleteSavingGoal: async (userId, goalId) => {
    try {
      await db.collection('users').doc(userId).collection('savingGoals').doc(goalId).delete();
    } catch (error) {
      console.error("Error deleting saving goal:", error);
      throw error;
    }
  }
};

// Expose to window object
window.FinanceDB = FinanceDB;

