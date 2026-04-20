import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      offset={{ bottom: 72 }}
      mobileOffset={{ bottom: 72 }}
      toastOptions={{
        classNames: {
          toast:
            'group border surface-toast text-card-foreground border-border shadow-lg rounded-lg',
          description: 'text-muted-foreground',
          actionButton: 'bg-primary text-primary-foreground',
          cancelButton: 'bg-muted text-muted-foreground',
        },
      }}
    />
  );
}
