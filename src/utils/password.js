import bcrypt from 'bcrypt';

export const hashPassword = (password) => bcrypt.hash(password, 12);

export const comparePassword = (password, hashedPassword) =>
  bcrypt.compare(password, hashedPassword);
