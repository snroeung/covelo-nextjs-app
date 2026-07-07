'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc-client';
import { CARD_NAMES, type CardId, type PortalId } from '@/lib/points/types';
import { TRANSFER_PARTNERS } from '@/lib/points/transferPartners';
import { PARTNER_IMAGES } from '@/lib/partnerImages';
import type { Issuer, TransferBonus, SpendingBonus } from '@/lib/types/offers';

const OFFER_TAGS = [
  'Statement credit',
  'Free night',
  'Sign on bonus',
  'Points bonus',
  'Transfer bonus',
  'Cash back',
  'Hotel credit',
  'Flight credit',
  'Dining credit',
  'Travel credit',
  'Annual benefit',
  'Limited time',
];

type OfferType = 'transfer' | 'spending';

const ISSUERS: Issuer[] = ['chase', 'amex', 'c1', 'bilt', 'citi'];

const ISSUER_LABELS: Record<Issuer, string> = {
  chase: 'Chase',
  amex:  'American Express',
  c1:    'Capital One',
  bilt:  'Bilt',
  citi:  'Citi',
};

const ISSUER_TO_PORTAL: Record<Issuer, PortalId> = {
  chase: 'chase',
  amex:  'amex',
  c1:    'capital_one',
  bilt:  'bilt',
  citi:  'citi',
};

const ISSUER_CARDS: Record<Issuer, CardId[]> = {
  chase: ['chase_reserve', 'chase_preferred', 'chase_freedom_unlimited'],
  amex:  ['amex_platinum', 'amex_gold', 'amex_green'],
  c1:    ['c1_venture_x', 'c1_venture', 'c1_savor'],
  bilt:  ['bilt_blue', 'bilt_obsidian', 'bilt_palladium'],
  citi:  ['citi_strata_premier', 'citi_strata_elite'],
};

interface TransferForm {
  issuer:           Issuer | '';
  transfer_partner: string;
  bonus_pct:        string;
  description:      string;
  tags:             string[];
  start_date:       string;
  end_date:         string;
  is_targeted:      boolean;
  source_url:       string;
  country:          string;
  active:           boolean;
}

interface SpendingForm {
  issuer:           Issuer | '';
  merchant_name:    string;
  bonus_multiplier: string;
  bonus_type:       'points_multiplier' | 'cash_back_pct' | 'dollar_amount';
  spending_minimum: string;
  minimum_nights:   string;
  description:      string;
  tags:             string[];
  card_ids:         string[];
  start_date:       string;
  end_date:         string;
  is_targeted:      boolean;
  source_url:       string;
  country:          string;
  active:           boolean;
}

type InitialOffer =
  | { type: 'transfer'; offer: TransferBonus }
  | { type: 'spending'; offer: SpendingBonus };

interface Props {
  initial?: InitialOffer;
  onSave:   () => void;
  onCancel: () => void;
  isDark:   boolean;
}

function labelCls(isDark: boolean) {
  return `text-[10px] font-mono font-bold tracking-widest ${isDark ? 'text-gph-dark-muted' : 'text-gray-500'}`;
}

function inputCls(isDark: boolean) {
  return `w-full px-3 py-2 rounded-lg text-sm border outline-none transition-colors ${
    isDark
      ? 'bg-gph-dark-bg border-gph-dark-line text-gph-dark-ink placeholder-gph-dark-muted focus:border-blue-500'
      : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
  }`;
}

export function AdminOfferEditor({ initial, onSave, onCancel, isDark }: Props) {
  const queryClient = useQueryClient();
  const isEditing = !!initial;

  const [offerType, setOfferType] = useState<OfferType>(
    initial?.type ?? 'transfer'
  );
  const [error, setError] = useState<string | null>(null);

  const initT = initial?.type === 'transfer' ? initial.offer : undefined;
  const initS = initial?.type === 'spending' ? initial.offer : undefined;

  const [transfer, setTransfer] = useState<TransferForm>({
    issuer:           initT?.issuer           ?? '',
    transfer_partner: initT?.transfer_partner ?? '',
    bonus_pct:        initT?.bonus_pct?.toString() ?? '',
    description:      initT?.description      ?? '',
    tags:             initT?.tags             ?? [],
    start_date:       initT?.start_date       ?? '',
    end_date:         initT?.end_date         ?? '',
    is_targeted:      initT?.is_targeted      ?? false,
    source_url:       initT?.source_url       ?? '',
    country:          initT?.country          ?? 'US',
    active:           initT?.active           ?? true,
  });

  const [spending, setSpending] = useState<SpendingForm>({
    issuer:           initS?.issuer                  ?? '',
    merchant_name:    initS?.merchant_name           ?? '',
    bonus_multiplier: initS?.bonus_multiplier?.toString() ?? '',
    bonus_type:       initS?.bonus_type              ?? 'points_multiplier',
    spending_minimum: initS?.spending_minimum?.toString() ?? '',
    minimum_nights:   initS?.minimum_nights?.toString()   ?? '',
    description:      initS?.description             ?? '',
    tags:             initS?.tags                    ?? [],
    card_ids:         initS?.card_ids                ?? [],
    start_date:       initS?.start_date              ?? '',
    end_date:         initS?.end_date                ?? '',
    is_targeted:      initS?.is_targeted             ?? false,
    source_url:       initS?.source_url              ?? '',
    country:          initS?.country                 ?? 'US',
    active:           initS?.active                  ?? true,
  });

  const card  = isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200';
  const ink   = isDark ? 'text-gph-dark-ink'   : 'text-gray-900';
  const muted = isDark ? 'text-gph-dark-muted' : 'text-gray-500';
  const line  = isDark ? 'border-gph-dark-line' : 'border-gray-200';
  const subBg = isDark ? 'bg-gph-dark-bg'       : 'bg-gray-50';

  const lCls = labelCls(isDark);
  const iCls = inputCls(isDark);

  // Transfer partner options filtered by issuer
  const partnerOptions = transfer.issuer
    ? (TRANSFER_PARTNERS[ISSUER_TO_PORTAL[transfer.issuer as Issuer]] ?? [])
    : [];

  // Card checkboxes filtered by issuer
  const cardOptions = spending.issuer
    ? (ISSUER_CARDS[spending.issuer as Issuer] ?? [])
    : [];

  // Derived effective ratio (read-only, mirrors DB GENERATED column)
  const bonusPctNum    = parseFloat(transfer.bonus_pct);
  const effectiveRatio = !isNaN(bonusPctNum) && bonusPctNum > 0
    ? (1 + bonusPctNum / 100).toFixed(4)
    : '—';

  const { mutate: createTransfer, isPending: creatingTransfer } = useMutation({
    mutationFn: () => trpc.offers.admin.createTransferBonus.mutate({
      issuer:           transfer.issuer as Issuer,
      transfer_partner: transfer.transfer_partner,
      bonus_pct:        parseFloat(transfer.bonus_pct),
      description:      transfer.description || null,
      tags:             transfer.tags,
      start_date:       transfer.start_date,
      end_date:         transfer.end_date,
      is_targeted:      transfer.is_targeted,
      source_url:       transfer.source_url || null,
      country:          transfer.country,
      active:           transfer.active,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers.admin.listAll'] });
      onSave();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Save failed'),
  });

  const { mutate: createSpending, isPending: creatingSpending } = useMutation({
    mutationFn: () => trpc.offers.admin.createSpendingBonus.mutate({
      issuer:           spending.issuer as Issuer,
      merchant_name:    spending.merchant_name,
      bonus_multiplier: parseFloat(spending.bonus_multiplier),
      bonus_type:       spending.bonus_type,
      spending_minimum: spending.spending_minimum ? parseFloat(spending.spending_minimum) : null,
      minimum_nights:   spending.minimum_nights ? parseInt(spending.minimum_nights, 10) : null,
      description:      spending.description || null,
      tags:             spending.tags,
      card_ids:         spending.card_ids,
      start_date:       spending.start_date,
      end_date:         spending.end_date,
      is_targeted:      spending.is_targeted,
      source_url:       spending.source_url || null,
      country:          spending.country,
      active:           spending.active,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers.admin.listAll'] });
      onSave();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Save failed'),
  });

  const { mutate: updateTransfer, isPending: updatingTransfer } = useMutation({
    mutationFn: () => trpc.offers.admin.updateTransferBonus.mutate({
      id:               (initT as TransferBonus).id,
      issuer:           transfer.issuer as Issuer,
      transfer_partner: transfer.transfer_partner,
      bonus_pct:        parseFloat(transfer.bonus_pct),
      description:      transfer.description || null,
      tags:             transfer.tags,
      start_date:       transfer.start_date || null,
      end_date:         transfer.end_date,
      is_targeted:      transfer.is_targeted,
      source_url:       transfer.source_url || null,
      country:          transfer.country,
      active:           transfer.active,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers.admin.listAll'] });
      onSave();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Save failed'),
  });

  const { mutate: updateSpending, isPending: updatingSpending } = useMutation({
    mutationFn: () => trpc.offers.admin.updateSpendingBonus.mutate({
      id:               (initS as SpendingBonus).id,
      issuer:           spending.issuer as Issuer,
      merchant_name:    spending.merchant_name,
      bonus_multiplier: parseFloat(spending.bonus_multiplier),
      bonus_type:       spending.bonus_type,
      spending_minimum: spending.spending_minimum ? parseFloat(spending.spending_minimum) : null,
      minimum_nights:   spending.minimum_nights ? parseInt(spending.minimum_nights, 10) : null,
      description:      spending.description || null,
      tags:             spending.tags,
      card_ids:         spending.card_ids,
      start_date:       spending.start_date || null,
      end_date:         spending.end_date,
      is_targeted:      spending.is_targeted,
      source_url:       spending.source_url || null,
      country:          spending.country,
      active:           spending.active,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers.admin.listAll'] });
      onSave();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Save failed'),
  });

  const isPending = creatingTransfer || creatingSpending || updatingTransfer || updatingSpending;

  function setT<K extends keyof TransferForm>(key: K, value: TransferForm[K]) {
    setTransfer((prev) => ({ ...prev, [key]: value }));
  }

  function setS<K extends keyof SpendingForm>(key: K, value: SpendingForm[K]) {
    setSpending((prev) => ({ ...prev, [key]: value }));
  }

  function handleTransferIssuerChange(issuer: string) {
    setTransfer((prev) => ({ ...prev, issuer: issuer as Issuer, transfer_partner: '' }));
  }

  function handleSpendingIssuerChange(issuer: string) {
    setSpending((prev) => ({ ...prev, issuer: issuer as Issuer, card_ids: [] }));
  }

  function toggleCardId(cardId: string) {
    setSpending((prev) => ({
      ...prev,
      card_ids: prev.card_ids.includes(cardId)
        ? prev.card_ids.filter((id) => id !== cardId)
        : [...prev.card_ids, cardId],
    }));
  }

  function handlePublish() {
    setError(null);
    if (isEditing) {
      if (offerType === 'transfer') updateTransfer();
      else updateSpending();
    } else {
      if (offerType === 'transfer') createTransfer();
      else createSpending();
    }
  }

  const transferChecks = [
    { label: 'Issuer selected',           ok: !!transfer.issuer },
    { label: 'Transfer partner selected', ok: !!transfer.transfer_partner },
    { label: 'Bonus % is positive',       ok: !isNaN(bonusPctNum) && bonusPctNum > 0 },
    { label: 'Start date set',            ok: !!transfer.start_date },
    { label: 'End date set',              ok: !!transfer.end_date },
    { label: 'Source URL valid (if set)', ok: !transfer.source_url || /^https?:\/\/.+/.test(transfer.source_url) },
  ];

  const spendingBonusNum = parseFloat(spending.bonus_multiplier);
  const spendingChecks = [
    { label: 'Issuer selected',           ok: !!spending.issuer },
    { label: 'Merchant name filled',      ok: spending.merchant_name.trim().length > 0 },
    { label: 'Bonus value is positive',   ok: !isNaN(spendingBonusNum) && spendingBonusNum > 0 },
    { label: 'At least one card',         ok: spending.card_ids.length > 0 },
    { label: 'Start date set',            ok: !!spending.start_date },
    { label: 'End date set',              ok: !!spending.end_date },
    { label: 'Source URL valid (if set)', ok: !spending.source_url || /^https?:\/\/.+/.test(spending.source_url) },
  ];

  const checks = offerType === 'transfer' ? transferChecks : spendingChecks;
  const allValid = checks.every((c) => c.ok);

  const toggleBtnCls = (active: boolean) =>
    `px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
      active
        ? isDark ? 'bg-white text-gray-900' : 'bg-gray-900 text-white'
        : isDark ? 'text-gph-dark-muted hover:text-gph-dark-ink' : 'text-gray-500 hover:text-gray-900'
    }`;

  const toggleSwitchCls = (on: boolean, color = 'bg-green-500') =>
    `relative w-9 h-5 rounded-full transition-colors ${on ? color : isDark ? 'bg-gph-dark-line' : 'bg-gray-300'}`;

  return (
    <div className={`rounded-xl border overflow-hidden ${card}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-5 py-4 border-b ${line}`}>
        <div>
          <div className={`text-[10px] font-mono font-bold tracking-widest mb-1 ${muted}`}>
            {isEditing ? 'EDIT OFFER' : 'NEW OFFER'}
          </div>
          <h3 className={`text-lg font-bold ${ink}`}>
            {isEditing ? 'Edit offer' : 'Create a new offer'}
          </h3>
        </div>
        <button
          onClick={onCancel}
          className={`text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors ${
            isDark ? 'text-gph-dark-muted hover:text-gph-dark-ink hover:bg-white/5' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          Cancel
        </button>
      </div>

      {/* Offer type toggle */}
      <div className={`px-5 py-3 border-b flex items-center gap-2 ${line} ${subBg}`}>
        <button
          onClick={() => !isEditing && setOfferType('transfer')}
          className={toggleBtnCls(offerType === 'transfer')}
          disabled={isEditing}
        >
          Transfer Bonus
        </button>
        <button
          onClick={() => !isEditing && setOfferType('spending')}
          className={toggleBtnCls(offerType === 'spending')}
          disabled={isEditing}
        >
          Spending Bonus
        </button>
        {isEditing && (
          <span className={`ml-2 text-[10px] font-mono ${muted}`}>Type is locked when editing</span>
        )}
      </div>

      <div className="grid md:grid-cols-[1.2fr_1fr]">
        {/* ── Form ── */}
        <div className={`p-5 md:p-6 flex flex-col gap-5 border-r ${line}`}>

          {offerType === 'transfer' ? (
            <>
              {/* 1. Issuer & Partner */}
              <section>
                <div className={`mb-3 ${lCls}`}>1 · ISSUER & PARTNER</div>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className={`block mb-1.5 ${lCls}`}>ISSUER</label>
                    <select
                      className={iCls}
                      value={transfer.issuer}
                      onChange={(e) => handleTransferIssuerChange(e.target.value)}
                    >
                      <option value="">Select issuer…</option>
                      {ISSUERS.map((iss) => (
                        <option key={iss} value={iss}>{ISSUER_LABELS[iss]}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={`block mb-1.5 ${lCls}`}>TRANSFER PARTNER</label>
                    <select
                      className={iCls}
                      value={transfer.transfer_partner}
                      onChange={(e) => setT('transfer_partner', e.target.value)}
                      disabled={!transfer.issuer}
                    >
                      <option value="">{transfer.issuer ? 'Select partner…' : 'Select issuer first'}</option>
                      {partnerOptions.map((p) => (
                        <option key={p.program} value={p.program}>
                          [{p.type === 'hotel' ? 'Hotel' : 'Airline'}] {p.program} ({p.ratio})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={`block mb-1.5 ${lCls}`}>DESCRIPTION <span className={muted}>— optional</span></label>
                    <textarea
                      rows={2}
                      className={iCls}
                      value={transfer.description}
                      onChange={(e) => setT('description', e.target.value)}
                      placeholder="e.g. Limited-time 30% bonus when transferring Chase points to Hyatt through Dec 31."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={`block mb-1.5 ${lCls}`}>BONUS %</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className={iCls}
                        value={transfer.bonus_pct}
                        onChange={(e) => setT('bonus_pct', e.target.value)}
                        placeholder="e.g. 30"
                      />
                    </div>
                    <div>
                      <label className={`block mb-1.5 ${lCls}`}>EFFECTIVE RATIO</label>
                      <div className={`${iCls} font-mono cursor-default select-none ${muted}`}>
                        {effectiveRatio}:1
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* 2. Tags, Dates & Flags */}
              <section>
                <div className={`mb-3 ${lCls}`}>2 · TAGS, DATES & FLAGS</div>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className={`block mb-1.5 ${lCls}`}>TAGS <span className={muted}>— select all that apply</span></label>
                    <div className="flex flex-wrap gap-2">
                      {OFFER_TAGS.map((tag) => {
                        const checked = transfer.tags.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => setT('tags', checked ? transfer.tags.filter((t) => t !== tag) : [...transfer.tags, tag])}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-bold transition-colors ${
                              checked
                                ? isDark ? 'bg-white text-gray-900' : 'bg-gray-900 text-white'
                                : isDark ? 'bg-gph-dark-linesoft text-gph-dark-muted hover:text-gph-dark-ink' : 'bg-gray-100 text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={`block mb-1.5 ${lCls}`}>START DATE</label>
                      <input type="date" className={iCls} value={transfer.start_date} onChange={(e) => setT('start_date', e.target.value)} />
                    </div>
                    <div>
                      <label className={`block mb-1.5 ${lCls}`}>END DATE <span className="text-red-500">*</span></label>
                      <input type="date" className={iCls} value={transfer.end_date} onChange={(e) => setT('end_date', e.target.value)} />
                    </div>
                    <div className="col-span-2">
                      <label className={`block mb-1.5 ${lCls}`}>COUNTRY / REGION</label>
                      <select className={iCls} value={transfer.country} onChange={(e) => setT('country', e.target.value)}>
                        <option value="US">United States</option>
                        <option value="Global">Global</option>
                        <option value="CA">Canada</option>
                        <option value="GB">United Kingdom</option>
                        <option value="AU">Australia</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={`block mb-1.5 ${lCls}`}>SOURCE URL</label>
                    <input
                      className={`${iCls} font-mono text-xs`}
                      value={transfer.source_url}
                      onChange={(e) => setT('source_url', e.target.value)}
                      placeholder="https://…"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setT('is_targeted', !transfer.is_targeted)}
                      className={toggleSwitchCls(transfer.is_targeted, 'bg-amber-500')}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${transfer.is_targeted ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                    <span className={`text-sm font-semibold ${ink}`}>
                      {transfer.is_targeted ? 'Targeted — not available to all cardholders' : 'Available to all cardholders'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setT('active', !transfer.active)}
                      className={`relative w-9 h-5 rounded-full transition-colors ${transfer.active ? 'bg-green-500' : isDark ? 'bg-gph-dark-line' : 'bg-gray-300'}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${transfer.active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                    <span className={`text-sm font-semibold ${ink}`}>
                      {transfer.active ? 'Active — visible to users' : 'Inactive — hidden from users'}
                    </span>
                  </div>
                </div>
              </section>
            </>
          ) : (
            <>
              {/* 1. Issuer & Merchant */}
              <section>
                <div className={`mb-3 ${lCls}`}>1 · ISSUER & MERCHANT</div>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className={`block mb-1.5 ${lCls}`}>ISSUER</label>
                    <select
                      className={iCls}
                      value={spending.issuer}
                      onChange={(e) => handleSpendingIssuerChange(e.target.value)}
                    >
                      <option value="">Select issuer…</option>
                      {ISSUERS.map((iss) => (
                        <option key={iss} value={iss}>{ISSUER_LABELS[iss]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={`block mb-1.5 ${lCls}`}>MERCHANT / CATEGORY</label>
                    <input
                      className={iCls}
                      value={spending.merchant_name}
                      onChange={(e) => setS('merchant_name', e.target.value)}
                      placeholder="e.g. Restaurants, Gas Stations, Amazon"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={`block mb-1.5 ${lCls}`}>
                        {spending.bonus_type === 'dollar_amount' ? 'DOLLAR AMOUNT ($)' : 'BONUS MULTIPLIER'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step={spending.bonus_type === 'dollar_amount' ? '1' : '0.01'}
                        className={iCls}
                        value={spending.bonus_multiplier}
                        onChange={(e) => setS('bonus_multiplier', e.target.value)}
                        placeholder={spending.bonus_type === 'dollar_amount' ? 'e.g. 50' : 'e.g. 5'}
                      />
                    </div>
                    <div>
                      <label className={`block mb-1.5 ${lCls}`}>BONUS TYPE</label>
                      <select
                        className={iCls}
                        value={spending.bonus_type}
                        onChange={(e) => setS('bonus_type', e.target.value as SpendingForm['bonus_type'])}
                      >
                        <option value="points_multiplier">Points Multiplier</option>
                        <option value="cash_back_pct">Cash Back %</option>
                        <option value="dollar_amount">Dollar Amount</option>
                      </select>
                    </div>
                    <div>
                      <label className={`block mb-1.5 ${lCls}`}>SPENDING MINIMUM ($) <span className={muted}>— optional</span></label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className={iCls}
                        value={spending.spending_minimum}
                        onChange={(e) => setS('spending_minimum', e.target.value)}
                        placeholder="e.g. 500"
                      />
                    </div>
                    <div>
                      <label className={`block mb-1.5 ${lCls}`}>MINIMUM NIGHTS <span className={muted}>— optional</span></label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        className={iCls}
                        value={spending.minimum_nights}
                        onChange={(e) => setS('minimum_nights', e.target.value)}
                        placeholder="e.g. 2"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className={`block mb-1.5 ${lCls}`}>DESCRIPTION <span className={muted}>— optional</span></label>
                      <textarea
                        rows={2}
                        className={iCls}
                        value={spending.description}
                        onChange={(e) => setS('description', e.target.value)}
                        placeholder="e.g. Earn 5x points at restaurants through June 30 with the Amex Gold card."
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* 2. Eligible Cards */}
              <section>
                <div className={`mb-3 ${lCls}`}>2 · ELIGIBLE CARDS</div>
                {!spending.issuer ? (
                  <p className={`text-sm ${muted}`}>Select an issuer above to see eligible cards.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {cardOptions.map((cardId) => {
                      const checked = spending.card_ids.includes(cardId);
                      return (
                        <label key={cardId} className="flex items-center gap-3 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleCardId(cardId)}
                            className="w-4 h-4 rounded accent-blue-500"
                          />
                          <span className={`text-sm font-medium transition-colors ${checked ? ink : muted} group-hover:${ink}`}>
                            {CARD_NAMES[cardId]}
                          </span>
                        </label>
                      );
                    })}
                    <div className="flex items-center gap-3 mt-1">
                      <button
                        type="button"
                        onClick={() => setS('card_ids', cardOptions.slice())}
                        className={`text-[10px] font-mono font-bold ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`}
                      >
                        Select all
                      </button>
                      {spending.card_ids.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setS('card_ids', [])}
                          className={`text-[10px] font-mono font-bold ${isDark ? 'text-gph-dark-muted hover:text-gph-dark-ink' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </section>

              {/* 3. Tags, Dates & Flags */}
              <section>
                <div className={`mb-3 ${lCls}`}>3 · TAGS, DATES & FLAGS</div>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className={`block mb-1.5 ${lCls}`}>TAGS <span className={muted}>— select all that apply</span></label>
                    <div className="flex flex-wrap gap-2">
                      {OFFER_TAGS.map((tag) => {
                        const checked = spending.tags.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => setS('tags', checked ? spending.tags.filter((t) => t !== tag) : [...spending.tags, tag])}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-bold transition-colors ${
                              checked
                                ? isDark ? 'bg-white text-gray-900' : 'bg-gray-900 text-white'
                                : isDark ? 'bg-gph-dark-linesoft text-gph-dark-muted hover:text-gph-dark-ink' : 'bg-gray-100 text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={`block mb-1.5 ${lCls}`}>START DATE</label>
                      <input type="date" className={iCls} value={spending.start_date} onChange={(e) => setS('start_date', e.target.value)} />
                    </div>
                    <div>
                      <label className={`block mb-1.5 ${lCls}`}>END DATE <span className="text-red-500">*</span></label>
                      <input type="date" className={iCls} value={spending.end_date} onChange={(e) => setS('end_date', e.target.value)} />
                    </div>
                    <div className="col-span-2">
                      <label className={`block mb-1.5 ${lCls}`}>COUNTRY / REGION</label>
                      <select className={iCls} value={spending.country} onChange={(e) => setS('country', e.target.value)}>
                        <option value="US">United States</option>
                        <option value="Global">Global</option>
                        <option value="CA">Canada</option>
                        <option value="GB">United Kingdom</option>
                        <option value="AU">Australia</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={`block mb-1.5 ${lCls}`}>SOURCE URL</label>
                    <input
                      className={`${iCls} font-mono text-xs`}
                      value={spending.source_url}
                      onChange={(e) => setS('source_url', e.target.value)}
                      placeholder="https://…"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setS('is_targeted', !spending.is_targeted)}
                      className={toggleSwitchCls(spending.is_targeted, 'bg-amber-500')}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${spending.is_targeted ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                    <span className={`text-sm font-semibold ${ink}`}>
                      {spending.is_targeted ? 'Targeted — not available to all cardholders' : 'Available to all cardholders'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setS('active', !spending.active)}
                      className={`relative w-9 h-5 rounded-full transition-colors ${spending.active ? 'bg-green-500' : isDark ? 'bg-gph-dark-line' : 'bg-gray-300'}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${spending.active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                    <span className={`text-sm font-semibold ${ink}`}>
                      {spending.active ? 'Active — visible to users' : 'Inactive — hidden from users'}
                    </span>
                  </div>
                </div>
              </section>
            </>
          )}

          {error && <p className="text-sm text-red-500 font-semibold">{error}</p>}

          <div className={`flex items-center justify-end gap-3 pt-4 border-t ${line}`}>
            <button
              onClick={onCancel}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                isDark ? 'text-gph-dark-muted hover:text-gph-dark-ink' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Cancel
            </button>
            <button
              disabled={isPending || !allValid}
              onClick={handlePublish}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 ${
                isDark ? 'bg-white text-gray-900 hover:bg-gray-100' : 'bg-gray-900 text-white hover:bg-gray-700'
              }`}
            >
              {isPending
                ? (isEditing ? 'Saving…' : 'Publishing…')
                : (isEditing ? 'Save changes' : 'Publish offer')}
            </button>
          </div>
        </div>

        {/* ── Validation checklist + preview ── */}
        <div className={`p-5 md:p-6 flex flex-col gap-4 ${subBg}`}>
          <div className={`text-[10px] font-mono font-bold tracking-widest ${muted}`}>VALIDATION</div>
          <div className="flex flex-col gap-2">
            {checks.map((c) => (
              <div key={c.label} className="flex items-center gap-2.5">
                <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${c.ok ? 'bg-green-100' : 'bg-red-100'}`}>
                  {c.ok ? (
                    <svg className="w-2.5 h-2.5 text-green-600" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <svg className="w-2.5 h-2.5 text-red-600" viewBox="0 0 12 12" fill="none">
                      <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  )}
                </div>
                <span className={`text-xs font-medium ${c.ok ? ink : 'text-red-500'}`}>{c.label}</span>
                {!c.ok && <span className="ml-auto text-[10px] font-mono font-bold text-red-500">REQUIRED</span>}
              </div>
            ))}
          </div>

          {/* Preview card */}
          <div className={`mt-2 rounded-xl border overflow-hidden ${isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200'}`}>
            <div className={`text-[10px] font-mono font-bold tracking-widest px-4 pt-3 pb-1 ${muted}`}>PREVIEW</div>
            {offerType === 'transfer' ? (() => {
              const partnerImg = transfer.transfer_partner ? PARTNER_IMAGES[transfer.transfer_partner] : undefined;
              return (
                <div className="flex items-center gap-3 px-4 pb-4">
                  {partnerImg && (
                    <div className="shrink-0 w-16 h-10 relative rounded-md overflow-hidden bg-white border border-gray-100 flex items-center justify-center p-1">
                      <Image src={partnerImg} alt={transfer.transfer_partner} fill className="object-contain p-1" />
                    </div>
                  )}
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className={`text-sm font-bold truncate ${ink}`}>
                      {transfer.issuer ? ISSUER_LABELS[transfer.issuer as Issuer] : '—'} → {transfer.transfer_partner || '—'}
                    </div>
                    <div className={`text-xs font-mono ${muted}`}>
                      +{transfer.bonus_pct || '0'}% bonus · {effectiveRatio}:1 ratio
                    </div>
                    {transfer.end_date && (
                      <div className={`text-[10px] font-mono ${muted}`}>
                        Expires {new Date(transfer.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                        {transfer.is_targeted && ' · TARGETED'}
                      </div>
                    )}
                  </div>
                </div>
              );
            })() : (
              <div className="flex items-center gap-3 px-4 pb-4">
                {/* Image placeholder — upload coming soon */}
                <div className={`shrink-0 w-16 h-10 rounded-md border flex items-center justify-center ${
                  isDark ? 'bg-gph-dark-bg border-gph-dark-line' : 'bg-gray-50 border-gray-200'
                }`}>
                  <svg className={`w-5 h-5 ${muted}`} viewBox="0 0 14 14" fill="none">
                    <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1"/>
                    <circle cx="4.5" cy="4.5" r="1" fill="currentColor"/>
                    <path d="M1 10l3.5-3.5 2.5 2.5 2-2 3 3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className={`text-sm font-bold truncate ${ink}`}>{spending.merchant_name || '—'}</div>
                  <div className={`text-xs font-mono ${muted}`}>
                    {spending.bonus_type === 'dollar_amount'
                      ? `$${spending.bonus_multiplier || '0'} credit`
                      : spending.bonus_type === 'cash_back_pct'
                        ? `${spending.bonus_multiplier || '0'}% cash back`
                        : `${spending.bonus_multiplier || '0'}x points`}
                    {spending.spending_minimum ? ` · min. $${spending.spending_minimum}` : ''}
                    {spending.issuer ? ` · ${ISSUER_LABELS[spending.issuer as Issuer]}` : ''}
                  </div>
                  {spending.card_ids.length > 0 && (
                    <div className={`text-[10px] font-mono truncate ${muted}`}>
                      {spending.card_ids.map((id) => CARD_NAMES[id as CardId]).join(', ')}
                    </div>
                  )}
                  {spending.end_date && (
                    <div className={`text-[10px] font-mono ${muted}`}>
                      Expires {new Date(spending.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                      {spending.is_targeted && ' · TARGETED'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <p className={`text-[10px] font-mono leading-relaxed mt-auto ${muted}`}>
            Admin-created offers publish immediately with <span className={isDark ? 'text-gph-dark-ink' : 'text-gray-700'}>status: admin</span> and are visible on the public offers page without review.
          </p>
        </div>
      </div>
    </div>
  );
}
