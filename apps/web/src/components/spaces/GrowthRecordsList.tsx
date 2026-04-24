import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useDeleteGrowthRecord } from '@/hooks/useGrowthRecords';
import type { GrowthRecordDto } from '@moments/shared';

interface GrowthRecordsListProps {
  records: GrowthRecordDto[];
  slug: string;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function GrowthRecordsList({ records, slug }: GrowthRecordsListProps) {
  const { t } = useTranslation('spaces');
  const currentUser = useAuthStore((s) => s.currentUser);
  const deleteRecord = useDeleteGrowthRecord(slug);

  return (
    <div className="rounded-xl border border-border surface-card shadow-sm overflow-hidden">
      {/* Table header */}
      <div className="grid grid-cols-5 gap-2 border-b border-border bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground">
        <span>{t('growth.date')}</span>
        <span>{t('growth.height')}</span>
        <span>{t('growth.weight')}</span>
        <span>{t('growth.headCircumference')}</span>
        <span />
      </div>

      {/* Rows */}
      {[...records].reverse().map((record) => (
        <div
          key={record.id}
          className="grid grid-cols-5 gap-2 items-center border-b border-border last:border-b-0 px-4 py-2.5 text-sm"
        >
          <span className="text-foreground">{formatDate(record.date)}</span>
          <span className="text-foreground">
            {record.heightCm != null ? record.heightCm : '—'}
          </span>
          <span className="text-foreground">
            {record.weightKg != null ? record.weightKg : '—'}
          </span>
          <span className="text-foreground">
            {record.headCircumferenceCm != null ? record.headCircumferenceCm : '—'}
          </span>
          <div className="flex justify-end">
            {currentUser?.id === record.recordedBy.id && (
              <button
                onClick={() => deleteRecord.mutate(record.id)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
