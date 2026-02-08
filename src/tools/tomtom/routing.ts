import { calculateRoute } from '@tomtom-org/maps-sdk/services';
import { getTomTomApiKey } from './client.js';

export const getRoute = async (origin: number[], destination: number[]) =>
    calculateRoute({
        apiKey: getTomTomApiKey(),
        locations: [origin, destination],
        costModel: { traffic: 'live' },
        computeAdditionalTravelTimeFor: 'all',
    });
