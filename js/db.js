/**
 * db.js - IndexedDB & Cryptography Wrapper for Personal Finance Manager
 * Implements client-side user accounts, transactions, and category budget limits.
 */

(function () {
  const DB_NAME = 'MoneyManagerDB';
  const DB_VERSION = 2;
  let dbInstance = null;

  const FinanceDB = {
    /**
     * Initialize the IndexedDB database
     * @returns {Promise<IDBDatabase>}
     */
    init() {
      return new Promise((resolve, reject) => {
        if (dbInstance) {
          resolve(dbInstance);
          return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
          console.error('Database failed to open:', event.target.error);
          reject(event.target.error);
        };

        request.onsuccess = (event) => {
          dbInstance = event.target.result;
          resolve(dbInstance);
        };

        request.onupgradeneeded = (event) => {
          const db = event.target.result;

          // 1. Users Store
          if (!db.objectStoreNames.contains('users')) {
            const userStore = db.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
            userStore.createIndex('username', 'username', { unique: true });
          }

          // 2. Transactions Store
          if (!db.objectStoreNames.contains('transactions')) {
            const txStore = db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
            txStore.createIndex('userId', 'userId', { unique: false });
            txStore.createIndex('date', 'date', { unique: false });
          }

          // 3. Budgets Store
          if (!db.objectStoreNames.contains('budgets')) {
            const budgetStore = db.createObjectStore('budgets', { keyPath: 'id', autoIncrement: true });
            budgetStore.createIndex('userId', 'userId', { unique: false });
            budgetStore.createIndex('userId_category', ['userId', 'category'], { unique: true });
          }

          // 4. Saving Goals Store
          if (!db.objectStoreNames.contains('savingGoals')) {
            const goalsStore = db.createObjectStore('savingGoals', { keyPath: 'id', autoIncrement: true });
            goalsStore.createIndex('userId', 'userId', { unique: false });
          }
        };
      });
    },

    /**
     * Hash a password using SHA-256 via Web Crypto API
     * @param {string} password 
     * @returns {Promise<string>} Hex string of hash
     */
    async hashPassword(password) {
      const msgUint8 = new TextEncoder().encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    },

    /**
     * Register a new user
     * @param {string} username 
     * @param {string} password 
     * @returns {Promise<object>} User object without password
     */
    async registerUser(username, password) {
      const db = await this.init();
      const cleanUsername = username.trim().toLowerCase();
      if (!cleanUsername || !password) {
        throw new Error('Username dan Password tidak boleh kosong.');
      }

      const passwordHash = await this.hashPassword(password);

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['users'], 'readwrite');
        const store = transaction.objectStore('users');
        const usernameIndex = store.index('username');
        const checkRequest = usernameIndex.get(cleanUsername);

        checkRequest.onsuccess = () => {
          if (checkRequest.result) {
            reject(new Error('Username sudah terdaftar. Silakan pilih username lain.'));
            return;
          }

          const newUser = {
            username: cleanUsername,
            passwordHash,
            createdAt: new Date().toISOString()
          };

          const addRequest = store.add(newUser);

          addRequest.onsuccess = (event) => {
            resolve({
              id: event.target.result,
              username: cleanUsername,
              createdAt: newUser.createdAt
            });
          };

          addRequest.onerror = () => {
            reject(new Error('Gagal menyimpan user ke database.'));
          };
        };

        checkRequest.onerror = () => {
          reject(new Error('Gagal memeriksa ketersediaan username.'));
        };
      });
    },

    /**
     * Authenticate a user
     * @param {string} username 
     * @param {string} password 
     * @returns {Promise<object>} User object
     */
    async loginUser(username, password) {
      const db = await this.init();
      const cleanUsername = username.trim().toLowerCase();
      if (!cleanUsername || !password) {
        throw new Error('Username dan Password tidak boleh kosong.');
      }

      const passwordHash = await this.hashPassword(password);

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['users'], 'readonly');
        const store = transaction.objectStore('users');
        const usernameIndex = store.index('username');
        const request = usernameIndex.get(cleanUsername);

        request.onsuccess = () => {
          const user = request.result;
          if (!user) {
            reject(new Error('Username tidak ditemukan.'));
            return;
          }

          if (user.passwordHash !== passwordHash) {
            reject(new Error('Password salah.'));
            return;
          }

          resolve({
            id: user.id,
            username: user.username,
            createdAt: user.createdAt
          });
        };

        request.onerror = () => {
          reject(new Error('Gagal melakukan proses login.'));
        };
      });
    },

    /**
     * Add a transaction
     * @param {string|number} userId 
     * @param {object} transaction
     * @returns {Promise<object>} Transaction object
     */
    async addTransaction(userId, transaction) {
      const db = await this.init();
      const numericId = Number(userId);
      const uId = isNaN(numericId) ? userId : numericId;
      const tx = {
        userId: uId,
        type: transaction.type, // 'income' or 'expense'
        amount: parseFloat(transaction.amount),
        category: transaction.category,
        date: transaction.date, // YYYY-MM-DD
        description: (transaction.description || '').trim(),
        createdAt: transaction.createdAt || new Date().toISOString()
      };

      if (isNaN(tx.amount) || tx.amount <= 0) {
        throw new Error('Jumlah uang harus lebih besar dari 0.');
      }
      if (!tx.category) {
        throw new Error('Kategori harus dipilih.');
      }
      if (!tx.date) {
        throw new Error('Tanggal harus diisi.');
      }

      return new Promise((resolve, reject) => {
        const transactionStore = db.transaction(['transactions'], 'readwrite');
        const store = transactionStore.objectStore('transactions');
        const request = store.add(tx);

        request.onsuccess = (event) => {
          tx.id = event.target.result;
          resolve(tx);
        };

        request.onerror = () => {
          reject(new Error('Gagal menyimpan transaksi.'));
        };
      });
    },

    /**
     * Update a transaction
     * @param {string|number} userId 
     * @param {number} transactionId 
     * @param {object} updates 
     * @returns {Promise<object>} Updated transaction
     */
    async updateTransaction(userId, transactionId, updates) {
      const db = await this.init();
      const id = Number(transactionId) || transactionId;
      return new Promise((resolve, reject) => {
        const transactionStore = db.transaction(['transactions'], 'readwrite');
        const store = transactionStore.objectStore('transactions');
        const getReq = store.get(id);
        
        getReq.onsuccess = () => {
          const data = getReq.result;
          if (!data) {
            reject(new Error('Transaksi tidak ditemukan.'));
            return;
          }
          if (updates.type) data.type = updates.type;
          if (updates.amount) data.amount = parseFloat(updates.amount);
          if (updates.category) data.category = updates.category;
          if (updates.date) data.date = updates.date;
          if (updates.description !== undefined) data.description = updates.description.trim();
          
          const putReq = store.put(data);
          putReq.onsuccess = () => resolve(data);
          putReq.onerror = () => reject(new Error('Gagal memperbarui transaksi.'));
        };
        getReq.onerror = () => reject(new Error('Gagal mencari transaksi untuk diperbarui.'));
      });
    },

    /**
     * Get all transactions for a user
     * @param {string|number} userId 
     * @returns {Promise<Array>} List of transactions sorted by date descending
     */
    async getTransactions(userId) {
      const db = await this.init();
      const numericId = Number(userId);
      const searchId = isNaN(numericId) ? userId : numericId;
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['transactions'], 'readonly');
        const store = transaction.objectStore('transactions');
        const userIdIndex = store.index('userId');
        const request = userIdIndex.getAll(searchId);

        request.onsuccess = () => {
          const list = request.result;
          list.sort((a, b) => {
            const dateCompare = b.date.localeCompare(a.date);
            if (dateCompare !== 0) return dateCompare;
            return b.id - a.id;
          });
          resolve(list);
        };

        request.onerror = () => {
          reject(new Error('Gagal mengambil data transaksi.'));
        };
      });
    },

    /**
     * Delete a transaction by ID
     * @param {string|number} userId 
     * @param {number} transactionId 
     * @returns {Promise<boolean>}
     */
    async deleteTransaction(userId, transactionId) {
      const db = await this.init();
      const id = Number(transactionId) || transactionId;
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['transactions'], 'readwrite');
        const store = transaction.objectStore('transactions');
        const request = store.delete(id);

        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(new Error('Gagal menghapus transaksi.'));
      });
    },

    /**
     * Add a budget limit for a category
     * @param {string|number} userId 
     * @param {object} budget 
     * @returns {Promise<object>} Budget object
     */
    async addBudget(userId, budget) {
      const db = await this.init();
      const numericId = Number(userId);
      const uId = isNaN(numericId) ? userId : numericId;
      const amount = parseFloat(budget.amount);

      if (isNaN(amount) || amount < 0) {
        throw new Error('Batas nominal tidak valid.');
      }

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['budgets'], 'readwrite');
        const store = transaction.objectStore('budgets');
        const index = store.index('userId_category');
        const getRequest = index.get([uId, budget.category]);

        getRequest.onsuccess = () => {
          const existingBudget = getRequest.result;
          if (existingBudget) {
            existingBudget.amount = amount;
            existingBudget.type = budget.type;
            existingBudget.updatedAt = new Date().toISOString();
            const updateRequest = store.put(existingBudget);
            updateRequest.onsuccess = () => resolve(existingBudget);
            updateRequest.onerror = () => reject(new Error('Gagal memperbarui batas anggaran.'));
          } else {
            const newBudget = {
              userId: uId,
              category: budget.category,
              amount: amount,
              type: budget.type,
              createdAt: new Date().toISOString()
            };
            const addRequest = store.add(newBudget);
            addRequest.onsuccess = (event) => {
              newBudget.id = event.target.result;
              resolve(newBudget);
            };
            addRequest.onerror = () => reject(new Error('Gagal menyimpan batas anggaran baru.'));
          }
        };

        getRequest.onerror = () => {
          reject(new Error('Gagal memproses batas anggaran.'));
        };
      });
    },

    /**
     * Get all budgets/limits for a user
     * @param {string|number} userId 
     * @returns {Promise<Array>} List of budgets
     */
    async getBudgets(userId) {
      const db = await this.init();
      const numericId = Number(userId);
      const searchId = isNaN(numericId) ? userId : numericId;
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['budgets'], 'readonly');
        const store = transaction.objectStore('budgets');
        const index = store.index('userId');
        const request = index.getAll(searchId);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(new Error('Gagal mengambil data anggaran.'));
      });
    },

    /**
     * Delete a budget limit
     * @param {string|number} userId 
     * @param {number} budgetId 
     * @returns {Promise<boolean>}
     */
    async deleteBudget(userId, budgetId) {
      const db = await this.init();
      const id = Number(budgetId) || budgetId;
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['budgets'], 'readwrite');
        const store = transaction.objectStore('budgets');
        const request = store.delete(id);

        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(new Error('Gagal menghapus batas anggaran.'));
      });
    },

    /**
     * Add a new saving goal
     * @param {string|number} userId
     * @param {object} goal
     * @returns {Promise<object>} Saving goal object
     */
    async addSavingGoal(userId, goal) {
      const db = await this.init();
      const numericId = Number(userId);
      const uId = isNaN(numericId) ? userId : numericId;
      const targetAmount = parseFloat(goal.targetAmount);

      if (!goal.name || !goal.name.trim()) {
        throw new Error('Nama target tidak boleh kosong.');
      }
      if (isNaN(targetAmount) || targetAmount <= 0) {
        throw new Error('Nominal target harus lebih besar dari 0.');
      }

      const newGoal = {
        userId: uId,
        name: goal.name.trim(),
        targetAmount: targetAmount,
        currentAmount: parseFloat(goal.currentAmount) || 0,
        description: (goal.description || '').trim(),
        emoji: goal.emoji || '🎯',
        createdAt: goal.createdAt || new Date().toISOString()
      };

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['savingGoals'], 'readwrite');
        const store = transaction.objectStore('savingGoals');
        const request = store.add(newGoal);

        request.onsuccess = (event) => {
          newGoal.id = event.target.result;
          resolve(newGoal);
        };

        request.onerror = () => {
          reject(new Error('Gagal menyimpan target menabung.'));
        };
      });
    },

    /**
     * Update a saving goal
     * @param {string|number} userId 
     * @param {number} goalId 
     * @param {object} updates 
     * @returns {Promise<object>} Updated saving goal
     */
    async updateSavingGoal(userId, goalId, updates) {
      const db = await this.init();
      const id = Number(goalId) || goalId;
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['savingGoals'], 'readwrite');
        const store = transaction.objectStore('savingGoals');
        const getReq = store.get(id);

        getReq.onsuccess = () => {
          const data = getReq.result;
          if (!data) {
            reject(new Error('Target menabung tidak ditemukan.'));
            return;
          }
          if (updates.name !== undefined) data.name = updates.name.trim();
          if (updates.targetAmount !== undefined) data.targetAmount = parseFloat(updates.targetAmount);
          if (updates.currentAmount !== undefined) data.currentAmount = parseFloat(updates.currentAmount);
          if (updates.description !== undefined) data.description = updates.description.trim();
          if (updates.emoji !== undefined) data.emoji = updates.emoji;

          const putReq = store.put(data);
          putReq.onsuccess = () => resolve(data);
          putReq.onerror = () => reject(new Error('Gagal memperbarui target menabung.'));
        };
        getReq.onerror = () => reject(new Error('Gagal mencari target menabung untuk diperbarui.'));
      });
    },

    /**
     * Get all saving goals for a user
     * @param {string|number} userId
     * @returns {Promise<Array>} List of saving goals
     */
    async getSavingGoals(userId) {
      const db = await this.init();
      const numericId = Number(userId);
      const searchId = isNaN(numericId) ? userId : numericId;
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['savingGoals'], 'readonly');
        const store = transaction.objectStore('savingGoals');
        const index = store.index('userId');
        const request = index.getAll(searchId);

        request.onsuccess = () => {
          const list = request.result;
          list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
          resolve(list);
        };

        request.onerror = () => {
          reject(new Error('Gagal mengambil data target menabung.'));
        };
      });
    },

    /**
     * Delete a saving goal by ID
     * @param {string|number} userId 
     * @param {number} goalId
     * @returns {Promise<boolean>}
     */
    async deleteSavingGoal(userId, goalId) {
      const db = await this.init();
      const id = Number(goalId) || goalId;
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['savingGoals'], 'readwrite');
        const store = transaction.objectStore('savingGoals');
        const request = store.delete(id);

        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(new Error('Gagal menghapus target menabung.'));
      });
    }
  };

  // Expose to window object
  window.FinanceDB = FinanceDB;
  window.FinanceDBLocal = FinanceDB;
})();

