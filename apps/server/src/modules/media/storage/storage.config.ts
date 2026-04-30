import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { StorageConfig, CiConfig } from '@moments/config';

export type { StorageConfig, CiConfig } from '@moments/config';

@Injectable()
export class StorageConfigService {
  private readonly config: StorageConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = this.configService.getOrThrow<StorageConfig>('storage');
  }

  getConfig(): StorageConfig {
    return this.config;
  }
}
