/**
 * auth.js - Handles user authentication logic for login and registration.
 * Manages UI interactions for auth forms and redirects based on authentication status.
 */

// Firebase Configuration (Make sure this matches your project's config)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY", // Replace with your actual API Key
  authDomain: "YOUR_AUTH_DOMAIN", // Replace with your actual Auth Domain
  projectId: "YOUR_PROJECT_ID", // Replace with your actual Project ID
  storageBucket: "YOUR_STORAGE_BUCKET", // Replace with your actual Storage Bucket
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID", // Replace with your actual Messaging Sender ID
  appId: "YOUR_APP_ID" // Replace with your actual App ID
};

// Initialize Firebase (compat v9)
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Helper: Toast Notifications (Copied from app.js for auth purposes)
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  // Ensure container exists, important for login.html
  if (!container) {
    console.warn("Toast container not found. Cannot display toast.");
    return;
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let iconClass = 'fa-circle-info';
  if (type === 'success') iconClass = 'fa-circle-check';
  if (type === 'warning') iconClass = 'fa-triangle-exclamation';
  if (type === 'danger') iconClass = 'fa-circle-xmark';

  toast.innerHTML = `
    <i class="fa-solid ${iconClass} toast-icon"></i>
    <span>${message}</span>
    <button class="toast-close"><i class="fa-solid fa-xmark"></i></button>
  `;

  container.appendChild(toast);

  // Animate in
  setTimeout(() => toast.classList.add('show'), 50);

  // Auto-remove after 4 seconds
  const autoRemove = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4500);

  // Close button handler
  toast.querySelector('.toast-close').addEventListener('click', () => {
    clearTimeout(autoRemove);
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  });
}

// Authentication Functions
async function registerUser(username, password) {
  try {
    const userCredential = await auth.createUserWithEmailAndPassword(username, password);
    await userCredential.user.updateProfile({ displayName: username });
    showToast('Pendaftaran berhasil! Silakan masuk.', 'success');
    return userCredential.user;
  } catch (error) {
    console.error("Error registering user:", error);
    showToast(`Pendaftaran gagal: ${error.message}`, 'danger');
    throw error;
  }
}

async function loginUser(username, password) {
  try {
    const userCredential = await auth.signInWithEmailAndPassword(username, password);
    showToast('Login berhasil!', 'success');
    return userCredential.user;
  } catch (error) {
    console.error("Error logging in user:", error);
    showToast(`Login gagal: ${error.message}`, 'danger');
    throw error;
  }
}

async function signInWithGoogle() {
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    const userCredential = await auth.signInWithPopup(provider);
    showToast('Login dengan Google berhasil!', 'success');
    return userCredential.user;
  } catch (error) {
    console.error("Error signing in with Google:", error);
    showToast(`Login dengan Google gagal: ${error.message}`, 'danger');
    throw error;
  }
}

async function logoutUser() {
  try {
    await auth.signOut();
    showToast('Anda telah keluar.', 'info');
  } catch (error) {
    console.error("Error logging out:", error);
    showToast(`Gagal keluar: ${error.message}`, 'danger');
    throw error;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const authContainer = document.getElementById('auth-container');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const goToRegister = document.getElementById('go-to-register');
  const goToLogin = document.getElementById('go-to-login');
  const googleLoginBtn = document.getElementById('google-login-btn');
  const googleRegisterBtn = document.getElementById('google-register-btn');

  // Redirect if already authenticated
  auth.onAuthStateChanged((user) => {
    if (user) {
      window.location.href = 'home.html'; // This should be relative to current html/login.html
    } else {
      // Ensure auth container is visible if not authenticated
      if (authContainer) {
        authContainer.classList.remove('hidden');
      }
    }
  });

  // Toggle password visibility
  document.querySelectorAll('.toggle-password').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const passwordInput = toggle.previousElementSibling;
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      toggle.classList.toggle('fa-eye');
      toggle.classList.toggle('fa-eye-slash');
    });
  });

  // Switch between login and register forms
  if (goToRegister) {
    goToRegister.addEventListener('click', (e) => {
      e.preventDefault();
      loginForm.classList.remove('active');
      registerForm.classList.add('active');
    });
  }

  if (goToLogin) {
    goToLogin.addEventListener('click', (e) => {
      e.preventDefault();
      registerForm.classList.remove('active');
      loginForm.classList.add('active');
    });
  }

  // Handle Login Form Submission
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = loginForm['login-username'].value;
      const password = loginForm['login-password'].value;

      try {
        await loginUser(username, password);
        // Redirection handled by onAuthStateChanged listener
      } catch (error) {
        // Error already displayed by showToast in loginUser
      }
    });
  }

  // Handle Register Form Submission
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = registerForm['register-username'].value;
      const password = registerForm['register-password'].value;
      const confirmPassword = registerForm['register-confirm-password'].value;

      if (password !== confirmPassword) {
        showToast('Password dan konfirmasi password tidak cocok!', 'danger');
        return;
      }

      try {
        await registerUser(username, password);
        // Redirection handled by onAuthStateChanged listener
      } catch (error) {
        // Error already displayed by showToast in registerUser
      }
    });
  }

  // Handle Google Login
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', async () => {
      try {
        await signInWithGoogle();
        // Redirection handled by onAuthStateChanged listener
      } catch (error) {
        // Error already displayed by showToast in signInWithGoogle
      }
    });
  }

  // Handle Google Register (can reuse googleLoginBtn logic as it registers/logs in)
  if (googleRegisterBtn) {
    googleRegisterBtn.addEventListener('click', async () => {
      try {
        await signInWithGoogle();
        // Redirection handled by onAuthStateChanged listener
      } catch (error) {
        // Error already displayed by showToast in signInWithGoogle
      }
    });
  }
});
