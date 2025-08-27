// src/lib/timezone.ts

// Get the timezone from environment variables. Fallback to a default if not set.
const TIMEZONE = process.env.TIMEZONE || 'Asia/Makassar';

/**
 * Formats a date string or Date object into a localized string using the configured timezone.
 * @param date The date to format (string or Date object).
 * @param style The format style ('full', 'long', 'medium', 'short'). Defaults to 'full' (e.g., "Selasa, 14 Mei 2024 14.30.15 WITA").
 * @returns The formatted date string.
 */
export function formatDateInTimezone(
  date: string | Date,
  style: 'full' | 'long' | 'medium' | 'short' | 'date-only' | "dd/MM/yy HH:mm" = 'full'
): string {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) {
      return "Invalid Date";
    }

    let options: Intl.DateTimeFormatOptions = { timeZone: TIMEZONE };

    switch (style) {
      case 'full':
        options = { ...options, dateStyle: 'full', timeStyle: 'long' };
        break;
      case 'long':
        options = { ...options, dateStyle: 'long', timeStyle: 'medium' };
        break;
      case 'medium':
        options = { ...options, dateStyle: 'medium', timeStyle: 'short' };
        break;
      case 'short':
        options = { ...options, dateStyle: 'short', timeStyle: 'short' };
        break;
      case 'date-only':
        options = { ...options, dateStyle: 'long' };
        break;
      case 'dd/MM/yy HH:mm':
        // Custom format using individual parts
        const year = dateObj.toLocaleString('en-GB', { year: '2-digit', timeZone: TIMEZONE });
        const month = dateObj.toLocaleString('en-GB', { month: '2-digit', timeZone: TIMEZONE });
        const day = dateObj.toLocaleString('en-GB', { day: '2-digit', timeZone: TIMEZONE });
        const hour = dateObj.toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: TIMEZONE });
        const minute = dateObj.toLocaleString('en-GB', { minute: '2-digit', timeZone: TIMEZONE });
        return `${day}/${month}/${year} ${hour}:${minute}`;
      default:
        return dateObj.toLocaleString('id-ID', { timeZone: TIMEZONE });
    }

    return dateObj.toLocaleString('id-ID', options);
  } catch (error) {
    console.error("Error formatting date:", error);
    return String(date); // Fallback to default string representation
  }
}
