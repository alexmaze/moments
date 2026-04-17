import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import FeedList from '@/components/feed/FeedList';
import PostComposer from '@/components/composer/PostComposer';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

export default function FeedPage() {
  const { t } = useTranslation('feed');
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
        title={t('newPost')}
      >
        <Plus className="w-6 h-6" strokeWidth={2.5} />
      </button>

      {/* Composer dialog */}
      <Dialog open={composerOpen} onOpenChange={(v) => { if (!v) closeComposer(); }}>
        <DialogContent hideCloseButton>
          <DialogTitle className="sr-only">{t('composer.title')}</DialogTitle>
          <PostComposer onClose={closeComposer} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
