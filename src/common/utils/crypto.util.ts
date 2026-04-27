import crypto from 'crypto';

export const generateUniqueHex = () => {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
};
