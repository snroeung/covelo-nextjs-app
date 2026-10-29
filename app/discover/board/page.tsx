import type { Metadata } from 'next';
import { Suspense } from 'react';
import { BoardPage } from '@/components/board/feed/BoardPage';
import { FeedSkeleton } from '@/components/board/shared/FeedSkeleton';

export const metadata: Metadata = {
  title: 'The board · Covelo',
  description: 'Travel tips and points offers from covelo members, with admin-verified offers marked.',
};

// useSearchParams (the filters live in the URL) needs a Suspense boundary
export default function Page() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-[1120px] px-4 pt-7 md:px-6"><FeedSkeleton /></div>}>
      <BoardPage />
    </Suspense>
  );
}
