import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './mocks/server';

process.env.GOOGLE_MAPS_API_KEY ||= 'test-google-maps-key';
process.env.DUFFEL_API_KEY ||= 'test-duffel-key';
process.env.HOTELBEDS_API_KEY ||= 'test-hotelbeds-key';
process.env.HOTELBEDS_API_SECRET ||= 'test-hotelbeds-secret';
process.env.NEXT_PUBLIC_MAPBOX_API_KEY ||= 'test-mapbox-key';

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
