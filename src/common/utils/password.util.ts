import bcrypt from 'bcrypt';

export const hashPassword = async (rawPassword: string) => {
  return await bcrypt.hash(rawPassword, 10);
};

export const comparePassword = async (
  rawPassword: string,
  hashedPassword: string,
) => {
  return await bcrypt.compare(rawPassword, hashedPassword);
};
