import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { useGrowthRecords } from '@/hooks/useGrowthRecords';
import { GrowthChart } from '@/components/spaces/GrowthChart';
import { GrowthRecordsList } from '@/components/spaces/GrowthRecordsList';
import { GrowthRecordForm } from '@/components/spaces/GrowthRecordForm';

interface GrowthTabProps {
  slug: string;
  isMember: boolean;
}

export function GrowthTab({ slug, isMember }: GrowthTabProps) {
  const { t } = useTranslation('spaces');
  const { data: records, isLoading } = useGrowthRecords(slug);
  const [formOpen, setFormOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  const sortedRecords = [...(records ?? [])].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  return (
    <div className="space-y-6">
      {/* Header with add button */}
      {isMember && (
        <div className="flex justify-end">
          <button
            onClick={() => setFormOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            {t('growth.addRecord')}
          </button>
        </div>
      )}

      {/* Empty state */}
      {sortedRecords.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {t('growth.noRecords')}
          </p>
        </div>
      )}

      {/* Chart */}
      {sortedRecords.length > 0 && <GrowthChart records={sortedRecords} />}

      {/* Records list */}
      {sortedRecords.length > 0 && (
        <GrowthRecordsList records={sortedRecords} slug={slug} />
      )}

      {/* Add record form */}
      <GrowthRecordForm
        slug={slug}
        open={formOpen}
        onOpenChange={setFormOpen}
      />
    </div>
  );
}
