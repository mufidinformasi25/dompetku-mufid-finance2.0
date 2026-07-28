/**
 * auth.js - Handles user authentication logic for login and registration.
 * Menggunakan firebase-local.js (mock IndexedDB) — tidak memerlukan Firebase SDK asli.
 */

// Helper: Toast Notifications
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) {
    console.warn('Toast container not found.');
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
  setTimeout(() => toast.classList.add('show'), 50);

  const autoRemove = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4500);

  toast.querySelector('.toast-close').addEventListener('click', () => {
    clearTimeout(autoRemove);
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  });
}

// Authentication Functions
async function registerUser(username, password) {
  try {
    const userCredential = await firebase.auth().createUserWithEmailAndPassword(username, password);
    showToast('Pendaftaran berhasil! Silakan masuk.', 'success');
    return userCredential.user;
  } catch (error) {
    console.error('Error registering user:', error);
    showToast(`Pendaftaran gagal: ${error.message}`, 'danger');
    throw error;
  }
}

async function loginUser(username, password) {
  try {
    const userCredential = await firebase.auth().signInWithEmailAndPassword(username, password);
    showToast('Login berhasil!', 'success');
    return userCredential.user;
  } catch (error) {
    console.error('Error logging in user:', error);
    showToast(`Login gagal: ${error.message}`, 'danger');
    throw error;
  }
}

async function signInWithGoogle() {
  try {
    const userCredential = await firebase.auth().signInWithPopup();
    showToast('Login dengan Google berhasil!', 'success');
    return userCredential.user;
  } catch (error) {
    console.error('Error signing in with Google:', error);
    showToast(`Login dengan Google gagal: ${error.message}`, 'danger');
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

  // Redirect jika sudah login
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      window.location.href = 'home.html';
    } else {
      if (authContainer) {
        authContainer.classList.remove('hidden');
      }
    }
  });

  // Toggle password visibility
  document.querySelectorAll('.toggle-password').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const passwordInput = toggle.previousElementSibling;
      if (!passwordInput) return;
      const isPassword = passwordInput.getAttribute('type') === 'password';
      passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
      toggle.classList.toggle('fa-eye');
      toggle.classList.toggle('fa-eye-slash');
    });
  });

  // Switch ke form registrasi
  if (goToRegister) {
    goToRegister.addEventListener('click', (e) => {
      e.preventDefault();
      loginForm.classList.remove('active');
      registerForm.classList.add('active');
    });
  }

  // Switch ke form login
  if (goToLogin) {
    goToLogin.addEventListener('click', (e) => {
      e.preventDefault();
      registerForm.classList.remove('active');
      loginForm.classList.add('active');
    });
  }

  // Handle Login Form
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value;
      try {
        await loginUser(username, password);
        // Redirect ditangani oleh onAuthStateChanged
      } catch (error) {
        // Error sudah ditampilkan via showToast
      }
    });
  }

  // Handle Register Form
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('register-username').value.trim();
      const password = document.getElementById('register-password').value;
      const confirmPassword = document.getElementById('register-confirm-password').value;

      if (password !== confirmPassword) {
        showToast('Password dan konfirmasi password tidak cocok!', 'danger');
        return;
      }
      if (password.length < 6) {
        showToast('Password minimal 6 karakter.', 'warning');
        return;
      }

      try {
        await registerUser(username, password);
        // Redirect ditangani oleh onAuthStateChanged
      } catch (error) {
        // Error sudah ditampilkan via showToast
      }
    });
  }

  // Handle Google Login
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', async () => {
      try {
        await signInWithGoogle();
      } catch (error) {
        // Error sudah ditampilkan via showToast
      }
    });
  }

  // Handle Google Register
  if (googleRegisterBtn) {
    googleRegisterBtn.addEventListener('click', async () => {
      try {
        await signInWithGoogle();
      } catch (error) {
        // Error sudah ditampilkan via showToast
      }
    });
  }
});
