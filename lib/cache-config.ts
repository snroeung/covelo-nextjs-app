// TTL constants (seconds)
export const TTL = {
  FIFTEEN_MINUTES: 60 * 15,
  ONE_HOUR:        60 * 60,
  ONE_DAY:         60 * 60 * 24,
  SEVEN_DAYS:      60 * 60 * 24 * 7,
  THIRTY_DAYS:     60 * 60 * 24 * 30,
} as const;

// Typed key builders — take structured params, return the cache key string
export const cacheKeys = {
  stayDetails:      (accommodationId: string) =>
    `stay:details:${accommodationId}`,
  stayRooms:        (searchResultId: string) =>
    `stay:rooms:${searchResultId}`,
  staySearchResult: (accommodationId: string, checkIn: string, checkOut: string, rooms: number) =>
    `stay:accommodation:${accommodationId}:${checkIn}:${checkOut}:${rooms}`,
  hotelBedsSearch:  (hash: string) =>
    `hb:search:${hash}`,
  flightSearch:     (hash: string) =>
    `flight:search:${hash}`,
  flightBoard:      (hash: string) =>
    `flight:board:${hash}`,
  placeLatLng:      (placeId: string) =>
    `place:latlng:${placeId}`,
  placePhoto:       (name: string, address: string) =>
    `place:photo:ref:${name}:${address}`,
  transferBonuses:  () =>
    `offers:transfer-bonuses`,
  spendingBonuses:  () =>
    `offers:spending-bonuses`,
} as const;

// Cache entry config — one place to change a TTL
export const CACHE = {
  stayDetails:      { ttl: TTL.ONE_DAY },
  stayRooms:        { ttl: TTL.FIFTEEN_MINUTES },
  staySearchResult: { ttl: TTL.ONE_HOUR },
  hotelBedsSearch:  { ttl: TTL.FIFTEEN_MINUTES },
  flightSearch:     { ttl: TTL.FIFTEEN_MINUTES },
  flightBoard:      { ttl: TTL.ONE_DAY },
  placeLatLng:      { ttl: TTL.THIRTY_DAYS },
  placePhoto:       { ttl: TTL.SEVEN_DAYS },
  transferBonuses:  { ttl: TTL.FIFTEEN_MINUTES },
  spendingBonuses:  { ttl: TTL.FIFTEEN_MINUTES },
} as const;
