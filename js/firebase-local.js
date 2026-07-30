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
     * Sign in with Google (Mocked - but with UI)
     */
    async signInWithPopup(provider) {
      return new Promise((resolve, reject) => {
        // Buat elemen overlay modal
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
        overlay.style.display = 'flex';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.zIndex = '99999';
        overlay.style.backdropFilter = 'blur(4px)';

        // Buat kotak dialog mirip google
        const dialog = document.createElement('div');
        dialog.style.backgroundColor = '#fff';
        dialog.style.padding = '40px 35px';
        dialog.style.borderRadius = '8px';
        dialog.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        dialog.style.textAlign = 'center';
        dialog.style.fontFamily = '"Roboto", "Outfit", sans-serif';
        dialog.style.width = '90%';
        dialog.style.maxWidth = '400px';

        dialog.innerHTML = `
           <div style="margin-bottom: 15px;">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="45" height="45">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
           </div>
           <h2 style="margin: 0 0 10px; font-weight: 400; font-size: 24px; color: #202124;">Masuk</h2>
           <p style="margin: 0 0 35px; color: #202124; font-size: 16px;">Gunakan Akun Google Anda</p>
           
           <div style="text-align: left; margin-bottom: 35px;">
               <input type="email" id="google-mock-email" placeholder="Email atau nomor telepon" style="width: 100%; padding: 13px 15px; border: 1px solid #dadce0; border-radius: 4px; font-size: 16px; outline: none; box-sizing: border-box; transition: border-color 0.2s;" />
               <div id="google-mock-error" style="color: #d93025; font-size: 12px; margin-top: 5px; display: none;">Masukkan email yang valid</div>
           </div>
           
           <div style="display: flex; justify-content: space-between; align-items: center;">
              <button id="google-mock-cancel" style="background: none; border: none; color: #1a73e8; font-weight: 500; font-size: 14px; cursor: pointer; padding: 10px 8px; outline: none;">Batal</button>
              <button id="google-mock-next" style="background: #1a73e8; border: none; color: white; font-weight: 500; font-size: 14px; cursor: pointer; padding: 10px 24px; border-radius: 4px; outline: none;">Selanjutnya</button>
           </div>
        `;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        const emailInput = dialog.querySelector('#google-mock-email');
        const errorText = dialog.querySelector('#google-mock-error');
        const cancelBtn = dialog.querySelector('#google-mock-cancel');
        const nextBtn = dialog.querySelector('#google-mock-next');

        emailInput.focus();
        
        emailInput.addEventListener('input', () => {
          emailInput.style.border = "1px solid #dadce0";
          errorText.style.display = "none";
        });

        const cleanup = () => {
            document.body.removeChild(overlay);
        };

        cancelBtn.addEventListener('click', () => {
            cleanup();
            reject(new Error("Login Google dibatalkan pengguna."));
        });

        nextBtn.addEventListener('click', () => {
            const email = emailInput.value.trim();
            if (!email || !email.includes('@')) {
                emailInput.style.border = "2px solid #d93025";
                errorText.style.display = "block";
                return;
            }
            cleanup();
            
            // Simulasikan delay jaringan kecil agar lebih natural
            setTimeout(() => {
              currentUser = {
                uid: "google_user_" + Date.now(),
                email: email,
                displayName: email.split('@')[0]
              };
              
              localStorage.setItem('dompetku_current_user', JSON.stringify(currentUser));
              triggerAuthStateChanged();
              resolve({ user: currentUser });
            }, 600);
        });
      });
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
