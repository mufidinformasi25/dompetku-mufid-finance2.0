const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const { google } = require("googleapis");
const serviceAccount = require("./service-account.json"); // Pastikan ini ada di folder functions dan TIDAK di-commit

admin.initializeApp();

const SPREADSHEET_ID = "1gNuULRvowQpLs8TD9iMgvOh44nnJILp1hvgdYIRzjos";
const SHEET_NAME = "Sheet1";
const HEADER_ROW_INDEX = 1; // Baris 1 adalah header

// Inisialisasi Google Sheets API
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: serviceAccount.client_email,
    private_key: serviceAccount.private_key.replace(/\\n/g, "\n"), // Handle escaped newlines
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

/**
 * Mendapatkan indeks baris terakhir yang berisi data.
 * Berguna untuk menambahkan data baru di bawah data yang sudah ada.
 */
async function getLastRowIndex(spreadsheetId, sheetName) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: `${sheetName}!A:A`, // Baca kolom A untuk menemukan baris terakhir
    });
    return response.data.values ? response.data.values.length : 0;
  } catch (error) {
    console.error("Error getting last row index:", error);
    return 0;
  }
}

/**
 * Menemukan baris transaksi berdasarkan ID transaksi.
 * Asumsi: Transaksi memiliki kolom ID unik di spreadsheet.
 */
async function findRowByTransactionId(spreadsheetId, sheetName, transactionId) {
  const range = `${sheetName}!A:Z`; // Sesuaikan range jika perlu
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId,
    range: range,
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) {
    return -1; // Tidak ada data
  }

  // Lewati baris header jika ada
  const dataRows = rows.slice(HEADER_ROW_INDEX);

  for (let i = 0; i < dataRows.length; i++) {
    // Asumsi: ID transaksi ada di kolom pertama (indeks 0)
    if (dataRows[i][0] === transactionId) {
      return i + HEADER_ROW_INDEX; // Kembalikan indeks baris di spreadsheet (mulai dari 1)
    }
  }
  return -1; // Tidak ditemukan
}

// =========================================================
// Firestore Trigger: Ketika Transaksi BARU Dibuat
// =========================================================
exports.addTransactionToSheet = functions.firestore.document("users/{userId}/transactions/{transactionId}").onCreate(async (snap, context) => {
  const transaction = snap.data();
  const transactionId = snap.id; // ID dokumen Firestore

  try {
    const lastRow = await getLastRowIndex(SPREADSHEET_ID, SHEET_NAME);
    const startRow = lastRow > HEADER_ROW_INDEX ? lastRow + 1 : HEADER_ROW_INDEX + 1; // Mulai setelah header

    const values = [transactionId, transaction.date, transaction.type, transaction.amount, transaction.category, transaction.description, context.params.userId];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A${startRow}`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      resource: {
        values: [values],
      },
    });
    console.log(`Transaction ${transactionId} added to Google Sheet.`);
    return null;
  } catch (error) {
    console.error("Error adding transaction to Google Sheet:", error);
    return null;
  }
});

// =========================================================
// Firestore Trigger: Ketika Transaksi Diperbarui
// =========================================================
exports.updateTransactionInSheet = functions.firestore.document("users/{userId}/transactions/{transactionId}").onUpdate(async (change, context) => {
  const newData = change.after.data();
  const transactionId = change.after.id;

  try {
    const rowIndex = await findRowByTransactionId(SPREADSHEET_ID, SHEET_NAME, transactionId);

    if (rowIndex === -1) {
      console.warn(`Transaction ${transactionId} not found in Google Sheet for update.`);
      return null;
    }

    const values = [transactionId, newData.date, newData.type, newData.amount, newData.category, newData.description, context.params.userId];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A${rowIndex + 1}`, // +1 karena range Sheets berbasis 1
      valueInputOption: "USER_ENTERED",
      resource: {
        values: [values],
      },
    });
    console.log(`Transaction ${transactionId} updated in Google Sheet at row${rowIndex + 1}.`);
    return null;
  } catch (error) {
    console.error("Error updating transaction in Google Sheet:", error);
    return null;
  }
});

// =========================================================
// Firestore Trigger: Ketika Transaksi Dihapus
// =========================================================
exports.deleteTransactionFromSheet = functions.firestore.document("users/{userId}/transactions/{transactionId}").onDelete(async (snap, context) => {
  const transactionId = snap.id;

  try {
    const rowIndex = await findRowByTransactionId(SPREADSHEET_ID, SHEET_NAME, transactionId);

    if (rowIndex === -1) {
      console.warn(`Transaction ${transactionId} not found in Google Sheet for deletion.`);
      return null;
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      resource: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: 0, // 0 untuk sheet pertama (Sheet1)
                startIndex: rowIndex, // Indeks baris dimulai dari 0 untuk API
                endIndex: rowIndex + 1,
              },
            },
          },
        ],
      },
    });
    console.log(`Transaction ${transactionId} deleted from Google Sheet at row${rowIndex + 1}.`);
    return null;
  } catch (error) {
    console.error("Error deleting transaction from Google Sheet:", error);
    return null;
  }
});
