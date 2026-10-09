import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { getWeatherSettings, setWeatherSettings } from '../../weather-settings';

const AUSTIN = { lat: 30.27, lon: -97.74, label: 'Austin, Texas' };

describe('weather settings (shared by the dashboard chip and get_weather)', () => {
  let home: string;
  let dir: string;
  let previousHome: string | undefined;

  beforeEach(() => {
    previousHome = process.env.WIREASSIST_HOME;
    home = mkdtempSync(join(tmpdir(), 'wa-wset-'));
    dir = join(home, '.wireassist');
    mkdirSync(dir, { recursive: true });
    process.env.WIREASSIST_HOME = home;
  });
  afterEach(() => {
    if (previousHome === undefined) delete process.env.WIREASSIST_HOME;
    else process.env.WIREASSIST_HOME = previousHome;
    rmSync(home, { recursive: true, force: true });
  });

  it('defaults to no location and imperial units', () => {
    expect(getWeatherSettings()).toEqual({ location: null, units: 'imperial' });
  });

  it('saves and reads back a location and units', () => {
    setWeatherSettings({ location: AUSTIN, units: 'metric' });
    expect(getWeatherSettings()).toEqual({ location: AUSTIN, units: 'metric' });
  });

  it('changing one field leaves the other alone', () => {
    setWeatherSettings({ location: AUSTIN, units: 'metric' });
    setWeatherSettings({ units: 'imperial' });
    expect(getWeatherSettings()).toEqual({ location: AUSTIN, units: 'imperial' });
  });

  it('picks up a city already saved by the dashboard before this setting existed', () => {
    writeFileSync(join(dir, 'dashboard-location.json'), JSON.stringify(AUSTIN));
    expect(getWeatherSettings().location).toEqual(AUSTIN);
  });

  it('prefers the new setting over the old dashboard file', () => {
    writeFileSync(join(dir, 'dashboard-location.json'), JSON.stringify(AUSTIN));
    const berlin = { lat: 52.52, lon: 13.4, label: 'Berlin, Berlin' };
    setWeatherSettings({ location: berlin });
    expect(getWeatherSettings().location).toEqual(berlin);
  });

  it('keeps a cleared location cleared even though the old dashboard file still exists', () => {
    writeFileSync(join(dir, 'dashboard-location.json'), JSON.stringify(AUSTIN));
    setWeatherSettings({ location: null });
    expect(getWeatherSettings().location).toBeNull();
  });

  it('rejects invalid values instead of saving them', () => {
    expect(() => setWeatherSettings({ units: 'kelvin' as never })).toThrow(/units/);
    expect(() =>
      setWeatherSettings({ location: { lat: 'x', lon: 1, label: 'A' } as never })
    ).toThrow(/lat/);
    expect(() => setWeatherSettings({ location: { lat: NaN, lon: 1, label: 'A' } })).toThrow(/lat/);
    expect(getWeatherSettings()).toEqual({ location: null, units: 'imperial' });
  });

  it('falls back to defaults when the file is corrupt', () => {
    writeFileSync(join(dir, 'weather.json'), '{not json');
    expect(getWeatherSettings()).toEqual({ location: null, units: 'imperial' });
  });
});
