import clsx, { ClassValue } from 'clsx';

/** Join class names conditionally (tiny wrapper keeps call sites tidy). */
export function cn(...values: ClassValue[]): string {
  return clsx(values);
}
