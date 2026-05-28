/** Shared dev/prod port defaults (override with API_PORT / WEB_PORT). */
export function getApiPort() {
  return process.env.API_PORT ?? '3002';
}

export function getWebPort() {
  return process.env.WEB_PORT ?? '3001';
}

export function apiOrigin() {
  return `http://127.0.0.1:${getApiPort()}`;
}
