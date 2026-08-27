const views = {
  qr: document.querySelector('#qrView'),
  input: document.querySelector('#inputView'),
  result: document.querySelector('#resultView'),
};
const connectionBadge = document.querySelector('#connectionBadge');
const connectionLabel = document.querySelector('#connectionLabel');
const numbersInput = document.querySelector('#numbersInput');
const fileInput = document.querySelector('#fileInput');
const fileLabel = document.querySelector('#fileLabel');
const fileStatus = document.querySelector('#fileStatus');
const numberCount = document.querySelector('#numberCount');
const formError = document.querySelector('#formError');
const manualTab = document.querySelector('#manualTab');
const fileTab = document.querySelector('#fileTab');
const manualPanel = document.querySelector('#manualPanel');
const filePanel = document.querySelector('#filePanel');
const resultsBody = document.querySelector('#resultsBody');
const resultTitle = document.querySelector('#resultTitle');
const progressLabel = document.querySelector('#progressLabel');
const progressBar = document.querySelector('#progressBar');
const totalStat = document.querySelector('#totalStat');
const activeStat = document.querySelector('#activeStat');
const inactiveStat = document.querySelector('#inactiveStat');
const newScanButton = document.querySelector('#newScanButton');
const backButton = document.querySelector('#backButton');
const resetButton = document.querySelector('#resetButton');
const connectButton = document.querySelector('#connectButton');
const connectLabel = document.querySelector('#connectLabel');
const qrImage = document.querySelector('#qrImage');
const qrCode = document.querySelector('#qrCode');
const pairingStatus = document.querySelector('#pairingStatus');
const qrCountdown = document.querySelector('#qrCountdown');
const scanStatus = document.querySelector('#scanStatus');
const bulkLoading = document.querySelector('#bulkLoading');
const bulkError = document.querySelector('#bulkError');
const bulkErrorMessage = document.querySelector('#bulkErrorMessage');
const retryButton = document.querySelector('#retryButton');
const scanData = document.querySelector('#scanData');
const progressTrack = document.querySelector('#progressTrack');
const apiBase = 'https://webscanner.djgroup-dev.com/api/v1/scan';
const pairingStorageKey = 'pairing';
const sessionStorageKey = 'sessionToken';
let source = 'manual';
let fileNumbers = [];
let scanning = false;
let pairing = null;
let pairingTimer = null;
let qrTimer = null;
let qrRefreshPromise = null;
let qrRefreshRetryTimer = null;
let sessionToken = null;

function showView(name) {
  Object.entries(views).forEach(([key, view]) => {
    view.hidden = key !== name;
  });
  connectionBadge.hidden = false;
}

function setConnectionStatus(status) {
  connectionLabel.textContent = status === 'linked'
    ? 'WhatsApp linked'
    : status === 'checking'
      ? 'Checking session'
      : 'WhatsApp not connected';
  connectionBadge.classList.toggle('checking', status === 'checking');
  connectionBadge.classList.toggle('disconnected', status === 'disconnected');
}

function numbers() {
  return source === 'manual'
    ? numbersInput.value.split(/\r?\n/).filter((value) => value.trim())
    : fileNumbers;
}

function invalidNumberRows(list) {
  return list
    .map((number, index) => ({ number: number.trim(), index: index + 1 }))
    .filter(({ number }) => !/^[1-9]\d{7,14}$/.test(number));
}

function showError(message) {
  formError.textContent = message;
  formError.hidden = false;
}

function clearError() {
  formError.textContent = '';
  formError.hidden = true;
}

function setScanControlsDisabled(disabled) {
  manualTab.disabled = disabled;
  fileTab.disabled = disabled;
  numbersInput.disabled = disabled;
  fileInput.disabled = disabled;
  document.querySelector('#scanButton').disabled = disabled;
  document.querySelector('#resetButton').disabled = disabled;
}

function pairingError(error) {
  return error?.message || 'Pairing request failed. Try again.';
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function stopPairingPoll() {
  clearTimeout(pairingTimer);
  pairingTimer = null;
}

function stopQrTimer() {
  clearInterval(qrTimer);
  clearTimeout(qrRefreshRetryTimer);
  qrTimer = null;
  qrRefreshRetryTimer = null;
  qrCountdown.hidden = true;
}

function qrExpiresInSeconds() {
  return Math.max(0, Math.ceil((Date.parse(pairing?.qrExpiresAt) - Date.now()) / 1000));
}

async function clearPairing() {
  stopPairingPoll();
  stopQrTimer();
  pairing = null;
  qrImage.hidden = true;
  qrImage.removeAttribute('src');
  qrCode.classList.remove('loading');
  await chrome.storage.local.remove(pairingStorageKey);
}

function setPairingStatus(message) {
  pairingStatus.textContent = message;
}

function showQr(qr) {
  qrCode.classList.remove('loading');
  qrImage.src = qr;
  qrImage.hidden = false;
}

function updateQrCountdown() {
  const seconds = qrExpiresInSeconds();
  qrCountdown.textContent = `Expires ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  qrCountdown.hidden = false;
  if (seconds > 3 || !pairing) return;
  stopQrTimer();
  setPairingStatus('Refreshing QR');
  refreshQr().catch((error) => {
    setPairingStatus(pairingError(error));
    if (!pairingExpired()) qrRefreshRetryTimer = setTimeout(() => refreshQr().catch(() => {}), 3000);
  });
}

function startQrTimer() {
  stopQrTimer();
  if (!pairing?.qrExpiresAt) return;
  updateQrCountdown();
  qrTimer = setInterval(updateQrCountdown, 1000);
}

function pairingExpired() {
  return pairing?.expiresAt && Date.parse(pairing.expiresAt) <= Date.now();
}

async function refreshQr() {
  if (qrRefreshPromise) return qrRefreshPromise;
  const pairingId = pairing.id;
  const pairingToken = pairing.token;
  qrImage.hidden = true;
  qrCode.classList.add('loading');
  qrRefreshPromise = (async () => {
    const response = await request(`/pairings/${encodeURIComponent(pairingId)}/qr`, {
      method: 'POST',
      headers: { 'X-Pairing-Token': pairingToken },
    });
    const data = response.data;
    if (!data?.qr || !data?.qr_expires_at) throw new Error('QR refresh response is missing QR data.');
    if (!pairing || pairing.id !== pairingId) return;
    pairing = { ...pairing, qr: data.qr, qrExpiresAt: data.qr_expires_at, expiresAt: data.expires_at };
    await chrome.storage.local.set({ [pairingStorageKey]: pairing });
    showQr(data.qr);
    setPairingStatus('Waiting for scan');
    startQrTimer();
  })();
  try {
    await qrRefreshPromise;
  } finally {
    qrRefreshPromise = null;
  }
}

async function pollPairing() {
  if (!pairing) return;
  if (pairingExpired()) {
    await clearPairing();
    setPairingStatus('Pairing expired. Create a new pairing.');
    connectButton.disabled = false;
    return;
  }
  try {
    if (pairing.qrExpiresAt && qrExpiresInSeconds() <= 3) await refreshQr();
    const response = await request(`/pairings/${encodeURIComponent(pairing.id)}`, {
      headers: { 'X-Pairing-Token': pairing.token },
    });
    const state = response.data?.state;
    if (state === 'paired') {
      stopPairingPoll();
      const pairedSessionToken = response.data?.session_token;
      if (!pairedSessionToken) {
        setPairingStatus('Paired response is missing session token. Create a new pairing.');
        return;
      }
      await chrome.storage.local.set({ [sessionStorageKey]: pairedSessionToken });
      sessionToken = pairedSessionToken;
      setConnectionStatus('linked');
      await clearPairing();
      showView('input');
      return;
    }
    if (response.data?.qr_expires_at && Date.parse(response.data.qr_expires_at) > Date.parse(pairing.qrExpiresAt)) {
      pairing = {
        ...pairing,
        qrExpiresAt: response.data.qr_expires_at,
        expiresAt: response.data.expires_at || pairing.expiresAt,
      };
      await chrome.storage.local.set({ [pairingStorageKey]: pairing });
      startQrTimer();
    }
    setPairingStatus(state === 'pending' ? 'Waiting for scan' : response.message || 'Waiting for scan');
    pairingTimer = setTimeout(pollPairing, 3000);
  } catch (error) {
    setPairingStatus(pairingError(error));
    pairingTimer = setTimeout(pollPairing, 3000);
  }
}

async function createPairing() {
  connectButton.disabled = true;
  connectLabel.textContent = 'Generating QR';
  clearError();
  try {
    await clearPairing();
    qrCode.classList.add('loading');
    setPairingStatus('Creating pairing');
    const response = await request('/pairings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendor_code: 'EXT' }),
    });
    const data = response.data;
    if (!data?.pairing_id || !data?.pairing_token || !data?.qr) {
      throw new Error('Pairing response is missing required data.');
    }
    pairing = {
      id: data.pairing_id,
      token: data.pairing_token,
      qr: data.qr,
      qrExpiresAt: data.qr_expires_at,
      expiresAt: data.expires_at,
    };
    await chrome.storage.local.set({ [pairingStorageKey]: pairing });
    showQr(data.qr);
    setPairingStatus('Waiting for scan');
    startQrTimer();
    pollPairing();
  } catch (error) {
    await clearPairing();
    setPairingStatus(pairingError(error));
  } finally {
    connectButton.disabled = false;
    connectLabel.textContent = 'Generate QR';
  }
}

function renderCount() {
  const count = numbers().length;
  numberCount.textContent = count
    ? `${count} number${count === 1 ? '' : 's'} ready`
    : 'No numbers added';
}

function selectSource(nextSource) {
  if (scanning) return;
  source = nextSource;
  const manual = source === 'manual';
  manualTab.classList.toggle('active', manual);
  fileTab.classList.toggle('active', !manual);
  manualTab.setAttribute('aria-selected', String(manual));
  fileTab.setAttribute('aria-selected', String(!manual));
  manualPanel.hidden = !manual;
  filePanel.hidden = manual;
  clearError();
  renderCount();
}

function updateProgress(total, complete, onWhatsapp, notOnWhatsapp) {
  totalStat.textContent = total;
  activeStat.textContent = onWhatsapp;
  inactiveStat.textContent = notOnWhatsapp;
  progressLabel.textContent = `${complete} / ${total}`;
  progressBar.style.width = `${total ? (complete / total) * 100 : 0}%`;
}

function addResult(index, result) {
  const status = result.has_whatsapp === true
    ? 'active'
    : result.has_whatsapp === false
      ? 'inactive'
      : result.error === 'invalid_number'
        ? 'invalid'
        : 'failed';
  const label = status === 'active'
    ? 'On WhatsApp'
    : status === 'inactive'
      ? 'Not on WhatsApp'
      : status === 'invalid'
        ? 'Invalid'
        : 'Failed';
  const row = document.createElement('tr');
  const numberCell = document.createElement('td');
  numberCell.textContent = result.phone || result.input;
  row.innerHTML = `<td>${index + 1}</td>`;
  row.append(numberCell);
  row.insertAdjacentHTML(
    'beforeend',
    `<td><span class="status ${status}">${label}</span></td>`,
  );
  resultsBody.append(row);
}

async function scan() {
  const list = numbers();
  if (scanning) return;
  if (!list.length) {
    showError(source === 'manual' ? 'Add at least one number before starting a scan.' : 'Choose a file with at least one number before starting a scan.');
    return;
  }
  const invalidRows = invalidNumberRows(list);
  if (invalidRows.length) {
    const rows = invalidRows.slice(0, 5).map(({ index }) => index).join(', ');
    const more = invalidRows.length > 5 ? '…' : '';
    showError(`Use country code without +. Digits only, 8-15 digits. Invalid row: ${rows}${more}.`);
    return;
  }
  if (!sessionToken) {
    showError('Session missing. Disconnect and pair WhatsApp again.');
    return;
  }
  clearError();
  scanning = true;
  setScanControlsDisabled(true);
  resultsBody.replaceChildren();
  resultTitle.textContent = 'Scanning numbers';
  newScanButton.hidden = true;
  backButton.hidden = true;
  scanStatus.textContent = `Checking ${list.length} number${list.length === 1 ? '' : 's'} with WhatsApp. This may take a while.`;
  bulkLoading.hidden = false;
  bulkError.hidden = true;
  progressTrack.hidden = false;
  retryButton.textContent = 'Back to input';
  scanData.hidden = true;
  progressTrack.classList.add('indeterminate');
  updateProgress(list.length, 0, 0, 0);
  showView('result');
  try {
    const form = new FormData();
    if (source === 'file') form.append('file', fileInput.files[0]);
    else form.append('numbers', list.join('\n'));
    const response = await request('/check/bulk', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}` },
      body: form,
    });
    const data = response.data;
    if (!Array.isArray(data?.results)) throw new Error('Bulk check response is missing results.');
    data.results.forEach((result, index) => addResult(index, result));
    updateProgress(data.total, data.total, data.on_whatsapp, data.not_on_whatsapp);
    resultTitle.textContent = 'Scan complete';
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      await chrome.storage.local.remove(sessionStorageKey);
      sessionToken = null;
      setConnectionStatus('disconnected');
      bulkErrorMessage.textContent = 'WhatsApp session expired. Connect again.';
      retryButton.textContent = 'Connect again';
    } else {
      bulkErrorMessage.textContent = pairingError(error);
    }
    resultTitle.textContent = 'Scan results';
    bulkError.hidden = false;
  } finally {
    progressTrack.classList.remove('indeterminate');
    progressTrack.hidden = !bulkError.hidden;
    bulkLoading.hidden = true;
    scanData.hidden = !bulkError.hidden;
    newScanButton.hidden = false;
    backButton.hidden = false;
    scanning = false;
    setScanControlsDisabled(false);
  }
}

connectButton.addEventListener('click', createPairing);
resetButton.addEventListener('click', async () => {
  if (scanning || !sessionToken) return;
  resetButton.disabled = true;
  resetButton.textContent = 'Disconnecting...';
  clearError();
  try {
    await request('/session', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    await clearPairing();
    await chrome.storage.local.remove(sessionStorageKey);
    sessionToken = null;
    setConnectionStatus('disconnected');
    showView('qr');
    setPairingStatus('Generating QR');
    createPairing();
  } catch (error) {
    showError(`Disconnect failed. ${pairingError(error)}`);
  } finally {
    resetButton.disabled = false;
    resetButton.textContent = 'Disconnect session';
  }
});
document.querySelector('#scanButton').addEventListener('click', scan);
newScanButton.addEventListener('click', () => showView('input'));
backButton.addEventListener('click', () => showView('input'));
retryButton.addEventListener('click', () => {
  if (sessionToken) {
    showView('input');
    return;
  }
  showView('qr');
  setPairingStatus('Generating QR');
  createPairing();
});
manualTab.addEventListener('click', () => selectSource('manual'));
fileTab.addEventListener('click', () => selectSource('file'));
numbersInput.addEventListener('input', () => {
  clearError();
  renderCount();
});
fileInput.addEventListener('change', async () => {
  const [file] = fileInput.files;
  if (!file) return;
  if (!/\.(txt|csv)$/i.test(file.name)) {
    fileInput.value = '';
    fileNumbers = [];
    fileLabel.textContent = 'Choose a .txt or .csv file';
    fileStatus.textContent = 'File will be uploaded when scan starts.';
    showError('Choose a .txt or .csv file.');
    renderCount();
    return;
  }
  fileNumbers = (await file.text())
    .split(/\r?\n/)
    .filter((value) => value.trim());
  fileLabel.textContent = file.name;
  fileStatus.textContent = fileNumbers.length
    ? `${fileNumbers.length} number${fileNumbers.length === 1 ? '' : 's'} found in this file.`
    : 'No numbers found in this file.';
  if (fileNumbers.length) clearError();
  else showError('This file does not contain any numbers.');
  renderCount();
});
chrome.storage.local.get([pairingStorageKey, sessionStorageKey], async (stored) => {
  pairing = stored[pairingStorageKey] || null;
  sessionToken = stored[sessionStorageKey] || null;
  if (sessionToken) {
    const storedSessionToken = sessionToken;
    showView('input');
    setConnectionStatus('checking');
    try {
      await request('/session', { headers: { Authorization: `Bearer ${storedSessionToken}` } });
      setConnectionStatus('linked');
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        await chrome.storage.local.remove(sessionStorageKey);
        sessionToken = null;
        setConnectionStatus('disconnected');
        showView('qr');
        setPairingStatus('Generating QR');
        createPairing();
      }
    }
  } else if (pairing && !pairingExpired()) {
    showView('qr');
    setConnectionStatus('disconnected');
    setPairingStatus('Restoring pairing');
    if (pairing.qr && pairing.qrExpiresAt && Date.parse(pairing.qrExpiresAt) > Date.now()) {
      showQr(pairing.qr);
      startQrTimer();
      pollPairing();
    } else {
      refreshQr().then(pollPairing).catch(async (error) => {
        await clearPairing();
        setPairingStatus(pairingError(error));
      });
    }
  } else if (pairing) {
    showView('qr');
    setConnectionStatus('disconnected');
    clearPairing();
    setPairingStatus('Pairing expired. Create a new pairing.');
  } else {
    showView('qr');
    setConnectionStatus('disconnected');
    setPairingStatus('Generating QR');
    createPairing();
  }
  renderCount();
});
