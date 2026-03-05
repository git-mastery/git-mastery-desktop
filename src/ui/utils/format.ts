/**
 * Formats a breadcrumb string to be more readable.
 * 
 * Input strings are camelCase. Add a space before each character
 * @param s 
 */
export const formatBreadcrumb = (s: string) => {
  return s.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase());
}