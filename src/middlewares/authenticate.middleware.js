import { verifyAccessToken } from '../utils/jwt.js';
import { User } from '../modules/users/user.model.js';

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export const auth = () => async (request, _response, next) => {
  try {
    const authorization = request.headers.authorization;
    const bearerToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
    const token = request.cookies?.accessToken || bearerToken;
    if (!token) return next(createError('Authentication required', 401));

    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.userId);
    if (!user) return next(createError('Authenticated user was not found', 401));
    if (!user.isActive) return next(createError('User account is inactive', 403));

    request.userId = user._id;
    request.user = user;
    return next();
  } catch (error) {
    if (error.statusCode) return next(error);
    return next(createError('Invalid or expired access token', 401));
  }
};

export const authenticate = auth();
