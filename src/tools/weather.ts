import { Type, type Static } from '@mariozechner/pi-ai';
import type { AgentTool } from '@mariozechner/pi-agent-core';
import { fetchWeatherApi } from 'openmeteo';
import { geocodeAddress } from './tomtom/geocode.js';

const parameters = Type.Object({
    location: Type.String({ description: 'Location to get weather for (e.g. "Portland, OR", "Seattle", "1250 E Burnside St, Portland OR")' }),
    timeframe: Type.Union([
        Type.Literal('now'),
        Type.Literal('day'),
        Type.Literal('week'),
    ], { description: 'Timeframe: "now" for current conditions, "day" for today\'s hourly forecast, "week" for 7-day forecast' }),
});

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

const WMO_CODES: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    56: 'Light freezing drizzle',
    57: 'Dense freezing drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    66: 'Light freezing rain',
    67: 'Heavy freezing rain',
    71: 'Slight snow',
    73: 'Moderate snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    85: 'Slight snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with slight hail',
    99: 'Thunderstorm with heavy hail',
};

const describeWeatherCode = (code: number) => WMO_CODES[code] ?? `Unknown (${code})`;

const range = (start: number, stop: number, step: number) =>
    Array.from({ length: (stop - start) / step }, (_, i) => start + i * step);

const formatTemp = (celsius: number) => {
    const fahrenheit = celsius * 9 / 5 + 32;
    return `${Math.round(fahrenheit)}°F (${Math.round(celsius)}°C)`;
};

const resolveCoordinates = async (location: string) => {
    const place = await geocodeAddress(location);
    const [lon, lat] = place.geometry.coordinates as [number, number];
    return { latitude: lat, longitude: lon, label: place.properties.address?.freeformAddress ?? location };
};

const fetchCurrent = async (lat: number, lon: number) => {
    const responses = await fetchWeatherApi(FORECAST_URL, {
        latitude: [lat],
        longitude: [lon],
        current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m',
        temperature_unit: 'celsius',
        wind_speed_unit: 'mph',
        timezone: 'auto',
    });

    const response = responses[0]!;
    const current = response.current()!;

    return {
        temperature: current.variables(0)!.value(),
        feelsLike: current.variables(1)!.value(),
        weatherCode: current.variables(2)!.value(),
        windSpeed: current.variables(3)!.value(),
        humidity: current.variables(4)!.value(),
    };
};

const fetchHourly = async (lat: number, lon: number) => {
    const responses = await fetchWeatherApi(FORECAST_URL, {
        latitude: [lat],
        longitude: [lon],
        hourly: 'temperature_2m,weather_code,precipitation_probability,wind_speed_10m',
        temperature_unit: 'celsius',
        wind_speed_unit: 'mph',
        timezone: 'auto',
        forecast_days: 1,
    });

    const response = responses[0]!;
    const utcOffsetSeconds = response.utcOffsetSeconds();
    const hourly = response.hourly()!;

    const times = range(Number(hourly.time()), Number(hourly.timeEnd()), hourly.interval())
        .map((t) => new Date((t + utcOffsetSeconds) * 1000));
    const temperatures = hourly.variables(0)!.valuesArray()!;
    const weatherCodes = hourly.variables(1)!.valuesArray()!;
    const precipProb = hourly.variables(2)!.valuesArray()!;
    const windSpeeds = hourly.variables(3)!.valuesArray()!;

    return times.map((time, i) => ({
        time,
        temperature: temperatures[i]!,
        weatherCode: weatherCodes[i]!,
        precipProbability: precipProb[i]!,
        windSpeed: windSpeeds[i]!,
    }));
};

const fetchDaily = async (lat: number, lon: number) => {
    const responses = await fetchWeatherApi(FORECAST_URL, {
        latitude: [lat],
        longitude: [lon],
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max',
        temperature_unit: 'celsius',
        wind_speed_unit: 'mph',
        timezone: 'auto',
        forecast_days: 7,
    });

    const response = responses[0]!;
    const utcOffsetSeconds = response.utcOffsetSeconds();
    const daily = response.daily()!;

    const times = range(Number(daily.time()), Number(daily.timeEnd()), daily.interval())
        .map((t) => new Date((t + utcOffsetSeconds) * 1000));
    const weatherCodes = daily.variables(0)!.valuesArray()!;
    const maxTemps = daily.variables(1)!.valuesArray()!;
    const minTemps = daily.variables(2)!.valuesArray()!;
    const precipProb = daily.variables(3)!.valuesArray()!;
    const windSpeeds = daily.variables(4)!.valuesArray()!;

    return times.map((time, i) => ({
        time,
        weatherCode: weatherCodes[i]!,
        maxTemp: maxTemps[i]!,
        minTemp: minTemps[i]!,
        precipProbability: precipProb[i]!,
        maxWindSpeed: windSpeeds[i]!,
    }));
};

const formatCurrentWeather = (label: string, data: Awaited<ReturnType<typeof fetchCurrent>>) =>
    [
        `Current weather for ${label}:`,
        '',
        `  ${describeWeatherCode(data.weatherCode)}`,
        `  Temperature: ${formatTemp(data.temperature)}`,
        `  Feels like: ${formatTemp(data.feelsLike)}`,
        `  Humidity: ${Math.round(data.humidity)}%`,
        `  Wind: ${Math.round(data.windSpeed)} mph`,
    ].join('\n');

const formatHourlyForecast = (label: string, hours: Awaited<ReturnType<typeof fetchHourly>>) => {
    const header = `Today's hourly forecast for ${label}:`;
    const rows = hours.map((h) => {
        const time = h.time.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
        return `  ${time.padEnd(6)} ${formatTemp(h.temperature).padEnd(16)} ${describeWeatherCode(h.weatherCode).padEnd(22)} Precip: ${Math.round(h.precipProbability)}%  Wind: ${Math.round(h.windSpeed)} mph`;
    });

    return [header, '', ...rows].join('\n');
};

const formatDailyForecast = (label: string, days: Awaited<ReturnType<typeof fetchDaily>>) => {
    const header = `7-day forecast for ${label}:`;
    const rows = days.map((d) => {
        const day = d.time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        return `  ${day.padEnd(12)} ${describeWeatherCode(d.weatherCode).padEnd(26)} High: ${formatTemp(d.maxTemp).padEnd(16)} Low: ${formatTemp(d.minTemp).padEnd(16)} Precip: ${Math.round(d.precipProbability)}%  Wind: ${Math.round(d.maxWindSpeed)} mph`;
    });

    return [header, '', ...rows].join('\n');
};

const executeWeather = async (params: Static<typeof parameters>) => {
    const { latitude, longitude, label } = await resolveCoordinates(params.location);

    switch (params.timeframe) {
        case 'now':
            return fetchCurrent(latitude, longitude).then((data) => formatCurrentWeather(label, data));
        case 'day':
            return fetchHourly(latitude, longitude).then((hours) => formatHourlyForecast(label, hours));
        case 'week':
            return fetchDaily(latitude, longitude).then((days) => formatDailyForecast(label, days));
    }
};

export const weather: AgentTool<typeof parameters> = {
    name: 'get_weather',
    description: 'Get weather information for a location. Supports current conditions, today\'s hourly forecast, or a 7-day forecast.',
    label: 'Checking weather',
    parameters,
    execute: async (_toolCallId, params) => ({
        content: [{
            type: 'text',
            text: await executeWeather(params),
        }],
        details: {},
    }),
};
