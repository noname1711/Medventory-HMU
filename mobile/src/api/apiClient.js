import { buildHeaders } from './apiConfig';

async function request(method, url, body, userId) {
  try {
    const res = await fetch(url, {
      method,
      headers: buildHeaders(userId),
      body: body != null ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

export const apiGet = (url, userId) => request('GET', url, undefined, userId);
export const apiSend = (method, url, body, userId) => request(method, url, body, userId);
