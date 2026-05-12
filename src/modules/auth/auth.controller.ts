import {
  Controller,
  Post,
  Patch,
  Body,
  Res,
  Get,
  Req,
  UseGuards,
  UnauthorizedException,
  BadRequestException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  UpdateProfileDto,
  VerifyEmailDto,
  ResendVerifyEmailDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { Response, Request } from 'express';
import { AuthGuard } from '../../common/guards/auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: RegisterDto) {
    const { user, requiresVerification } =
      await this.authService.register(body);
    return {
      success: true,
      message: requiresVerification
        ? 'Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản'
        : 'Đăng ký thành công',
      requiresVerification,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role!.name,
      },
    };
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.email, dto.code, dto.newPassword);
  }

  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.email, dto.code);
  }

  @Post('resend-verify-email')
  async resendVerifyEmail(@Body() dto: ResendVerifyEmailDto) {
    return this.authService.resendVerifyEmail(dto.email);
  }

  @Post('login')
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(body);

    // Nếu như tài khoản chưa được verify (service trả về requiresVerification = true)
    if (result.requiresVerification) {
      return {
        success: true,
        requiresVerification: true,
        email: result.email,
        message: result.message,
      };
    }

    const { user, accessToken, refreshToken } = result;

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
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatar: user.avatar || '',
        role: user.role!.name,
        shop: user.shopId || null,
      },
    };
  }

  @Post('google')
  async googleLogin(
    @Body('credential') credential: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!credential) {
      throw new UnauthorizedException('Thiếu Google credential');
    }

    const { user, accessToken, refreshToken } =
      await this.authService.googleLogin(credential);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày với google login
    });

    return {
      success: true,
      message: 'Đăng nhập với Google thành công!',
      accessToken: accessToken,
      user: {
        id: user.id.toString(),
        email: user.email,
        username: user.username,
        avatar: user.avatar || '',
        role: user.role!.name,
        shop: user.shopId || null,
      },
    };
  }

  @Get('me')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('USER')
  async getMe(@Req() req: Request) {
    return req.user;
  }

  @Get('profile')
  @UseGuards(AuthGuard)
  async getProfile(@CurrentUser() user: any) {
    return this.authService.getProfile(user.id);
  }

  @Patch('profile')
  @UseGuards(AuthGuard)
  async updateProfile(@CurrentUser() user: any, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(user.id, dto);
  }

  @Post('profile/avatar')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('avatar'))
  async uploadAvatar(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Không có file được upload');
    return this.authService.uploadAvatar(user.id, file);
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    });
    return {
      success: true,
      message: 'User logged out successfully',
    };
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // get refresh token from cookie
    const token = req.cookies.refreshToken;
    if (!token) {
      throw new UnauthorizedException('Không tìm thấy Refresh Token');
    }
    // refresh token
    const {
      user,
      accessToken,
      refreshToken: newRefreshToken,
    } = await this.authService.refresh(token);

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return {
      success: true,
      message: 'Refresh Token successfully',
      accessToken: accessToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatar: user.avatar || '',
        role: user.role!.name,
        shop: user.shopId || null,
      },
    };
  }
}
