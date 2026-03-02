import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { DbService } from './db.service';
import { UploadService } from './upload.service';
import { RedisStateService } from './redis-state.service';
import { N8nApiService } from './n8n-api.service';
import { OrgGuard } from '../guards/auth.guard';

@Global()
@Module({
  providers: [PrismaService, DbService, UploadService, RedisStateService, N8nApiService, OrgGuard],
  exports: [DbService, UploadService, RedisStateService, N8nApiService, OrgGuard],
})
export class SharedServicesModule {}
