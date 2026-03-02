import { Module } from '@nestjs/common';
import { MenuService } from './menu.service';
import { MenuUpdate } from './menu.update';
import { MessageCreatedHandlerRegistry } from './message-created-handler-registry.service';
import { SharedServicesModule } from '../shared/services/shared-services.module';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';

@Module({
  imports: [SharedServicesModule, KnowledgeBaseModule],
  providers: [MenuService, MenuUpdate, MessageCreatedHandlerRegistry],
  exports: [MenuService, MenuUpdate],
})
export class MenuModule {}
