import {
  Controller,
  Post,
  Body,
  Res,
  Get,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { Response, Request } from 'express';
import { AuthGuard } from '../../common/guards/auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: RegisterDto) {
    const user = await this.authService.register(body);
    return {
      success: true,
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role!.name,
      },
    };
  }

  @Post('login')
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, accessToken, refreshToken } =
      await this.authService.login(body);

    const maxAge = body.rememberMe
      ? 7 * 24 * 60 * 60 * 1000
      : 1 * 24 * 60 * 60 * 1000;

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge,
    });

    return {
      success: true,
      message: 'User logged in successfully',
      accessToken: accessToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role!.name,
      },
    };
  }

  @Get('me')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('USER')
  async getMe(@Req() req: Request) {
    return req.user;
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
    });
    return {
      success: true,
      message: 'User logged out successfully',
    };
  }

  @Post('refresh')
  async refresh(@Req() req: Request) {
    // get refresh token from cookie
    const token = req.cookies.refreshToken;
    if (!token) {
      throw new UnauthorizedException('No refresh token found');
    }
    // refresh token
    const {
      user,
      accessToken,
      refreshToken: newRefreshToken,
    } = await this.authService.refresh(token);

    return {
      success: true,
      message: 'Token refreshed successfully',
      accessToken: accessToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role!.name,
      },
    };
  }
}
