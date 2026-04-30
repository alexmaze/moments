import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return {
      status: 'ok',
      version: process.env.APP_VERSION || 'dev',
      timestamp: new Date().toISOString(),
    };
  }
}
