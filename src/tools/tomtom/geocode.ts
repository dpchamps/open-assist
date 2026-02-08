import { geocode } from '@tomtom-org/maps-sdk/services';
import { getTomTomApiKey } from './client.js';

export const geocodeAddress = async (address: string) => {
    const response = await geocode({ apiKey: getTomTomApiKey(), query: address });
    const place = response.features[0];
    if (!place) throw new Error(`Could not geocode address: ${address}`);
    return place;
};
