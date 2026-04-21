import * as React from 'react';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { cn } from '@/lib/utils';

const AlertDialog = AlertDialogPrimitive.Root;
const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
const AlertDialogPortal = AlertDialogPrimitive.Portal;

const AlertDialogOverlay = React.forwardRef<
  React.ComponentRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/35',
      'data-[state=open]:animate-[overlay-in_150ms_ease-out]',
      'data-[state=closed]:animate-[overlay-out_150ms_ease-in]',
      className,
    )}
    {...props}
  />
));
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

const AlertDialogContent = React.forwardRef<
  React.ComponentRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, onClick, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      ref={ref}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      className={cn(
        'fixed inset-x-0 bottom-0 z-50 w-full',
        'surface-overlay rounded-t-[1.75rem] border border-border border-b-0 px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-lg',
        'data-[state=open]:animate-[sheet-in_220ms_cubic-bezier(0.22,1,0.36,1)]',
        'data-[state=closed]:animate-[sheet-out_180ms_ease-in]',
        'sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2',
        'sm:rounded-xl sm:border sm:p-6',
        'sm:data-[state=open]:animate-[dialog-in_200ms_ease-out]',
        'sm:data-[state=closed]:animate-[dialog-out_150ms_ease-in]',
        'focus:outline-none',
        className,
      )}
      {...props}
    />
  </AlertDialogPortal>
));
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

function AlertDialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-2 text-center sm:text-left', className)} {...props} />;
}

function AlertDialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end sm:gap-2', className)}
      {...props}
    />
  );
}

const AlertDialogTitle = React.forwardRef<
  React.ComponentRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title
    ref={ref}
    className={cn('text-base font-semibold text-foreground sm:text-left', className)}
    {...props}
  />
));
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;

const AlertDialogDescription = React.forwardRef<
  React.ComponentRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description
    ref={ref}
    className={cn('text-sm leading-6 text-muted-foreground sm:text-left', className)}
    {...props}
  />
));
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName;

const AlertDialogAction = React.forwardRef<
  React.ComponentRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className, onClick, ...props }, ref) => (
  <AlertDialogPrimitive.Action
    ref={ref}
    onClick={(e) => {
      e.stopPropagation();
      onClick?.(e);
    }}
    className={cn(
      'order-1 inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-medium sm:order-2 sm:w-auto sm:rounded-lg sm:py-2',
      'bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity',
      'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
      className,
    )}
    {...props}
  />
));
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;

const AlertDialogCancel = React.forwardRef<
  React.ComponentRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, onClick, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    onClick={(e) => {
      e.stopPropagation();
      onClick?.(e);
    }}
    className={cn(
      'order-2 mt-1 inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-medium sm:order-1 sm:mt-0 sm:w-auto sm:rounded-lg sm:py-2',
      'bg-secondary text-secondary-foreground hover:bg-accent transition-colors',
      'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
      className,
    )}
    {...props}
  />
));
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
