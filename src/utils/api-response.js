export const sendSuccess = (
  response,
  {
    statusCode = 200,
    message = 'Request completed successfully',
    data,
    meta,
    pagination,
    filters,
    summary,
  },
) => {
  const body = { success: true, message };

  if (data !== undefined) body.data = data;
  if (meta !== undefined) body.meta = meta;
  if (pagination !== undefined) body.pagination = pagination;
  if (filters !== undefined) body.filters = filters;
  if (summary !== undefined) body.summary = summary;

  return response.status(statusCode).json(body);
};

export const sendError = (
  response,
  { statusCode = 500, message = 'Internal server error', errors, items, dependencies },
) => {
  const body = { success: false, message };

  if (errors !== undefined) body.errors = errors;
  if (items !== undefined) body.items = items;
  if (dependencies !== undefined) body.dependencies = dependencies;

  return response.status(statusCode).json(body);
};
