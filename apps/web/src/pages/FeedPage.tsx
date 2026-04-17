import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import FeedList from '@/components/feed/FeedList';
import PostComposer from '@/components/composer/PostComposer';

export default function FeedPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [composerOpen, setComposerOpen] = useState(
    searchParams.get('compose') === '1',
  );

  const openComposer = () => {
    setComposerOpen(true);
    setSearchParams({});
  };

  const closeComposer = () => {
    setComposerOpen(false);
    setSearchParams({});
  };

  return (
    <div className="relative">
      <FeedList />

      {/* Floating new post button (desktop) */}
      <button
        onClick={openComposer}
        className="hidden md:flex fixed bottom-8 right-8 w-14 h-14 rounded-full bg-primary text-primary-foreground items-center justify-center shadow-lg hover:opacity-90 transition-opacity z-30"
        title="New Post"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-6 h-6">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {/* Composer dialog */}
      {composerOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 md:pt-24 px-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeComposer}
          />
          {/* Composer */}
          <div className="relative w-full max-w-lg z-10">
            <PostComposer onClose={closeComposer} />
          </div>
        </div>
      )}
    </div>
  );
}
