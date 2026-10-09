/** Shared dev/prod port defaults (override with API_PORT / WEB_PORT). */
export function getApiPort() {
  return process.env.API_PORT ?? '3002';
}

export function getWebPort() {
  return process.env.WEB_PORT ?? '3001';
}

/**
 * Interface the web UI listens on. Loopback by default — the UI fronts an
 * unauthenticated API, so it shouldn't be LAN-reachable from a plain dev run.
 * The Docker deploy sets WEB_HOST=0.0.0.0 (docker-compose.yml).
 */
export function getWebHost() {
  return process.env.WEB_HOST || '127.0.0.1';
}

export function apiOrigin() {
  return `http://127.0.0.1:${getApiPort()}`;
}
