import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { verifyAccessToken } from '../utils/jwt.util';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    const auth = request.headers.authorization;

    if (!auth || !auth.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'You are not authorized to access this resource',
      );
    }

    const token = auth.split(' ')[1];

    try {
      const payload = verifyAccessToken(token);

      request.user = payload;

      return true;
    } catch (error) {
      throw new UnauthorizedException('Access token is invalid or expired');
    }
  }
}

export class OptionalAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    const auth = request.headers.authorization;

    if (!auth || !auth.startsWith('Bearer ')) {
      request.user = null;
      return true;
    }

    const token = auth.split(' ')[1];

    try {
      const payload = verifyAccessToken(token);

      request.user = payload;

      return true;
    } catch (error) {
      return false;
    }
  }
}
