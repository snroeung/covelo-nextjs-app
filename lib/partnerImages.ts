import type { StaticImageData } from 'next/image';

import imgFlyingBlue     from '@/assets/partners/flying_blue.png';
import imgUnited         from '@/assets/partners/united.png';
import imgSouthwest      from '@/assets/partners/southwest.png';
import imgBritishAirways from '@/assets/partners/british_airways.png';
import imgSingapore      from '@/assets/partners/singapore.png';
import imgVirginAtlantic from '@/assets/partners/virgin_atlantic.png';
import imgIberia         from '@/assets/partners/iberia.png';
import imgAerLingus      from '@/assets/partners/aer_lingus.png';
import imgAirCanada      from '@/assets/partners/air_canada.png';
import imgEmirates       from '@/assets/partners/emirates.png';
import imgJetBlue        from '@/assets/partners/jetblue.png';
import imgDelta          from '@/assets/partners/delta.png';
import imgAna            from '@/assets/partners/ana.png';
import imgEtihad         from '@/assets/partners/etihad.png';
import imgHawaiian       from '@/assets/partners/hawaiian.png';
import imgQantas         from '@/assets/partners/qantas.png';
import imgAmerican       from '@/assets/partners/american.png';
import imgAlaska         from '@/assets/partners/alaska.png';
import imgAvianca        from '@/assets/partners/avianca.png';
import imgTurkish        from '@/assets/partners/turkish.png';
import imgCathay         from '@/assets/partners/cathay.png';
import imgTap            from '@/assets/partners/tap.png';
import imgEva            from '@/assets/partners/eva.png';
import imgHyatt          from '@/assets/partners/hyatt.png';
import imgIhg            from '@/assets/partners/ihg.png';
import imgMarriott       from '@/assets/partners/marriott.png';
import imgHilton         from '@/assets/partners/hilton.png';
import imgWyndham        from '@/assets/partners/wyndham.png';
import imgChoice         from '@/assets/partners/choice.png';

/** Keyed by the program name string from TRANSFER_PARTNERS */
export const PARTNER_IMAGES: Record<string, StaticImageData> = {
  'Air France/KLM Flying Blue':  imgFlyingBlue,
  'United MileagePlus':          imgUnited,
  'Southwest Rapid Rewards':     imgSouthwest,
  'British Airways Avios':       imgBritishAirways,
  'Singapore KrisFlyer':         imgSingapore,
  'Virgin Atlantic Flying Club': imgVirginAtlantic,
  'Iberia Plus':                 imgIberia,
  'Aer Lingus AerClub':          imgAerLingus,
  'Air Canada Aeroplan':         imgAirCanada,
  'Emirates Skywards':           imgEmirates,
  'JetBlue TrueBlue':            imgJetBlue,
  'Delta SkyMiles':              imgDelta,
  'ANA Mileage Club':            imgAna,
  'Etihad Guest':                imgEtihad,
  'Hawaiian Miles':              imgHawaiian,
  'Qantas Frequent Flyer':       imgQantas,
  'American AAdvantage':         imgAmerican,
  'Alaska Mileage Plan':         imgAlaska,
  'Avianca LifeMiles':           imgAvianca,
  'Turkish Miles&Smiles':        imgTurkish,
  'Cathay Pacific Asia Miles':   imgCathay,
  'TAP Air Portugal Miles&Go':   imgTap,
  'EVA Air':                     imgEva,
  'World of Hyatt':              imgHyatt,
  'IHG One Rewards':             imgIhg,
  'Marriott Bonvoy':             imgMarriott,
  'Hilton Honors':               imgHilton,
  'Wyndham Rewards':             imgWyndham,
  'Choice Privileges':           imgChoice,
};
