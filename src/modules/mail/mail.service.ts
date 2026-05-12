import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { getVerifyEmailHtml } from './templates/verifyEmail';
import { getResetPasswordHtml } from './templates/resetPassword';

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendVerifyEmail(to: string, code: string) {
    await this.mailerService.sendMail({
      to,
      subject: 'Mã xác thực tài khoản — DaoDuck Wear',
      html: getVerifyEmailHtml(code),
    });
  }

  async sendResetPasswordEmail(to: string, code: string) {
    await this.mailerService.sendMail({
      to,
      subject: 'Đặt lại mật khẩu — DaoDuck Wear',
      html: getResetPasswordHtml(code),
    });
  }
}
