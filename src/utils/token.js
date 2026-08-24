import crypto from 'node:crypto';

export const createRandomToken = () => crypto.randomBytes(32).toString('hex');

export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
