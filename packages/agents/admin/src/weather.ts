import { getWeatherSettings, type WeatherUnits } from '@wireassist/core';

// Current conditions and a short forecast from Open-Meteo (open-meteo.com):
// no API key, structured numbers rather than search-result snippets. Admin
// has no general web access, so this is its one door to live weather.
//
// Failures throw plain-English errors — the chat loop hands the message back
// to the model, which relays it, so it must say what to do next.

const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_FORECAST_DAYS = 7;

export interface WeatherParams {
  location?: string;
  units?: WeatherUnits;
  days?: number;
}

export interface WeatherReport {
  location: { name: string; region?: string; country?: string };
  units: WeatherUnits;
  current: {
    conditions: string;
    temperature: number;
    feelsLike: number;
    humidityPercent: number;
    windSpeed: number;
    precipitation: number;
  };
  daily: {
    date: string;
    conditions: string;
    high: number;
    low: number;
    precipitationChancePercent: number | null;
  }[];
  unitLabels: { temperature: string; wind: string; precipitation: string };
  source: string;
  fetchedAt: string;
}

type FetchFn = typeof fetch;

// WMO weather interpretation codes, as documented by Open-Meteo.
const WMO: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Freezing fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  56: 'Light freezing drizzle',
  57: 'Freezing drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Freezing rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Light rain showers',
  81: 'Rain showers',
  82: 'Violent rain showers',
  85: 'Light snow showers',
  86: 'Snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Thunderstorm with heavy hail',
};

export const describeWeatherCode = (code: number): string => WMO[code] ?? 'Unknown conditions';

const US_STATES: Record<string, string> = {
  al: 'alabama',
  ak: 'alaska',
  az: 'arizona',
  ar: 'arkansas',
  ca: 'california',
  co: 'colorado',
  ct: 'connecticut',
  de: 'delaware',
  fl: 'florida',
  ga: 'georgia',
  hi: 'hawaii',
  id: 'idaho',
  il: 'illinois',
  in: 'indiana',
  ia: 'iowa',
  ks: 'kansas',
  ky: 'kentucky',
  la: 'louisiana',
  me: 'maine',
  md: 'maryland',
  ma: 'massachusetts',
  mi: 'michigan',
  mn: 'minnesota',
  ms: 'mississippi',
  mo: 'missouri',
  mt: 'montana',
  ne: 'nebraska',
  nv: 'nevada',
  nh: 'new hampshire',
  nj: 'new jersey',
  nm: 'new mexico',
  ny: 'new york',
  nc: 'north carolina',
  nd: 'north dakota',
  oh: 'ohio',
  ok: 'oklahoma',
  or: 'oregon',
  pa: 'pennsylvania',
  ri: 'rhode island',
  sc: 'south carolina',
  sd: 'south dakota',
  tn: 'tennessee',
  tx: 'texas',
  ut: 'utah',
  vt: 'vermont',
  va: 'virginia',
  wa: 'washington',
  wv: 'west virginia',
  wi: 'wisconsin',
  wy: 'wyoming',
  dc: 'district of columbia',
};

interface GeoResult {
  name: string;
  latitude: number;
  longitude: number;
  admin1?: string;
  country?: string;
  country_code?: string;
}

async function getJson<T>(url: URL, fetchFn: FetchFn, what: string): Promise<T> {
  let res: Response;
  try {
    res = await fetchFn(url.toString(), { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch {
    throw new Error(`Couldn't reach the weather service (${what}). Try again in a moment.`);
  }
  if (!res.ok) {
    throw new Error(`The weather service returned an error (${what}: HTTP ${res.status}).`);
  }
  return (await res.json()) as T;
}

// Look a typed place up. The geocoder reads "Springfield, MO" but returns only
// the top hits, and a bare "Austin TX" (no comma) finds nothing — so this
// searches the part before the first comma, asks for several candidates, and
// uses whatever came after it (state, country) to pick between them.
export async function resolveLocation(query: string, fetchFn: FetchFn): Promise<GeoResult> {
  const [place, ...rest] = query.split(',');
  const name = place.trim();
  const qualifier = rest.join(' ').trim().toLowerCase();

  const url = new URL(GEOCODE_URL);
  url.searchParams.set('name', name);
  url.searchParams.set('count', '10');
  url.searchParams.set('language', 'en');
  const data = await getJson<{ results?: GeoResult[] }>(url, fetchFn, 'location lookup');
  const results = data.results ?? [];
  if (results.length === 0) {
    throw new Error(
      `Couldn't find a place called "${query}". Ask for a city name, optionally with a state or country.`
    );
  }
  if (!qualifier) return results[0];

  const wantedState = US_STATES[qualifier] ?? qualifier;
  const match = results.find((r) => {
    const admin1 = r.admin1?.toLowerCase() ?? '';
    const country = r.country?.toLowerCase() ?? '';
    const code = r.country_code?.toLowerCase() ?? '';
    return admin1 === wantedState || country === qualifier || code === qualifier;
  });
  return match ?? results[0];
}

// How a looked-up place is saved and shown: "Austin, Texas".
export const placeLabel = (place: Pick<GeoResult, 'name' | 'admin1'>): string =>
  [place.name, place.admin1].filter(Boolean).join(', ');

const UNIT_PARAMS: Record<WeatherUnits, Record<string, string>> = {
  imperial: { temperature_unit: 'fahrenheit', wind_speed_unit: 'mph', precipitation_unit: 'inch' },
  metric: { temperature_unit: 'celsius', wind_speed_unit: 'kmh', precipitation_unit: 'mm' },
};
const UNIT_LABELS: Record<WeatherUnits, WeatherReport['unitLabels']> = {
  imperial: { temperature: '°F', wind: 'mph', precipitation: 'in' },
  metric: { temperature: '°C', wind: 'km/h', precipitation: 'mm' },
};

export async function getWeather(
  params: WeatherParams,
  fetchFn: FetchFn = fetch
): Promise<WeatherReport> {
  const settings = getWeatherSettings();
  const query = params.location?.trim();
  const units: WeatherUnits =
    params.units === 'metric' || params.units === 'imperial' ? params.units : settings.units;
  const days = Math.min(Math.max(Math.round(params.days ?? 3), 1), MAX_FORECAST_DAYS);

  // A place named in the question wins; otherwise the location saved on the
  // dashboard / Settings page (already coordinates, so no lookup is needed).
  let place: Pick<GeoResult, 'name' | 'latitude' | 'longitude' | 'admin1' | 'country'>;
  if (query) {
    place = await resolveLocation(query, fetchFn);
  } else if (settings.location) {
    place = {
      name: settings.location.label,
      latitude: settings.location.lat,
      longitude: settings.location.lon,
    };
  } else {
    throw new Error(
      'No location given and none is saved. Ask the user which city, or tell them they can ' +
        'save one under Settings → Weather (or in the dashboard header).'
    );
  }

  const url = new URL(FORECAST_URL);
  url.searchParams.set('latitude', String(place.latitude));
  url.searchParams.set('longitude', String(place.longitude));
  url.searchParams.set(
    'current',
    'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m'
  );
  url.searchParams.set(
    'daily',
    'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max'
  );
  url.searchParams.set('forecast_days', String(days));
  url.searchParams.set('timezone', 'auto');
  for (const [key, value] of Object.entries(UNIT_PARAMS[units])) url.searchParams.set(key, value);

  const data = await getJson<{
    current?: {
      temperature_2m: number;
      apparent_temperature: number;
      relative_humidity_2m: number;
      precipitation: number;
      weather_code: number;
      wind_speed_10m: number;
    };
    daily?: {
      time: string[];
      weather_code: number[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      precipitation_probability_max?: (number | null)[];
    };
  }>(url, fetchFn, 'forecast');

  if (!data.current || !data.daily) {
    throw new Error('The weather service returned no forecast for that place. Try again later.');
  }
  const { current, daily } = data;

  return {
    location: { name: place.name, region: place.admin1, country: place.country },
    units,
    current: {
      conditions: describeWeatherCode(current.weather_code),
      temperature: current.temperature_2m,
      feelsLike: current.apparent_temperature,
      humidityPercent: current.relative_humidity_2m,
      windSpeed: current.wind_speed_10m,
      precipitation: current.precipitation,
    },
    daily: daily.time.map((date, i) => ({
      date,
      conditions: describeWeatherCode(daily.weather_code[i]),
      high: daily.temperature_2m_max[i],
      low: daily.temperature_2m_min[i],
      precipitationChancePercent: daily.precipitation_probability_max?.[i] ?? null,
    })),
    unitLabels: UNIT_LABELS[units],
    source: 'Open-Meteo (open-meteo.com)',
    fetchedAt: new Date().toISOString(),
  };
}
