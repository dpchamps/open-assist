import { Type } from '@mariozechner/pi-ai';
import { geocodeAddress } from './geocode.js';
import { searchPlaces } from './search.js';

const parameters = Type.Object({
    query: Type.String({ description: 'What to search for (e.g. "post office", "gas station", "pharmacy")' }),
    near: Type.Optional(Type.String({ description: 'Location to search near (e.g. "south east Portland", "downtown Seattle")' })),
});

export const definition = {
    name: 'search_nearby',
    description: 'Search for places and points of interest like businesses, services, and landmarks. Optionally narrow results to a specific area.',
    parameters,
};

const metersToMiles = (meters: number) => (meters * 0.000621371).toFixed(1);

const DEFAULT_RADIUS_METERS = 16000;

const formatResult = (props: { poi?: { name: string }; address: { freeformAddress: string }; distance?: number }, index: number) => {
    const name = props.poi?.name;
    const address = props.address.freeformAddress;
    const distance = props.distance !== undefined ? `   ${metersToMiles(props.distance)} miles away` : '';

    return name
        ? `${index + 1}. ${name}\n   ${address}${distance}`
        : `${index + 1}. ${address}${distance}`;
};

export const execute = async (params: { query: string; near?: string }) => {
    const position = params.near
        ? await geocodeAddress(params.near).then((place) => place.geometry.coordinates as [number, number])
        : undefined;

    const response = await searchPlaces(params.query, {
        ...(position ? { position, radiusMeters: DEFAULT_RADIUS_METERS } : {}),
    });

    if (response.features.length === 0) {
        return params.near
            ? `No results found for "${params.query}" near ${params.near}.`
            : `No results found for "${params.query}".`;
    }

    const header = params.near
        ? `Results for "${params.query}" near ${params.near}:`
        : `Results for "${params.query}":`;

    const results = response.features
        .filter((f) => f.properties !== null)
        .map((f, i) => formatResult(f.properties, i));

    return [header, '', ...results].join('\n');
};
