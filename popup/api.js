export const apiBase = 'https://webscanner.djgroup-dev.com/api/v1/scan';

export async function request(path, { timeout = 15000, ...options } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  let response;
  try {
    response = await fetch(`${apiBase}${path}`, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Request timed out. Try again.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

export function validQr(qr) {
  return typeof qr === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(qr);
}
