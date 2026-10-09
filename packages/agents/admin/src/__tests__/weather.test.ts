import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { setWeatherSettings } from '@wireassist/core';
import { describeWeatherCode, getWeather, resolveLocation } from '../weather';
import { ADMIN_TOOL_SCHEMAS, READ_ONLY_ADMIN_TOOLS } from '../tool-schemas';

const AUSTIN_TX = {
  name: 'Austin',
  latitude: 30.27,
  longitude: -97.74,
  admin1: 'Texas',
  country: 'United States',
  country_code: 'US',
};
const AUSTIN_MN = { ...AUSTIN_TX, latitude: 43.67, longitude: -92.97, admin1: 'Minnesota' };

const FORECAST = {
  current: {
    temperature_2m: 81.5,
    apparent_temperature: 84,
    relative_humidity_2m: 60,
    precipitation: 0,
    weather_code: 2,
    wind_speed_10m: 7.2,
  },
  daily: {
    time: ['2026-10-09', '2026-10-10'],
    weather_code: [2, 61],
    temperature_2m_max: [88, 79],
    temperature_2m_min: [68, 64],
    precipitation_probability_max: [10, null],
  },
};

// A fake fetch that answers the geocoder and the forecast endpoint and records the URLs asked.
function fakeFetch(geo: unknown[] = [AUSTIN_TX], opts: { forecastStatus?: number } = {}) {
  const urls: URL[] = [];
  const fn = jest.fn(async (input: Parameters<typeof fetch>[0]) => {
    const url = new URL(String(input));
    urls.push(url);
    if (url.hostname.startsWith('geocoding')) {
      return new Response(JSON.stringify({ results: geo }), { status: 200 });
    }
    return new Response(JSON.stringify(FORECAST), { status: opts.forecastStatus ?? 200 });
  });
  return { fn: fn as unknown as typeof fetch, urls };
}

describe('get_weather', () => {
  let home: string;
  let previousHome: string | undefined;
  beforeEach(() => {
    previousHome = process.env.WIREASSIST_HOME;
    home = mkdtempSync(join(tmpdir(), 'wa-weather-'));
    process.env.WIREASSIST_HOME = home;
  });
  afterEach(() => {
    if (previousHome === undefined) delete process.env.WIREASSIST_HOME;
    else process.env.WIREASSIST_HOME = previousHome;
    rmSync(home, { recursive: true, force: true });
  });

  it('is registered as a read-only chat tool with a schema', () => {
    expect(ADMIN_TOOL_SCHEMAS.get_weather).toBeDefined();
    expect(READ_ONLY_ADMIN_TOOLS.has('get_weather')).toBe(true);
  });

  it('returns current conditions and a forecast with plain-English conditions', async () => {
    const { fn } = fakeFetch();
    const report = await getWeather({ location: 'Austin' }, fn);
    expect(report.location).toMatchObject({ name: 'Austin', region: 'Texas' });
    expect(report.current).toMatchObject({ conditions: 'Partly cloudy', temperature: 81.5 });
    expect(report.daily).toHaveLength(2);
    expect(report.daily[1]).toMatchObject({
      conditions: 'Light rain',
      precipitationChancePercent: null,
    });
    expect(report.unitLabels.temperature).toBe('°F');
  });

  it('asks the API for the right units', async () => {
    const imperial = fakeFetch();
    await getWeather({ location: 'Austin', units: 'imperial' }, imperial.fn);
    expect(imperial.urls[1].searchParams.get('temperature_unit')).toBe('fahrenheit');
    expect(imperial.urls[1].searchParams.get('wind_speed_unit')).toBe('mph');

    const metric = fakeFetch();
    const report = await getWeather({ location: 'Austin', units: 'metric' }, metric.fn);
    expect(metric.urls[1].searchParams.get('temperature_unit')).toBe('celsius');
    expect(report.unitLabels.wind).toBe('km/h');
  });

  it('uses the saved location and units when none is given, with no lookup needed', async () => {
    setWeatherSettings({
      location: { lat: 52.52, lon: 13.4, label: 'Berlin, Berlin' },
      units: 'metric',
    });
    const { fn, urls } = fakeFetch();
    const report = await getWeather({}, fn);
    // Only the forecast was requested — saved coordinates skip the geocoder.
    expect(urls).toHaveLength(1);
    expect(urls[0].hostname).toBe('api.open-meteo.com');
    expect(urls[0].searchParams.get('latitude')).toBe('52.52');
    expect(report.location.name).toBe('Berlin, Berlin');
    expect(report.units).toBe('metric');
  });

  it('uses a place named in the question over the saved one', async () => {
    setWeatherSettings({ location: { lat: 52.52, lon: 13.4, label: 'Berlin, Berlin' } });
    const { fn, urls } = fakeFetch();
    const report = await getWeather({ location: 'Austin' }, fn);
    expect(urls[0].searchParams.get('name')).toBe('Austin');
    expect(report.location.name).toBe('Austin');
  });

  it('tells the model what to do when there is no location at all', async () => {
    const { fn } = fakeFetch();
    await expect(getWeather({}, fn)).rejects.toThrow(/Ask the user which city/);
    expect(fn).not.toHaveBeenCalled();
  });

  it('clamps the forecast length to 1-7 days', async () => {
    const low = fakeFetch();
    await getWeather({ location: 'Austin', days: 0 }, low.fn);
    expect(low.urls[1].searchParams.get('forecast_days')).toBe('1');
    const high = fakeFetch();
    await getWeather({ location: 'Austin', days: 99 }, high.fn);
    expect(high.urls[1].searchParams.get('forecast_days')).toBe('7');
  });

  it('says so plainly when the place is not found', async () => {
    const { fn } = fakeFetch([]);
    await expect(getWeather({ location: 'Nowhereville' }, fn)).rejects.toThrow(
      /Couldn't find a place called "Nowhereville"/
    );
  });

  it('turns an HTTP error from the forecast service into a readable error', async () => {
    const { fn } = fakeFetch([AUSTIN_TX], { forecastStatus: 503 });
    await expect(getWeather({ location: 'Austin' }, fn)).rejects.toThrow(/HTTP 503/);
  });

  it('turns a network failure into a readable error', async () => {
    const fn = jest.fn(async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    await expect(getWeather({ location: 'Austin' }, fn)).rejects.toThrow(
      /Couldn't reach the weather service/
    );
  });
});

describe('resolveLocation', () => {
  it('searches by the city name only, since the geocoder cannot match "City, ST"', async () => {
    const { fn, urls } = fakeFetch([AUSTIN_MN, AUSTIN_TX]);
    await resolveLocation('Austin, TX', fn);
    expect(urls[0].searchParams.get('name')).toBe('Austin');
  });

  it('uses a US state abbreviation to pick the right city', async () => {
    const { fn } = fakeFetch([AUSTIN_MN, AUSTIN_TX]);
    expect((await resolveLocation('Austin, TX', fn)).admin1).toBe('Texas');
  });

  it('accepts a full state or country name or country code as the qualifier', async () => {
    expect(
      (await resolveLocation('Austin, Texas', fakeFetch([AUSTIN_MN, AUSTIN_TX]).fn)).admin1
    ).toBe('Texas');
    expect(
      (await resolveLocation('Austin, United States', fakeFetch([AUSTIN_MN, AUSTIN_TX]).fn)).admin1
    ).toBe('Minnesota');
    expect((await resolveLocation('Austin, us', fakeFetch([AUSTIN_MN, AUSTIN_TX]).fn)).admin1).toBe(
      'Minnesota'
    );
  });

  it('falls back to the top result when the qualifier matches nothing', async () => {
    const { fn } = fakeFetch([AUSTIN_MN, AUSTIN_TX]);
    expect((await resolveLocation('Austin, Narnia', fn)).admin1).toBe('Minnesota');
  });
});

describe('describeWeatherCode', () => {
  it('maps known codes and tolerates unknown ones', () => {
    expect(describeWeatherCode(0)).toBe('Clear sky');
    expect(describeWeatherCode(95)).toBe('Thunderstorm');
    expect(describeWeatherCode(1234)).toBe('Unknown conditions');
  });
});
