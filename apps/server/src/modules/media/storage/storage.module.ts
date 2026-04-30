import { Module } from '@nestjs/common';
import { TencentCosStorageProvider } from './cos.storage';
import { StorageConfigService } from './storage.config';

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');

@Module({
  providers: [
    StorageConfigService,
    {
      provide: STORAGE_PROVIDER,
      useClass: TencentCosStorageProvider,
    },
  ],
  exports: [STORAGE_PROVIDER, StorageConfigService],
})
export class StorageModule {}
