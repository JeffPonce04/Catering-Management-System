// src/utils/dateUtils.js
import { format, isValid, parseISO, isAfter, isBefore, isEqual, differenceInDays, differenceInHours } from 'date-fns';

export const safeParseDate = (date) => {
    if (!date) return null;
    if (date instanceof Date) return isNaN(date.getTime()) ? null : date;
    if (typeof date === 'string') {
        const parsed = new Date(date);
        return isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof date === 'number') {
        const parsed = new Date(date);
        return isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
};

export const isValidDate = (date) => {
    return safeParseDate(date) !== null;
};

export const formatDate = (date, formatStr = 'MMM dd, yyyy') => {
    const parsed = safeParseDate(date);
    if (!parsed) return 'N/A';
    try {
        return format(parsed, formatStr);
    } catch (e) {
        return 'N/A';
    }
};

export const formatDateTime = (date, formatStr = 'MMM dd, yyyy h:mm a') => {
    const parsed = safeParseDate(date);
    if (!parsed) return 'N/A';
    try {
        return format(parsed, formatStr);
    } catch (e) {
        return 'N/A';
    }
};

export const formatTime = (date, formatStr = 'h:mm a') => {
    const parsed = safeParseDate(date);
    if (!parsed) return 'N/A';
    try {
        return format(parsed, formatStr);
    } catch (e) {
        return 'N/A';
    }
};

export const daysBetween = (date1, date2) => {
    const d1 = safeParseDate(date1);
    const d2 = safeParseDate(date2);
    if (!d1 || !d2) return 0;
    return differenceInDays(d2, d1);
};

export const hoursBetween = (date1, date2) => {
    const d1 = safeParseDate(date1);
    const d2 = safeParseDate(date2);
    if (!d1 || !d2) return 0;
    return differenceInHours(d2, d1);
};

export const isDateAfter = (date1, date2) => {
    const d1 = safeParseDate(date1);
    const d2 = safeParseDate(date2);
    if (!d1 || !d2) return false;
    return isAfter(d1, d2);
};

export const isDateBefore = (date1, date2) => {
    const d1 = safeParseDate(date1);
    const d2 = safeParseDate(date2);
    if (!d1 || !d2) return false;
    return isBefore(d1, d2);
};

export const isSameDate = (date1, date2) => {
    const d1 = safeParseDate(date1);
    const d2 = safeParseDate(date2);
    if (!d1 || !d2) return false;
    return isEqual(d1, d2);
};

export default {
    safeParseDate,
    isValidDate,
    formatDate,
    formatDateTime,
    formatTime,
    daysBetween,
    hoursBetween,
    isDateAfter,
    isDateBefore,
    isSameDate
};