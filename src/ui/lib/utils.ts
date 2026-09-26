import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Class joiner for vendored shadcn / AI Elements components, which pass
 * overrides through `className` and rely on conflict resolution to win.
 * House components use `cx` from `../utils/cx` instead.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
