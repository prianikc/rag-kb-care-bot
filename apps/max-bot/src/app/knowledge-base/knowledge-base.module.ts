import { Module } from '@nestjs/common';
import { KnowledgeBaseService } from './knowledge-base.service';
import { KnowledgeBaseUpdate } from './knowledge-base.update';
import { FileBatchCollectorService } from './file-batch-collector.service';
import { SharedServicesModule } from '../shared/services/shared-services.module';

@Module({
  imports: [SharedServicesModule],
  providers: [KnowledgeBaseService, KnowledgeBaseUpdate, FileBatchCollectorService],
  exports: [KnowledgeBaseService, KnowledgeBaseUpdate, FileBatchCollectorService],
})
export class KnowledgeBaseModule {}
