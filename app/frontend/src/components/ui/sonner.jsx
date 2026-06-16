import { Toaster as SonnerToaster, toast } from 'sonner';

// Re-export a pre-styled toaster and the toast() helper.
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      richColors
      closeButton
      toastOptions={{ className: 'rounded-lg' }}
    />
  );
}

export { toast };
