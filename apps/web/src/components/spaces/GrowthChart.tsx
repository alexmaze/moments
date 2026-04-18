import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { GrowthRecordDto } from '@/types/dto';

interface GrowthChartProps {
  records: GrowthRecordDto[];
}

function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function GrowthChart({ records }: GrowthChartProps) {
  const { t } = useTranslation('spaces');

  const chartData = useMemo(
    () =>
      records.map((r) => ({
        date: formatShortDate(r.date),
        heightCm: r.heightCm ?? undefined,
        weightKg: r.weightKg ?? undefined,
        headCircumferenceCm: r.headCircumferenceCm ?? undefined,
      })),
    [records],
  );

  const hasHeight = records.some((r) => r.heightCm != null);
  const hasWeight = records.some((r) => r.weightKg != null);
  const hasHeadCirc = records.some((r) => r.headCircumferenceCm != null);

  if (!hasHeight && !hasWeight && !hasHeadCirc) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-foreground">
        {t('growth.title')}
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            stroke="hsl(var(--muted-foreground))"
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            stroke="hsl(var(--muted-foreground))"
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
          />
          <Legend wrapperStyle={{ fontSize: '12px' }} />
          {hasHeight && (
            <Line
              type="monotone"
              dataKey="heightCm"
              name={t('growth.height')}
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 3, fill: '#3b82f6' }}
              connectNulls
            />
          )}
          {hasWeight && (
            <Line
              type="monotone"
              dataKey="weightKg"
              name={t('growth.weight')}
              stroke="#22c55e"
              strokeWidth={2}
              dot={{ r: 3, fill: '#22c55e' }}
              connectNulls
            />
          )}
          {hasHeadCirc && (
            <Line
              type="monotone"
              dataKey="headCircumferenceCm"
              name={t('growth.headCircumference')}
              stroke="#f97316"
              strokeWidth={2}
              dot={{ r: 3, fill: '#f97316' }}
              connectNulls
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
