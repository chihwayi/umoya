// Date utility functions for dd/mm/yyyy format
import { 
  formatDateToDDMMYYYY, 
  parseDDMMYYYYToDate, 
  isValidDDMMYYYY,
  formatDateTimeToDDMMYYYYHHMM,
  parseDDMMYYYYHHMMToDate,
  isValidDDMMYYYYHHMM
} from './dateFormatting';

// Legacy functions for backward compatibility
export const formatDateForInput = (date: Date | string): string => {
  return formatDateToDDMMYYYY(date);
};

export const formatDateForAPI = (dateString: string): string => {
  const normalizedDateString = (dateString || '').trim();

  // Accept ISO input from native date controls without re-parsing
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedDateString)) {
    return normalizedDateString;
  }

  // Convert dd/mm/yyyy to yyyy-mm-dd for API
  const date = parseDDMMYYYYToDate(normalizedDateString);
  if (!date) {
    console.warn('Invalid date string provided to formatDateForAPI:', dateString);
    return '';
  }
  return date.toISOString().split('T')[0];
};

export const parseDateFromInput = (dateString: string): Date => {
  const date = parseDDMMYYYYToDate(dateString);
  if (!date) {
    console.warn('Invalid date string provided to parseDateFromInput:', dateString);
    return new Date(); // Return current date as fallback
  }
  return date;
};

export const getTodayFormatted = (): string => {
  return formatDateToDDMMYYYY(new Date());
};

export const getMinDateFormatted = (): string => {
  return formatDateToDDMMYYYY(new Date());
};

export const isValidDate = (dateString: string): boolean => {
  return isValidDDMMYYYY(dateString);
};

// New comprehensive date formatting functions
export const formatDateTimeForInput = (date: Date | string): string => {
  return formatDateTimeToDDMMYYYYHHMM(date);
};

export const parseDateTimeFromInput = (dateTimeString: string): Date | null => {
  return parseDDMMYYYYHHMMToDate(dateTimeString);
};

export const isValidDateTime = (dateTimeString: string): boolean => {
  return isValidDDMMYYYYHHMM(dateTimeString);
};

// Re-export the comprehensive date formatting functions
export {
  formatDateToDDMMYYYY,
  formatDateTimeToDDMMYYYYHHMM,
  parseDDMMYYYYToDate,
  parseDDMMYYYYHHMMToDate,
  isValidDDMMYYYY,
  isValidDDMMYYYYHHMM
};
