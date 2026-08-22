'use client';

interface DashboardLocation {
  lat: number;
  lon: number;
  label: string;
}

interface Weather {
  tempF: number;
  code: number;
}

function greeting(date: Date): string {
  const h = date.getHours();
  if (h < 5) return 'Working late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Working late';
}

// WMO weather codes (Open-Meteo) collapsed to a small icon set.
function weatherIcon(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 2) return '🌤️';
  if (code === 3) return '☁️';
  if (code === 45 || code === 48) return '🌫️';
  if (code >= 51 && code <= 67) return '🌧️';
  if (code >= 71 && code <= 77) return '🌨️';
  if (code >= 80 && code <= 82) return '🌦️';
  if (code >= 95) return '⛈️';
  return '🌡️';
}

export default function DashboardHero({
  now,
  location,
  weather,
  locationInput,
  onLocationInputChange,
  savingLocation,
  onSaveLocation,
}: {
  now: Date | null;
  location: DashboardLocation | null | undefined;
  weather: Weather | null;
  locationInput: string;
  onLocationInputChange: (value: string) => void;
  savingLocation: boolean;
  onSaveLocation: () => void;
}) {
  return (
    // Greeting, live clock, weather, date. Sets the tone: this is your
    // assistant, not an ops console. Glass/depth accent used sparingly, only here.
    <div
      className="mb-8 flex flex-wrap items-end justify-between gap-6 rounded-3xl px-7 py-6"
      style={{
        background: 'linear-gradient(135deg, rgba(79,195,247,0.07), rgba(192,132,252,0.04))',
        border: '1px solid rgba(79,195,247,0.15)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div>
        <div className="font-mono text-[11px] tracking-[0.25em] text-accent/70 mb-2">
          WIREASSIST
        </div>
        <h1 className="text-4xl font-semibold tracking-tight">
          {now ? greeting(now) : 'Hello'}, Jason
        </h1>
        <p className="text-gray-500 text-sm mt-2">
          {now
            ? now.toLocaleDateString([], {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })
            : ''}
        </p>
      </div>
      <div className="text-right">
        <div className="font-mono text-5xl font-light tracking-tight text-gray-100 tabular-nums">
          {now ? now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '--:--'}
        </div>
        {location === null ? (
          <div className="flex items-center gap-2 mt-2 justify-end">
            <input
              value={locationInput}
              onChange={(e) => onLocationInputChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSaveLocation()}
              placeholder="Set your city for weather"
              className="text-xs rounded-full px-3 py-1.5 outline-none w-44"
              style={{ background: '#0d0d1a', border: '1px solid #1e2040', color: '#e2e8f0' }}
            />
            <button
              onClick={onSaveLocation}
              disabled={savingLocation || !locationInput.trim()}
              className="text-xs px-3 py-1.5 rounded-full text-accent border border-accent/30 hover:bg-accent/10 transition-colors disabled:opacity-40"
            >
              {savingLocation ? '…' : 'Save'}
            </button>
          </div>
        ) : location && weather ? (
          <div className="text-sm text-gray-400 mt-1">
            {weatherIcon(weather.code)} {weather.tempF}°F · {location.label}
          </div>
        ) : location ? (
          <div className="text-sm text-gray-600 mt-1">{location.label}</div>
        ) : null}
      </div>
    </div>
  );
}
