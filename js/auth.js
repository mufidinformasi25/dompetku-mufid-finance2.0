/**
 * auth.js - Handles user authentication logic for login and registration.
 * Menggunakan firebase-local.js (mock IndexedDB) — tidak memerlukan Firebase SDK asli.
 */

// Helper: Toast Notifications
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
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

// Set tombol loading state agar tidak bisa diklik ganda
function setLoading(btn, isLoading) {
  if (!btn) return;
  btn.disabled = isLoading;
  btn.style.opacity = isLoading ? '0.7' : '1';
}

document.addEventListener('DOMContentLoaded', async () => {
  const authContainer = document.getElementById('auth-container');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const goToRegister = document.getElementById('go-to-register');
  const goToLogin = document.getElementById('go-to-login');
  const googleLoginBtn = document.getElementById('google-login-btn');
  const googleRegisterBtn = document.getElementById('google-register-btn');
  const loginSubmitBtn = loginForm ? loginForm.querySelector('button[type="submit"]') : null;
  const registerSubmitBtn = registerForm ? registerForm.querySelector('button[type="submit"]') : null;

  // --- STEP 1: Inisialisasi database jika tersedia ---
  try {
    const dbObj = window.FinanceDB || (typeof FinanceDB !== 'undefined' ? FinanceDB : null);
    if (dbObj && typeof dbObj.init === 'function') {
      await dbObj.init();
    }
  } catch (err) {
    console.error('Gagal inisialisasi database:', err);
  }

  // --- STEP 2: Cek status login, tampilkan form jika belum login ---
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      // Sudah login, langsung ke beranda
      window.location.href = 'home.html';
    } else {
      // Belum login, tampilkan form
      if (authContainer) {
        authContainer.classList.remove('hidden');
      }
    }
  });

  // --- Toggle show/hide password ---
  document.querySelectorAll('.toggle-password').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const wrapper = toggle.closest('.password-input-wrapper');
      if (!wrapper) return;
      const passwordInput = wrapper.querySelector('input');
      if (!passwordInput) return;
      const isPassword = passwordInput.getAttribute('type') === 'password';
      passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
      toggle.classList.toggle('fa-eye');
      toggle.classList.toggle('fa-eye-slash');
    });
  });

  // --- Switch ke form registrasi ---
  if (goToRegister) {
    goToRegister.addEventListener('click', (e) => {
      e.preventDefault();
      loginForm.classList.remove('active');
      registerForm.classList.add('active');
    });
  }

  // --- Switch ke form login ---
  if (goToLogin) {
    goToLogin.addEventListener('click', (e) => {
      e.preventDefault();
      registerForm.classList.remove('active');
      loginForm.classList.add('active');
    });
  }

  // Helper untuk pesan error Firebase
  function getFriendlyAuthError(error) {
    if (!error || !error.code) return error.message || 'Terjadi kesalahan.';
    switch (error.code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Username/email atau password salah.';
      case 'auth/email-already-in-use':
        return 'Username/email ini sudah terdaftar.';
      case 'auth/weak-password':
        return 'Password terlalu lemah (minimal 6 karakter).';
      case 'auth/invalid-email':
        return 'Format email atau username tidak valid.';
      default:
        return error.message;
    }
  }

  // --- Handle Login Form ---
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value;

      if (!username || !password) {
        showToast('Username dan password tidak boleh kosong.', 'warning');
        return;
      }

      const email = username.includes('@') ? username : `${username}@dompetku.local`;

      setLoading(loginSubmitBtn, true);
      try {
        await firebase.auth().signInWithEmailAndPassword(email, password);
        showToast('Login berhasil! Mengalihkan...', 'success');
        // Redirect ditangani oleh onAuthStateChanged
      } catch (error) {
        console.error('Login error:', error);
        showToast(`Login gagal: ${getFriendlyAuthError(error)}`, 'danger');
        setLoading(loginSubmitBtn, false);
      }
    });
  }

  // --- Handle Register Form ---
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('register-username').value.trim();
      const password = document.getElementById('register-password').value;
      const confirmPassword = document.getElementById('register-confirm-password').value;

      if (!username || !password) {
        showToast('Username dan password tidak boleh kosong.', 'warning');
        return;
      }
      if (password.length < 6) {
        showToast('Password minimal 6 karakter.', 'warning');
        return;
      }
      if (password !== confirmPassword) {
        showToast('Password dan konfirmasi password tidak cocok!', 'danger');
        return;
      }

      const email = username.includes('@') ? username : `${username}@dompetku.local`;

      setLoading(registerSubmitBtn, true);
      try {
        const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
        if (userCredential.user && !userCredential.user.displayName) {
          await userCredential.user.updateProfile({ displayName: username });
        }
        showToast('Pendaftaran berhasil! Mengalihkan...', 'success');
        // Redirect ditangani oleh onAuthStateChanged
      } catch (error) {
        console.error('Register error:', error);
        showToast(`Pendaftaran gagal: ${getFriendlyAuthError(error)}`, 'danger');
        setLoading(registerSubmitBtn, false);
      }
    });
  }

  // --- Handle Google Login / Register ---
  async function handleGoogleSignIn(btn) {
    setLoading(btn, true);
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      await firebase.auth().signInWithPopup(provider);
      showToast('Login dengan Google berhasil! Mengalihkan...', 'success');
      // Redirect ditangani oleh onAuthStateChanged
    } catch (error) {
      console.error('Google sign-in error:', error);
      showToast(`Login Google gagal: ${getFriendlyAuthError(error)}`, 'danger');
      setLoading(btn, false);
    }
  }

  if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', () => handleGoogleSignIn(googleLoginBtn));
  }
  if (googleRegisterBtn) {
    googleRegisterBtn.addEventListener('click', () => handleGoogleSignIn(googleRegisterBtn));
  }
});
