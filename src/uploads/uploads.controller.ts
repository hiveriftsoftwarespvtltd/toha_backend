import { Controller, Post, UseInterceptors, UploadedFile, BadRequestException, UseGuards, Req } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { extname, join } from 'path';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums';
import { CloudinaryService } from './cloudinary.service';

@ApiTags('Uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  @Post('image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Upload product or banner image' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|webp)$/i)) {
          return cb(new BadRequestException('Only JPG, JPEG, PNG, or WEBP image files are allowed!'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) throw new BadRequestException('Image file is required');

    // 1. If Cloudinary credentials are set in .env, stream to Cloudinary!
    if (this.cloudinaryService.isEnabled) {
      try {
        const res: any = await this.cloudinaryService.uploadFile(file, 'tohay_kids');
        const cUrl = res?.secure_url || res?.url;
        return {
          success: true,
          message: 'Image uploaded to Cloudinary successfully',
          data: {
            url: cUrl,
            public_id: res?.public_id,
            format: res?.format,
            size: res?.bytes,
          },
        };
      } catch (err: any) {
        throw new BadRequestException(`Cloudinary upload failed: ${err?.message || err}`);
      }
    }

    // 2. Fallback: Save to Local Disk Storage
    const uploadDir = join(process.cwd(), 'uploads');
    if (!existsSync(uploadDir)) {
      mkdirSync(uploadDir, { recursive: true });
    }

    const randomName = Array(16)
      .fill(null)
      .map(() => Math.floor(Math.random() * 16).toString(16))
      .join('');
    const filename = `${randomName}${extname(file.originalname)}`;
    const filePath = join(uploadDir, filename);

    writeFileSync(filePath, file.buffer);

    const host = req?.get('host') || 'localhost:5000';
    const protocol = req?.protocol || 'http';
    const fullUrl = `${protocol}://${host}/uploads/${filename}`;

    return {
      success: true,
      message: 'Image uploaded to local disk successfully',
      data: {
        url: fullUrl,
        path: `/uploads/${filename}`,
        filename,
        size: file.size,
      },
    };
  }
}
