import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  size?: number;
}

/**
 * Moments brand logo — amber rounded square with a winking smile.
 * Rendered as inline SVG so it inherits no external dependencies.
 */
export default function Logo({ className, size = 28 }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      aria-hidden="true"
    >
      <rect x="10" y="10" width="80" height="80" rx="22" fill="hsl(24 80% 50%)" />
      <circle cx="34" cy="34" r="6.5" fill="hsl(30 20% 98%)" />
      <path
        d="M 34 50 C 34 68 42 70 55 70 C 65 70 70 63 70 56"
        stroke="hsl(30 20% 98%)"
        strokeWidth="8.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
