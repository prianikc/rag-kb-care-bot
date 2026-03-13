import { Module } from '@nestjs/common';
import { MenuService } from './menu.service';
import { MenuUpdate } from './menu.update';
import { SharedServicesModule } from '../shared/services/shared-services.module';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';

@Module({
  imports: [SharedServicesModule, KnowledgeBaseModule],
  providers: [MenuService, MenuUpdate],
  exports: [MenuService, MenuUpdate],
})
export class MenuModule {}
