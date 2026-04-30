export function AppVersion({ className }: { className?: string }) {
  return (
    <span
      className={
        className ?? 'text-xs text-muted-foreground/50 select-none'
      }
    >
      v{__APP_VERSION__}
    </span>
  );
}
