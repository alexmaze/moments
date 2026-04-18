import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSpace } from '@/hooks/useSpaces';
import { SpaceHeader } from '@/components/spaces/SpaceHeader';
import { SpacePostsTab } from '@/components/spaces/SpacePostsTab';
import { SpaceMembersTab } from '@/components/spaces/SpaceMembersTab';
import { GrowthTab } from '@/components/spaces/GrowthTab';

type Tab = 'posts' | 'members' | 'growth';

export default function SpaceDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation('spaces');
  const { data: space, isLoading, error } = useSpace(slug!);
  const [activeTab, setActiveTab] = useState<Tab>('posts');

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-xl bg-muted" />
        <div className="mt-4 space-y-3">
          <div className="h-6 w-48 animate-pulse rounded bg-muted" />
          <div className="h-4 w-72 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (error || !space) {
    return (
      <div className="py-20 text-center">
        <p className="text-lg font-medium text-muted-foreground">
          Space not found
        </p>
      </div>
    );
  }

  const isMember = space.myMembership !== null;
  const isBaby = space.type === 'baby';
  const tabs: { key: Tab; label: string }[] = [
    { key: 'posts', label: t('detail.postsTab') },
    { key: 'members', label: t('detail.membersTab') },
    ...(isBaby ? [{ key: 'growth' as Tab, label: t('detail.growthTab') }] : []),
  ];

  return (
    <div>
      <SpaceHeader space={space} />

      {/* Tab navigation */}
      <div className="mt-6 flex border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-4">
        {activeTab === 'posts' && (
          <SpacePostsTab slug={slug!} spaceId={space.id} isMember={isMember} />
        )}
        {activeTab === 'members' && <SpaceMembersTab slug={slug!} />}
        {activeTab === 'growth' && isBaby && (
          <GrowthTab slug={slug!} isMember={isMember} />
        )}
      </div>
    </div>
  );
}
