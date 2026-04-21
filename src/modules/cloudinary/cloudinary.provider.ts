import { v2 as cloudinary } from 'cloudinary';
import { Provider, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const CloudinaryProvider: Provider = {
  provide: 'CLOUDINARY',
  inject: [ConfigService],
  useFactory: async (configService: ConfigService) => {
    cloudinary.config({
      cloud_name: configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: configService.get<string>('CLOUDINARY_API_SECRET'),
    });

    try {
      const result = await cloudinary.api.ping();
      if (result.status === 'ok') {
        Logger.log('Kết nối thành công!', 'CloudinaryProvider');
      }
    } catch (error: any) {
      Logger.error(
        'Lỗi kết nối! Vui lòng kiểm tra lại biến môi trường.',
        error.error ? error.error.message : error.message,
        'CloudinaryProvider',
      );
    }

    return cloudinary;
  },
};
