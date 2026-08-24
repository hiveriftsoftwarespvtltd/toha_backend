import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import * as streamifier from 'streamifier';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private isConfigured = false;

  constructor(private configService: ConfigService) {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    if (cloudName && apiKey && apiSecret && !cloudName.includes('your_cloud_name')) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      });
      this.isConfigured = true;
      this.logger.log('✅ Cloudinary SDK initialized successfully');
    } else {
      this.logger.warn('⚠️ Cloudinary credentials missing in .env. Falling back to local uploads.');
    }
  }

  get isEnabled(): boolean {
    return this.isConfigured;
  }

  async uploadFile(file: Express.Multer.File, folder = 'tohay_kids'): Promise<UploadApiResponse | UploadApiErrorResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'auto',
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        },
      );

      if (file.buffer) {
        streamifier.createReadStream(file.buffer).pipe(uploadStream);
      } else {
        reject(new Error('File buffer is empty'));
      }
    });
  }
}
