/**
 * app.js - Personal Finance Manager Application Logic
 * Integrates UI interaction, IndexedDB data operations, Chart.js, and budget checking.
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const appContainer = document.getElementById('app-container');

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

  // Helper: Toast Notifications (This function needs to be available in home.html)
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
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

  // Authentication Listener for Home Page (redirects to index.html if not authenticated)
  firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
      currentUser = user;
      usernameDisplay.textContent = `Halo, ${currentUser.displayName || currentUser.email}`;
      appContainer.classList.remove('hidden'); // Ensure app container is visible
      await loadAllData(); // Initialize data and UI for authenticated user
    } else {
      currentUser = null;
      // If not authenticated, redirect to index.html
      window.location.href = 'index.html';
      // No need to hide appContainer here, as the page will redirect
      // No need to show authContainer here, as this is home.html
    }
  });

  // Logout button event listener
  logoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    await firebase.auth().signOut();
    window.location.href = 'index.html'; // Redirect to index.html after logout
  });

  // KPI functions (Key Performance Indicators)
  async function updateKPIs() {
    const today = getLocalDateString();
    let totalIncome = 0;
    let totalExpense = 0;
    let currentBalance = 0;

    // Calculate current balance
    if (transactions.length > 0) {
      currentBalance = transactions.reduce((acc, tx) => {
        if (tx.type === 'income') return acc + tx.amount;
        if (tx.type === 'expense') return acc - tx.amount;
        return acc;
      }, 0);
    }

    // Calculate today's income and expense
    const todayTransactions = transactions.filter(tx => tx.date === today);
    todayIncome = todayTransactions.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
    todayExpense = todayTransactions.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);

    totalBalanceEl.textContent = formatRupiah(currentBalance);
    todayIncomeEl.textContent = formatRupiah(todayIncome);
    todayExpenseEl.textContent = formatRupiah(todayExpense);

    // Check budget limits for today
    let limitsSummary = '';
    const todayExpensesByCategory = todayTransactions.filter(tx => tx.type === 'expense').reduce((acc, tx) => {
      acc[tx.category] = (acc[tx.category] || 0) + tx.amount;
      return acc;
    }, {});

    budgets.forEach(budget => {
      if (budget.type === 'daily' && todayExpensesByCategory[budget.category] > budget.amount) {
        limitsSummary += `<p class="text-danger">Batas harian '${budget.category}' terlampaui!</p>`;
      }
    });

    todayLimitsSummaryEl.innerHTML = limitsSummary || '<p class="text-info">Batas harian terjaga.</p>';
  }

  // --- Transaction Logic ---
  async function addOrUpdateTransaction(tx) {
    if (!currentUser) return;
    try {
      if (tx.id) {
        await FinanceDB.updateTransaction(currentUser.uid, tx.id, tx);
        showToast('Transaksi berhasil diperbarui.', 'success');
      } else {
        await FinanceDB.addTransaction(currentUser.uid, tx);
        showToast('Transaksi berhasil ditambahkan.', 'success');
      }
      await loadAllData();
      resetTransactionForm();
    } catch (error) {
      console.error("Error adding/updating transaction:", error);
      showToast(`Gagal menyimpan transaksi: ${error.message || 'Terjadi kesalahan pada database.'}`, 'danger');
    }

  }

  async function deleteTransaction(txId) {
    if (!currentUser) return;
    if (!confirm('Anda yakin ingin menghapus transaksi ini?')) return;
    try {
      await FinanceDB.deleteTransaction(currentUser.uid, txId);
      showToast('Transaksi berhasil dihapus.', 'success');
      await loadAllData();
    } catch (error) {
      console.error("Error deleting transaction:", error);
      showToast('Gagal menghapus transaksi.', 'danger');
    }
  }

  function renderTransactionTable() {
    if (!transactions.length) {
      transactionRows.innerHTML = '<tr><td colspan="6" class="placeholder-text text-center">Belum ada transaksi tercatat. Mulai tambahkan transaksi di atas!</td></tr>';
      return;
    }

    const fType = filterType.value;
    const fCategory = filterCategory.value;
    const sQuery = searchDesc.value.toLowerCase().trim();

    const filteredTransactions = transactions.filter(tx => {
      const matchType = (fType === 'all') || (tx.type === fType);
      const matchCategory = (fCategory === 'all') || (tx.category === fCategory);
      const matchDesc = !sQuery || (tx.description.toLowerCase().includes(sQuery)) || (tx.category.toLowerCase().includes(sQuery));
      return matchType && matchCategory && matchDesc;
    });

    transactionRows.innerHTML = ''; // Clear existing rows

    if (filteredTransactions.length === 0) {
      transactionRows.innerHTML = '<tr><td colspan="6" class="placeholder-text text-center">Tidak ada transaksi yang cocok.</td></tr>';
      return;
    }

    filteredTransactions.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(tx => {
      const row = transactionRows.insertCell();
      row.insertCell().textContent = tx.date;
      row.insertCell().textContent = tx.category;
      row.insertCell().textContent = tx.description;
      row.insertCell().textContent = tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
      row.insertCell().textContent = formatRupiah(tx.amount);

      const actionsCell = row.insertCell();
      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-sm btn-action btn-edit';
      editBtn.innerHTML = '<i class="fa-solid fa-edit"></i>';
      editBtn.onclick = () => editTransaction(tx);
      actionsCell.appendChild(editBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-sm btn-action btn-delete';
      deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
      deleteBtn.onclick = () => deleteTransaction(tx.id);
      actionsCell.appendChild(deleteBtn);
    });
  }

  function editTransaction(tx) {
    transactionForm.dataset.editingId = tx.id; // Store ID for update
    txType.value = tx.type;
    txAmount.value = tx.amount;
    txCategory.value = tx.category;
    txDate.value = tx.date;
    txDesc.value = tx.description;
    document.getElementById('add-transaction-btn').textContent = 'Perbarui Transaksi';
  }

  function resetTransactionForm() {
    transactionForm.reset();
    delete transactionForm.dataset.editingId;
    document.getElementById('add-transaction-btn').textContent = 'Tambah Transaksi';
    txDate.value = getLocalDateString(); // Set default date to today
  }

  transactionForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const newTransaction = {
      id: transactionForm.dataset.editingId || null,
      type: txType.value,
      amount: parseFloat(txAmount.value),
      category: txCategory.value,
      date: txDate.value,
      description: txDesc.value,
    };
    addOrUpdateTransaction(newTransaction);
  });

  // --- Budget Logic ---
  async function addBudget(budget) {
    if (!currentUser) return;
    try {
      await FinanceDB.addBudget(currentUser.uid, budget);
      showToast('Batas anggaran berhasil ditambahkan.', 'success');
      await loadAllData();
      resetBudgetForm();
    } catch (error) {
      console.error("Error adding budget:", error);
      showToast('Gagal menambahkan batas anggaran.', 'danger');
    }
  }

  async function deleteBudget(budgetId) {
    if (!currentUser) return;
    if (!confirm('Anda yakin ingin menghapus batas anggaran ini?')) return;
    try {
      await FinanceDB.deleteBudget(currentUser.uid, budgetId);
      showToast('Batas anggaran berhasil dihapus.', 'success');
      await loadAllData();
    } catch (error) {
      console.error("Error deleting budget:", error);
      showToast('Gagal menghapus batas anggaran.', 'danger');
    }
  }
  window.deleteBudget = deleteBudget;

  function renderBudgets() {
    activeBudgetsList.innerHTML = '';
    if (budgets.length === 0) {
      activeBudgetsList.innerHTML = '<p class="placeholder-text">Belum ada batas anggaran aktif.</p>';
      return;
    }

    budgets.forEach(budget => {
      const li = document.createElement('li');
      li.className = 'budget-item';
      li.innerHTML = `
        <span>${budget.category} (${budget.type === 'daily' ? 'Harian' : 'Bulanan'}): ${formatRupiah(budget.amount)}</span>
        <button class="btn btn-sm btn-action btn-delete" onclick="deleteBudget('${budget.id}')"><i class="fa-solid fa-trash"></i></button>
      `;
      activeBudgetsList.appendChild(li);
    });
  }

  function resetBudgetForm() {
    budgetForm.reset();
  }

  budgetForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const newBudget = {
      category: budgetCategory.value,
      amount: parseFloat(budgetAmount.value),
      type: budgetForm.querySelector('input[name="budget-type"]:checked').value,
    };
    addBudget(newBudget);
  });

  // --- Saving Goals Logic ---
  async function addSavingGoal(goal) {
    if (!currentUser) return;
    try {
      await FinanceDB.addSavingGoal(currentUser.uid, goal);
      showToast('Target menabung berhasil ditambahkan.', 'success');
      await loadAllData();
      resetSavingGoalForm();
    } catch (error) {
      console.error("Error adding saving goal:", error);
      showToast('Gagal menambahkan target menabung.', 'danger');
    }
  }

  async function updateSavingGoal(goalId, amount) {
    if (!currentUser) return;
    try {
      await FinanceDB.updateSavingGoal(currentUser.uid, goalId, { currentAmount: amount });
      showToast('Target menabung berhasil diperbarui.', 'success');
      await loadAllData();
    } catch (error) {
      console.error("Error updating saving goal:", error);
      showToast('Gagal memperbarui target menabung.', 'danger');
    }
  }

  async function deleteSavingGoal(goalId) {
    if (!currentUser) return;
    if (!confirm('Anda yakin ingin menghapus target menabung ini?')) return;
    try {
      await FinanceDB.deleteSavingGoal(currentUser.uid, goalId);
      showToast('Target menabung berhasil dihapus.', 'success');
      await loadAllData();
    } catch (error) {
      console.error("Error deleting saving goal:", error);
      showToast('Gagal menghapus target menabung.', 'danger');
    }
  }
  window.deleteSavingGoal = deleteSavingGoal;

  function renderSavingGoals() {
    const savingGoalsGrid = document.getElementById('saving-goals-grid');
    const goalsPlaceholder = document.getElementById('goals-placeholder');
    const goalsSummaryText = document.getElementById('goals-summary-text');

    savingGoalsGrid.innerHTML = ''; // Clear existing cards
    if (savingGoals.length === 0) {
      goalsPlaceholder.style.display = 'block';
      goalsSummaryText.textContent = '0 target aktif';
      return;
    }
    goalsPlaceholder.style.display = 'none';

    let totalGoals = 0;
    let completedGoals = 0;

    savingGoals.forEach(goal => {
      totalGoals++;
      if (goal.currentAmount >= goal.targetAmount) {
        completedGoals++;
      }

      const progress = (goal.currentAmount / goal.targetAmount) * 100;
      const card = document.createElement('div');
      card.className = 'saving-goal-card';
      card.innerHTML = `
        <h3>${goal.name}</h3>
        <p class="goal-desc">${goal.description}</p>
        <div class="progress-bar-wrapper">
          <div class="progress-bar" style="width: ${Math.min(progress, 100)}%;"></div>
          <span class="progress-text">${formatRupiah(goal.currentAmount)} / ${formatRupiah(goal.targetAmount)}</span>
        </div>
        <p class="progress-percentage">${progress.toFixed(2)}% Tercapai</p>
        <div class="goal-actions">
          <button class="btn btn-sm btn-primary" onclick="showDepositModal('${goal.id}', ${goal.currentAmount})">Setor</button>
          <button class="btn btn-sm btn-delete" onclick="deleteSavingGoal('${goal.id}')">Hapus</button>
        </div>
      `;
      savingGoalsGrid.appendChild(card);
    });
    goalsSummaryText.textContent = `${completedGoals} dari ${totalGoals} target tercapai`;
  }

  const savingGoalForm = document.getElementById('saving-goal-form');
  const savingGoalName = document.getElementById('goal-name');
  const savingGoalTargetAmount = document.getElementById('goal-target-amount');
  const savingGoalDescription = document.getElementById('goal-desc');

  function resetSavingGoalForm() {
    savingGoalForm.reset();
  }

  savingGoalForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const newGoal = {
      name: savingGoalName.value,
      description: savingGoalDescription.value,
      targetAmount: parseFloat(savingGoalTargetAmount.value),
      currentAmount: 0, // Start with 0
      createdAt: new Date().toISOString(),
    };
    addSavingGoal(newGoal);
  });

  // Deposit to Saving Goal Modal
  const depositModal = document.getElementById('deposit-modal');
  const closeDepositModalBtn = document.getElementById('close-deposit-modal');
  const depositAmountInput = document.getElementById('deposit-amount');
  const confirmDepositBtn = document.getElementById('confirm-deposit-btn');
  let currentSavingGoalId = null;
  let currentSavingGoalCurrentAmount = 0;

  function showDepositModal(goalId, currentAmount) {
    currentSavingGoalId = goalId;
    currentSavingGoalCurrentAmount = currentAmount;
    depositAmountInput.value = ''; // Clear previous input
    depositModal.classList.remove('hidden');
  }
  window.showDepositModal = showDepositModal;

  closeDepositModalBtn.addEventListener('click', () => {
    depositModal.classList.add('hidden');
  });

  confirmDepositBtn.addEventListener('click', async () => {
    const amountToDeposit = parseFloat(depositAmountInput.value);
    if (isNaN(amountToDeposit) || amountToDeposit <= 0) {
      showToast('Jumlah setoran tidak valid.', 'danger');
      return;
    }
    const newAmount = currentSavingGoalCurrentAmount + amountToDeposit;
    await updateSavingGoal(currentSavingGoalId, newAmount);
    depositModal.classList.add('hidden');
  });

  // Close modal when clicking outside content
  depositModal.addEventListener('click', (e) => {
    if (e.target === depositModal) {
      depositModal.classList.add('hidden');
    }
  });


  // --- Chart Logic ---
  function renderCharts() {
    if (myChart) {
      myChart.destroy();
    }

    if (!transactions.length) {
      expensesChartCanvas.style.display = 'none';
      return;
    }
    expensesChartCanvas.style.display = 'block';

    if (activeChartTab === 'category') {
      renderCategoryDistributionChart();
    } else if (activeChartTab === 'trend') {
      renderMonthlyTrendChart();
    }
  }

  function renderCategoryDistributionChart() {
    const expenseTransactions = transactions.filter(tx => tx.type === 'expense');
    const categoryData = expenseTransactions.reduce((acc, tx) => {
      acc[tx.category] = (acc[tx.category] || 0) + tx.amount;
      return acc;
    }, {});

    const labels = Object.keys(categoryData);
    const data = Object.values(categoryData);

    myChart = new Chart(expensesChartCanvas, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40',
            '#8D6E63', '#C0CA33', '#795548', '#607D8B', '#E91E63', '#00BCD4',
            '#FFD700', '#ADFF2F'
          ],
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: 'var(--text-primary)',
            }
          },
          title: {
            display: true,
            text: 'Distribusi Pengeluaran berdasarkan Kategori',
            color: 'var(--text-primary)',
          }
        }
      }
    });
  }

  function renderMonthlyTrendChart() {
    const monthlyData = transactions.reduce((acc, tx) => {
      const monthYear = tx.date.substring(0, 7); // YYYY-MM
      if (!acc[monthYear]) {
        acc[monthYear] = { income: 0, expense: 0 };
      }
      if (tx.type === 'income') {
        acc[monthYear].income += tx.amount;
      } else {
        acc[monthYear].expense += tx.amount;
      }
      return acc;
    }, {});

    const sortedMonths = Object.keys(monthlyData).sort();
    const incomes = sortedMonths.map(month => monthlyData[month].income);
    const expenses = sortedMonths.map(month => monthlyData[month].expense);

    myChart = new Chart(expensesChartCanvas, {
      type: 'line',
      data: {
        labels: sortedMonths,
        datasets: [
          {
            label: 'Pemasukan',
            data: incomes,
            borderColor: 'var(--color-success)',
            backgroundColor: 'rgba(46, 204, 113, 0.2)',
            fill: true,
            tension: 0.3
          },
          {
            label: 'Pengeluaran',
            data: expenses,
            borderColor: 'var(--color-danger)',
            backgroundColor: 'rgba(231, 76, 60, 0.2)',
            fill: true,
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: 'var(--text-primary)',
            }
          },
          title: {
            display: true,
            text: 'Tren Pemasukan dan Pengeluaran Bulanan',
            color: 'var(--text-primary)',
          }
        },
        scales: {
          x: {
            ticks: {
              color: 'var(--text-secondary)',
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.1)',
            }
          },
          y: {
            ticks: {
              color: 'var(--text-secondary)',
              callback: function(value) {
                return formatRupiah(value);
              }
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.1)',
            }
          }
        }
      }
    });
  }


  // --- Master Data Load and UI Update ---
  async function loadAllData() {
    if (!currentUser) return;
    try {
      transactions = await FinanceDB.getTransactions(currentUser.uid);
      budgets = await FinanceDB.getBudgets(currentUser.uid);
      savingGoals = await FinanceDB.getSavingGoals(currentUser.uid);

      updateKPIs();
      renderTransactionTable();
      renderBudgets();
      renderSavingGoals();
      renderCharts();
      populateCategoryFilters(); // Ensure filters are populated
    } catch (error) {
      console.error("Error loading all data:", error);
      showToast('Gagal memuat data.', 'danger');
    }
  }

  function populateCategoryFilters() {
    // Clear existing options except 'all'
    filterCategory.innerHTML = '<option value="all">Semua Kategori</option>';

    // Get unique categories from all transactions
    const uniqueCategories = [...new Set(transactions.map(tx => tx.category))];

    uniqueCategories.sort().forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      filterCategory.appendChild(option);
    });
  }

  // Event Listeners for filters and tabs
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
      dailyReportRows.innerHTML = '<tr><td colspan="4" class="placeholder-text text-center">Tidak ada data untuk bulan ini.</td></tr>';
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

  // Initialize Database and load initial data
  const dbObj = window.FinanceDB || (typeof FinanceDB !== 'undefined' ? FinanceDB : null);
  if (dbObj && typeof dbObj.init === 'function') {
    dbObj.init().then(() => {
      // No setupAuthListener here, it's handled by the onAuthStateChanged at the top
    }).catch((err) => {
      console.error(err);
      showToast('Gagal membuka database.', 'danger');
    });
  }


});

