/**
 * app.js - Personal Finance Manager Application Logic
 * Integrates UI interaction, IndexedDB data operations, Chart.js, and budget checking.
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const authContainer = document.getElementById('auth-container');
  const appContainer = document.getElementById('app-container');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const goToRegister = document.getElementById('go-to-register');
  const goToLogin = document.getElementById('go-to-login');

  const usernameDisplay = document.getElementById('username-display');
  const logoutBtn = document.getElementById('logout-btn');

  // KPI Elements
  const totalBalanceEl = document.getElementById('total-balance');
  const todayIncomeEl = document.getElementById('today-income');
  const todayExpenseEl = document.getElementById('today-expense');
  const todayLimitsSummaryEl = document.getElementById('today-limits-summary');

  // Forms
  const transactionForm = document.getElementById('transaction-form');
  const txType = document.getElementById('tx-type');
  const txAmount = document.getElementById('tx-amount');
  const txCategory = document.getElementById('tx-category');
  const txDate = document.getElementById('tx-date');
  const txDesc = document.getElementById('tx-desc');

  const budgetForm = document.getElementById('budget-form');
  const budgetCategory = document.getElementById('budget-category');
  const budgetAmount = document.getElementById('budget-amount');
  const activeBudgetsList = document.getElementById('active-budgets-list');

  // History Filters
  const filterType = document.getElementById('filter-type');
  const filterCategory = document.getElementById('filter-category');
  const searchDesc = document.getElementById('search-desc');
  const transactionRows = document.getElementById('transaction-rows');
  const exportCsvBtn = document.getElementById('export-csv-btn');

  // Daily Report Elements
  const dailyReportBtn = document.getElementById('daily-report-btn');
  const dailyReportModal = document.getElementById('daily-report-modal');
  const closeDailyReportBtn = document.getElementById('close-daily-report');
  const reportMonthInput = document.getElementById('report-month');
  const dailyReportRows = document.getElementById('daily-report-rows');

  // Chart Elements
  const chartTabs = document.querySelectorAll('.chart-tab');
  const expensesChartCanvas = document.getElementById('expensesChart');

  // State variables
  let currentUser = null;
  let transactions = [];
  let budgets = [];
  let savingGoals = [];
  let myChart = null;
  let activeChartTab = 'category'; // 'category' or 'trend'

  // Categories list for populating filters dynamically
  const categoriesList = [
    "Makanan & Minuman",
    "Transportasi",
    "Tempat Tinggal & Tagihan",
    "Hiburan & Gaya Hidup",
    "Kesehatan",
    "Pendidikan",
    "Belanja",
    "Investasi & Tabungan",
    "Lain-lain",
    "Gaji / Upah",
    "Hasil Usaha / Bisnis",
    "Investasi",
    "Pemberian / Hibah",
    "Pemasukan Lain-lain"
  ];

  // Helper: Format number to Rupiah currency
  function formatRupiah(amount) {
    if (amount === undefined || amount === null) return 'Rp 0';
    return 'Rp ' + Math.round(amount).toLocaleString('id-ID');
  }

  // Helper: Get local YYYY-MM-DD date string
  function getLocalDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Helper: Toast Notifications
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
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

  // Check Auth State via Firebase onAuthStateChanged
  function setupAuthListener() {
    // FinanceDB.onAuthStateChanged wraps Firebase auth observer
    FinanceDB.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        currentUser = {
          id: firebaseUser.uid,
          username: firebaseUser.displayName || firebaseUser.email.split('@')[0],
          email: firebaseUser.email
        };
        usernameDisplay.textContent = currentUser.username;
        authContainer.classList.add('hidden');
        appContainer.classList.remove('hidden');
        await initializeDashboard();
      } else {
        currentUser = null;
        authContainer.classList.remove('hidden');
        appContainer.classList.add('hidden');
        // Reset state when logged out
        transactions = [];
        budgets = [];
        savingGoals = [];
        if (myChart) { myChart.destroy(); myChart = null; }
      }
    });
  }

  // Initialize Dashboard Data
  async function initializeDashboard() {
    if (!currentUser) return;

    // Load initial default date
    txDate.value = getLocalDateString();

    // Populate dynamic Category list in History Filters
    populateFilterCategories();

    try {
      // Fetch transactions, budgets, and saving goals
      transactions = await FinanceDB.getTransactions(currentUser.id);
      budgets = await FinanceDB.getBudgets(currentUser.id);
      savingGoals = await FinanceDB.getSavingGoals(currentUser.id);

      // Render components
      renderDashboardUI();
    } catch (err) {
      console.error(err);
      showToast('Gagal memuat data dari database.', 'danger');
    }
  }

  // Populate Filter Categories in History Controls
  function populateFilterCategories() {
    filterCategory.innerHTML = '<option value="all">Semua Kategori</option>';
    categoriesList.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      filterCategory.appendChild(option);
    });
  }

  // Render All UI Elements based on state
  function renderDashboardUI() {
    const todayStr = getLocalDateString();

    // 1. Calculate KPI Metrics
    let balance = 0;
    let todayIncome = 0;
    let todayExpense = 0;
    let totalSavings = 0;

    transactions.forEach(tx => {
      const amount = parseFloat(tx.amount);
      if (tx.type === 'income') {
        balance += amount;
        if (tx.date === todayStr) {
          todayIncome += amount;
        }
      } else if (tx.type === 'saving') {
        balance -= amount;
        totalSavings += amount;
        if (tx.date === todayStr) {
          todayExpense += amount;
        }
      } else {
        balance -= amount;
        if (tx.date === todayStr) {
          todayExpense += amount;
        }
      }
    });

    totalBalanceEl.textContent = formatRupiah(balance);
    todayIncomeEl.textContent = formatRupiah(todayIncome);
    todayExpenseEl.textContent = formatRupiah(todayExpense);

    // Update total savings KPI
    const totalSavingsEl = document.getElementById('total-savings');
    if (totalSavingsEl) totalSavingsEl.textContent = formatRupiah(totalSavings);

    // 2. Render Active Budget List & Calculate Budget Limits Summary
    activeBudgetsList.innerHTML = '';

    let totalLimitSpent = 0;
    let totalLimitBudget = 0;

    if (budgets.length === 0) {
      activeBudgetsList.innerHTML = '<p class="placeholder-text">Belum ada batasan pengeluaran harian yang diatur.</p>';
      todayLimitsSummaryEl.textContent = formatRupiah(0);
    } else {
      budgets.forEach(budget => {
        // Calculate total expense in this category today
        const spentToday = transactions
          .filter(tx => tx.type === 'expense' && tx.category === budget.category && tx.date === todayStr)
          .reduce((sum, tx) => sum + tx.amount, 0);

        totalLimitSpent += spentToday;
        totalLimitBudget += budget.limitAmount;

        const ratio = budget.limitAmount > 0 ? (spentToday / budget.limitAmount) : 0;
        const percent = Math.min(Math.round(ratio * 100), 999);

        let progressClass = 'progress-safe';
        let alertClass = 'alert-safe';
        let alertIcon = '<i class="fa-solid fa-circle-check"></i>';
        let alertMessage = `Sisa batas aman: ${formatRupiah(Math.max(0, budget.limitAmount - spentToday))}`;

        if (ratio > 1.0) {
          progressClass = 'progress-exceeded';
          alertClass = 'alert-exceeded';
          alertIcon = '<i class="fa-solid fa-circle-exclamation"></i>';
          alertMessage = `MELEBIHI BATAS! Lebih ${formatRupiah(spentToday - budget.limitAmount)}`;
        } else if (ratio > 0.7) {
          progressClass = 'progress-warning';
          alertClass = 'alert-warning';
          alertIcon = '<i class="fa-solid fa-triangle-exclamation"></i>';
          alertMessage = `Awas! Sisa batas tipis: ${formatRupiah(budget.limitAmount - spentToday)}`;
        }

        const budgetItem = document.createElement('div');
        budgetItem.className = 'budget-status-item';
        budgetItem.innerHTML = `
          <div class="budget-meta">
            <span class="budget-category-title">${budget.category}</span>
            <span class="budget-amount-ratio">${formatRupiah(spentToday)} / ${formatRupiah(budget.limitAmount)}</span>
          </div>
          <div class="progress-bar-container">
            <div class="progress-bar-fill ${progressClass}" style="width: ${Math.min(percent, 100)}%"></div>
          </div>
          <div class="budget-alert-text ${alertClass}">
            ${alertIcon} ${alertMessage} (${percent}% terpakai)
            <button class="btn-danger-sm btn-xs delete-budget-btn" data-id="${budget.id}" style="padding: 1px 4px; font-size: 0.7rem; margin-left: auto; display: inline-flex; height: 16px; align-items: center; justify-content: center;">Hapus Batasan</button>
          </div>
        `;
        activeBudgetsList.appendChild(budgetItem);
      });

      // KPI card "Sisa Batasan Hari Ini"
      const remainingLimitTotal = Math.max(0, totalLimitBudget - totalLimitSpent);
      todayLimitsSummaryEl.textContent = formatRupiah(remainingLimitTotal);

      // Bind delete budget buttons
      document.querySelectorAll('.delete-budget-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const budgetId = parseInt(btn.getAttribute('data-id'));
          if (confirm('Apakah Anda yakin ingin menghapus batasan pengeluaran untuk kategori ini?')) {
            try {
              await FinanceDB.deleteBudget(budgetId);
              showToast('Batasan pengeluaran berhasil dihapus.', 'success');
              budgets = await FinanceDB.getBudgets(currentUser.id);
              renderDashboardUI();
            } catch (err) {
              showToast('Gagal menghapus batasan.', 'danger');
            }
          }
        });
      });
    }

    // 3. Render Transaction History Table
    renderTransactionTable();

    // 4. Render Charts
    renderCharts();

    // 5. Render Saving Goals
    renderSavingGoals();
  }

  // Render Filtered Transactions to the Table
  function renderTransactionTable() {
    const fType = filterType.value;
    const fCategory = filterCategory.value;
    const sQuery = searchDesc.value.toLowerCase().trim();

    // Filter transactions
    const filteredTxs = transactions.filter(tx => {
      const matchType = (fType === 'all') || (tx.type === fType);
      const matchCategory = (fCategory === 'all') || (tx.category === fCategory);
      const matchDesc = !sQuery || (tx.description.toLowerCase().includes(sQuery)) || (tx.category.toLowerCase().includes(sQuery));
      return matchType && matchCategory && matchDesc;
    });

    transactionRows.innerHTML = '';

    if (filteredTxs.length === 0) {
      transactionRows.innerHTML = `
        <tr>
          <td colspan="6" class="placeholder-text text-center">Tidak ada transaksi yang cocok dengan filter.</td>
        </tr>
      `;
      return;
    }

    filteredTxs.forEach(tx => {
      const tr = document.createElement('tr');
      const formattedDate = new Date(tx.date).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
      const badgeClass = tx.type === 'income' ? 'badge-income' : 'badge-expense';
      const valClass = tx.type === 'income' ? 'val-income' : 'val-expense';
      const typeLabel = tx.type === 'income' ? 'Masuk' : 'Keluar';
      const prefix = tx.type === 'income' ? '+' : '-';

      tr.innerHTML = `
        <td>${formattedDate}</td>
        <td><strong>${tx.category}</strong></td>
        <td>${tx.description || '-'}</td>
        <td><span class="badge ${badgeClass}">${typeLabel}</span></td>
        <td class="${valClass}">${prefix} ${formatRupiah(tx.amount)}</td>
        <td>
          <button class="btn btn-danger-sm delete-tx-btn" data-id="${tx.id}">
            <i class="fa-solid fa-trash"></i> Hapus
          </button>
        </td>
      `;
      transactionRows.appendChild(tr);
    });

    // Bind Delete Button Listeners
    document.querySelectorAll('.delete-tx-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const txId = parseInt(btn.getAttribute('data-id'));
        if (confirm('Apakah Anda yakin ingin menghapus transaksi ini?')) {
          try {
            await FinanceDB.deleteTransaction(txId);
            showToast('Transaksi berhasil dihapus.', 'success');
            // Reload transactions
            transactions = await FinanceDB.getTransactions(currentUser.id);
            renderDashboardUI();
          } catch (err) {
            console.error(err);
            showToast('Gagal menghapus transaksi.', 'danger');
          }
        }
      });
    });
  }

  // Render Analytics Charts (Chart.js integration)
  function renderCharts() {
    // If a chart already exists, destroy it first to avoid canvas conflicts
    if (myChart) {
      myChart.destroy();
      myChart = null;
    }

    const expensesOnly = transactions.filter(tx => tx.type === 'expense');

    if (expensesOnly.length === 0) {
      // Draw placeholder message inside canvas block
      const ctx = expensesChartCanvas.getContext('2d');
      ctx.clearRect(0, 0, expensesChartCanvas.width, expensesChartCanvas.height);
      ctx.fillStyle = '#6b7280';
      ctx.font = '14px Outfit';
      ctx.textAlign = 'center';
      ctx.fillText('Belum ada transaksi pengeluaran untuk ditampilkan grafiknya.', expensesChartCanvas.width / 2, expensesChartCanvas.height / 2);
      return;
    }

    if (activeChartTab === 'category') {
      // Chart 1: Expenses by Category (Doughnut Chart)
      const categoryMap = {};
      expensesOnly.forEach(tx => {
        categoryMap[tx.category] = (categoryMap[tx.category] || 0) + tx.amount;
      });

      const labels = Object.keys(categoryMap);
      const data = Object.values(categoryMap);
      const colors = [
        '#6366f1', // Indigo
        '#a855f7', // Purple
        '#f43f5e', // Rose
        '#f59e0b', // Amber
        '#10b981', // Emerald
        '#0ea5e9', // Sky
        '#14b8a6', // Teal
        '#ec4899', // Pink
        '#8b5cf6'  // Violet
      ];

      myChart = new Chart(expensesChartCanvas, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: colors.slice(0, labels.length),
            borderWidth: 2,
            borderColor: '#111726'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: {
                color: '#9ca3af',
                font: { family: 'Outfit', size: 11 }
              }
            },
            tooltip: {
              callbacks: {
                label: function (context) {
                  return ` ${context.label}: ${formatRupiah(context.raw)}`;
                }
              }
            }
          }
        }
      });

    } else {
      // Chart 2: Daily Spending Trend in last 7 days (Bar Chart)
      const dailyMap = {};

      // Find last 7 days
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        days.push(dateStr);
        dailyMap[dateStr] = 0;
      }

      // Group expenses by date
      expensesOnly.forEach(tx => {
        if (dailyMap[tx.date] !== undefined) {
          dailyMap[tx.date] += tx.amount;
        }
      });

      const labels = days.map(dateStr => {
        const [, , dd] = dateStr.split('-');
        const dateObj = new Date(dateStr);
        const dayName = dateObj.toLocaleDateString('id-ID', { weekday: 'short' });
        return `${dayName} (${dd})`;
      });
      const data = Object.values(dailyMap);

      myChart = new Chart(expensesChartCanvas, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Pengeluaran (Rp)',
            data: data,
            backgroundColor: 'rgba(99, 102, 241, 0.7)',
            borderColor: '#6366f1',
            borderWidth: 1.5,
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function (context) {
                  return ` Pengeluaran: ${formatRupiah(context.raw)}`;
                }
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: '#9ca3af', font: { family: 'Outfit' } }
            },
            y: {
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: {
                color: '#9ca3af',
                font: { family: 'Outfit' },
                callback: function (value) {
                  if (value >= 1000000) return 'Rp ' + (value / 1000000) + 'jt';
                  if (value >= 1000) return 'Rp ' + (value / 1000) + 'rb';
                  return 'Rp ' + value;
                }
              }
            }
          }
        }
      });
    }
  }

  // ==========================================================================
  // SAVING GOALS RENDER
  // ==========================================================================

  function renderSavingGoals() {
    const grid = document.getElementById('saving-goals-grid');
    const placeholder = document.getElementById('goals-placeholder');
    const summaryText = document.getElementById('goals-summary-text');
    if (!grid) return;

    // Total all saving transactions
    const totalSaved = transactions
      .filter(tx => tx.type === 'saving')
      .reduce((sum, tx) => sum + tx.amount, 0);

    // Remove existing goal cards (keep placeholder)
    grid.querySelectorAll('.goal-card').forEach(c => c.remove());

    if (savingGoals.length === 0) {
      if (placeholder) placeholder.style.display = 'block';
      if (summaryText) summaryText.textContent = '';
      return;
    }

    if (placeholder) placeholder.style.display = 'none';

    // Count achieved goals
    let achievedCount = 0;

    savingGoals.forEach(goal => {
      const percent = Math.min((totalSaved / goal.targetAmount) * 100, 100);
      const isAchieved = totalSaved >= goal.targetAmount;
      if (isAchieved) achievedCount++;

      const remaining = Math.max(goal.targetAmount - totalSaved, 0);

      let progressClass = 'goal-progress-low';
      if (percent >= 100) progressClass = 'goal-progress-done';
      else if (percent >= 70) progressClass = 'goal-progress-high';
      else if (percent >= 40) progressClass = 'goal-progress-mid';

      const card = document.createElement('div');
      card.className = `goal-card glass-card ${isAchieved ? 'goal-achieved' : ''}`;
      card.innerHTML = `
        <div class="goal-card-header">
          <div class="goal-emoji-badge">${goal.emoji || '🎯'}</div>
          <div class="goal-info">
            <h3 class="goal-name">${goal.name}</h3>
            ${goal.description ? `<p class="goal-desc">${goal.description}</p>` : ''}
          </div>
          ${isAchieved ? '<div class="goal-achieved-badge"><i class="fa-solid fa-trophy"></i> Tercapai!</div>' : ''}
        </div>

        <div class="goal-amounts">
          <span class="goal-saved">${formatRupiah(Math.min(totalSaved, goal.targetAmount))} <small>terkumpul</small></span>
          <span class="goal-target">${formatRupiah(goal.targetAmount)} <small>target</small></span>
        </div>

        <div class="goal-progress-container">
          <div class="goal-progress-fill ${progressClass}" style="width: ${percent.toFixed(1)}%"></div>
        </div>

        <div class="goal-footer">
          <span class="goal-percent">${percent.toFixed(1)}% terpenuhi</span>
          ${!isAchieved
            ? `<span class="goal-remaining"><i class="fa-solid fa-clock"></i> Sisa ${formatRupiah(remaining)}</span>`
            : `<span class="goal-remaining goal-remaining-done"><i class="fa-solid fa-circle-check"></i> Target terpenuhi!</span>`
          }
        </div>

        <button class="btn btn-danger-sm delete-goal-btn" data-id="${goal.id}">
          <i class="fa-solid fa-trash"></i> Hapus Target
        </button>
      `;
      grid.appendChild(card);
    });

    // Update summary text
    if (summaryText) {
      summaryText.textContent = `${achievedCount} dari ${savingGoals.length} target tercapai`;
    }

    // Bind delete buttons
    grid.querySelectorAll('.delete-goal-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const goalId = parseInt(btn.getAttribute('data-id'));
        const goal = savingGoals.find(g => g.id === goalId);
        if (confirm(`Hapus target "${goal ? goal.name : 'ini'}"? Tindakan ini tidak dapat dibatalkan.`)) {
          try {
            await FinanceDB.deleteSavingGoal(goalId);
            showToast('Target menabung berhasil dihapus.', 'success');
            savingGoals = await FinanceDB.getSavingGoals(currentUser.id);
            renderSavingGoals();
          } catch (err) {
            showToast('Gagal menghapus target.', 'danger');
          }
        }
      });
    });
  }

  // ==========================================================================
  // EVENT LISTENERS
  // ==========================================================================

  // Toggle password visibility
  function resetPasswordFieldsVisibility() {
    document.querySelectorAll('.password-input-wrapper input').forEach(input => {
      input.type = 'password';
    });
    document.querySelectorAll('.toggle-password').forEach(icon => {
      icon.classList.remove('fa-eye-slash');
      icon.classList.add('fa-eye');
    });
  }

  document.querySelectorAll('.toggle-password').forEach(icon => {
    icon.addEventListener('click', () => {
      const input = icon.previousElementSibling;
      if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
      } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
      }
    });
  });

  // Auth Toggle Form
  goToRegister.addEventListener('click', (e) => {
    e.preventDefault();
    resetPasswordFieldsVisibility();
    loginForm.classList.remove('active');
    registerForm.classList.add('active');
  });

  goToLogin.addEventListener('click', (e) => {
    e.preventDefault();
    resetPasswordFieldsVisibility();
    registerForm.classList.remove('active');
    loginForm.classList.add('active');
  });

  // Submit Register Form
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('register-username').value;
    const psw = document.getElementById('register-password').value;
    const confirmPsw = document.getElementById('register-confirm-password').value;

    if (psw.length < 6) {
      showToast('Password harus minimal 6 karakter.', 'warning');
      return;
    }

    if (psw !== confirmPsw) {
      showToast('Konfirmasi password tidak cocok.', 'warning');
      return;
    }

    try {
      await FinanceDB.registerUser(username, psw);
      showToast('Pendaftaran akun berhasil! Silakan masuk.', 'success');
      registerForm.reset();
      resetPasswordFieldsVisibility();

      // Toggle back to login and auto fill username
      registerForm.classList.remove('active');
      loginForm.classList.add('active');
      document.getElementById('login-username').value = username;
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });

  // Submit Login Form
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const psw = document.getElementById('login-password').value;

    const loginBtn = loginForm.querySelector('button[type="submit"]');
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memproses...';

    try {
      await FinanceDB.loginUser(username, psw);
      // onAuthStateChanged will handle UI transition automatically
      loginForm.reset();
      resetPasswordFieldsVisibility();
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      loginBtn.disabled = false;
      loginBtn.innerHTML = 'Masuk <i class="fa-solid fa-right-to-bracket"></i>';
    }
  });

  // Google Login Handler
  const googleLoginBtn = document.getElementById('google-login-btn');
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', async () => {
      googleLoginBtn.disabled = true;
      googleLoginBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Membuka Google...';
      try {
        await FinanceDB.loginWithGoogle();
        // onAuthStateChanged handles everything after this
      } catch (err) {
        showToast(err.message, 'danger');
      } finally {
        googleLoginBtn.disabled = false;
        googleLoginBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 48 48" style="margin-right: 10px; flex-shrink:0;"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.29-8.16 2.29-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>Masuk dengan Google`;
      }
    });
  }

  // Logout Handler
  logoutBtn.addEventListener('click', () => {
    if (confirm('Apakah Anda yakin ingin keluar dari aplikasi?')) {
      FinanceDB.logoutUser()
        .then(() => showToast('Anda telah berhasil keluar.', 'info'))
        .catch(console.error);
      // onAuthStateChanged will reset the UI automatically
    }
  });

  // Submit Transaction Form
  transactionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const type = txType.value;
    const amount = parseFloat(txAmount.value);
    const category = txCategory.value;
    const date = txDate.value;
    const description = txDesc.value;

    try {
      // Budget checking (Only triggers for expense)
      if (type === 'expense') {
        const categoryBudget = budgets.find(b => b.category === category);
        if (categoryBudget) {
          // Calculate today's existing expense in this category
          const spentToday = transactions
            .filter(tx => tx.type === 'expense' && tx.category === category && tx.date === date)
            .reduce((sum, tx) => sum + tx.amount, 0);

          const newTotal = spentToday + amount;
          if (newTotal > categoryBudget.limitAmount) {
            showToast(`Peringatan! Menambahkan Rp ${amount.toLocaleString('id-ID')} akan MELEBIHI batasan pengeluaran ${category} (${formatRupiah(categoryBudget.limitAmount)}) hari ini!`, 'warning');
          }
        }
      }

      await FinanceDB.addTransaction(currentUser.id, type, amount, category, date, description);
      showToast('Transaksi berhasil ditambahkan.', 'success');

      // Reset form controls except date
      txAmount.value = '';
      txCategory.value = '';
      txDesc.value = '';

      // Reload & Refresh
      transactions = await FinanceDB.getTransactions(currentUser.id);
      renderDashboardUI();

      // If saving transaction, also refresh saving goals progress
      if (type === 'saving') {
        savingGoals = await FinanceDB.getSavingGoals(currentUser.id);
      }
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });

  // Submit Budget / Limit Form
  budgetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const category = budgetCategory.value;
    const amount = parseFloat(budgetAmount.value);

    try {
      await FinanceDB.addBudget(currentUser.id, category, amount);
      showToast(`Batasan pengeluaran kategori ${category} berhasil diterapkan!`, 'success');

      budgetForm.reset();

      // Reload & Refresh
      budgets = await FinanceDB.getBudgets(currentUser.id);
      renderDashboardUI();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });

  // Submit Saving Goal Form
  const savingGoalForm = document.getElementById('saving-goal-form');
  savingGoalForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const name = document.getElementById('goal-name').value;
    const amount = parseFloat(document.getElementById('goal-amount').value);
    const desc = document.getElementById('goal-desc').value;
    const emoji = document.getElementById('goal-emoji').value.trim() || '🎯';

    try {
      await FinanceDB.addSavingGoal(currentUser.id, name, amount, desc, emoji);
      showToast(`Target menabung "${name}" berhasil ditambahkan!`, 'success');

      savingGoalForm.reset();

      // Reload & Refresh
      savingGoals = await FinanceDB.getSavingGoals(currentUser.id);
      renderSavingGoals();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });

  // Listeners for filters
  filterType.addEventListener('change', renderTransactionTable);
  filterCategory.addEventListener('change', renderTransactionTable);
  searchDesc.addEventListener('input', renderTransactionTable);

  // Tab switching for charts
  chartTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      chartTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeChartTab = tab.getAttribute('data-chart');
      renderCharts();
    });
  });

  // Export Filtered Transactions to CSV
  exportCsvBtn.addEventListener('click', () => {
    if (!currentUser || transactions.length === 0) return;

    // Filter matching active selections
    const fType = filterType.value;
    const fCategory = filterCategory.value;
    const sQuery = searchDesc.value.toLowerCase().trim();

    const filtered = transactions.filter(tx => {
      const matchType = (fType === 'all') || (tx.type === fType);
      const matchCategory = (fCategory === 'all') || (tx.category === fCategory);
      const matchDesc = !sQuery || (tx.description.toLowerCase().includes(sQuery)) || (tx.category.toLowerCase().includes(sQuery));
      return matchType && matchCategory && matchDesc;
    });

    if (filtered.length === 0) {
      showToast('Tidak ada transaksi yang disaring untuk diekspor.', 'warning');
      return;
    }

    // Generate CSV contents
    const headers = ['Tanggal', 'Jenis', 'Kategori', 'Jumlah (Rp)', 'Keterangan'];
    const rows = filtered.map(tx => [
      tx.date,
      tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
      tx.category,
      tx.amount,
      `"${tx.description.replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF"
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `riwayat_keuangan_${currentUser.username}_${getLocalDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Ekspor CSV berhasil disiapkan.', 'success');
  });

  // Initialize

  // --- Daily Report Logic ---
  function renderDailyReport() {
    if (!currentUser || !transactions) return;

    // Get selected month (format: YYYY-MM)
    const selectedMonth = reportMonthInput.value;
    if (!selectedMonth) return;

    // Filter transactions by selected month
    const filteredTx = transactions.filter(tx => tx.date.startsWith(selectedMonth));

    // Group by date
    const dailyData = {};
    filteredTx.forEach(tx => {
      if (!dailyData[tx.date]) {
        dailyData[tx.date] = { income: 0, expense: 0 };
      }
      if (tx.type === 'income') {
        dailyData[tx.date].income += tx.amount;
      } else {
        dailyData[tx.date].expense += tx.amount;
      }
    });

    dailyReportRows.innerHTML = '';

    const dates = Object.keys(dailyData).sort((a, b) => b.localeCompare(a)); // Descending

    if (dates.length === 0) {
      dailyReportRows.innerHTML = '<tr><td colspan="4" class="text-center placeholder-text">Tidak ada data untuk bulan ini.</td></tr>';
      return;
    }

    dates.forEach(date => {
      const data = dailyData[date];
      const net = data.income - data.expense;

      let netClass = 'text-primary';
      if (net > 0) netClass = 'val-income';
      else if (net < 0) netClass = 'val-expense';

      const tr = document.createElement('tr');
      tr.innerHTML = `
    <td><strong>${date}</strong></td>
    <td class="${netClass}">${formatRupiah(net)}</td>
    <td class="val-income">${formatRupiah(data.income)}</td>
    <td class="val-expense">${formatRupiah(data.expense)}</td>
  `;
      dailyReportRows.appendChild(tr);
    });
  }

  dailyReportBtn.addEventListener('click', () => {
    // Set default month to current if empty
    if (!reportMonthInput.value) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      reportMonthInput.value = `${yyyy}-${mm}`;
    }
    renderDailyReport();
    dailyReportModal.classList.remove('hidden');
  });

  closeDailyReportBtn.addEventListener('click', () => {
    dailyReportModal.classList.add('hidden');
  });

  reportMonthInput.addEventListener('change', renderDailyReport);

  // Close modal when clicking outside content
  dailyReportModal.addEventListener('click', (e) => {
    if (e.target === dailyReportModal) {
      dailyReportModal.classList.add('hidden');
    }
  });
  // --------------------------

  FinanceDB.init().then(() => {
    setupAuthListener();
  }).catch((err) => {
    console.error(err);
    showToast('Inisialisasi Firebase gagal. Pastikan konfigurasi firebaseConfig sudah diisi.', 'danger');
  });
});
