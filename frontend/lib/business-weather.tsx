"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/lib/api";
import {
  DEFAULT_TZ,
  sceneFor,
  zonedHour,
  type WeatherReport,
  type WeatherScene,
} from "@/lib/weather-scene";

const WEATHER_KEY = "s7-weather-v2";
const WEATHER_FRESH_MS = 15 * 60 * 1000;
const WEATHER_KEEP_MS = 2 * 60 * 60 * 1000;

type StoredWeather = WeatherReport & { savedAt?: number };

type WeatherContextValue = {
  weather: WeatherReport | null;
  scene: WeatherScene;
  dark: boolean;
  timeZone: string;
  hour: number;
  now: Date;
};

const WeatherContext = createContext<WeatherContextValue | null>(null);

export function BusinessWeatherProvider({ children }: { children: ReactNode }) {
  const [weather, setWeather] = useState<WeatherReport | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let fresh = false;
    try {
      const raw = sessionStorage.getItem(WEATHER_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as StoredWeather;
        if (
          saved.timezone &&
          saved.condition &&
          saved.savedAt &&
          Date.now() - saved.savedAt < WEATHER_KEEP_MS
        ) {
          setWeather(saved);
          fresh = Date.now() - saved.savedAt < WEATHER_FRESH_MS;
        }
      }
    } catch {
      /* ignore a bad cache */
    }

    const load = async () => {
      try {
        const res = await api.get<WeatherReport>("/reports/weather");
        const next = { ...res.data, savedAt: Date.now() };
        sessionStorage.setItem(WEATHER_KEY, JSON.stringify(next));
        if (!cancelled) setWeather(next);
      } catch {
        /* keep the last real report; do not invent conditions */
      }
    };
    if (!fresh) void load();
    const id = window.setInterval(() => void load(), WEATHER_FRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const timeZone = weather?.timezone || DEFAULT_TZ;
  const scene = sceneFor(weather, now);
  const value: WeatherContextValue = {
    weather,
    scene,
    dark: sceneImageDark(scene),
    timeZone,
    hour: zonedHour(now, timeZone),
    now,
  };

  return (
    <WeatherContext.Provider value={value}>{children}</WeatherContext.Provider>
  );
}

function sceneImageDark(scene: WeatherScene) {
  return (
    scene === "sunset" ||
    scene === "clear_night" ||
    scene === "cloudy_night" ||
    scene === "rainy_day" ||
    scene === "rainy_night" ||
    scene === "thunderstorm"
  );
}

export function useBusinessWeather() {
  const value = useContext(WeatherContext);
  if (!value) {
    const now = new Date();
    return {
      weather: null,
      scene: sceneFor(null, now),
      dark: sceneImageDark(sceneFor(null, now)),
      timeZone: DEFAULT_TZ,
      hour: zonedHour(now, DEFAULT_TZ),
      now,
    };
  }
  return value;
}
