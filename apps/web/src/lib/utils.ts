import { type ClassValue, clsx } from "clsx";
import i18n from "@/i18n";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

function toIntlLocale(locale?: string): string {
  const lang = locale ?? i18n.language ?? 'en';
  if (lang === 'en') return 'en-US';
  return lang;
}

export function formatRelativeTime(dateStr: string, locale?: string): string {
  const intlLocale = toIntlLocale(locale);
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  const rtf = new Intl.RelativeTimeFormat(intlLocale, { numeric: 'auto' });

  if (diffSecs < 60) return rtf.format(-diffSecs, 'second');
  if (diffMins < 60) return rtf.format(-diffMins, 'minute');
  if (diffHours < 24) return rtf.format(-diffHours, 'hour');
  if (diffDays < 30) return rtf.format(-diffDays, 'day');
  if (diffDays < 365) return rtf.format(-Math.floor(diffDays / 30), 'month');
  return rtf.format(-Math.floor(diffDays / 365), 'year');
}

export function formatDate(dateStr: string, locale?: string): string {
  return new Date(dateStr).toLocaleDateString(toIntlLocale(locale), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
