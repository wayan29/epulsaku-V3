// src/lib/sanitize.ts

// This file contains utility functions for input sanitization and validation.
// It does NOT contain Server Actions, so 'use server'; is not used here.

/**
 * Basic input sanitizer. Removes HTML-like tags, some command injection characters,
 * trims whitespace, and limits length.
 * @param input The string to sanitize.
 * @returns The sanitized string.
 */
export function sanitizeInput(input: string): string {
  // Remove any potential HTML/script tags
  input = input.replace(/<[^>]*>/g, '');
  
  // Remove potential command injections
  input = input.replace(/[&;|`$]/g, '');
  
  // Trim excessive whitespace
  input = input.replace(/\s+/g, ' ').trim();
  
  // Limit length
  const MAX_LENGTH = 1000;
  if (input.length > MAX_LENGTH) {
    input = input.slice(0, MAX_LENGTH);
  }
  
  return input;
}

/**
 * Validates a message string against a set of rules.
 * @param message The message to validate.
 * @returns An object with an `isValid` boolean and an optional `error` message.
 */
export function validateMessage(message: string): { isValid: boolean; error?: string } {
  if (!message || message.trim().length === 0) {
    return { isValid: false, error: 'Message cannot be empty' };
  }
  
  if (message.length < 2) {
    return { isValid: false, error: 'Message too short' };
  }
  
  if (message.length > 1000) {
    return { isValid: false, error: 'Message too long (max 1000 characters)' };
  }
  
  // Check for potential harmful patterns
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /data:/i,
    /vbscript:/i,
    /onload=/i,
    /onerror=/i
  ];
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(message)) {
      return { isValid: false, error: 'Message contains invalid content' };
    }
  }
  
  return { isValid: true };
}
