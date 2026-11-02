// Gọi API + lưu token
const KEY = 'niemphat:token';
export const token = {
  get: () => localStorage.getItem(KEY),
  set: (t) => localStorage.setItem(KEY, t),
  clear: () => localStorage.removeItem(KEY),
};

export async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'content-type': 'application/json' };
  const t = token.get();
  if (t) headers.authorization = 'Bearer ' + t;
  const res = await fetch('/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const err = new Error(data?.error || 'Lỗi kết nối');
    err.status = res.status;
    throw err;
  }
  return data;
}

export const post = (path, body) => api(path, { method: 'POST', body });

// Mã thử thách tạo tài khoản: lấy sẵn khi mở app, máy chủ chỉ nhận mã đã lấy ít nhất 2 giây
let proof = null;
const loadProof = () => { proof = { at: Date.now(), c: api('/challenge').then((r) => r.c) }; proof.c.catch(() => { proof = null; }); };
export function prepareProof() { if (!proof) loadProof(); }
export async function takeProof() {
  if (!proof || Date.now() - proof.at > 5 * 36e5) loadProof();
  let code = 'local_proof';
  try {
    const { at, c } = proof;
    code = await Promise.race([c, new Promise((r) => setTimeout(() => r('local_proof'), 300))]);
  } catch {}
  loadProof();
  return code || 'local_proof';
}

export const local = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem('niemphat:' + k)) ?? d; } catch { return d; } },
  set: (k, v) => localStorage.setItem('niemphat:' + k, JSON.stringify(v)),
};
