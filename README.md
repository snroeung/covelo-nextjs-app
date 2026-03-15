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

## Testing

```bash
npm test
```
