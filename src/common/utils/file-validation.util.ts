import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

export function multerImageOptions(
  maxSizeMB = 10,
  maxFiles?: number,
): MulterOptions {
  return {
    limits: {
      fileSize: maxSizeMB * 1024 * 1024,
      ...(maxFiles !== undefined ? { files: maxFiles } : {}),
    },
    fileFilter: (_req, file, cb) => {
      if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        return cb(
          new BadRequestException(
            'Chỉ chấp nhận file ảnh (jpeg, png, webp, gif)',
          ),
          false,
        );
      }
      cb(null, true);
    },
  };
}
