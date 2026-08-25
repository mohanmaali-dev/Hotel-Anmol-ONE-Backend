import { buildDateFilter } from './date-range.js';

const createError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const commonFilterNames = [
  'fromDate',
  'toDate',
  'paymentType',
  'orderType',
  'paymentStatus',
  'status',
  'supplier',
  'category',
];

const normalizeFilterValue = (value, fieldName) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw createError(`${fieldName} must be a single value`);
  return value.trim() || null;
};

export const getReportContext = (query) => {
  const filters = Object.fromEntries(
    commonFilterNames.map((field) => [field, normalizeFilterValue(query[field], field)]),
  );
  const dateRange = buildDateFilter(filters.fromDate, filters.toDate);
  return {
    filters,
    dateRange: dateRange || null,
  };
};

export const addDateFilter = (match, dateField, dateRange) => {
  if (dateRange) match[dateField] = dateRange;
  return match;
};
