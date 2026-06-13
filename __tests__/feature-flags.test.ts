import { isEnabled, getEnabledFlags } from '@/lib/feature-flags';
import type { FlagName } from '@/lib/feature-flags';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function withEnv(value: string | undefined, fn: () => void) {
  const original = process.env.NEXT_PUBLIC_APP_ENV;
  if (value === undefined) {
    delete process.env.NEXT_PUBLIC_APP_ENV;
  } else {
    process.env.NEXT_PUBLIC_APP_ENV = value;
  }
  try {
    fn();
  } finally {
    if (original === undefined) {
      delete process.env.NEXT_PUBLIC_APP_ENV;
    } else {
      process.env.NEXT_PUBLIC_APP_ENV = original;
    }
  }
}

// ---------------------------------------------------------------------------
// isEnabled() — environment detection
// ---------------------------------------------------------------------------

describe('isEnabled() — environment detection', () => {
  it('defaults to local when NEXT_PUBLIC_APP_ENV is unset', () => {
    withEnv(undefined, () => {
      expect(isEnabled('ui:flights')).toBe(true);
    });
  });

  it('defaults to local for unrecognised env values', () => {
    withEnv('staging', () => {
      expect(isEnabled('ui:flights')).toBe(true);
    });
  });

  it('reads beta environment correctly', () => {
    withEnv('beta', () => {
      expect(isEnabled('ui:flights')).toBe(true);
    });
  });

  it('reads production environment correctly', () => {
    withEnv('production', () => {
      expect(isEnabled('ui:flights')).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// isEnabled() — gating behaviour
// ---------------------------------------------------------------------------

describe('isEnabled() — gating behaviour', () => {
  it('returns true for a flag enabled in the current env', () => {
    withEnv('local', () => {
      expect(isEnabled('integration:redis:stays')).toBe(true);
    });
  });

  it('returns false for an unknown flag name', () => {
    withEnv('local', () => {
      // Cast to FlagName to test the safety guard — unknown flag returns false
      expect(isEnabled('ui:unknown' as FlagName)).toBe(false);
    });
  });

  it('each UI route flag is independent', () => {
    withEnv('local', () => {
      // ui:hotels is currently gated (enabledIn: []) — disabled everywhere
      expect(isEnabled('ui:hotels')).toBe(false);
      expect(isEnabled('ui:flights')).toBe(true);
      expect(isEnabled('ui:trip-planner')).toBe(true);
    });
  });

  it('each tRPC router flag is independent', () => {
    withEnv('local', () => {
      expect(isEnabled('api:stays')).toBe(true);
      // api:flights is currently gated (enabledIn: []) — disabled everywhere
      expect(isEnabled('api:flights')).toBe(false);
      expect(isEnabled('api:places')).toBe(true);
    });
  });

  it('each integration flag is independent', () => {
    withEnv('local', () => {
      expect(isEnabled('integration:duffel:flights')).toBe(true);
      expect(isEnabled('integration:duffel:stays')).toBe(true);
      expect(isEnabled('integration:hotelbeds:stays')).toBe(true);
      expect(isEnabled('integration:google-places:places')).toBe(true);
      expect(isEnabled('integration:redis:stays')).toBe(true);
      expect(isEnabled('integration:redis:places')).toBe(true);
      expect(isEnabled('integration:supabase')).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// isEnabled() — narrowed flag scenarios
// ---------------------------------------------------------------------------

describe('isEnabled() — narrowed flags', () => {
  it('ui:hotels is disabled in all envs (enabledIn: [])', () => {
    withEnv('local', () => {
      expect(isEnabled('ui:hotels')).toBe(false);
    });
    withEnv('beta', () => {
      expect(isEnabled('ui:hotels')).toBe(false);
    });
    withEnv('production', () => {
      expect(isEnabled('ui:hotels')).toBe(false);
    });
  });

  it('api:flights is disabled in all envs (enabledIn: [])', () => {
    withEnv('local', () => {
      expect(isEnabled('api:flights')).toBe(false);
    });
    withEnv('beta', () => {
      expect(isEnabled('api:flights')).toBe(false);
    });
    withEnv('production', () => {
      expect(isEnabled('api:flights')).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// getEnabledFlags()
// ---------------------------------------------------------------------------

describe('getEnabledFlags()', () => {
  const ALL_FLAGS: FlagName[] = [
    'ui:hotels', 'ui:flights', 'ui:trip-planner',
    'api:stays', 'api:flights', 'api:places',
    'integration:duffel:flights', 'integration:duffel:stays',
    'integration:hotelbeds:stays', 'integration:google-places:places',
    'integration:redis:stays', 'integration:redis:places',
    'integration:supabase',
  ];

  // ui:hotels and api:flights are currently set to enabledIn: []
  const DISABLED_FLAGS: FlagName[] = ['ui:hotels', 'api:flights'];
  const ENABLED_FLAGS = ALL_FLAGS.filter((f) => !DISABLED_FLAGS.includes(f));

  it('returns only enabled flags for current config', () => {
    withEnv('local', () => {
      const enabled = getEnabledFlags();
      expect(enabled).toHaveLength(ENABLED_FLAGS.length);
      for (const flag of ENABLED_FLAGS) {
        expect(enabled).toContain(flag);
      }
      for (const flag of DISABLED_FLAGS) {
        expect(enabled).not.toContain(flag);
      }
    });
  });

  it('returns the same enabled set for beta', () => {
    withEnv('beta', () => {
      const enabled = getEnabledFlags();
      expect(enabled).toHaveLength(ENABLED_FLAGS.length);
    });
  });

  it('returns the same enabled set for production', () => {
    withEnv('production', () => {
      const enabled = getEnabledFlags();
      expect(enabled).toHaveLength(ENABLED_FLAGS.length);
    });
  });

  it('result is an array of FlagName strings', () => {
    withEnv('local', () => {
      const enabled = getEnabledFlags();
      for (const flag of enabled) {
        expect(typeof flag).toBe('string');
        expect(ALL_FLAGS).toContain(flag);
      }
    });
  });
});
