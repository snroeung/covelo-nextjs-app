import type { StaticImageData } from 'next/image';
import type { CardId } from '@/lib/points/types';

import imgChaseReserve    from '@/assets/cards/card_sapphire_reserve.webp';
import imgChasePreferred  from '@/assets/cards/chase_sapphire_preferred.jpeg';
import imgChaseFreedom    from '@/assets/cards/chase_freedom.avif';
import imgC1VentureX      from '@/assets/cards/capitalone_venture_x.avif';
import imgC1Venture       from '@/assets/cards/capitalone_venture.avif';
import imgC1Savor         from '@/assets/cards/capitalone_savor.avif';
import imgAmexPlatinum    from '@/assets/cards/amex_platinum.avif';
import imgAmexGold        from '@/assets/cards/amex_gold.avif';
import imgAmexGreen       from '@/assets/cards/amex_green.avif';
import imgBiltBlue        from '@/assets/cards/bilt_blue.webp';
import imgBiltObsidian    from '@/assets/cards/bilt_obsidian.webp';
import imgBiltPalladium   from '@/assets/cards/bilt_palladium.webp';
import imgCitiPremier     from '@/assets/cards/citi_strata_premier.webp';
import imgCitiElite       from '@/assets/cards/citi_strata_elite.png';

export const CARD_IMAGES: Partial<Record<CardId, StaticImageData>> = {
  chase_reserve:           imgChaseReserve,
  chase_preferred:         imgChasePreferred,
  chase_freedom_unlimited: imgChaseFreedom,
  c1_venture_x:            imgC1VentureX,
  c1_venture:              imgC1Venture,
  c1_savor:                imgC1Savor,
  amex_platinum:           imgAmexPlatinum,
  amex_gold:               imgAmexGold,
  amex_green:              imgAmexGreen,
  bilt_blue:               imgBiltBlue,
  bilt_obsidian:           imgBiltObsidian,
  bilt_palladium:          imgBiltPalladium,
  citi_strata_premier:     imgCitiPremier,
  citi_strata_elite:       imgCitiElite,
};
