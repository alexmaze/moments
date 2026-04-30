import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSpace } from '@/hooks/useSpaces';
import { SpaceHeader } from '@/components/spaces/SpaceHeader';
import { SpacePostsTab } from '@/components/spaces/SpacePostsTab';
import { SpaceMembersTab } from '@/components/spaces/SpaceMembersTab';
import { GrowthTab } from '@/components/spaces/GrowthTab';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

type Tab = 'posts' | 'members' | 'growth';

export default function SpaceDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation('spaces');
  const { data: space, isLoading, error } = useSpace(slug!);
  const [activeTab, setActiveTab] = useState<Tab>('posts');
  const [renderedTab, setRenderedTab] = useState<Tab>('posts');
  const tabRenderTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (tabRenderTimerRef.current !== null) {
        window.clearTimeout(tabRenderTimerRef.current);
      }
    };
  }, []);

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

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    if (tabRenderTimerRef.current !== null) {
      window.clearTimeout(tabRenderTimerRef.current);
    }
    tabRenderTimerRef.current = window.setTimeout(() => {
      setRenderedTab(tab);
      tabRenderTimerRef.current = null;
    }, 320);
  };

  return (
    <div>
      <SpaceHeader space={space} />

      {/* Tab navigation */}
      <SegmentedControl
        className="mt-6"
        ariaLabel={t('detail.postsTab')}
        options={tabs.map((tab) => ({ value: tab.key, label: tab.label }))}
        value={activeTab}
        onValueChange={handleTabChange}
      />

      {/* Tab content */}
      <div className="mt-4">
        {renderedTab === 'posts' && (
          <SpacePostsTab
            slug={slug!}
            spaceId={space.id}
            spaceName={space.name}
            isMember={isMember}
          />
        )}
        {renderedTab === 'members' && <SpaceMembersTab slug={slug!} />}
        {renderedTab === 'growth' && isBaby && (
          <GrowthTab slug={slug!} isMember={isMember} babyBirthday={space.babyBirthday} />
        )}
      </div>
    </div>
  );
}
