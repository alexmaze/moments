import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createMigratedDrizzleClient } from '@moments/db';

export const DRIZZLE = Symbol('DRIZZLE');

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const url = config.getOrThrow<string>('DATABASE_URL');
        return createMigratedDrizzleClient(url);
      },
    },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule {}
