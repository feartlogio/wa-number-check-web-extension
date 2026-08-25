const views = {
  qr: document.querySelector('#qrView'),
  input: document.querySelector('#inputView'),
  result: document.querySelector('#resultView'),
};
const connectionBadge = document.querySelector('#connectionBadge');
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
let source = 'manual';
let fileNumbers = [];
let scanning = false;

function showView(name) {
  Object.entries(views).forEach(([key, view]) => {
    view.hidden = key !== name;
  });
  connectionBadge.hidden = name === 'qr';
}

function numbers() {
  return source === 'manual'
    ? numbersInput.value.split(/\r?\n/).filter((value) => value.trim())
    : fileNumbers;
}

function showError(message) {
  formError.textContent = message;
  formError.hidden = false;
}

function clearError() {
  formError.textContent = '';
  formError.hidden = true;
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

function statusFor(number) {
  let hash = 0;
  for (let index = 0; index < number.length; index += 1)
    hash = (hash * 31 + number.charCodeAt(index)) >>> 0;
  return hash % 5 ? 'active' : 'inactive';
}

function updateProgress(total, complete, active) {
  totalStat.textContent = total;
  activeStat.textContent = active;
  inactiveStat.textContent = complete - active;
  progressLabel.textContent = `${complete} / ${total}`;
  progressBar.style.width = `${total ? (complete / total) * 100 : 0}%`;
}

function addResult(index, number, status) {
  const row = document.createElement('tr');
  const numberCell = document.createElement('td');
  numberCell.textContent = number;
  row.innerHTML = `<td>${index + 1}</td>`;
  row.append(numberCell);
  row.insertAdjacentHTML(
    'beforeend',
    `<td><span class="status ${status}">${status === 'active' ? 'Active' : 'Inactive'}</span></td>`,
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
  clearError();
  scanning = true;
  resultsBody.replaceChildren();
  resultTitle.textContent = 'Scanning numbers';
  newScanButton.hidden = true;
  backButton.hidden = true;
  updateProgress(list.length, 0, 0);
  showView('result');
  let active = 0;
  for (const [index, number] of list.entries()) {
    await new Promise((resolve) => setTimeout(resolve, 280));
    const status = statusFor(number);
    if (status === 'active') active += 1;
    addResult(index, number, status);
    updateProgress(list.length, index + 1, active);
  }
  resultTitle.textContent = 'Scan complete';
  newScanButton.hidden = false;
  backButton.hidden = false;
  scanning = false;
}

document.querySelector('#connectButton').addEventListener('click', async () => {
  await chrome.storage.local.set({ whatsappConnected: true });
  showView('input');
});
document.querySelector('#resetButton').addEventListener('click', async () => {
  if (!scanning) {
    await chrome.storage.local.remove('whatsappConnected');
    showView('qr');
  }
});
document.querySelector('#scanButton').addEventListener('click', scan);
newScanButton.addEventListener('click', () => showView('input'));
backButton.addEventListener('click', () => showView('input'));
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
    fileStatus.textContent = 'Your file stays local and is not uploaded.';
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
chrome.storage.local.get('whatsappConnected', ({ whatsappConnected }) => {
  showView(whatsappConnected ? 'input' : 'qr');
  renderCount();
});
