# points_portal_backend
Temporary name

## Development

### Start the dev server

```bash
npm run dev
```

Server runs at `http://localhost:3000`.

### Test flight search (Duffel offer requests)

Local:

```bash
curl -X POST http://localhost:3000/api/trpc/flights.searchOffers \
  -H "Content-Type: application/json" \
  -d '{"origin": "LHR", "destination": "JFK", "departureDate": "2026-06-01", "passengers": 1}'
```

Vercel preview:

```bash
vercel curl /api/trpc/flights.searchOffers --deployment https://points-portal-backend-1sva7fdz1-snroeungs-projects.vercel.app -- --request POST --header "Content-Type: application/json" --data '{"origin":"SYD","destination":"MEL","departureDate":"2026-04-01","passengers":1,"cabinClass":"economy"}'
```

**Input fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `origin` | string (IATA) | yes | 3-letter origin airport code |
| `destination` | string (IATA) | yes | 3-letter destination airport code |
| `departureDate` | string (YYYY-MM-DD) | yes | Departure date |
| `passengers` | number (1–9) | yes | Number of adult passengers |
| `cabinClass` | `economy` \| `premium_economy` \| `business` \| `first` | no | Defaults to `economy` |

### Test stays search (Duffel stays)

> **Note:** The Duffel Stays API requires separate product access. Access has been requested and is pending approval. The endpoint exists but will return an error until access is granted.

```bash
curl -X POST http://localhost:3000/api/trpc/stays.search \
  -H "Content-Type: application/json" \
  -d '{"location": "London, UK", "checkInDate": "2026-06-04", "checkOutDate": "2026-06-07", "rooms": 1, "guests": [{"type": "adult"}, {"type": "child", "age": 7}]}'
```

**Input fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `location` | string | yes | City, neighborhood, or region (e.g. `"Paris, France"`, `"SoHo, New York"`) |
| `checkInDate` | string (YYYY-MM-DD) | yes | Check-in date |
| `checkOutDate` | string (YYYY-MM-DD) | yes | Check-out date |
| `rooms` | number | no | Number of rooms, defaults to `1` |
| `guests` | array | yes | At least one guest: `{"type": "adult"}` or `{"type": "child", "age": 7}` |
| `freeCancellationOnly` | boolean | no | Filter for free cancellation rates, defaults to `false` |
| `radius` | number | no | Search radius in km, defaults to `5` |

## Testing

```bash
npm test
```
