import { Global, Module } from '@nestjs/common';
import { createRedisClient } from '../../config/redis.config';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => createRedisClient(),
    },
    RedisService,
  ],
  exports: [RedisService],
})
export class RedisModule {}
