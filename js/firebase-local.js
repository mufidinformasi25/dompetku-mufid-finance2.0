/**
 * firebase-local.js - Mock Firebase Auth using local IndexedDB and localStorage.
 * Enables the app to run completely locally and offline.
 */
(function () {
  const listeners = [];
  let currentUser = null;

  // Load current session from localStorage if exists
  const savedUser = localStorage.getItem('dompetku_current_user');
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
    } catch (e) {
      console.error("Error parsing saved session", e);
    }
  }

  function triggerAuthStateChanged() {
    listeners.forEach(cb => {
      try {
        cb(currentUser);
      } catch (e) {
        console.error("Error in auth state change listener:", e);
      }
    });
  }

  const mockAuth = {
    /**
     * Listen for auth changes
     * @param {Function} callback 
     * @returns {Function} Unsubscribe function
     */
    onAuthStateChanged(callback) {
      listeners.push(callback);
      // Trigger callback with current user asynchronously to mimic Firebase behavior
      setTimeout(() => callback(currentUser), 0);
      return () => {
        const index = listeners.indexOf(callback);
        if (index > -1) listeners.splice(index, 1);
      };
    },

    /**
     * Create user with email and password
     * Note: Since Firebase requires email, but login form is labeled "username",
     * we will accept whatever the user typing (and append a dummy domain if it's not an email).
     */
    async createUserWithEmailAndPassword(email, password) {
      if (!window.FinanceDB) {
        throw new Error("Local Database (FinanceDB) not initialized.");
      }
      
      const cleanUsername = email.trim();
      // Call IndexedDB register
      const user = await window.FinanceDB.registerUser(cleanUsername, password);
      
      currentUser = {
        uid: String(user.id),
        email: user.username.includes('@') ? user.username : `${user.username}@local.com`,
        displayName: user.username
      };
      
      localStorage.setItem('dompetku_current_user', JSON.stringify(currentUser));
      triggerAuthStateChanged();
      return { user: currentUser };
    },

    /**
     * Sign in user with email and password
     */
    async signInWithEmailAndPassword(email, password) {
      if (!window.FinanceDB) {
        throw new Error("Local Database (FinanceDB) not initialized.");
      }
      
      const cleanUsername = email.trim();
      // Call IndexedDB login
      const user = await window.FinanceDB.loginUser(cleanUsername, password);
      
      currentUser = {
        uid: String(user.id),
        email: user.username.includes('@') ? user.username : `${user.username}@local.com`,
        displayName: user.username
      };
      
      localStorage.setItem('dompetku_current_user', JSON.stringify(currentUser));
      triggerAuthStateChanged();
      return { user: currentUser };
    },

    /**
     * Sign in with Google (Mocked)
     */
    async signInWithPopup(provider) {
      currentUser = {
        uid: "google_user_local",
        email: "google.user@local.com",
        displayName: "Google User"
      };
      
      localStorage.setItem('dompetku_current_user', JSON.stringify(currentUser));
      triggerAuthStateChanged();
      return { user: currentUser };
    },

    /**
     * Sign out current user
     */
    async signOut() {
      currentUser = null;
      localStorage.removeItem('dompetku_current_user');
      triggerAuthStateChanged();
    },

    get currentUser() {
      return currentUser;
    }
  };

  // Expose mock firebase object globally
  window.firebase = {
    auth() {
      return mockAuth;
    },
    // Mock Firestore placeholder just in case anything checks it
    firestore() {
      return {
        collection() {
          return {
            doc() {
              return {
                collection() {
                  return {
                    add() { return Promise.resolve({ id: "mock_id" }); },
                    get() { return Promise.resolve({ docs: [] }); },
                    doc() {
                      return {
                        update() { return Promise.resolve(); },
                        delete() { return Promise.resolve(); }
                      };
                    }
                  };
                }
              };
            }
          };
        }
      };
    },
    apps: { length: 1 }
  };
})();
