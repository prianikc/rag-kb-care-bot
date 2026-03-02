import { MaxAction, MaxContext, MaxUpdate } from 'nestjs-max';
import { Context } from '@maxhub/max-bot-api';
import { UseGuards } from '@nestjs/common';
import { OrgGuard } from '../shared/guards/auth.guard';
import { KbPayload } from './knowledge-base.types';
import { KnowledgeBaseService } from './knowledge-base.service';

@UseGuards(OrgGuard)
@MaxUpdate()
export class KnowledgeBaseUpdate {
  constructor(private readonly kbService: KnowledgeBaseService) {}

  @MaxAction(KbPayload.startUpload)
  showUpload(@MaxContext() ctx: Context): Promise<void> {
    return this.kbService.showUploadPrompt(ctx);
  }

  @MaxAction(KbPayload.startQuestion)
  showQuestion(@MaxContext() ctx: Context): Promise<void> {
    return this.kbService.showQuestionPrompt(ctx);
  }

  @MaxAction(KbPayload.listDocs)
  showDocs(@MaxContext() ctx: Context): Promise<void> {
    return this.kbService.showDocumentList(ctx);
  }
}
