import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  hashPassword,
  comparePassword,
} from '../../common/utils/password.util';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../common/utils/jwt.util';

@Injectable()
export class AuthService {
  constructor(private readonly prismaService: PrismaService) {}

  async register(body: RegisterDto) {
    const { email, username, password } = body;

    const user = await this.prismaService.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (user) {
      throw new UnauthorizedException('User already exists');
    }

    const hashedPassword = await hashPassword(password);

    const userCreated = await this.prismaService.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        role: 'USER',
      },
    });

    return userCreated;
  }

  async login(body: LoginDto) {
    const { email, password } = body;

    const user = await this.prismaService.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Wrong email or password');
    }

    const accessToken = signAccessToken({ id: user.id, role: user.role });
    const refreshToken = signRefreshToken({ id: user.id, role: user.role });

    return { user, accessToken, refreshToken };
  }

  async refresh(refreshToken: string) {
    const decodedToken = verifyRefreshToken(refreshToken);
    const user = await this.prismaService.user.findUnique({
      where: { id: decodedToken.id },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const accessToken = signAccessToken({ id: user.id, role: user.role });
    const newRefreshToken = signRefreshToken({ id: user.id, role: user.role });
    return { user, accessToken, refreshToken: newRefreshToken };
  }
}
