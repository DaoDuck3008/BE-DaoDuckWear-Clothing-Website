import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { config } from 'dotenv';

config();

export const signAccessToken = (payload: any) => {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN,
  });
};

export const signRefreshToken = (payload: { id: string }) => {
  const tokenId = randomUUID();
  const token = jwt.sign(
    { ...payload, tokenId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN },
  );
  return { token, tokenId };
};

export const verifyAccessToken = (token: string) => {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
};

export const verifyRefreshToken = (token: string) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};
