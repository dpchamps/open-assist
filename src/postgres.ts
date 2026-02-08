import { Client } from 'pg';
import pgvector from 'pgvector/pg';

export const createClient = async () => {
    const client = new Client({
        host: process.env['POSTGRES_URI'],
        port: Number(process.env['POSTGRES_PORT']),
        user: process.env['POSTGRES_USER'],
        password: process.env['POSTGRES_PASSWORD'],
        database: 'postgres',
    });
    await client.connect();
    await pgvector.registerTypes(client);
    return client;
};
