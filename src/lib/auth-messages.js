// Canonical auth error strings — shared by BOTH the Edge middleware and the
// node-side API guards, so keep this file Edge-runtime-safe (no imports).
// Spec: API_implement doc — every 401/403 across the API surface must use
// exactly these messages.
export const UNAUTHORIZED_MESSAGE = 'missing Authorization header or token query parameter';
export const FORBIDDEN_MESSAGE = 'insufficient permissions';
