/**
 * Capitalizes the first letter of each word in a string.
 */
export function titleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Humanizes a persona label by replacing underscores and double underscores
 * with more professional separators and applying title casing.
 */
export function humanizeLabel(value: string): string {
  if (!value) return '';

  // Handle double underscores as major separation
  const parts = value.split('__');
  
  return parts
    .map((part) => {
      // Replace single underscores with spaces and title case
      const humanizedPart = part.replace(/_/g, ' ');
      return titleCase(humanizedPart);
    })
    .join(' • '); // Use a bullet point or similar elegant separator
}
