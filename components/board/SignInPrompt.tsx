'use client';

import Link from 'next/link';
import { BTN_GHOST, BTN_PRIMARY } from './buttons';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from './Dialog';

/** Shown when a signed-out visitor tries to post. */
export function SignInPrompt({ onClose }: { onClose: () => void }) {
  return (
    <Dialog label="Sign in to post" onClose={onClose} width="sm">
      <DialogHeader title="Sign in to post" onClose={onClose} />
      <DialogBody>
        <p className="text-sm leading-relaxed text-gph-muted">
          Anyone can read the board. Posting, voting and commenting are for covelo members — it takes a minute to sign in or create an account.
        </p>
      </DialogBody>
      <DialogFooter>
        <button type="button" onClick={onClose} className={BTN_GHOST}>Not now</button>
        <Link href="/auth" className={BTN_PRIMARY}>Sign in</Link>
      </DialogFooter>
    </Dialog>
  );
}
