import { http, HttpResponse } from 'msw';

export const handlers = [
  // Duffel offer requests
  http.post('https://api.duffel.com/air/offer_requests', () => {
    return HttpResponse.json({
      data: {
        id: 'orq_mock',
        live_mode: false,
        cabin_class: 'economy',
        created_at: new Date().toISOString(),
        slices: [],
        passengers: [],
        offers: [],
      },
    });
  }),

  // Google Places autocomplete
  http.get('https://places.googleapis.com/v1/places:autocomplete', () => {
    return HttpResponse.json({ suggestions: [] });
  }),
];
