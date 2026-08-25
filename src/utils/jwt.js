import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';

export const createAccessToken = (userId) =>
  jwt.sign({ userId, type: 'access' }, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessExpiresIn,
  });

export const createRefreshToken = (userId) =>
  jwt.sign({ userId, type: 'refresh' }, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshExpiresIn,
  });

const verifyToken = (token, secret, expectedType) => {
  const payload = jwt.verify(token, secret);
  if (payload.type !== expectedType) throw new jwt.JsonWebTokenError('Invalid token type');
  return payload;
};

export const verifyAccessToken = (token) => verifyToken(token, env.jwtAccessSecret, 'access');

export const verifyRefreshToken = (token) => verifyToken(token, env.jwtRefreshSecret, 'refresh');
