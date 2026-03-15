# points_portal_backend
Temporary name

## Development

### Start the dev server

```bash
npm run dev
```

Server runs at `http://localhost:3000`.

### Test flight search (Duffel offer requests)

```bash
curl -X POST http://localhost:3000/api/trpc/flights.searchOffers \
  -H "Content-Type: application/json" \
  -d '{"origin": "LHR", "destination": "JFK", "departureDate": "2026-06-01", "passengers": 1}'
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
