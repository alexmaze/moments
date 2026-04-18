import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync } from 'fs';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const configService = app.get(ConfigService);

  // Global prefix for API routes
  app.setGlobalPrefix('api');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Serve uploaded media files
  const uploadDir = configService.get<string>('UPLOAD_DIR', './uploads');
  app.useStaticAssets(join(process.cwd(), uploadDir), {
    prefix: '/uploads',
  });

  // In production, serve the frontend SPA
  const publicDir = join(__dirname, '..', 'public');
  if (configService.get('NODE_ENV') === 'production' && existsSync(publicDir)) {
    app.useStaticAssets(publicDir);

    // SPA fallback: serve index.html for all non-API, non-uploads routes
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.get(/^\/(?!api|uploads).*/, (_req: unknown, res: { sendFile: (path: string) => void }) => {
      res.sendFile(join(publicDir, 'index.html'));
    });
  }

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port, '0.0.0.0');
  console.log(`Server running on http://localhost:${port}`);
}

bootstrap();
