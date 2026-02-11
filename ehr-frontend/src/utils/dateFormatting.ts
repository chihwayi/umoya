// Date formatting utilities for consistent dd/mm/yyyy format across the application

/**
 * Format a date string to DD/MM/YYYY format
 * @param dateString - ISO date string or Date object
 * @returns Formatted date string in DD/MM/YYYY format
 */
export const formatDateToDDMMYYYY = (dateString: string | Date): string => {
  if (!dateString) return '';
  
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  if (isNaN(date.getTime())) {
    console.warn('Invalid date provided to formatDateToDDMMYYYY:', dateString);
    return '';
  }
  
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}/${month}/${year}`;
};

/**
 * Format a date string to DD/MM/YYYY HH:MM format
 * @param dateString - ISO date string or Date object
 * @returns Formatted date string in DD/MM/YYYY HH:MM format
 */
export const formatDateTimeToDDMMYYYYHHMM = (dateString: string | Date): string => {
  if (!dateString) return '';
  
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  if (isNaN(date.getTime())) {
    console.warn('Invalid date provided to formatDateTimeToDDMMYYYYHHMM:', dateString);
    return '';
  }
  
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

/**
 * Parse a DD/MM/YYYY string to a Date object
 * @param dateString - Date string in DD/MM/YYYY format
 * @returns Date object or null if invalid
 */
export const parseDDMMYYYYToDate = (dateString: string): Date | null => {
  if (!dateString) return null;
  
  // Remove any whitespace
  const cleanDate = dateString.trim();
  
  // Check if it matches DD/MM/YYYY format
  const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const match = cleanDate.match(dateRegex);
  
  if (!match) {
    // Only warn if the string looks like a full date attempt (>= 8 chars) to avoid spamming logs during typing
    if (cleanDate.length >= 8) {
      console.warn('Invalid date format provided to parseDDMMYYYYToDate:', dateString);
    }
    return null;
  }
  
  const [, day, month, year] = match;
  const dayNum = parseInt(day, 10);
  const monthNum = parseInt(month, 10);
  const yearNum = parseInt(year, 10);
  
  // Validate date components
  if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12 || yearNum < 1900) {
    console.warn('Invalid date values provided to parseDDMMYYYYToDate:', dateString);
    return null;
  }
  
  // Create date object in UTC to avoid timezone issues (month is 0-indexed in JavaScript)
  const date = new Date(Date.UTC(yearNum, monthNum - 1, dayNum));
  
  // Verify the date is valid (handles cases like 31/02/2024)
  if (date.getUTCDate() !== dayNum || date.getUTCMonth() !== monthNum - 1 || date.getUTCFullYear() !== yearNum) {
    console.warn('Invalid date provided to parseDDMMYYYYToDate:', dateString);
    return null;
  }
  
  return date;
};

/**
 * Parse a DD/MM/YYYY HH:MM string to a Date object
 * @param dateTimeString - Date string in DD/MM/YYYY HH:MM format
 * @returns Date object or null if invalid
 */
export const parseDDMMYYYYHHMMToDate = (dateTimeString: string): Date | null => {
  if (!dateTimeString) return null;
  
  // Remove any whitespace
  const cleanDateTime = dateTimeString.trim();
  
  // Check if it matches DD/MM/YYYY HH:MM format
  const dateTimeRegex = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/;
  const match = cleanDateTime.match(dateTimeRegex);
  
  if (!match) {
    console.warn('Invalid date-time format provided to parseDDMMYYYYHHMMToDate:', dateTimeString);
    return null;
  }
  
  const [, day, month, year, hours, minutes] = match;
  const dayNum = parseInt(day, 10);
  const monthNum = parseInt(month, 10);
  const yearNum = parseInt(year, 10);
  const hoursNum = parseInt(hours, 10);
  const minutesNum = parseInt(minutes, 10);
  
  // Validate date and time components
  if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12 || yearNum < 1900 ||
      hoursNum < 0 || hoursNum > 23 || minutesNum < 0 || minutesNum > 59) {
    console.warn('Invalid date-time values provided to parseDDMMYYYYHHMMToDate:', dateTimeString);
    return null;
  }
  
  // Create date object in UTC to avoid timezone issues (month is 0-indexed in JavaScript)
  const date = new Date(Date.UTC(yearNum, monthNum - 1, dayNum, hoursNum, minutesNum));
  
  // Verify the date is valid
  if (date.getUTCDate() !== dayNum || date.getUTCMonth() !== monthNum - 1 || date.getUTCFullYear() !== yearNum ||
      date.getUTCHours() !== hoursNum || date.getUTCMinutes() !== minutesNum) {
    console.warn('Invalid date-time provided to parseDDMMYYYYHHMMToDate:', dateTimeString);
    return null;
  }
  
  return date;
};

/**
 * Convert a Date object to ISO string for API calls
 * @param date - Date object
 * @returns ISO string or empty string if invalid
 */
export const dateToISOString = (date: Date | null): string => {
  if (!date || isNaN(date.getTime())) {
    return '';
  }
  
  return date.toISOString();
};

/**
 * Get current date in DD/MM/YYYY format
 * @returns Current date in DD/MM/YYYY format
 */
export const getCurrentDateDDMMYYYY = (): string => {
  return formatDateToDDMMYYYY(new Date());
};

/**
 * Get current date and time in DD/MM/YYYY HH:MM format
 * @returns Current date and time in DD/MM/YYYY HH:MM format
 */
export const getCurrentDateTimeDDMMYYYYHHMM = (): string => {
  return formatDateTimeToDDMMYYYYHHMM(new Date());
};

/**
 * Validate if a string is in DD/MM/YYYY format
 * @param dateString - Date string to validate
 * @returns True if valid DD/MM/YYYY format, false otherwise
 */
export const isValidDDMMYYYY = (dateString: string): boolean => {
  return parseDDMMYYYYToDate(dateString) !== null;
};

/**
 * Validate if a string is in DD/MM/YYYY HH:MM format
 * @param dateTimeString - Date-time string to validate
 * @returns True if valid DD/MM/YYYY HH:MM format, false otherwise
 */
export const isValidDDMMYYYYHHMM = (dateTimeString: string): boolean => {
  return parseDDMMYYYYHHMMToDate(dateTimeString) !== null;
};
