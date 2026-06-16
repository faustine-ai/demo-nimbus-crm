import * as React from 'react';
import { cn } from '@/lib/utils';

// Lightweight badge. Pass `className` for color variants (see lib/constants).
function Badge({ className, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
        className
      )}
      {...props}
    />
  );
}

export { Badge };
