// SINGLE SOURCE OF TRUTH for card art. Never import from @/assets/cards/*
// anywhere else — asset renames/format migrations must only touch this file.
// Consumers render a placeholder when a CardId is absent from the map.
import type { StaticImageData } from 'next/image';
import type { CardId } from '@/lib/points/types';

import imgChasePreferred  from '@/assets/cards/chase_sapphire_preferred.jpeg';
import imgChaseFreedom    from '@/assets/cards/chase_freedom.png';
import imgC1VentureX      from '@/assets/cards/capitalone_venture_x.png';
import imgC1Venture       from '@/assets/cards/capitalone_venture.png';
import imgC1Savor         from '@/assets/cards/capitalone_savor.png';
import imgAmexPlatinum    from '@/assets/cards/amex_platinum.png';
import imgAmexGold        from '@/assets/cards/amex_gold.png';
import imgAmexGreen       from '@/assets/cards/amex_green.png';
import imgCitiElite       from '@/assets/cards/citi_strata_elite.png';

export const CARD_IMAGES: Partial<Record<CardId, StaticImageData>> = {
  chase_preferred:         imgChasePreferred,
  chase_freedom_unlimited: imgChaseFreedom,
  c1_venture_x:            imgC1VentureX,
  c1_venture:              imgC1Venture,
  c1_savor:                imgC1Savor,
  amex_platinum:           imgAmexPlatinum,
  amex_gold:               imgAmexGold,
  amex_green:              imgAmexGreen,
  citi_strata_elite:       imgCitiElite,
};
