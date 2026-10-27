import { Footer } from '@/components/layout/Footer';
import { NavBar } from '@/components/layout/NavBar';
import { BoardToastProvider } from '@/components/board/shared/Toast';

// Shared chrome for the board's pages: the feed and a single post.
export default function BoardLayout({ children }: { children: React.ReactNode }) {
  return (
    <BoardToastProvider>
      <div className="flex min-h-screen flex-col bg-gph-bg text-gph-ink">
        <NavBar />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </BoardToastProvider>
  );
}
