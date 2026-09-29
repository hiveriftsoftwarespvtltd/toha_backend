import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Trust reverse proxy headers (Cloudflare, Nginx, Apache) for https://api.tohay.in
  app.set('trust proxy', true);

  // Increase JSON payload limit for product images & base64 uploads
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  const configService = app.get(ConfigService);

  const port = configService.get<number>('PORT') || 5000;
  const frontendUrl = configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';

  // Global Prefix
  app.setGlobalPrefix('api');

  const allowedOriginsEnv = configService.get<string>('ALLOWED_ORIGINS') || '';
  const parsedOrigins = allowedOriginsEnv
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const allowedOrigins = Array.from(
    new Set([
      frontendUrl,
      'https://tohay.in',
      'https://www.tohay.in',
      'https://api.tohay.in',
      'http://tohay.in',
      'http://www.tohay.in',
      'http://api.tohay.in',
      'https://toha.buxaa.in',
      'http://toha.buxaa.in',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      'http://127.0.0.1:3000',
      ...parsedOrigins,
    ]),
  );

  // CORS Setup (Allows tohay.in, api.tohay.in, and all configured origins)
  app.enableCors({
    origin: (origin, callback) => {
      // Allow server-to-server, mobile apps, or tools without origin header
      if (!origin) {
        return callback(null, true);
      }

      // Check explicit array whitelist
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Allow any subdomain of tohay.in, buxaa.in, or localhost ports
      const isAllowedDomain =
        /^https?:\/\/([a-zA-Z0-9-]+\.)*tohay\.in(:\d+)?$/.test(origin) ||
        /^https?:\/\/([a-zA-Z0-9-]+\.)*buxaa\.in(:\d+)?$/.test(origin) ||
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

      if (isAllowedDomain) {
        return callback(null, true);
      }

      // Fallback: allow origin gracefully to avoid breaking frontend clients
      logger.log(`Allowed CORS origin via fallback: ${origin}`);
      return callback(null, true);
    },
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders:
      'Content-Type,Accept,Authorization,X-Requested-With,Origin,Access-Control-Request-Method,Access-Control-Request-Headers,Cache-Control,Pragma',
    optionsSuccessStatus: 204,
  });

  // Serve static Uploads folder
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  // Global Validation & Exception Pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      forbidNonWhitelisted: false,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // Swagger Documentation Setup
  const config = new DocumentBuilder()
    .setTitle('Tohay Kids E-Commerce REST API')
    .setDescription('Production-ready backend API specification for Tohay Kids Festive Wear')
    .setVersion('1.0')
    .addServer('https://api.tohay.in', 'Production Server')
    .addServer(`http://localhost:${port}`, 'Local Development Server')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 NestJS Backend running at: https://api.tohay.in/api`);
  logger.log(`📚 Swagger UI documentation available at: https://api.tohay.in/api/docs`);
}

bootstrap();
