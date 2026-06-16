import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Spinner({ className }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-muted-foreground', className)} />;
}

/** Full-area loading state used while a page's data loads. */
export function PageLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <Spinner className="h-7 w-7" />
    </div>
  );
}
