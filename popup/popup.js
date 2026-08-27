import { request, validQr } from './api.js';
import { createPairingController } from './pairing.js';

const views = {
  qr: document.querySelector('#qrView'),
  input: document.querySelector('#inputView'),
  result: document.querySelector('#resultView'),
};
const connectionBadge = document.querySelector('#connectionBadge');
const connectionLabel = document.querySelector('#connectionLabel');
const toast = document.querySelector('#toast');
const toastMessage = document.querySelector('#toastMessage');
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
const pairingStorageKey = 'pairing';
const sessionStorageKey = 'sessionToken';
const maxFileSize = 2 * 1024 * 1024;
let source = 'manual';
let fileNumbers = [];
let scanning = false;
let sessionToken = null;
let toastTimer = null;

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

function showToast(message, type = 'connected') {
  clearTimeout(toastTimer);
  toastMessage.textContent = message;
  toast.classList.toggle('disconnected', type === 'disconnected');
  toast.hidden = false;
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 5000);
}

function showError(message) {
  formError.textContent = message;
  formError.hidden = false;
}

function clearError() {
  formError.textContent = '';
  formError.hidden = true;
}

function pairingError(error) {
  return error?.message || 'Request failed. Try again.';
}

function setScanControlsDisabled(disabled) {
  manualTab.disabled = disabled;
  fileTab.disabled = disabled;
  numbersInput.disabled = disabled;
  fileInput.disabled = disabled;
  document.querySelector('#scanButton').disabled = disabled;
  resetButton.disabled = disabled;
}

function pairingUi() {
  return {
    clearQr() {
      qrImage.hidden = true;
      qrImage.removeAttribute('src');
      qrCode.classList.remove('loading');
    },
    setCountdown(seconds) {
      qrCountdown.hidden = seconds === null;
      if (seconds !== null) qrCountdown.textContent = `Expires ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    },
    setGenerateLoading(loading) {
      connectButton.disabled = loading;
      connectLabel.textContent = loading ? 'Generating QR' : 'Generate QR';
    },
    setQrLoading() {
      qrImage.hidden = true;
      qrCode.classList.add('loading');
    },
    setStatus(message) {
      pairingStatus.textContent = message;
    },
    showQr(qr) {
      if (!validQr(qr)) throw new Error('Pairing response contains an invalid QR image.');
      qrCode.classList.remove('loading');
      qrImage.src = qr;
      qrImage.hidden = false;
    },
  };
}

const pairing = createPairingController(pairingUi(), async (token) => {
  await chrome.storage.local.set({ [sessionStorageKey]: token });
  sessionToken = token;
  setConnectionStatus('linked');
  showToast('WhatsApp connected. You can scan numbers now.');
  showView('input');
});

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

function renderCount() {
  const count = numbers().length;
  numberCount.textContent = count ? `${count} number${count === 1 ? '' : 's'} ready` : 'No numbers added';
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
  const status = result.has_whatsapp === true ? 'active' : result.has_whatsapp === false ? 'inactive' : result.error === 'invalid_number' ? 'invalid' : 'failed';
  const label = status === 'active' ? 'On WhatsApp' : status === 'inactive' ? 'Not on WhatsApp' : status === 'invalid' ? 'Invalid' : 'Failed';
  const row = document.createElement('tr');
  const indexCell = document.createElement('td');
  const numberCell = document.createElement('td');
  const statusCell = document.createElement('td');
  const statusBadge = document.createElement('span');
  indexCell.textContent = index + 1;
  numberCell.textContent = result.phone || result.input;
  statusBadge.className = `status ${status}`;
  statusBadge.textContent = label;
  statusCell.append(statusBadge);
  row.append(indexCell, numberCell, statusCell);
  resultsBody.append(row);
}

function startNewScan() {
  numbersInput.value = '';
  fileInput.value = '';
  fileNumbers = [];
  fileLabel.textContent = 'Choose a .txt or .csv file';
  fileStatus.textContent = 'File will be uploaded when scan starts.';
  selectSource('manual');
  renderCount();
  showView('input');
}

async function scan() {
  const list = numbers();
  if (scanning) return;
  if (!list.length) return showError(source === 'manual' ? 'Add at least one number before starting a scan.' : 'Choose a file with at least one number before starting a scan.');
  const invalidRows = invalidNumberRows(list);
  if (invalidRows.length) {
    const rows = invalidRows.slice(0, 5).map(({ index }) => index).join(', ');
    return showError(`Use country code without +. Digits only, 8-15 digits. Invalid row: ${rows}${invalidRows.length > 5 ? '…' : ''}.`);
  }
  if (!sessionToken) return showError('Session missing. Disconnect and pair WhatsApp again.');
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
    const response = await request('/check/bulk', { method: 'POST', headers: { Authorization: `Bearer ${sessionToken}` }, body: form, timeout: 120000 });
    const data = response.data;
    if (!Array.isArray(data?.results)) throw new Error('Bulk check response is missing results.');
    data.results.forEach((result, index) => addResult(index, result));
    updateProgress(data.total, data.total, data.on_whatsapp, data.not_on_whatsapp);
    resultTitle.textContent = 'Scan complete';
  } catch (error) {
    if ((error.status === 409 && error.code === 'device_unlinked') || (error.status === 401 && error.code === 'unauthenticated')) {
      await chrome.storage.local.remove(sessionStorageKey);
      sessionToken = null;
      setConnectionStatus('disconnected');
      showToast('WhatsApp disconnected. Scan QR to reconnect.', 'disconnected');
      showView('qr');
      pairing.create();
      return;
    } else if (error.status === 401 || error.status === 403) {
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

connectButton.addEventListener('click', () => pairing.create());
resetButton.addEventListener('click', async () => {
  if (scanning || !sessionToken) return;
  resetButton.disabled = true;
  resetButton.textContent = 'Disconnecting...';
  clearError();
  try {
    await request('/session', { method: 'DELETE', headers: { Authorization: `Bearer ${sessionToken}` } });
    await pairing.clear();
    await chrome.storage.local.remove(sessionStorageKey);
    sessionToken = null;
    setConnectionStatus('disconnected');
    showView('qr');
    pairing.create();
  } catch (error) {
    showError(`Disconnect failed. ${pairingError(error)}`);
  } finally {
    resetButton.disabled = false;
    resetButton.textContent = 'Disconnect session';
  }
});
document.querySelector('#scanButton').addEventListener('click', scan);
newScanButton.addEventListener('click', scan);
backButton.addEventListener('click', startNewScan);
retryButton.addEventListener('click', () => {
  if (sessionToken) return showView('input');
  showView('qr');
  pairing.create();
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
  if (!/\.(txt|csv)$/i.test(file.name) || file.size > maxFileSize) {
    fileInput.value = '';
    fileNumbers = [];
    fileLabel.textContent = 'Choose a .txt or .csv file';
    fileStatus.textContent = 'File will be uploaded when scan starts.';
    showError(file.size > maxFileSize ? 'Choose a file smaller than 2 MB.' : 'Choose a .txt or .csv file.');
    renderCount();
    return;
  }
  fileNumbers = (await file.text())
    .split(/\r?\n/)
    .filter((value, index) => value.trim() && (index || value.trim().toLowerCase() !== 'phone'));
  fileLabel.textContent = file.name;
  fileStatus.textContent = fileNumbers.length ? `${fileNumbers.length} number${fileNumbers.length === 1 ? '' : 's'} found in this file.` : 'No numbers found in this file.';
  if (fileNumbers.length) clearError();
  else showError('This file does not contain any numbers.');
  renderCount();
});

chrome.storage.local.get([pairingStorageKey, sessionStorageKey], async (stored) => {
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
        pairing.create();
      }
    }
  } else {
    showView('qr');
    setConnectionStatus('disconnected');
    if (!(await pairing.restore(stored[pairingStorageKey]))) pairing.create();
  }
  renderCount();
});
