export type WeatherScene =
  | "clear_morning"
  | "cloudy_morning"
  | "sunny_afternoon"
  | "cloudy_afternoon"
  | "sunset"
  | "clear_night"
  | "cloudy_night"
  | "rainy_day"
  | "rainy_night"
  | "thunderstorm";

export type WeatherReport = {
  locationName: string;
  timezone: string;
  temperatureC: number;
  condition: string;
  weatherCode?: number | null;
  cloudCover?: number | null;
  precipitationMm?: number | null;
  sunrise?: string | null;
  sunset?: string | null;
  observedAt: string;
};

export const DEFAULT_TZ = "Africa/Dar_es_Salaam";

/** Stable local photographs. One file per category, not a new image per render. */
export const SCENE_IMAGE: Record<
  WeatherScene,
  { webp: string; jpg: string; dark: boolean }
> = {
  clear_morning: {
    webp: "/weather/clear-morning.webp",
    jpg: "/weather/clear-morning.jpg",
    dark: false,
  },
  cloudy_morning: {
    webp: "/weather/cloudy-morning.webp",
    jpg: "/weather/cloudy-morning.jpg",
    dark: false,
  },
  sunny_afternoon: {
    webp: "/weather/sunny-afternoon.webp",
    jpg: "/weather/sunny-afternoon.jpg",
    dark: false,
  },
  cloudy_afternoon: {
    webp: "/weather/cloudy-afternoon.webp",
    jpg: "/weather/cloudy-afternoon.jpg",
    dark: false,
  },
  sunset: {
    webp: "/weather/sunset.webp",
    jpg: "/weather/sunset.jpg",
    dark: true,
  },
  clear_night: {
    webp: "/weather/clear-night.webp",
    jpg: "/weather/clear-night.jpg",
    dark: true,
  },
  cloudy_night: {
    webp: "/weather/cloudy-night.webp",
    jpg: "/weather/cloudy-night.jpg",
    dark: true,
  },
  rainy_day: {
    webp: "/weather/rainy-day.webp",
    jpg: "/weather/rainy-day.jpg",
    dark: true,
  },
  rainy_night: {
    webp: "/weather/rainy-night.webp",
    jpg: "/weather/rainy-night.jpg",
    dark: true,
  },
  thunderstorm: {
    webp: "/weather/thunderstorm.webp",
    jpg: "/weather/thunderstorm.jpg",
    dark: true,
  },
};

export function zonedMinutes(date: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const hour = Number(parts.find((part) => part.type === "hour")?.value);
    const minute = Number(parts.find((part) => part.type === "minute")?.value);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
      return date.getHours() * 60 + date.getMinutes();
    }
    return hour * 60 + minute;
  } catch {
    return date.getHours() * 60 + date.getMinutes();
  }
}

export function zonedHour(date: Date, timeZone: string) {
  return Math.floor(zonedMinutes(date, timeZone) / 60);
}

function clockMinutes(localIso?: string | null) {
  if (!localIso) return null;
  const match = localIso.match(/T(\d{2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

type Period = "morning" | "afternoon" | "evening" | "night";

export function periodFromClock(
  nowMin: number,
  sunrise: number | null,
  sunset: number | null,
): Period {
  const rise = sunrise ?? 6 * 60;
  const set = sunset ?? 18 * 60 + 30;
  const morningStart = Math.min(5 * 60, rise);
  const eveningStart = Math.min(17 * 60, Math.max(15 * 60, set - 75));
  const nightStart = 21 * 60;
  if (nowMin < morningStart || nowMin >= nightStart) return "night";
  if (nowMin >= eveningStart) return "evening";
  if (nowMin < 12 * 60) return "morning";
  return "afternoon";
}

function isStorm(report: WeatherReport | null) {
  if (!report) return false;
  if (report.condition === "storm") return true;
  return typeof report.weatherCode === "number" && report.weatherCode >= 95;
}

function isRain(report: WeatherReport | null) {
  if (!report || isStorm(report)) return false;
  if (report.condition === "rain") return true;
  if (typeof report.precipitationMm === "number" && report.precipitationMm >= 0.2) {
    return true;
  }
  const code = report.weatherCode;
  if (typeof code !== "number") return false;
  return (code >= 51 && code <= 67) || (code >= 80 && code <= 82);
}

function isCloudy(report: WeatherReport | null) {
  if (!report) return false;
  if (report.condition === "cloudy" || report.condition === "fog") return true;
  return typeof report.cloudCover === "number" && report.cloudCover >= 60;
}

/**
 * Weather wins over the clock. A missing report falls back to the time of day
 * only, and never invents rain or a storm.
 */
export function sceneFor(report: WeatherReport | null, now: Date): WeatherScene {
  const timeZone = report?.timezone || DEFAULT_TZ;
  const period = periodFromClock(
    zonedMinutes(now, timeZone),
    clockMinutes(report?.sunrise),
    clockMinutes(report?.sunset),
  );
  if (isStorm(report)) return "thunderstorm";
  if (isRain(report)) return period === "night" ? "rainy_night" : "rainy_day";
  const cloudy = isCloudy(report);
  if (period === "evening") return "sunset";
  if (period === "night") return cloudy ? "cloudy_night" : "clear_night";
  if (period === "morning") return cloudy ? "cloudy_morning" : "clear_morning";
  return cloudy ? "cloudy_afternoon" : "sunny_afternoon";
}

export function greetingKey(hour: number) {
  if (hour >= 5 && hour < 12) return "dashboard.greeting.morning";
  if (hour >= 12 && hour < 17) return "dashboard.greeting.afternoon";
  if (hour >= 17 && hour < 21) return "dashboard.greeting.evening";
  return "dashboard.greeting.night";
}
