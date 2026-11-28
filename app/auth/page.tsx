'use client';

export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { AuthForm } from '@/components/auth/AuthForm';

export default function AuthPage() {
  return (
    <Suspense>
      <AuthForm />
    </Suspense>
  );
}
