import { env } from '../config/env.js';

const createError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const datePartsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: env.appTimezone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const getParts = (date) =>
  Object.fromEntries(
    datePartsFormatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );

const zonedDateTimeToUtc = (year, month, day, hour = 0, minute = 0, second = 0) => {
  const target = Date.UTC(year, month - 1, day, hour, minute, second);
  let result = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = getParts(new Date(result));
    const represented = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const corrected = result + (target - represented);
    if (corrected === result) break;
    result = corrected;
  }
  return new Date(result);
};

const parseCalendarDate = (value, fieldName) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw createError(`${fieldName} must use YYYY-MM-DD format`);
  }
  const [year, month, day] = value.split('-').map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw createError(`${fieldName} must be a valid date`);
  }
  return { year, month, day };
};

const nextCalendarDay = ({ year, month, day }) => {
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
};

export const buildDateFilter = (fromDate, toDate) => {
  const range = {};
  if (fromDate) {
    const from = parseCalendarDate(fromDate, 'fromDate');
    range.$gte = zonedDateTimeToUtc(from.year, from.month, from.day);
  }
  if (toDate) {
    const next = nextCalendarDay(parseCalendarDate(toDate, 'toDate'));
    range.$lt = zonedDateTimeToUtc(next.year, next.month, next.day);
  }
  if (range.$gte && range.$lt && range.$gte >= range.$lt) {
    throw createError('fromDate cannot be after toDate');
  }
  return Object.keys(range).length ? range : undefined;
};

export const getCurrentDayRange = (now = new Date()) => {
  const current = getParts(now);
  const next = nextCalendarDay(current);
  return {
    start: zonedDateTimeToUtc(current.year, current.month, current.day),
    end: zonedDateTimeToUtc(next.year, next.month, next.day),
  };
};

export const getCurrentMonthRange = (now = new Date()) => {
  const current = getParts(now);
  const nextMonth = new Date(Date.UTC(current.year, current.month, 1));
  return {
    start: zonedDateTimeToUtc(current.year, current.month, 1),
    end: zonedDateTimeToUtc(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth() + 1, 1),
  };
};
