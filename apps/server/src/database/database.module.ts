import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DatabaseConfig } from '@moments/config';
import { createMigratedDrizzleClient } from '@moments/db';

export const DRIZZLE = Symbol('DRIZZLE');

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const db = config.getOrThrow<DatabaseConfig>('database');
        return createMigratedDrizzleClient(db.url);
      },
    },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule {}
