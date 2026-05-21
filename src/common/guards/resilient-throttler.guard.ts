import { ThrottlerGuard } from '@nestjs/throttler';
import { ExecutionContext, Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ResilientThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(ResilientThrottlerGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      return await super.canActivate(context);
    } catch (err) {
      this.logger.warn(`Throttler storage unavailable, bypassing rate limit: ${(err as Error).message}`);
      return true;
    }
  }
}
