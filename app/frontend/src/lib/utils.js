import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes conditionally (shadcn/ui helper). */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/** Turn a name into a URL-friendly slug, e.g. "Sales Pipeline" -> "sales-pipeline". */
export function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
