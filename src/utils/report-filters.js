const createError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const parseDate = (value, fieldName, endOfDay = false) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw createError(`${fieldName} must use YYYY-MM-DD format`);
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(
    Date.UTC(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0),
  );
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw createError(`${fieldName} must be a valid date`);
  }
  if (endOfDay) date.setUTCMilliseconds(999);
  return date;
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
  const dateRange = {};
  if (filters.fromDate) dateRange.$gte = parseDate(filters.fromDate, 'fromDate');
  if (filters.toDate) dateRange.$lte = parseDate(filters.toDate, 'toDate', true);
  if (dateRange.$gte && dateRange.$lte && dateRange.$gte > dateRange.$lte) {
    throw createError('fromDate cannot be after toDate');
  }
  return {
    filters,
    dateRange: Object.keys(dateRange).length ? dateRange : null,
  };
};

export const addDateFilter = (match, dateField, dateRange) => {
  if (dateRange) match[dateField] = dateRange;
  return match;
};
