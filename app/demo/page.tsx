'use client';

/**
 * app/demo/page.tsx
 *
 * Browser smoke-test for the deep-link integration.
 * Uses hardcoded Duffel-shaped mock data — no API key or network call needed.
 * Visit:  http://localhost:3000/demo
 */

import { AppShell } from '@/components/AppShell';
import { FlightCard } from '@/components/FlightCard';
import { HotelCard } from '@/components/HotelCard';
import { useTheme } from '@/contexts/ThemeContext';

// ---------------------------------------------------------------------------
// Mock offers — shaped to match the Duffel API response FlightCard / HotelCard
// read from the `offer` and `searchResult` props respectively.
// ---------------------------------------------------------------------------

const MOCK_FLIGHTS = [
  // Round-trip economy — United LAX → ORD (domestic, UA is a Chase/Bilt transfer partner)
  {
    id: 'mock-rt-economy',
    owner: { name: 'United Airlines', iata_code: 'UA' },
    total_amount: '520.00',
    total_currency: 'USD',
    slices: [
      {
        segments: [{
          origin:      { iata_code: 'LAX' },
          destination: { iata_code: 'ORD' },
          departing_at: '2025-12-01T08:00:00',
          arriving_at:  '2025-12-01T14:15:00',
          duration:     'PT4H15M',
          marketing_carrier: { name: 'United Airlines', iata_code: 'UA' },
          passengers: [{ cabin_class: 'economy' }],
        }],
      },
      {
        segments: [{
          origin:      { iata_code: 'ORD' },
          destination: { iata_code: 'LAX' },
          departing_at: '2025-12-10T17:00:00',
          arriving_at:  '2025-12-10T19:45:00',
          duration:     'PT4H45M',
          marketing_carrier: { name: 'United Airlines', iata_code: 'UA' },
          passengers: [{ cabin_class: 'economy' }],
        }],
      },
    ],
  },

  // One-way business class — Delta JFK → CDG (long-haul, DL is an Amex transfer partner)
  {
    id: 'mock-ow-business',
    owner: { name: 'Delta Air Lines', iata_code: 'DL' },
    total_amount: '3200.00',
    total_currency: 'USD',
    slices: [
      {
        segments: [
          {
            origin:      { iata_code: 'JFK' },
            destination: { iata_code: 'AMS' },
            departing_at: '2025-12-05T22:05:00',
            arriving_at:  '2025-12-06T11:30:00',
            duration:     'PT7H25M',
            marketing_carrier: { name: 'Delta Air Lines', iata_code: 'DL' },
            passengers: [{ cabin_class: 'business' }],
          },
          {
            origin:      { iata_code: 'AMS' },
            destination: { iata_code: 'CDG' },
            departing_at: '2025-12-06T13:10:00',
            arriving_at:  '2025-12-06T14:25:00',
            duration:     'PT1H15M',
            marketing_carrier: { name: 'KLM', iata_code: 'KL' },
            passengers: [{ cabin_class: 'business' }],
          },
        ],
      },
    ],
  },

  // Round-trip economy — British Airways SFO → LHR (long-haul, BA is a Chase/Amex/C1/Bilt partner)
  {
    id: 'mock-rt-ba',
    owner: { name: 'British Airways', iata_code: 'BA' },
    total_amount: '1150.00',
    total_currency: 'USD',
    slices: [
      {
        segments: [{
          origin:      { iata_code: 'SFO' },
          destination: { iata_code: 'LHR' },
          departing_at: '2025-11-20T17:30:00',
          arriving_at:  '2025-11-21T11:45:00',
          duration:     'PT10H15M',
          marketing_carrier: { name: 'British Airways', iata_code: 'BA' },
          passengers: [{ cabin_class: 'economy' }],
        }],
      },
      {
        segments: [{
          origin:      { iata_code: 'LHR' },
          destination: { iata_code: 'SFO' },
          departing_at: '2025-11-28T12:00:00',
          arriving_at:  '2025-11-28T15:30:00',
          duration:     'PT11H30M',
          marketing_carrier: { name: 'British Airways', iata_code: 'BA' },
          passengers: [{ cabin_class: 'economy' }],
        }],
      },
    ],
  },
];

const MOCK_HOTELS = [
  // Hyatt Chicago — World of Hyatt is a Chase + Bilt transfer partner
  {
    check_in_date:  '2025-12-01',
    check_out_date: '2025-12-05',
    cheapest_rate_total_amount: '980.00',
    cheapest_rate_currency: 'USD',
    accommodation: {
      name: 'Hyatt Regency Chicago',
      rating: 4,
      review_score: 8.6,
      review_count: 2847,
      location: {
        address: {
          line_one:     '151 East Wacker Drive',
          city_name:    'Chicago',
          country_code: 'US',
        },
      },
      rooms: [
        {
          name: 'King Deluxe Room',
          rates: [{
            total_amount: '980.00',
            total_currency: 'USD',
            cancellation_timeline: [{ refund_amount: '980.00' }],
          }],
        },
        {
          name: 'Double Queen Room',
          rates: [{
            total_amount: '1080.00',
            total_currency: 'USD',
            cancellation_timeline: [],
          }],
        },
      ],
      amenities: [
        { description: 'WiFi' },
        { description: 'Fitness Center' },
        { description: 'Indoor Pool' },
        { description: 'Restaurant' },
        { description: 'Room Service' },
        { description: 'Concierge' },
        { description: 'Business Center' },
        { description: 'Valet Parking' },
      ],
      photos: [{ url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&auto=format' }],
    },
  },

  // Marriott NYC — Marriott Bonvoy is a Chase + Amex transfer partner
  {
    check_in_date:  '2025-12-10',
    check_out_date: '2025-12-13',
    cheapest_rate_total_amount: '1320.00',
    cheapest_rate_currency: 'USD',
    accommodation: {
      name: 'New York Marriott Marquis',
      rating: 4,
      review_score: 8.2,
      review_count: 5102,
      location: {
        address: {
          line_one:     '1535 Broadway',
          city_name:    'New York',
          country_code: 'US',
        },
      },
      rooms: [
        {
          name: 'Standard King Room',
          rates: [{
            total_amount: '1320.00',
            total_currency: 'USD',
            cancellation_timeline: [{ refund_amount: '1320.00' }],
          }],
        },
      ],
      amenities: [
        { description: 'WiFi' },
        { description: 'Fitness Center' },
        { description: 'Rooftop Bar' },
        { description: 'Restaurant' },
        { description: 'Times Square Views' },
      ],
      photos: [{ url: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&auto=format' }],
    },
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DemoPage() {
  const { isDark } = useTheme();
  const headingCls = isDark ? 'text-cv-blue-300' : 'text-cv-blue-900';
  const subCls     = isDark ? 'text-cv-blue-500' : 'text-cv-blue-400';

  const header = (
    <div>
      <p className={`text-[10px] font-semibold uppercase tracking-widest ${subCls}`}>Deep-link demo</p>
      <p className={`text-sm font-semibold ${headingCls}`}>Mock flights &amp; hotels</p>
      <p className={`text-xs mt-0.5 ${subCls}`}>
        Expand any card, open a portal section, and click <strong>Book on …</strong> to verify the deep link.
      </p>
    </div>
  );

  return (
    <AppShell header={header} hasResults>
      <h2 className={`text-xs font-semibold uppercase tracking-widest ${headingCls}`}>Flights</h2>

      {MOCK_FLIGHTS.map((offer, i) => (
        <FlightCard key={offer.id} offer={offer} defaultCollapsed={i > 0} />
      ))}

      <h2 className={`text-xs font-semibold uppercase tracking-widest mt-4 ${headingCls}`}>Hotels</h2>

      {MOCK_HOTELS.map((result, i) => (
        <HotelCard key={i} searchResult={result} defaultCollapsed={i > 0} />
      ))}
    </AppShell>
  );
}
