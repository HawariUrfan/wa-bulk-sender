// State
let importedRows = [];
let headers = [];
let mediaPath = null;

const $ = (id) => document.getElementById(id);

// --- Koneksi ----------------------------------------------------------------
$('btnConnect').addEventListener('click', async () => {
  $('btnConnect').disabled = true;
  $('qrBox').innerHTML = '<div class="qr-placeholder">Menyiapkan QR...</div>';
  await window.wa.init();
});

$('btnLogout').addEventListener('click', async () => {
  await window.wa.logout();
  $('qrBox').innerHTML = '<div class="qr-placeholder">Sudah logout. Klik "Hubungkan" untuk scan ulang.</div>';
  $('btnConnect').disabled = false;
  $('btnLogout').disabled = true;
  updateSendButton();
});

let waReady = false;

window.wa.onStatus((p) => {
  $('statusText').textContent = p.message;
  const dot = $('statusDot');
  dot.className = 'dot';
  if (p.state === 'ready') dot.classList.add('dot-on');
  else if (p.state === 'error' || p.state === 'disconnected') dot.classList.add('dot-err');
  else if (p.state === 'qr') dot.classList.add('dot-wait');
  else dot.classList.add('dot-wait');

  if (p.state === 'ready') {
    waReady = true;
    $('qrBox').innerHTML = '<div class="qr-placeholder" style="color:#1da851;font-weight:600;">✅ Terhubung</div>';
    $('btnLogout').disabled = false;
    $('btnConnect').disabled = true;
  }
  if (p.state === 'disconnected' || p.state === 'error') {
    waReady = false;
    $('btnConnect').disabled = false;
  }
  updateSendButton();
});

window.wa.onQr((dataUrl) => {
  $('qrBox').innerHTML = `<img src="${dataUrl}" alt="QR" />`;
});

window.wa.onReady(() => {
  waReady = true;
  updateSendButton();
});

// --- Import kontak ----------------------------------------------------------
$('btnImport').addEventListener('click', async () => {
  const res = await window.wa.importFile();
  if (res.canceled) return;
  if (res.error) { alert(res.error); return; }

  importedRows = res.rows || [];
  headers = res.headers || [];
  $('fileInfo').textContent = `${res.fileName} — ${importedRows.length} baris`;

  // pilih kolom nomor
  const sel = $('phoneCol');
  sel.innerHTML = '';
  headers.forEach((h) => {
    const opt = document.createElement('option');
    opt.value = h;
    opt.textContent = h;
    sel.appendChild(opt);
  });
  // auto-deteksi kolom nomor
  const guess = headers.find((h) => /phone|nomor|no\.?hp|hp|wa|telp|telepon|number|kontak/i.test(h));
  if (guess) sel.value = guess;
  $('colPickerRow').style.display = importedRows.length ? 'flex' : 'none';

  renderPreview();
  updateSendButton();
});

$('phoneCol').addEventListener('change', renderPreview);

function renderPreview() {
  if (!importedRows.length) { $('contactPreview').innerHTML = ''; return; }
  const cols = headers.slice(0, 5);
  const rowsHtml = importedRows.slice(0, 8).map((r) => {
    return '<tr>' + cols.map((c) => `<td>${escapeHtml(r[c])}</td>`).join('') + '</tr>';
  }).join('');
  const head = '<tr>' + cols.map((c) => `<th>${escapeHtml(c)}</th>`).join('') + '</tr>';
  const more = importedRows.length > 8 ? `<div class="muted" style="padding:6px 8px;">...dan ${importedRows.length - 8} baris lain</div>` : '';
  $('contactPreview').innerHTML = `<table>${head}${rowsHtml}</table>${more}`;
}

// --- Media ------------------------------------------------------------------
$('btnMedia').addEventListener('click', async () => {
  const res = await window.wa.pickMedia();
  if (res.canceled) return;
  mediaPath = res.filePath;
  $('mediaInfo').textContent = res.fileName;
  $('btnClearMedia').style.display = 'inline-block';
});
$('btnClearMedia').addEventListener('click', () => {
  mediaPath = null;
  $('mediaInfo').textContent = 'Tidak ada lampiran';
  $('btnClearMedia').style.display = 'none';
});

// --- Kirim ------------------------------------------------------------------
function updateSendButton() {
  $('btnSend').disabled = !(waReady && importedRows.length > 0);
  updateGroupButton();
}

$('btnSend').addEventListener('click', async () => {
  const message = $('message').value.trim();
  if (!message && !mediaPath) { alert('Tulis pesan atau lampirkan media dulu.'); return; }

  const minD = Number($('minDelay').value);
  const maxD = Number($('maxDelay').value);
  if (maxD < minD) { alert('Jeda Max harus >= Min.'); return; }

  if (!confirm(`Kirim ke ${importedRows.length} kontak?\n\nJeda acak ${minD}-${maxD} detik antar pesan.`)) return;

  $('btnSend').style.display = 'none';
  $('btnCancel').style.display = 'inline-block';
  $('progressWrap').style.display = 'block';
  $('log').innerHTML = '';
  $('progressBar').style.width = '0%';

  const res = await window.wa.send({
    rows: importedRows,
    phoneColumn: $('phoneCol').value,
    message,
    defaultCountry: $('country').value || '62',
    minDelay: minD,
    maxDelay: maxD,
    mediaPath,
    caption: message,
  });

  $('btnSend').style.display = 'inline-block';
  $('btnCancel').style.display = 'none';

  if (!res.ok) {
    alert('Error: ' + res.error);
    return;
  }
  addLog(`Selesai — Terkirim: ${res.sent}, Gagal: ${res.failed}, Dilewati: ${res.skipped} dari ${res.total}` +
    (res.cancelled ? ' (dibatalkan)' : ''), 'sent');
});

$('btnCancel').addEventListener('click', async () => {
  await window.wa.cancel();
  $('btnCancel').disabled = true;
  $('btnCancel').textContent = 'Membatalkan...';
});

window.wa.onProgress((p) => {
  const pct = p.total ? Math.round(((p.index + 1) / p.total) * 100) : 0;
  if (p.status !== 'waiting') $('progressBar').style.width = pct + '%';

  if (typeof p.sent === 'number') {
    $('counters').innerHTML =
      `<span class="ok">✅ ${p.sent} terkirim</span>` +
      `<span class="fail">❌ ${p.failed} gagal</span>` +
      `<span class="skip">⏭️ ${p.skipped} dilewati</span>`;
  }

  const labels = {
    sent: '✅', failed: '❌', skipped: '⏭️', waiting: '⏳', cancelled: '🛑',
  };
  const icon = labels[p.status] || '•';
  const who = p.number ? ` ${p.number}` : '';
  addLog(`${icon}${who} — ${p.message}`, p.status);
});

// --- Tambah ke Grup ---------------------------------------------------------
$('btnRefreshGroups').addEventListener('click', async () => {
  if (!waReady) { alert('Hubungkan WhatsApp dulu.'); return; }
  $('btnRefreshGroups').disabled = true;
  $('btnRefreshGroups').textContent = '⏳ Memuat...';
  const res = await window.wa.listGroups();
  $('btnRefreshGroups').disabled = false;
  $('btnRefreshGroups').textContent = '🔄 Muat daftar grup';
  if (!res.ok) { alert(res.error); return; }

  const sel = $('groupSelect');
  sel.innerHTML = '';
  if (!res.groups.length) {
    sel.innerHTML = '<option value="">(tidak ada grup)</option>';
  } else {
    res.groups.forEach((g) => {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = `${g.name} (${g.count})${g.isAdmin ? ' • admin' : ' • bukan admin'}`;
      opt.disabled = !g.isAdmin;
      sel.appendChild(opt);
    });
    // pilih grup admin pertama
    const firstAdmin = Array.from(sel.options).find((o) => !o.disabled);
    if (firstAdmin) sel.value = firstAdmin.value;
  }
  updateGroupButton();
});

$('groupSelect').addEventListener('change', updateGroupButton);

function updateGroupButton() {
  const sel = $('groupSelect');
  $('btnAddGroup').disabled = !(waReady && importedRows.length > 0 && sel.value);
}

$('btnAddGroup').addEventListener('click', async () => {
  const sel = $('groupSelect');
  if (!sel.value) { alert('Pilih grup dulu (dan kamu harus admin).'); return; }
  if (!importedRows.length) { alert('Import file kontak dulu.'); return; }

  const minD = Number($('minDelay').value);
  const maxD = Number($('maxDelay').value);
  if (maxD < minD) { alert('Jeda Max harus >= Min.'); return; }

  const groupName = sel.options[sel.selectedIndex].textContent;
  if (!confirm(`Tambahkan ${importedRows.length} kontak ke grup:\n${groupName}?\n\nJeda acak ${minD}-${maxD} detik. Yang privasinya tertutup akan dikirimi undangan.`)) return;

  $('btnAddGroup').style.display = 'none';
  $('btnCancelGroup').style.display = 'inline-block';
  $('btnCancelGroup').disabled = false;
  $('btnCancelGroup').textContent = 'Batalkan';
  $('groupProgressWrap').style.display = 'block';
  $('groupLog').innerHTML = '';
  $('groupProgressBar').style.width = '0%';

  const res = await window.wa.addToGroup({
    rows: importedRows,
    phoneColumn: $('phoneCol').value,
    groupId: sel.value,
    defaultCountry: $('country').value || '62',
    minDelay: minD,
    maxDelay: maxD,
  });

  $('btnAddGroup').style.display = 'inline-block';
  $('btnCancelGroup').style.display = 'none';

  if (!res.ok) { alert('Error: ' + res.error); return; }
  addGroupLog(`Selesai — Ditambahkan: ${res.added}, Diundang: ${res.invited}, Gagal: ${res.failed}, Dilewati: ${res.skipped} dari ${res.total}` +
    (res.cancelled ? ' (dibatalkan)' : ''), 'added');
});

$('btnCancelGroup').addEventListener('click', async () => {
  await window.wa.cancel();
  $('btnCancelGroup').disabled = true;
  $('btnCancelGroup').textContent = 'Membatalkan...';
});

window.wa.onGroupProgress((p) => {
  const pct = p.total ? Math.round(((p.index + 1) / p.total) * 100) : 0;
  if (p.status !== 'waiting') $('groupProgressBar').style.width = pct + '%';
  if (typeof p.added === 'number') {
    $('groupCounters').innerHTML =
      `<span class="ok">✅ ${p.added} ditambah</span>` +
      `<span class="invite">✉️ ${p.invited} diundang</span>` +
      `<span class="fail">❌ ${p.failed} gagal</span>` +
      `<span class="skip">⏭️ ${p.skipped} dilewati</span>`;
  }
  const icons = { added: '✅', invited: '✉️', failed: '❌', skipped: '⏭️', waiting: '⏳', cancelled: '🛑' };
  const icon = icons[p.status] || '•';
  const who = p.number ? ` ${p.number}` : '';
  addGroupLog(`${icon}${who} — ${p.message}`, p.status);
});

function addGroupLog(text, cls) {
  const div = document.createElement('div');
  div.className = 'line ' + (cls || '');
  div.textContent = text;
  $('groupLog').appendChild(div);
  $('groupLog').scrollTop = $('groupLog').scrollHeight;
}

function addLog(text, cls) {
  const div = document.createElement('div');
  div.className = 'line ' + (cls || '');
  div.textContent = text;
  $('log').appendChild(div);
  $('log').scrollTop = $('log').scrollHeight;
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
