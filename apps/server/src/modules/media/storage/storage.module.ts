import { Module } from '@nestjs/common';
import { LocalStorageProvider } from './local.storage';

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');

@Module({
  providers: [
    {
      provide: STORAGE_PROVIDER,
      useClass: LocalStorageProvider,
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
