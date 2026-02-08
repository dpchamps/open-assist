import { Type } from '@mariozechner/pi-ai';
import type { AgentTool } from '@mariozechner/pi-agent-core';
import { geocodeAddress } from './geocode.js';
import { getRoute } from './routing.js';

const parameters = Type.Object({
    origin: Type.String({ description: 'Starting address (e.g. "1250 E Burnside St, Portland OR")' }),
    destination: Type.String({ description: 'Destination address (e.g. "1400 SW 5th Ave, Portland OR")' }),
});

const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

const metersToMiles = (meters: number) => (meters * 0.000621371).toFixed(1);

const executeTimeToDestination = async (params: { origin: string; destination: string }) => {
    const [originPlace, destinationPlace] = await Promise.all([
        geocodeAddress(params.origin),
        geocodeAddress(params.destination),
    ]);

    const routes = await getRoute(
        originPlace.geometry.coordinates,
        destinationPlace.geometry.coordinates,
    );

    const route = routes.features[0];
    if (!route) throw new Error('No route found between the given addresses');

    const { summary } = route.properties;

    const lines = [
        `Origin: ${originPlace.properties.address.freeformAddress}`,
        `Destination: ${destinationPlace.properties.address.freeformAddress}`,
        `Distance: ${metersToMiles(summary.lengthInMeters)} miles`,
        `Travel time (with traffic): ${formatDuration(summary.travelTimeInSeconds)}`,
        `Traffic delay: ${formatDuration(summary.trafficDelayInSeconds)}`,
        `Departure: ${summary.departureTime.toLocaleString()}`,
        `Arrival: ${summary.arrivalTime.toLocaleString()}`,
    ];

    if (summary.noTrafficTravelTimeInSeconds !== undefined) {
        lines.push(`Free-flow travel time (no traffic): ${formatDuration(summary.noTrafficTravelTimeInSeconds)}`);
    }

    return lines.join('\n');
};

export const timeToDestination: AgentTool<typeof parameters> = {
    name: 'time_to_destination',
    description: 'Calculate travel time between two addresses, including traffic conditions, distance, and route details',
    label: 'Calculating route',
    parameters,
    execute: async (_toolCallId, params) => ({
        content: [{
            type: 'text',
            text: await executeTimeToDestination(params),
        }],
        details: {},
    }),
};
