// "Where I am" for anything weather-related: the dashboard's weather chip and
// the Admin Agent's get_weather tool share this one saved location, so it is
// entered once (dashboard or Settings) and used everywhere. Editable from
// either place and applied on the next request — no restart, no editing .env.
//
// Stored as a tiny JSON file under WIREASSIST_HOME (same convention as
// diagnostics.ts). The location is saved as coordinates plus a display label,
// so reading it never needs a network call.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';

export type WeatherUnits = 'imperial' | 'metric';

export interface WeatherLocation {
  lat: number;
  lon: number;
  // What a person would call it, e.g. "Austin, Texas".
  label: string;
}

export interface WeatherSettings {
  location: WeatherLocation | null;
  units: WeatherUnits;
}

const DEFAULTS: WeatherSettings = { location: null, units: 'imperial' };
const MAX_LABEL_LENGTH = 120;

function home(): string {
  // Resolved on each call (not at import) so it follows WIREASSIST_HOME.
  return join(process.env.WIREASSIST_HOME ?? homedir(), '.wireassist');
}

function readJson(path: string): Record<string, unknown> | null {
  try {
    if (!existsSync(path)) return null;
    const parsed = JSON.parse(readFileSync(path, 'utf-8'));
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    // Corrupt or unreadable file: treat as unset rather than breaking the dashboard or chat.
    return null;
  }
}

function asLocation(value: unknown): WeatherLocation | null {
  const v = value as Partial<WeatherLocation> | null | undefined;
  if (
    v &&
    typeof v.lat === 'number' &&
    typeof v.lon === 'number' &&
    Number.isFinite(v.lat) &&
    Number.isFinite(v.lon) &&
    typeof v.label === 'string'
  ) {
    return { lat: v.lat, lon: v.lon, label: v.label.slice(0, MAX_LABEL_LENGTH) };
  }
  return null;
}

export function getWeatherSettings(): WeatherSettings {
  const saved = readJson(join(home(), 'weather.json'));
  // Before this file existed the dashboard kept its own copy of the location.
  // Falling back to it means a city already saved there is not lost.
  // Only when this file has never stored a location: an explicit clear
  // (location: null) must stay cleared.
  const location =
    saved && 'location' in saved
      ? asLocation(saved.location)
      : asLocation(readJson(join(home(), 'dashboard-location.json')));
  return {
    location,
    units: saved?.units === 'metric' ? 'metric' : DEFAULTS.units,
  };
}

// Throws on invalid input so an API route can answer 400 instead of saving junk.
// `location: null` clears the saved location.
export function setWeatherSettings(update: {
  location?: WeatherLocation | null;
  units?: WeatherUnits;
}): WeatherSettings {
  const next = getWeatherSettings();

  if (update.location !== undefined) {
    if (update.location === null) {
      next.location = null;
    } else {
      const location = asLocation(update.location);
      if (!location) throw new Error('location needs lat (number), lon (number) and label (text)');
      next.location = location;
    }
  }
  if (update.units !== undefined) {
    if (update.units !== 'imperial' && update.units !== 'metric') {
      throw new Error('units must be "imperial" or "metric"');
    }
    next.units = update.units;
  }

  const path = join(home(), 'weather.json');
  mkdirSync(dirname(path), { recursive: true });
  // Written explicitly (even when null) so clearing is not undone by the
  // legacy-file fallback in getWeatherSettings().
  writeFileSync(path, JSON.stringify({ location: next.location, units: next.units }, null, 2));
  return next;
}
