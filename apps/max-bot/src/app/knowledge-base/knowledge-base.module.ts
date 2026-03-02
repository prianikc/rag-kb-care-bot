import { Module } from '@nestjs/common';
import { KnowledgeBaseService } from './knowledge-base.service';
import { KnowledgeBaseUpdate } from './knowledge-base.update';
import { UploadMessageCreatedHandler } from './upload-message-created.handler';
import { QuestionMessageCreatedHandler } from './question-message-created.handler';
import { SharedServicesModule } from '../shared/services/shared-services.module';

@Module({
  imports: [SharedServicesModule],
  providers: [
    KnowledgeBaseService,
    KnowledgeBaseUpdate,
    UploadMessageCreatedHandler,
    QuestionMessageCreatedHandler,
  ],
  exports: [
    KnowledgeBaseService,
    UploadMessageCreatedHandler,
    QuestionMessageCreatedHandler,
    KnowledgeBaseUpdate,
  ],
})
export class KnowledgeBaseModule {}
