import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import {
  Order,
  OrderDocument,
  PaymentStatus,
} from '../orders/schemas/order.schema';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    private readonly configService: ConfigService,
  ) {}

  async createVnpayUrl(
    orderId: string,
    userId: string,
    ipAddr: string,
    returnUrl: string,
  ): Promise<string> {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');
    if (order.userId?.toString() !== userId) {
      throw new BadRequestException(
        'Bạn không có quyền thanh toán đơn hàng này',
      );
    }
    if (order.paymentMethod !== 'VNPAY') {
      throw new BadRequestException(
        'Đơn hàng này không sử dụng phương thức VNPay',
      );
    }
    if (order.paymentStatus === PaymentStatus.PAID) {
      throw new BadRequestException('Đơn hàng đã được thanh toán');
    }

    // .trim() phòng khoảng trắng/xuống dòng thừa trong .env gây code 71
    const tmnCode = this.configService.get<string>('VNP_TMNCODE')!.trim();
    const secretKey = this.configService.get<string>('VNP_SECRET')!.trim();
    const vnpUrl = this.configService.get<string>('VNP_URL')!.trim();

    const now = new Date();
    const createDate = this.formatVnDate(now);
    const expireDate = this.formatVnDate(
      new Date(now.getTime() + 15 * 60 * 1000),
    );

    const params: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: tmnCode,
      vnp_Amount: String(order.finalTotal * 100),
      vnp_CreateDate: createDate,
      vnp_CurrCode: 'VND',
      vnp_IpAddr: ipAddr,
      vnp_Locale: 'vn',
      vnp_OrderInfo: `Thanh toan don hang ${order.orderCode}`,
      vnp_OrderType: 'other',
      vnp_ReturnUrl: returnUrl,
      vnp_TxnRef: order.orderCode,
      vnp_ExpireDate: expireDate,
    };

    const sortedParams = this.sortObject(params);
    const signData = Object.entries(sortedParams)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    const hmac = crypto.createHmac('sha512', secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    // vnpay sample dùng qs.stringify({ encode: false }) cho cả URL lẫn signData
    sortedParams['vnp_SecureHash'] = signed;
    const queryString = Object.entries(sortedParams)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    const paymentUrl = `${vnpUrl}?${queryString}`;

    return paymentUrl;
  }

  async handleVnpayReturn(
    query: Record<string, string>,
  ): Promise<{ orderCode: string; success: boolean }> {
    const secretKey = this.configService.get<string>('VNP_SECRET')!.trim();
    const secureHash = query['vnp_SecureHash'];

    const params = { ...query };
    delete params['vnp_SecureHash'];
    delete params['vnp_SecureHashType'];

    const sortedParams = this.sortObject(params);
    const signData = Object.entries(sortedParams)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    const hmac = crypto.createHmac('sha512', secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    const orderCode = query['vnp_TxnRef'];
    const responseCode = query['vnp_ResponseCode'];
    const transactionNo = query['vnp_TransactionNo'];

    if (signed !== secureHash) {
      return { orderCode, success: false };
    }

    if (responseCode === '00') {
      await this.orderModel.updateOne(
        { orderCode, paymentStatus: { $ne: PaymentStatus.PAID } },
        {
          paymentStatus: PaymentStatus.PAID,
          paidAt: new Date(),
          transactionId: transactionNo ?? null,
        },
      );
      return { orderCode, success: true };
    }

    return { orderCode, success: false };
  }

  async handleVnpayIpn(
    query: Record<string, string>,
  ): Promise<{ RspCode: string; Message: string }> {
    const secretKey = this.configService.get<string>('VNP_SECRET')!.trim();
    const secureHash = query['vnp_SecureHash'];

    const params = { ...query };
    delete params['vnp_SecureHash'];
    delete params['vnp_SecureHashType'];

    const sortedParams = this.sortObject(params);
    const signData = Object.entries(sortedParams)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    const hmac = crypto.createHmac('sha512', secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    if (signed !== secureHash) {
      return { RspCode: '97', Message: 'Invalid Checksum' };
    }

    const orderCode = query['vnp_TxnRef'];
    const responseCode = query['vnp_ResponseCode'];
    const transactionNo = query['vnp_TransactionNo'];

    const order = await this.orderModel.findOne({ orderCode });
    if (!order) {
      return { RspCode: '01', Message: 'Order Not Found' };
    }

    if (order.paymentStatus === PaymentStatus.PAID) {
      return { RspCode: '02', Message: 'Order Already Confirmed' };
    }

    if (responseCode === '00') {
      await this.orderModel.updateOne(
        { orderCode },
        {
          paymentStatus: PaymentStatus.PAID,
          paidAt: new Date(),
          transactionId: transactionNo ?? null,
        },
      );
    }

    return { RspCode: '00', Message: 'Confirm Success' };
  }

  // matches VNPay sample sortObject: sort keys theo ASCII (str.sort()),
  // encodeURIComponent values, %20 → +. KHÔNG dùng localeCompare vì có thể
  // cho thứ tự khác ASCII → lệch chuỗi ký → VNPay từ chối.
  private sortObject(params: Record<string, string>): Record<string, string> {
    return Object.fromEntries(
      Object.entries(params)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, encodeURIComponent(v).replace(/%20/g, '+')]),
    );
  }

  private formatVnDate(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      String(date.getFullYear()) +
      pad(date.getMonth() + 1) +
      pad(date.getDate()) +
      pad(date.getHours()) +
      pad(date.getMinutes()) +
      pad(date.getSeconds())
    );
  }
}
