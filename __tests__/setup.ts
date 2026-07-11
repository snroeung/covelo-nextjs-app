import { config } from 'dotenv';
import { resolve } from 'path';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './mocks/server';

config({ path: resolve(__dirname, '../.env') });

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
