/**
 * Shared status normalisation helpers used across approval screens.
 *
 * The backend returns status in several shapes:
 *   - int  0 = PENDING, 1 = APPROVED, 2 = REJECTED
 *   - string 'PENDING' | 'APPROVED' | 'REJECTED'
 *   - object { value: 0|1|2 } or { name: '...' }
 *
 * normaliseStatus → 'PENDING' | 'APPROVED' | 'REJECTED' | null
 * statusBadge     → { label: string, variant: string }
 */

/**
 * Normalise any status representation to one of the three canonical strings.
 * @param {number|string|object|null|undefined} status
 * @returns {'PENDING'|'APPROVED'|'REJECTED'|null}
 */
export function normaliseStatus(status) {
  if (status == null) return null;
  if (typeof status === 'object') {
    if (status.name) return normaliseStatus(status.name);
    if (status.value !== undefined) {
      return status.value === 0 ? 'PENDING' : status.value === 1 ? 'APPROVED' : 'REJECTED';
    }
    return null;
  }
  if (typeof status === 'number') {
    return status === 0 ? 'PENDING' : status === 1 ? 'APPROVED' : 'REJECTED';
  }
  const s = String(status).toUpperCase();
  if (s.includes('PENDING') || s.includes('CHO') || s.includes('CHỜ')) return 'PENDING';
  if (s.includes('APPROVED') || s.includes('DUYET') || s.includes('DUYỆT')) return 'APPROVED';
  if (s.includes('REJECTED') || s.includes('REJECT') || s.includes('TU CHOI') || s.includes('TỪ CHỐI')) return 'REJECTED';
  return null;
}

/**
 * Map a status value to a { label, variant } pair suitable for <Badge>.
 * @param {*} status  — any shape the backend may return
 * @param {string} [fallbackLabel]  — shown when the status cannot be mapped
 * @returns {{ label: string, variant: string }}
 */
export function statusBadge(status, fallbackLabel) {
  const norm = normaliseStatus(status);
  switch (norm) {
    case 'PENDING':  return { label: 'Chờ duyệt', variant: 'warning' };
    case 'APPROVED': return { label: 'Đã duyệt',  variant: 'success' };
    case 'REJECTED': return { label: 'Từ chối',   variant: 'danger'  };
    default:
      return { label: fallbackLabel || String(status ?? '—'), variant: 'neutral' };
  }
}
