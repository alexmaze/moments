import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync } from 'fs';
import type { AppConfig } from '@moments/config';
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

  const appConfig = configService.getOrThrow<AppConfig>('app');

  // In production, serve the frontend SPA
  const publicDir = join(__dirname, '..', 'public');
  if (appConfig.nodeEnv === 'production' && existsSync(publicDir)) {
    app.useStaticAssets(publicDir);

    // SPA fallback: serve index.html for all non-API routes
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.get(/^\/(?!api).*/, (_req: unknown, res: { sendFile: (path: string) => void }) => {
      res.sendFile(join(publicDir, 'index.html'));
    });
  }

  await app.listen(appConfig.port, '0.0.0.0');
  console.log(`Server running on http://localhost:${appConfig.port}`);
}

bootstrap();
