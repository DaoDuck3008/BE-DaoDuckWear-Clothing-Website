import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { BadRequestException } from '@nestjs/common';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly configService: ConfigService,
  ) {}

  @Post('vnpay/create')
  @UseGuards(AuthGuard)
  async createVnpayUrl(
    @Body('orderId') orderId: string,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    // Lấy IP address
    const ipAddr =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      req.socket.remoteAddress ||
      '127.0.0.1';

    const host = req.get('host');
    if (!host) throw new BadRequestException('Không xác định được host');

    // returnUrl PHẢI trỏ về backend (route GET /payments/vnpay/return này),
    // nơi verify checksum rồi mới redirect tiếp sang frontend /checkout/result.
    // Request create đi tới backend nên protocol://host chính là backend.
    const returnUrl = `${req.protocol}://${host}/payments/vnpay/return`;

    const paymentUrl = await this.paymentsService.createVnpayUrl(
      orderId,
      user.id,
      ipAddr,
      returnUrl,
    );

    return { paymentUrl };
  }

  @Get('vnpay/return')
  async vnpayReturn(
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL')!;
    const { orderCode, success } =
      await this.paymentsService.handleVnpayReturn(query);

    const status = success ? 'success' : 'failed';
    return res.redirect(
      `${frontendUrl}/checkout/result?status=${status}&orderCode=${encodeURIComponent(orderCode)}`,
    );
  }

  @Get('vnpay/ipn')
  async vnpayIpn(@Query() query: Record<string, string>) {
    return this.paymentsService.handleVnpayIpn(query);
  }
}
