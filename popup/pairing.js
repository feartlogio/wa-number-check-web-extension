import { request, validQr } from './api.js';

const pairingStorageKey = 'pairing';

export function createPairingController(ui, onPaired) {
  let pairing = null;
  let pairingTimer = null;
  let qrTimer = null;
  let qrRefreshPromise = null;
  let qrRefreshRetryTimer = null;

  function stopPoll() {
    clearTimeout(pairingTimer);
    pairingTimer = null;
  }

  function stopQrTimer() {
    clearInterval(qrTimer);
    clearTimeout(qrRefreshRetryTimer);
    qrTimer = null;
    qrRefreshRetryTimer = null;
    ui.setCountdown(null);
  }

  function expired() {
    return pairing?.expiresAt && Date.parse(pairing.expiresAt) <= Date.now();
  }

  function qrExpiresInSeconds() {
    return Math.max(
      0,
      Math.ceil((Date.parse(pairing?.qrExpiresAt) - Date.now()) / 1000),
    );
  }

  async function save() {
    await chrome.storage.local.set({ [pairingStorageKey]: pairing });
  }

  async function clear() {
    stopPoll();
    stopQrTimer();
    pairing = null;
    ui.clearQr();
    await chrome.storage.local.remove(pairingStorageKey);
  }

  async function refreshQr() {
    if (qrRefreshPromise) return qrRefreshPromise;
    const pairingId = pairing.id;
    const pairingToken = pairing.token;
    ui.setQrLoading();
    qrRefreshPromise = (async () => {
      const response = await request(
        `/pairings/${encodeURIComponent(pairingId)}/qr`,
        {
          method: 'POST',
          headers: { 'X-Pairing-Token': pairingToken },
        },
      );
      const data = response.data;
      if (!validQr(data?.qr) || !data?.qr_expires_at)
        throw new Error('QR refresh response is missing valid QR data.');
      if (!pairing || pairing.id !== pairingId) return;
      pairing = {
        ...pairing,
        qrExpiresAt: data.qr_expires_at,
        expiresAt: data.expires_at,
      };
      await save();
      ui.showQr(data.qr);
      ui.setStatus('Waiting for scan');
      startQrTimer();
    })();
    try {
      await qrRefreshPromise;
    } finally {
      qrRefreshPromise = null;
    }
  }

  function updateQrCountdown() {
    const seconds = qrExpiresInSeconds();
    ui.setCountdown(seconds);
    if (seconds > 3 || !pairing) return;
    stopQrTimer();
    ui.setStatus('Refreshing QR');
    refreshQr().catch((error) => {
      ui.setStatus(error.message || 'QR refresh failed.');
      if (!expired())
        qrRefreshRetryTimer = setTimeout(
          () => refreshQr().catch(() => {}),
          3000,
        );
    });
  }

  function startQrTimer() {
    stopQrTimer();
    if (!pairing?.qrExpiresAt) return;
    updateQrCountdown();
    qrTimer = setInterval(updateQrCountdown, 1000);
  }

  async function poll() {
    if (!pairing) return;
    if (expired()) {
      await clear();
      ui.setStatus('Pairing expired. Create a new pairing.');
      return;
    }
    try {
      if (qrExpiresInSeconds() <= 3) await refreshQr();
      const response = await request(
        `/pairings/${encodeURIComponent(pairing.id)}`,
        {
          headers: { 'X-Pairing-Token': pairing.token },
        },
      );
      if (response.data?.state === 'paired') {
        const sessionToken = response.data?.session_token;
        if (!sessionToken)
          throw new Error('Paired response is missing session token.');
        stopPoll();
        await clear();
        await onPaired(sessionToken);
        return;
      }
      if (
        response.data?.qr_expires_at &&
        Date.parse(response.data.qr_expires_at) >
          Date.parse(pairing.qrExpiresAt)
      ) {
        pairing = {
          ...pairing,
          qrExpiresAt: response.data.qr_expires_at,
          expiresAt: response.data.expires_at || pairing.expiresAt,
        };
        await save();
        startQrTimer();
      }
      ui.setStatus(
        response.data?.state === 'pending'
          ? 'Waiting for scan'
          : response.message || 'Waiting for scan',
      );
    } catch (error) {
      ui.setStatus(error.message || 'Pairing request failed. Try again.');
    }
    pairingTimer = setTimeout(poll, 3000);
  }

  async function create() {
    ui.setGenerateLoading(true);
    try {
      await clear();
      ui.setQrLoading();
      ui.setStatus('Creating pairing');
      const response = await request('/pairings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor_code: 'EXT' }),
      });
      const data = response.data;
      if (!data?.pairing_id || !data?.pairing_token || !validQr(data?.qr))
        throw new Error('Pairing response is missing required data.');
      pairing = {
        id: data.pairing_id,
        token: data.pairing_token,
        qrExpiresAt: data.qr_expires_at,
        expiresAt: data.expires_at,
      };
      await save();
      ui.showQr(data.qr);
      ui.setStatus('Waiting for scan');
      startQrTimer();
      poll();
    } catch (error) {
      await clear();
      ui.setStatus(error.message || 'Pairing request failed. Try again.');
    } finally {
      ui.setGenerateLoading(false);
    }
  }

  async function restore(storedPairing) {
    pairing = storedPairing;
    if (!pairing || expired()) {
      await clear();
      return false;
    }
    ui.setStatus('Restoring pairing');
    try {
      await refreshQr();
      poll();
      return true;
    } catch (error) {
      await clear();
      ui.setStatus(error.message || 'Pairing request failed. Try again.');
      return true;
    }
  }

  return { clear, create, restore };
}
