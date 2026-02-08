export const getTomTomApiKey = () => {
    const key = process.env.TOMTOM_KEY;
    if (!key) throw new Error('TOMTOM_KEY environment variable is not set');
    return key;
};
