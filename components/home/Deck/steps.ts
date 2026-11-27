// Data-driven walkthrough deck: chapters, steps (copy + durations + urls),
// camera home regions, and the static sample datasets the stage screens render.
// Copy and timings live here so they change without touching the screens.
// Beat timelines (what happens during a step) live in useDeckScript.ts because
// they drive the hook's actions — mirrors the design canvas's chapters()/script()
// split. Everything here is SAMPLE DATA.

export type StepId =
  | 's1' | 's2' | 's3' | 's4' | 's5' | 's6'
  | 'b1' | 'b2' | 'b3' | 'b4'
  | 't1';

export interface Step {
  id: StepId;
  label: string;
  dur: number;
  title: string;
  body: string;
  url: string;
}

export interface Chapter {
  name: string;
  short: string;
  steps: Step[];
}

export const CHAPTERS: Chapter[] = [
  {
    name: 'Search & compare',
    short: 'Search & compare',
    steps: [
      { id: 's1', label: 'Search', dur: 2700, title: 'Everything in one search', body: 'Enter your route and dates and Covelo estimates the prices in cash and points across the travel portals your cards unlock.', url: 'covelo.app/search' },
      { id: 's2', label: 'Results', dur: 2400, title: 'The fare and the best way to pay it.', body: 'Every result shows the cash price next to the points option, in cents per point.', url: 'covelo.app/flights?origin=PHL&destinationCode=SFO&tripType=roundtrip' },
      { id: 's3', label: 'Compare', dur: 2600, title: 'Portal or transfer?', body: 'The best direct portal and the best transfer partner sit together, with one Best choice. Every other way to book is one click away.', url: 'covelo.app/flights?origin=PHL&destinationCode=SFO&tripType=roundtrip' },
      { id: 's4', label: 'Bonuses', dur: 2450, title: 'Once a bonus is live, you’ll see it first.', body: 'When a partner bonus covers your dates and stay or flight, the result is flagged with the offer and its end date.', url: 'covelo.app/hotels?destination=Philadelphia%2C+PA&checkIn=2026-12-11&checkOut=2026-12-14' },
      { id: 's5', label: 'Bonus math', dur: 3100, title: 'The bonus is already in the math.', body: 'In this example, a 30% bonus to World of Hyatt lifts the stay from 1.7¢ to 2.21¢ per point. That is 17,674 fewer points for the same room.', url: 'covelo.app/hotels?destination=Philadelphia%2C+PA&checkIn=2026-12-11&checkOut=2026-12-14' },
      { id: 's6', label: 'Reports', dur: 3350, title: 'What travelers actually paid.', body: 'Every option carries reports from members who booked it — the real price they saw, matched against the quote. Expand any option to read them.', url: 'covelo.app/hotels?destination=Philadelphia%2C+PA&checkIn=2026-12-11&checkOut=2026-12-14' },
    ],
  },
  {
    name: 'The board',
    short: 'The board',
    steps: [
      { id: 'b1', label: 'Feed', dur: 2900, title: 'Find a community of travelers.', body: 'The board is where members share travel tips and live offers — transfer bonuses, award sweet spots, trip reports — all in one searchable feed.', url: 'covelo.app/discover/board' },
      { id: 'b2', label: 'Filter', dur: 2900, title: 'Search the feed. Follow a topic.', body: 'Filter by tips, offers or topic and search every post.', url: 'covelo.app/discover/board' },
      { id: 'b3', label: 'Save', dur: 3400, title: 'Save now. Book later.', body: 'Bookmark any post to your saved list and have it one tap away when the trip is finally real.', url: 'covelo.app/discover/board' },
      { id: 'b4', label: 'Post', dur: 2950, title: 'Good travelers share their tips.', body: 'Publish offers found on Covelo or other sites.', url: 'covelo.app/discover/board?compose=1' },
    ],
  },
  {
    name: 'Trip planner',
    short: 'Trip planner',
    steps: [
      { id: 't1', label: 'Coming soon', dur: 3500, title: 'Trip planner slides are on the way.', body: 'Placeholder until there’s a recording of the trip planner to build from: itinerary by day, map pins, Add to trip and saved trips.', url: 'covelo.app/trip-planner' },
    ],
  },
];

// Camera: a region [x, y, w, h] of the 1100×600 content screen. Desktop opens
// every step at full view; mobile opens framed on a per-step home region.
export type Region = [x: number, y: number, w: number, h: number];
export type Cam = [zoom: number, cx: number, cy: number];

export const MOBILE_HOME: Record<StepId, Region> = {
  s1: [30, 20, 620, 560],
  s2: [16, 40, 620, 540],
  s3: [150, 24, 800, 465],
  s4: [24, 90, 620, 500],
  s5: [90, 20, 920, 470],
  s6: [110, 140, 880, 320],
  b1: [24, 40, 782, 560],
  b2: [24, 40, 782, 560],
  b3: [24, 40, 782, 560],
  b4: [290, 14, 520, 572],
  t1: [0, 0, 1100, 600],
};

// Stage window dimensions (the viewport the 1100×600 content shows through).
export const DESKTOP_WINDOW = { w: 1100, h: 600 };
export const MOBILE_WINDOW = { w: 620, h: 700 };

// ── Static sample datasets rendered by the stage screens ──────────────────────

export interface FlightLeg {
  dir: string; date: string; dep: string; from: string;
  dur: string; stops: string; stopColor: string; arr: string; to: string;
}
export interface Flight {
  key: string; code: string; logo: string; name: string; price: number;
  best: string; cpp: string; legs: FlightLeg[];
}

export const FLIGHTS: Flight[] = [
  {
    key: 'ua', code: 'UA', logo: '#1f4f8f', name: 'United Airlines', price: 412,
    best: 'United MileagePlus via Chase', cpp: '1.3¢',
    legs: [
      { dir: 'OUTBOUND', date: 'SAT, DEC 5', dep: '08:15', from: 'PHL', dur: '6h 12m', stops: 'Nonstop', stopColor: '#2e7d32', arr: '11:27', to: 'SFO' },
      { dir: 'RETURN', date: 'SAT, DEC 12', dep: '13:05', from: 'SFO', dur: '5h 26m', stops: 'Nonstop', stopColor: '#2e7d32', arr: '21:31', to: 'PHL' },
    ],
  },
  {
    key: 'as', code: 'AS', logo: '#1d6fa5', name: 'Alaska Airlines', price: 438,
    best: 'Alaska Mileage Plan via Bilt', cpp: '1.2¢',
    legs: [
      { dir: 'OUTBOUND', date: 'SAT, DEC 5', dep: '10:40', from: 'PHL', dur: '8h 05m', stops: '1 stop · SEA', stopColor: '#6b7079', arr: '15:45', to: 'SFO' },
      { dir: 'RETURN', date: 'SAT, DEC 12', dep: '09:10', from: 'SFO', dur: '7h 50m', stops: '1 stop · SEA', stopColor: '#6b7079', arr: '20:00', to: 'PHL' },
    ],
  },
  {
    key: 'aa', code: 'AA', logo: '#b3261e', name: 'American Airlines', price: 389,
    best: 'Capital One Travel', cpp: '1¢',
    legs: [
      { dir: 'OUTBOUND', date: 'SAT, DEC 5', dep: '06:00', from: 'PHL', dur: '9h 20m', stops: '1 stop · DFW', stopColor: '#6b7079', arr: '12:20', to: 'SFO' },
      { dir: 'RETURN', date: 'SAT, DEC 12', dep: '07:45', from: 'SFO', dur: '9h 05m', stops: '1 stop · DFW', stopColor: '#6b7079', arr: '19:50', to: 'PHL' },
    ],
  },
];

export type SortKey = 'best' | 'cheap' | 'fast';
export const SORT_ORDER: Record<SortKey, string[]> = {
  best: ['ua', 'as', 'aa'],
  cheap: ['aa', 'ua', 'as'],
  fast: ['ua', 'as', 'aa'],
};
export const SORT_TABS: Array<[SortKey, string]> = [['best', 'Best'], ['cheap', 'Cheap'], ['fast', 'Fast']];

export const EXAMPLE_ROUTES = [
  { airline: 'UNITED AIRLINES', route: 'Philadelphia → San Francisco', code: 'PHL → SFO · Nonstop', price: '$206' },
  { airline: 'AMERICAN AIRLINES', route: 'Philadelphia → Los Angeles', code: 'PHL → LAX · Nonstop', price: '$189' },
  { airline: 'LUFTHANSA', route: 'Philadelphia → Munich', code: 'PHL → MUC · 1 stop', price: '$512' },
  { airline: 'KOREAN AIR', route: 'Philadelphia → Seoul', code: 'PHL → ICN · 1 stop', price: '$784' },
];

export const SEARCHING_WITH = [
  { name: 'Chase', pts: '120,800' },
  { name: 'Amex', pts: '86,400' },
  { name: 'Capital One', pts: '54,000' },
  { name: 'Citi', pts: '42,100' },
];

export interface BoardPost {
  id: string; badge: string; badgeDyn: string; meta: string; topic: string;
  votes: number; comments: number; title: string; body: string;
  offer: [string, string, string] | null;
}

export const BOARD_POSTS: BoardPost[] = [
  { id: 'p1', badge: 'VERIFIED · 2H', badgeDyn: 'background:var(--b-dff0e2);color:var(--c-2e6b34);', meta: 'milesandmore · 2h · Transfer bonuses', topic: 'transfer', votes: 42, comments: 12,
    title: 'Bilt → American AAdvantage 30% transfer bonus is back', body: 'Confirmed live through the end of the month — transfer 1,000 Bilt and land 1,300 AAdvantage miles. Great for domestic saver space.',
    offer: ['+30%', 'TRANSFER BONUS', 'Bilt Rewards → American AAdvantage'] },
  { id: 'p2', badge: 'TRAVEL TIP', badgeDyn: 'border:1px solid var(--l-111418);color:var(--c-111418);border-radius:3px;', meta: 'pointsplease · 5h · Hotels', topic: 'hotels', votes: 31, comments: 8,
    title: 'Best way to use points for a weekend in Kyoto', body: 'Comparing a few options for next spring. World of Hyatt keeps winning on cents-per-point — curious what’s worked for others booking machiya stays.', offer: null },
  { id: 'p3', badge: '◷ MEMBER OFFER', badgeDyn: 'background:var(--b-fbefd9);color:var(--c-8a5300);', meta: 'awardhacker · 6h · Transfer bonuses', topic: 'transfer', votes: 17, comments: 5,
    title: 'Amex → Flying Blue 25% bonus through Sunday', body: 'Saw this hit my account this morning. Decent for Europe saver space if you were already sitting on Membership Rewards.',
    offer: ['+25%', 'TRANSFER BONUS', 'Amex Membership Rewards → Flying Blue'] },
  { id: 'p4', badge: 'TRAVEL TIP', badgeDyn: 'border:1px solid var(--l-111418);color:var(--c-111418);border-radius:3px;', meta: 'flyerjen · 9h · Award flights', topic: 'flights', votes: 14, comments: 6,
    title: 'Check the cash fare before you burn points', body: 'If the portal price is under a cent a point, I pay cash and keep the points for a long-haul redemption. Saved me 40k last trip.', offer: null },
  { id: 'p5', badge: 'VERIFIED · 1D', badgeDyn: 'background:var(--b-dff0e2);color:var(--c-2e6b34);', meta: 'pointsdad · 1d · Transfer bonuses', topic: 'transfer', votes: 11, comments: 4,
    title: 'Capital One → Turkish Miles&Smiles 20% bonus', body: 'Runs through the 15th. Pairs well with Star Alliance saver space to Europe this winter.',
    offer: ['+20%', 'TRANSFER BONUS', 'Capital One Miles → Turkish Miles&Smiles'] },
  { id: 'p6', badge: 'TRAVEL TIP', badgeDyn: 'border:1px solid var(--l-111418);color:var(--c-111418);border-radius:3px;', meta: 'lisbonlayover · 2d · Hotels', topic: 'hotels', votes: 9, comments: 3,
    title: 'Portal vs booking direct: what I learned in Lisbon', body: 'Same room, same dates. The portal earned more points, but booking direct kept my elite night credits. Depends what you value.', offer: null },
];

// Bonus-math count-up endpoints (step s5/s6).
export const CPP_BASE = 1.7;
export const CPP_BONUS = 2.21;
export const PTS_BASE = 76589;
export const PTS_BONUS = 58915;
