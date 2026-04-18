import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useCreateGrowthRecord } from '@/hooks/useGrowthRecords';

interface GrowthRecordFormProps {
  slug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GrowthRecordForm({ slug, open, onOpenChange }: GrowthRecordFormProps) {
  const { t } = useTranslation('spaces');
  const createRecord = useCreateGrowthRecord(slug);

  const [date, setDate] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [headCircumferenceCm, setHeadCircumferenceCm] = useState('');
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (open) {
      const today = new Date().toISOString().split('T')[0];
      setDate(today);
      setHeightCm('');
      setWeightKg('');
      setHeadCircumferenceCm('');
      setValidationError('');
    }
  }, [open]);

  const hasAtLeastOne =
    heightCm.trim() !== '' || weightKg.trim() !== '' || headCircumferenceCm.trim() !== '';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!hasAtLeastOne) {
      setValidationError(t('growth.atLeastOne'));
      return;
    }

    const payload: {
      date: string;
      heightCm?: number;
      weightKg?: number;
      headCircumferenceCm?: number;
    } = { date: new Date(date).toISOString() };

    if (heightCm.trim()) payload.heightCm = parseFloat(heightCm);
    if (weightKg.trim()) payload.weightKg = parseFloat(weightKg);
    if (headCircumferenceCm.trim()) payload.headCircumferenceCm = parseFloat(headCircumferenceCm);

    createRecord.mutate(payload, {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('growth.addRecord')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 p-4">
          <div>
            <label htmlFor="growth-date" className="mb-1.5 block text-sm font-medium text-foreground">
              {t('growth.date')}
            </label>
            <input
              id="growth-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor="growth-height" className="mb-1.5 block text-sm font-medium text-foreground">
              {t('growth.height')}
            </label>
            <input
              id="growth-height"
              type="number"
              step="0.1"
              min="0"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              placeholder="65.5"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor="growth-weight" className="mb-1.5 block text-sm font-medium text-foreground">
              {t('growth.weight')}
            </label>
            <input
              id="growth-weight"
              type="number"
              step="0.01"
              min="0"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              placeholder="3.25"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor="growth-head" className="mb-1.5 block text-sm font-medium text-foreground">
              {t('growth.headCircumference')}
            </label>
            <input
              id="growth-head"
              type="number"
              step="0.1"
              min="0"
              value={headCircumferenceCm}
              onChange={(e) => setHeadCircumferenceCm(e.target.value)}
              placeholder="34.2"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {validationError && (
            <p className="text-sm text-destructive">{validationError}</p>
          )}

          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              {t('growth.cancel')}
            </button>
            <button
              type="submit"
              disabled={createRecord.isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {t('growth.submit')}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
