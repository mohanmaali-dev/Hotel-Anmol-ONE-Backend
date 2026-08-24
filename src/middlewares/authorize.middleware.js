import { hasPermission } from '../utils/permissions.js';

export const authorize = (module, action) => (request, _response, next) => {
  if (!request.user) {
    const error = new Error('Authentication required');
    error.statusCode = 401;
    return next(error);
  }
  if (!hasPermission(request.user, module.toLowerCase(), action.toLowerCase())) {
    const error = new Error(`You do not have permission to ${action} ${module}`);
    error.statusCode = 403;
    return next(error);
  }
  return next();
};
