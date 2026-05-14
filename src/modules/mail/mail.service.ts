import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { getVerifyEmailHtml } from './templates/verifyEmail';
import { getResetPasswordHtml } from './templates/resetPassword';
import { getStaffCredentialsHtml } from './templates/staffWelcome';

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

  async sendStaffWelcomeEmail(to: string, username: string, password: string) {
    const loginUrl = `${process.env.FRONTEND_URL ?? ''}/login`;
    await this.mailerService.sendMail({
      to,
      subject: 'Tài khoản nhân viên DaoDuck Wear',
      html: getStaffCredentialsHtml({
        username,
        email: to,
        password,
        loginUrl,
        isReset: false,
      }),
    });
  }

  async sendStaffResetByAdminEmail(
    to: string,
    username: string,
    password: string,
  ) {
    const loginUrl = `${process.env.FRONTEND_URL ?? ''}/login`;
    await this.mailerService.sendMail({
      to,
      subject: 'Mật khẩu mới — DaoDuck Wear',
      html: getStaffCredentialsHtml({
        username,
        email: to,
        password,
        loginUrl,
        isReset: true,
      }),
    });
  }
}
