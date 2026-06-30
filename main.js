const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const qrcode = require('qrcode');
const XLSX = require('xlsx');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');

let mainWindow = null;
let waClient = null;
let clientReady = false;
let sending = false;
let cancelRequested = false;

// Cari Chrome/Edge yang sudah terpasang di sistem supaya tidak perlu
// mengunduh Chromium terpisah untuk whatsapp-web.js.
function findBrowser() {
  const env = process.env;
  const candidates = [
    env.PUPPETEER_EXECUTABLE_PATH,
    path.join(env['ProgramFiles'] || '', 'Google/Chrome/Application/chrome.exe'),
    path.join(env['ProgramFiles(x86)'] || '', 'Google/Chrome/Application/chrome.exe'),
    path.join(env['LOCALAPPDATA'] || '', 'Google/Chrome/Application/chrome.exe'),
    path.join(env['ProgramFiles'] || '', 'Microsoft/Edge/Application/msedge.exe'),
    path.join(env['ProgramFiles(x86)'] || '', 'Microsoft/Edge/Application/msedge.exe'),
  ].filter(Boolean);
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c; } catch (_) {}
  }
  return null;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 760,
    minWidth: 820,
    minHeight: 600,
    title: 'WA Bulk Sender',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.removeMenu();
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

// --- WhatsApp client ---------------------------------------------------------

function initWhatsApp() {
  if (waClient) return;

  const browserPath = findBrowser();
  const puppeteerOpts = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  };
  if (browserPath) puppeteerOpts.executablePath = browserPath;

  waClient = new Client({
    authStrategy: new LocalAuth({
      dataPath: path.join(app.getPath('userData'), 'wa-session'),
    }),
    puppeteer: puppeteerOpts,
  });

  waClient.on('qr', async (qr) => {
    try {
      const dataUrl = await qrcode.toDataURL(qr, { width: 280, margin: 1 });
      send('wa:status', { state: 'qr', message: 'Scan QR dengan WhatsApp di HP kamu' });
      send('wa:qr', dataUrl);
    } catch (e) {
      send('wa:status', { state: 'error', message: 'Gagal membuat QR: ' + e.message });
    }
  });

  waClient.on('loading_screen', (percent) => {
    send('wa:status', { state: 'loading', message: `Memuat WhatsApp... ${percent}%` });
  });

  waClient.on('authenticated', () => {
    send('wa:status', { state: 'authenticated', message: 'Terautentikasi, menyiapkan...' });
  });

  waClient.on('auth_failure', (msg) => {
    clientReady = false;
    send('wa:status', { state: 'error', message: 'Autentikasi gagal: ' + msg });
  });

  waClient.on('ready', async () => {
    clientReady = true;
    let me = '';
    try {
      const info = waClient.info;
      me = info && info.wid ? info.wid.user : '';
    } catch (_) {}
    send('wa:status', { state: 'ready', message: 'Terhubung' + (me ? ` sebagai ${me}` : '') });
    send('wa:ready', { number: me });
  });

  waClient.on('disconnected', (reason) => {
    clientReady = false;
    send('wa:status', { state: 'disconnected', message: 'Terputus: ' + reason });
  });

  send('wa:status', { state: 'init', message: 'Menginisialisasi WhatsApp...' });
  waClient.initialize().catch((e) => {
    send('wa:status', { state: 'error', message: 'Gagal init: ' + e.message });
  });
}

async function logoutWhatsApp() {
  if (!waClient) return;
  try {
    await waClient.logout();
  } catch (_) {}
  try {
    await waClient.destroy();
  } catch (_) {}
  waClient = null;
  clientReady = false;
  send('wa:status', { state: 'disconnected', message: 'Sudah logout' });
}

// --- Helpers -----------------------------------------------------------------

// Ubah nomor ke format WhatsApp: 62xxxx (tanpa +, spasi, atau 0 di depan)
function normalizeNumber(raw, defaultCountry) {
  if (raw === null || raw === undefined) return null;
  let n = String(raw).trim();
  if (!n) return null;
  // buang karakter non-digit kecuali tanda + di awal
  n = n.replace(/[^\d+]/g, '');
  if (n.startsWith('+')) n = n.slice(1);
  const cc = (defaultCountry || '62').replace(/\D/g, '');
  if (n.startsWith('0')) {
    n = cc + n.slice(1);
  } else if (n.startsWith('8') && cc === '62') {
    // banyak orang menulis tanpa 0, mis. 81234...
    n = cc + n;
  }
  if (n.length < 8) return null;
  return n;
}

function applyTemplate(template, row) {
  return template.replace(/\{([^}]+)\}/g, (match, key) => {
    const k = String(key).trim().toLowerCase();
    for (const col of Object.keys(row)) {
      if (String(col).trim().toLowerCase() === k) {
        return row[col] == null ? '' : String(row[col]);
      }
    }
    return match; // biarkan apa adanya jika kolom tidak ada
  });
}

function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

// --- IPC ---------------------------------------------------------------------

ipcMain.handle('wa:init', () => {
  initWhatsApp();
  return { ok: true };
});

ipcMain.handle('wa:logout', async () => {
  await logoutWhatsApp();
  return { ok: true };
});

ipcMain.handle('wa:state', () => ({ ready: clientReady, sending }));

ipcMain.handle('file:import', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Pilih file kontak',
    properties: ['openFile'],
    filters: [
      { name: 'Spreadsheet', extensions: ['csv', 'xlsx', 'xls'] },
      { name: 'Semua file', extensions: ['*'] },
    ],
  });
  if (result.canceled || !result.filePaths.length) {
    return { canceled: true };
  }
  const filePath = result.filePaths[0];
  try {
    const wb = XLSX.readFile(filePath, { raw: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    const headers = rows.length ? Object.keys(rows[0]) : [];
    return { canceled: false, fileName: path.basename(filePath), rows, headers };
  } catch (e) {
    return { canceled: false, error: 'Gagal membaca file: ' + e.message };
  }
});

ipcMain.handle('media:pick', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Pilih media (gambar/dokumen)',
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths.length) return { canceled: true };
  return { canceled: false, filePath: result.filePaths[0], fileName: path.basename(result.filePaths[0]) };
});

ipcMain.handle('wa:cancel', () => {
  cancelRequested = true;
  return { ok: true };
});

ipcMain.handle('wa:send', async (_evt, opts) => {
  if (!clientReady) return { ok: false, error: 'WhatsApp belum terhubung.' };
  if (sending) return { ok: false, error: 'Pengiriman lain sedang berjalan.' };

  const {
    rows,
    phoneColumn,
    message,
    defaultCountry,
    minDelay,
    maxDelay,
    mediaPath,
    caption,
  } = opts;

  sending = true;
  cancelRequested = false;

  let media = null;
  if (mediaPath) {
    try {
      media = MessageMedia.fromFilePath(mediaPath);
    } catch (e) {
      sending = false;
      return { ok: false, error: 'Gagal memuat media: ' + e.message };
    }
  }

  const minMs = Math.max(0, Number(minDelay) || 0) * 1000;
  const maxMs = Math.max(minMs, (Number(maxDelay) || 0) * 1000);

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const total = rows.length;

  for (let i = 0; i < rows.length; i++) {
    if (cancelRequested) {
      send('wa:progress', { index: i, total, status: 'cancelled', message: 'Dibatalkan oleh pengguna' });
      break;
    }
    const row = rows[i];
    const number = normalizeNumber(row[phoneColumn], defaultCountry);
    const label = row[phoneColumn];

    if (!number) {
      skipped++;
      send('wa:progress', { index: i, total, number: label, status: 'skipped', message: 'Nomor tidak valid', sent, failed, skipped });
      continue;
    }

    const chatId = number + '@c.us';
    const text = applyTemplate(message || '', row);

    try {
      // cek nomor terdaftar di WhatsApp
      const registered = await waClient.isRegisteredUser(chatId);
      if (!registered) {
        failed++;
        send('wa:progress', { index: i, total, number, status: 'failed', message: 'Nomor tidak terdaftar di WhatsApp', sent, failed, skipped });
      } else {
        if (media) {
          await waClient.sendMessage(chatId, media, { caption: caption || text || undefined });
        } else {
          await waClient.sendMessage(chatId, text);
        }
        sent++;
        send('wa:progress', { index: i, total, number, status: 'sent', message: 'Terkirim', sent, failed, skipped });
      }
    } catch (e) {
      failed++;
      send('wa:progress', { index: i, total, number, status: 'failed', message: e.message, sent, failed, skipped });
    }

    // jeda anti-ban (acak antara min & max) — kecuali pesan terakhir
    if (i < rows.length - 1 && !cancelRequested) {
      const wait = minMs + Math.floor(Math.random() * (maxMs - minMs + 1));
      if (wait > 0) {
        send('wa:progress', { index: i, total, status: 'waiting', message: `Jeda ${Math.round(wait / 1000)} detik...`, sent, failed, skipped });
        await delay(wait);
      }
    }
  }

  sending = false;
  return { ok: true, sent, failed, skipped, total, cancelled: cancelRequested };
});

ipcMain.handle('wa:groups', async () => {
  if (!clientReady) return { ok: false, error: 'WhatsApp belum terhubung.' };
  try {
    const chats = await waClient.getChats();
    const myId = (waClient.info && waClient.info.wid && waClient.info.wid._serialized) || '';
    const groups = chats
      .filter((c) => c.isGroup)
      .map((c) => {
        let isAdmin = false;
        try {
          const me = (c.participants || []).find((p) => p.id && p.id._serialized === myId);
          isAdmin = !!(me && (me.isAdmin || me.isSuperAdmin));
        } catch (_) {}
        return {
          id: c.id._serialized,
          name: c.name || '(tanpa nama)',
          count: (c.participants || []).length,
          isAdmin,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    return { ok: true, groups };
  } catch (e) {
    return { ok: false, error: 'Gagal memuat grup: ' + e.message };
  }
});

ipcMain.handle('wa:addToGroup', async (_evt, opts) => {
  if (!clientReady) return { ok: false, error: 'WhatsApp belum terhubung.' };
  if (sending) return { ok: false, error: 'Operasi lain sedang berjalan.' };

  const { rows, phoneColumn, groupId, defaultCountry, minDelay, maxDelay } = opts;

  let group;
  try {
    group = await waClient.getChatById(groupId);
    if (!group || !group.isGroup) throw new Error('Bukan grup yang valid');
  } catch (e) {
    return { ok: false, error: 'Gagal membuka grup: ' + e.message };
  }

  sending = true;
  cancelRequested = false;

  const minMs = Math.max(0, Number(minDelay) || 0) * 1000;
  const maxMs = Math.max(minMs, (Number(maxDelay) || 0) * 1000);

  let added = 0, invited = 0, failed = 0, skipped = 0;
  const total = rows.length;

  for (let i = 0; i < rows.length; i++) {
    if (cancelRequested) {
      send('wa:groupProgress', { index: i, total, status: 'cancelled', message: 'Dibatalkan', added, invited, failed, skipped });
      break;
    }
    const number = normalizeNumber(rows[i][phoneColumn], defaultCountry);
    if (!number) {
      skipped++;
      send('wa:groupProgress', { index: i, total, number: rows[i][phoneColumn], status: 'skipped', message: 'Nomor tidak valid', added, invited, failed, skipped });
      continue;
    }
    const chatId = number + '@c.us';

    try {
      const registered = await waClient.isRegisteredUser(chatId);
      if (!registered) {
        failed++;
        send('wa:groupProgress', { index: i, total, number, status: 'failed', message: 'Tidak terdaftar di WhatsApp', added, invited, failed, skipped });
      } else {
        const result = await group.addParticipants([chatId], { autoSendInviteV4: true });
        const entry = (result && (result[chatId] || result[number] || Object.values(result)[0])) || {};
        const code = Number(entry.code);
        if (code === 200) {
          added++;
          send('wa:groupProgress', { index: i, total, number, status: 'added', message: 'Ditambahkan ke grup', added, invited, failed, skipped });
        } else if (code === 403 || entry.isInviteV4Sent) {
          invited++;
          send('wa:groupProgress', { index: i, total, number, status: 'invited', message: 'Tidak bisa langsung ditambah (privasi) — undangan dikirim', added, invited, failed, skipped });
        } else if (code === 409) {
          skipped++;
          send('wa:groupProgress', { index: i, total, number, status: 'skipped', message: 'Sudah jadi anggota grup', added, invited, failed, skipped });
        } else {
          failed++;
          send('wa:groupProgress', { index: i, total, number, status: 'failed', message: (entry.message || 'Gagal') + (code ? ` (kode ${code})` : ''), added, invited, failed, skipped });
        }
      }
    } catch (e) {
      failed++;
      send('wa:groupProgress', { index: i, total, number, status: 'failed', message: e.message, added, invited, failed, skipped });
    }

    if (i < rows.length - 1 && !cancelRequested) {
      const wait = minMs + Math.floor(Math.random() * (maxMs - minMs + 1));
      if (wait > 0) {
        send('wa:groupProgress', { index: i, total, status: 'waiting', message: `Jeda ${Math.round(wait / 1000)} detik...`, added, invited, failed, skipped });
        await delay(wait);
      }
    }
  }

  sending = false;
  return { ok: true, added, invited, failed, skipped, total, cancelled: cancelRequested };
});

// --- App lifecycle -----------------------------------------------------------

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', async () => {
  if (waClient) {
    try { await waClient.destroy(); } catch (_) {}
  }
  if (process.platform !== 'darwin') app.quit();
});
