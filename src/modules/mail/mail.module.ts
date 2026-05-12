import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { MailService } from './mail.service';

@Module({
  imports: [
    MailerModule.forRootAsync({
      useFactory: () => ({
        transport: {
          host: process.env.SMTP_MAIL_HOST,
          port: +(process.env.SMTP_MAIL_PORT ?? 465),
          secure: process.env.SMTP_MAIL_SECURE === 'true',
          auth: {
            user: process.env.SMTP_MAIL_USER,
            pass: process.env.SMTP_MAIL_PASS,
          },
        },
        defaults: {
          from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_MAIL_FROM_EMAIL}>`,
        },
      }),
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
