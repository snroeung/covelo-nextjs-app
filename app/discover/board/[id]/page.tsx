import type { Metadata } from 'next';
import { PostDetailPage } from '@/components/board/post/PostDetailPage';

export const metadata: Metadata = {
  title: 'Post · The board · Covelo',
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PostDetailPage id={id} />;
}
