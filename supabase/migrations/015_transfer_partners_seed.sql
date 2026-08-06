-- Run in Supabase Dashboard → SQL Editor → New Query
-- Seeds transfer_partners with the current contents of
-- lib/points/transferPartners.ts's TRANSFER_PARTNERS constant, so the DB
-- cutover in usePointsCalc doesn't lose existing coverage. All rows land as
-- source='admin', status='admin' — same trust tier as hand-entered data,
-- distinct from cron-scraped 'pending' rows.

INSERT INTO public.transfer_partners (portal_id, program, type, ratio, chain_key, iata_codes, source, status, active) VALUES
  -- chase
  ('chase', 'World of Hyatt',              'hotel',   '1:1', 'hyatt',    '{}',            'admin', 'admin', true),
  ('chase', 'IHG One Rewards',             'hotel',   '1:1', 'ihg',      '{}',            'admin', 'admin', true),
  ('chase', 'Marriott Bonvoy',             'hotel',   '1:1', 'marriott', '{}',            'admin', 'admin', true),
  ('chase', 'United MileagePlus',          'airline', '1:1', NULL,       '{UA}',          'admin', 'admin', true),
  ('chase', 'Southwest Rapid Rewards',     'airline', '1:1', NULL,       '{WN}',          'admin', 'admin', true),
  ('chase', 'British Airways Avios',       'airline', '1:1', NULL,       '{BA}',          'admin', 'admin', true),
  ('chase', 'Air France/KLM Flying Blue',  'airline', '1:1', NULL,       '{AF,KL}',       'admin', 'admin', true),
  ('chase', 'Singapore KrisFlyer',         'airline', '1:1', NULL,       '{SQ}',          'admin', 'admin', true),
  ('chase', 'Virgin Atlantic Flying Club', 'airline', '1:1', NULL,       '{VS}',          'admin', 'admin', true),
  ('chase', 'Iberia Plus',                 'airline', '1:1', NULL,       '{IB}',          'admin', 'admin', true),
  ('chase', 'Aer Lingus AerClub',          'airline', '1:1', NULL,       '{EI}',          'admin', 'admin', true),
  ('chase', 'Air Canada Aeroplan',         'airline', '1:1', NULL,       '{AC}',          'admin', 'admin', true),
  ('chase', 'Emirates Skywards',           'airline', '1:1', NULL,       '{EK}',          'admin', 'admin', true),
  ('chase', 'JetBlue TrueBlue',            'airline', '1:1', NULL,       '{B6}',          'admin', 'admin', true),

  -- amex
  ('amex', 'Hilton Honors',                'hotel',   '1:2', 'hilton',   '{}',            'admin', 'admin', true),
  ('amex', 'Marriott Bonvoy',              'hotel',   '1:1', 'marriott', '{}',            'admin', 'admin', true),
  ('amex', 'Delta SkyMiles',               'airline', '1:1', NULL,       '{DL}',          'admin', 'admin', true),
  ('amex', 'British Airways Avios',        'airline', '1:1', NULL,       '{BA}',          'admin', 'admin', true),
  ('amex', 'Air France/KLM Flying Blue',   'airline', '1:1', NULL,       '{AF,KL}',       'admin', 'admin', true),
  ('amex', 'Singapore KrisFlyer',          'airline', '1:1', NULL,       '{SQ}',          'admin', 'admin', true),
  ('amex', 'ANA Mileage Club',             'airline', '1:1', NULL,       '{NH}',          'admin', 'admin', true),
  ('amex', 'Virgin Atlantic Flying Club',  'airline', '1:1', NULL,       '{VS}',          'admin', 'admin', true),
  ('amex', 'Air Canada Aeroplan',          'airline', '1:1', NULL,       '{AC}',          'admin', 'admin', true),
  ('amex', 'Emirates Skywards',            'airline', '1:1', NULL,       '{EK}',          'admin', 'admin', true),
  ('amex', 'Etihad Guest',                 'airline', '1:1', NULL,       '{EY}',          'admin', 'admin', true),
  ('amex', 'Hawaiian Miles',               'airline', '1:1', NULL,       '{HA}',          'admin', 'admin', true),
  ('amex', 'Iberia Plus',                  'airline', '1:1', NULL,       '{IB}',          'admin', 'admin', true),
  ('amex', 'JetBlue TrueBlue',             'airline', '1:1', NULL,       '{B6}',          'admin', 'admin', true),
  ('amex', 'Qantas Frequent Flyer',        'airline', '1:1', NULL,       '{QF}',          'admin', 'admin', true),

  -- capital_one
  ('capital_one', 'Wyndham Rewards',               'hotel',   '1:1', 'wyndham', '{}',     'admin', 'admin', true),
  ('capital_one', 'Choice Privileges',              'hotel',   '1:1', 'choice',  '{}',     'admin', 'admin', true),
  ('capital_one', 'Air Canada Aeroplan',            'airline', '1:1', NULL,      '{AC}',   'admin', 'admin', true),
  ('capital_one', 'Air France/KLM Flying Blue',     'airline', '1:1', NULL,      '{AF,KL}','admin', 'admin', true),
  ('capital_one', 'Avianca LifeMiles',              'airline', '1:1', NULL,      '{AV}',   'admin', 'admin', true),
  ('capital_one', 'British Airways Avios',          'airline', '1:1', NULL,      '{BA}',   'admin', 'admin', true),
  ('capital_one', 'Emirates Skywards',              'airline', '1:1', NULL,      '{EK}',   'admin', 'admin', true),
  ('capital_one', 'Etihad Guest',                   'airline', '1:1', NULL,      '{EY}',   'admin', 'admin', true),
  ('capital_one', 'Singapore KrisFlyer',            'airline', '1:1', NULL,      '{SQ}',   'admin', 'admin', true),
  ('capital_one', 'Turkish Miles&Smiles',           'airline', '1:1', NULL,      '{TK}',   'admin', 'admin', true),
  ('capital_one', 'Virgin Atlantic Flying Club',    'airline', '1:1', NULL,      '{VS}',   'admin', 'admin', true),
  ('capital_one', 'TAP Air Portugal Miles&Go',      'airline', '1:1', NULL,      '{TP}',   'admin', 'admin', true),

  -- bilt
  ('bilt', 'World of Hyatt',                'hotel',   '1:1', 'hyatt',    '{}',            'admin', 'admin', true),
  ('bilt', 'IHG One Rewards',               'hotel',   '1:1', 'ihg',      '{}',            'admin', 'admin', true),
  ('bilt', 'Marriott Bonvoy',               'hotel',   '1:1', 'marriott', '{}',            'admin', 'admin', true),
  ('bilt', 'American AAdvantage',           'airline', '1:1', NULL,       '{AA}',          'admin', 'admin', true),
  ('bilt', 'United MileagePlus',            'airline', '1:1', NULL,       '{UA}',          'admin', 'admin', true),
  ('bilt', 'Alaska Mileage Plan',           'airline', '1:1', NULL,       '{AS}',          'admin', 'admin', true),
  ('bilt', 'Air France/KLM Flying Blue',    'airline', '1:1', NULL,       '{AF,KL}',       'admin', 'admin', true),
  ('bilt', 'British Airways Avios',         'airline', '1:1', NULL,       '{BA}',          'admin', 'admin', true),
  ('bilt', 'Virgin Atlantic Flying Club',   'airline', '1:1', NULL,       '{VS}',          'admin', 'admin', true),
  ('bilt', 'Cathay Pacific Asia Miles',     'airline', '1:1', NULL,       '{CX}',          'admin', 'admin', true),
  ('bilt', 'Emirates Skywards',             'airline', '1:1', NULL,       '{EK}',          'admin', 'admin', true),
  ('bilt', 'Turkish Miles&Smiles',          'airline', '1:1', NULL,       '{TK}',          'admin', 'admin', true),

  -- citi
  ('citi', 'Air France/KLM Flying Blue',    'airline', '1:1', NULL,       '{AF,KL}',       'admin', 'admin', true),
  ('citi', 'Avianca LifeMiles',             'airline', '1:1', NULL,       '{AV}',          'admin', 'admin', true),
  ('citi', 'Turkish Miles&Smiles',          'airline', '1:1', NULL,       '{TK}',          'admin', 'admin', true),
  ('citi', 'Virgin Atlantic Flying Club',   'airline', '1:1', NULL,       '{VS}',          'admin', 'admin', true),
  ('citi', 'Cathay Pacific Asia Miles',     'airline', '1:1', NULL,       '{CX}',          'admin', 'admin', true),
  ('citi', 'Singapore KrisFlyer',           'airline', '1:1', NULL,       '{SQ}',          'admin', 'admin', true),
  ('citi', 'Air Canada Aeroplan',           'airline', '1:1', NULL,       '{AC}',          'admin', 'admin', true),
  ('citi', 'EVA Air',                       'airline', '1:1', NULL,       '{BR}',          'admin', 'admin', true)
ON CONFLICT (portal_id, program, type) DO NOTHING;
