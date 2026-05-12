import Redis from 'ioredis';

export const createRedisClient = () => {
  const client = new Redis({
    host: process.env.REDIS_HOST ?? 'localhost',
    port: +(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    lazyConnect: true,
    retryStrategy: (times) => Math.min(times * 500, 5000),
  });

  client.on('error', (err: Error) => {
    console.error('[Redis] Connection error:', err.message);
  });

  return client;
};
