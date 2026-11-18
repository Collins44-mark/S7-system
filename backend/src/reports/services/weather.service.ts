import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const DAR_ES_SALAAM = {
  name: 'Dar es Salaam',
  latitude: -6.7924,
  longitude: 39.2083,
  timezone: 'Africa/Dar_es_Salaam',
};

export type WeatherCondition = 'clear' | 'cloudy' | 'fog' | 'rain' | 'storm';

export type BusinessWeather = {
  locationName: string;
  timezone: string;
  temperatureC: number;
  condition: WeatherCondition;
  weatherCode: number;
  cloudCover: number | null;
  precipitationMm: number | null;
  sunrise: string | null;
  sunset: string | null;
  observedAt: string;
};

type Place = {
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

type CacheEntry = { expires: number; value: BusinessWeather };

const TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

@Injectable()
export class WeatherService {
  constructor(private readonly prisma: PrismaService) {}

  async forBusiness(businessId: string): Promise<BusinessWeather> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { address: true },
    });
    const address = business?.address?.trim() ?? '';
    const key = `${businessId}:${address}`;
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.value;

    try {
      const place = await this.resolvePlace(address);
      const value = await this.fetchWeather(place);
      cache.set(key, { expires: Date.now() + TTL_MS, value });
      return value;
    } catch {
      if (hit) return hit.value;
      throw new ServiceUnavailableException('Weather is unavailable');
    }
  }

  private async resolvePlace(address: string): Promise<Place> {
    if (!address) return DAR_ES_SALAAM;
    const query = /tanzania/i.test(address) ? address : `${address}, Tanzania`;
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
    url.searchParams.set('name', query);
    url.searchParams.set('count', '5');
    url.searchParams.set('language', 'en');
    url.searchParams.set('format', 'json');
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return DAR_ES_SALAAM;
    const data = (await res.json()) as {
      results?: {
        name: string;
        latitude: number;
        longitude: number;
        timezone?: string;
        country_code?: string;
      }[];
    };
    const results = data.results ?? [];
    const match = results.find((row) => row.country_code === 'TZ') ?? null;
    if (!match) return DAR_ES_SALAAM;
    return {
      name: match.name,
      latitude: match.latitude,
      longitude: match.longitude,
      timezone: match.timezone || DAR_ES_SALAAM.timezone,
    };
  }

  private async fetchWeather(place: Place): Promise<BusinessWeather> {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(place.latitude));
    url.searchParams.set('longitude', String(place.longitude));
    url.searchParams.set(
      'current',
      'temperature_2m,weather_code,cloud_cover,precipitation,is_day',
    );
    url.searchParams.set('daily', 'sunrise,sunset');
    url.searchParams.set('forecast_days', '1');
    url.searchParams.set('timezone', place.timezone);
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error('weather fetch failed');
    const data = (await res.json()) as {
      timezone?: string;
      current?: {
        time?: string;
        temperature_2m?: number;
        weather_code?: number;
        cloud_cover?: number;
        precipitation?: number;
      };
      daily?: { sunrise?: string[]; sunset?: string[] };
    };
    const current = data.current;
    if (
      !current ||
      typeof current.temperature_2m !== 'number' ||
      typeof current.weather_code !== 'number'
    ) {
      throw new Error('weather payload missing');
    }
    return {
      locationName: place.name,
      timezone: data.timezone || place.timezone,
      temperatureC: current.temperature_2m,
      condition: conditionFromCode(current.weather_code),
      weatherCode: current.weather_code,
      cloudCover:
        typeof current.cloud_cover === 'number' ? current.cloud_cover : null,
      precipitationMm:
        typeof current.precipitation === 'number' ? current.precipitation : null,
      sunrise: data.daily?.sunrise?.[0] ?? null,
      sunset: data.daily?.sunset?.[0] ?? null,
      observedAt: current.time ?? new Date().toISOString(),
    };
  }
}

function conditionFromCode(code: number): WeatherCondition {
  if (code === 0) return 'clear';
  if (code === 1 || code === 2 || code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 95) return 'storm';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  return 'cloudy';
}
