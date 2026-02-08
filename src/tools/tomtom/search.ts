import { search } from '@tomtom-org/maps-sdk/services';
import { getTomTomApiKey } from './client.js';

export const searchPlaces = async (
    query: string,
    options?: { position?: [number, number]; radiusMeters?: number; limit?: number },
) =>
    search({
        apiKey: getTomTomApiKey(),
        query,
        ...(options?.position ? { position: options.position } : {}),
        ...(options?.radiusMeters ? { radiusMeters: options.radiusMeters } : {}),
        limit: options?.limit ?? 5,
    });
