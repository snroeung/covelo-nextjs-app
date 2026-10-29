import { describe, it, expect } from 'vitest';
import { decideModeration, MOD_MESSAGES, type ModerationSignals } from '@/lib/board/moderation/decide';
import type { ClassifierVerdict } from '@/lib/board/moderation/classify';

function verdict(over: Partial<ClassifierVerdict> = {}): ClassifierVerdict {
  return {
    toxicity: 0.02, spam: 0.01, on_topic: 0.95, categories: [], suggested_topic: null,
    topic_confidence: 0, rejected_topics: [], reason: 'fine', ...over,
  };
}

/** Flags on an allow/hold decision; rejects carry none. */
function flagsOf(d: ReturnType<typeof decideModeration>) {
  return d.action === 'reject' ? [] : d.flags;
}

function signals(over: Partial<ModerationSignals> = {}): ModerationSignals {
  return {
    blocklist: { tier: null, hits: [] },
    links: { referral: [], tooMany: false },
    lexicon: { score: 3 },
    classifier: verdict(),
    standing: 'normal',
    ...over,
  };
}

describe('decideModeration — reject', () => {
  it('rejects banned authors', () => {
    const d = decideModeration(signals({ standing: 'banned' }));
    expect(d).toMatchObject({ action: 'reject', reasons: ['restricted_author'], message: MOD_MESSAGES.banned });
  });

  it('rejects hard blocklist hits', () => {
    expect(decideModeration(signals({ blocklist: { tier: 'hard', hits: ['x'] } }))).toMatchObject({ action: 'reject', reasons: ['hard_blocklist'] });
  });

  it('rejects toxicity at or above 0.85', () => {
    expect(decideModeration(signals({ classifier: verdict({ toxicity: 0.85 }) }))).toMatchObject({ action: 'reject', reasons: ['toxicity'], message: MOD_MESSAGES.offensive });
  });

  it('rejects referral links', () => {
    expect(decideModeration(signals({ links: { referral: ['bit.ly/x'], tooMany: false } }))).toMatchObject({ action: 'reject', reasons: ['referral_link'], message: MOD_MESSAGES.referral });
  });

  it('rejects too many links', () => {
    expect(decideModeration(signals({ links: { referral: [], tooMany: true } }))).toMatchObject({ action: 'reject', reasons: ['too_many_links'] });
  });

  it('a soft blocklist hit with high toxicity is rejected, not held', () => {
    const d = decideModeration(signals({ blocklist: { tier: 'soft', hits: ['x'] }, classifier: verdict({ toxicity: 0.9 }) }));
    expect(d.action).toBe('reject');
  });
});

describe('decideModeration — hold', () => {
  it('holds soft blocklist hits', () => {
    expect(decideModeration(signals({ blocklist: { tier: 'soft', hits: ['x'] } }))).toMatchObject({ action: 'hold', modStatus: 'held', reasons: ['soft_blocklist'] });
  });

  it('holds soft blocklist hits even when the classifier is down', () => {
    expect(decideModeration(signals({ blocklist: { tier: 'soft', hits: ['x'] }, classifier: null })).action).toBe('hold');
  });

  it('holds toxicity between 0.5 and 0.85', () => {
    expect(decideModeration(signals({ classifier: verdict({ toxicity: 0.5 }) }))).toMatchObject({ action: 'hold', reasons: ['toxicity'] });
    expect(decideModeration(signals({ classifier: verdict({ toxicity: 0.84 }) })).action).toBe('hold');
  });

  it('holds off-topic posts with no lexicon hits, with the off-topic message', () => {
    const d = decideModeration(signals({ classifier: verdict({ on_topic: 0.2 }), lexicon: { score: 0 } }));
    expect(d).toMatchObject({ action: 'hold', reasons: ['off_topic'], message: MOD_MESSAGES.heldOffTopic });
  });

  it('does not hold low on_topic when the lexicon found travel words', () => {
    expect(decideModeration(signals({ classifier: verdict({ on_topic: 0.2 }), lexicon: { score: 1 } })).action).toBe('allow');
  });

  it('holds spam at or above 0.8', () => {
    expect(decideModeration(signals({ classifier: verdict({ spam: 0.8 }) }))).toMatchObject({ action: 'hold', reasons: ['spam'] });
  });

  it('holds near-duplicate titles', () => {
    expect(decideModeration(signals({ duplicateSimilarity: 0.9 }))).toMatchObject({ action: 'hold', reasons: ['duplicate'] });
    expect(decideModeration(signals({ duplicateSimilarity: 0.89 })).action).toBe('allow');
  });

  it('holds everything from restricted authors', () => {
    expect(decideModeration(signals({ standing: 'restricted' }))).toMatchObject({ action: 'hold', reasons: ['restricted_author'], message: MOD_MESSAGES.held });
  });

  it('holds watched authors when there is no classifier verdict', () => {
    expect(decideModeration(signals({ standing: 'watch', classifier: null }))).toMatchObject({ action: 'hold', reasons: ['watch_unscanned'] });
  });

  it('collects every hold reason', () => {
    const d = decideModeration(signals({ blocklist: { tier: 'soft', hits: ['x'] }, classifier: verdict({ spam: 0.9 }), standing: 'restricted' }));
    expect(d.action === 'hold' && d.reasons).toEqual(['soft_blocklist', 'spam', 'restricted_author']);
  });
});

describe('decideModeration — allow', () => {
  it('allows clean content as clean', () => {
    expect(decideModeration(signals())).toEqual({ action: 'allow', modStatus: 'clean', reasons: [], flags: [] });
  });

  it('allows as unscanned when the classifier was skipped', () => {
    expect(decideModeration(signals({ classifier: null }))).toMatchObject({ action: 'allow', modStatus: 'unscanned' });
  });

  it('allows watched authors who have a verdict', () => {
    expect(decideModeration(signals({ standing: 'watch' })).action).toBe('allow');
  });

  it('flags borderline topicality between 0.35 and 0.6', () => {
    expect(decideModeration(signals({ classifier: verdict({ on_topic: 0.4 }) }))).toMatchObject({ action: 'allow', flags: ['borderline_topic'] });
    expect(flagsOf(decideModeration(signals({ classifier: verdict({ on_topic: 0.6 }) })))).toEqual([]);
  });

  it('flags a confident topic mismatch', () => {
    const d = decideModeration(signals({ chosenTopics: ['Hotels'], classifier: verdict({ suggested_topic: 'Award flights', topic_confidence: 0.8 }) }));
    expect(d.action === 'allow' && d.flags).toEqual(['topic_mismatch']);
  });

  it('no mismatch when the suggestion is one of the chosen topics, or confidence is low', () => {
    expect(flagsOf(decideModeration(signals({ chosenTopics: ['hotels'], classifier: verdict({ suggested_topic: 'Hotels', topic_confidence: 0.9 }) })))).toEqual([]);
    expect(flagsOf(decideModeration(signals({ chosenTopics: ['Hotels'], classifier: verdict({ suggested_topic: 'Award flights', topic_confidence: 0.5 }) })))).toEqual([]);
  });
});
