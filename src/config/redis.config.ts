import Redis from 'ioredis';

export const createRedisClient = () => {
  const client = new Redis({
    host: process.env.REDIS_HOST ?? 'localhost',
    port: +(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    lazyConnect: true,
    maxRetriesPerRequest: 0,   // Fail fast, không đợi 20 retries mỗi command
    enableOfflineQueue: false, // Reject command ngay khi offline
    retryStrategy: (times) => Math.min(times * 500, 5000),
  });

  let wasConnected = false;

  client.on('ready', () => {
    console.log(wasConnected ? '[Redis] Connection restored' : '[Redis] Connected');
    wasConnected = true;
  });

  client.on('error', (err: Error) => {
    if (wasConnected) {
      wasConnected = false;
      console.error('[Redis] Connection lost:', err.message);
    }
  });

  return client;
};
