import { Injectable } from '@nestjs/common';
import { Context } from '@maxhub/max-bot-api';
import { MessageCreatedHandler } from '../shared/types/message-created-handler.types';
import { UserSessionState } from '../shared/types/user-state.types';
import { KnowledgeBaseService } from './knowledge-base.service';

@Injectable()
export class QuestionMessageCreatedHandler implements MessageCreatedHandler {
  constructor(private readonly kbService: KnowledgeBaseService) {}

  async handle(ctx: Context, _state: UserSessionState): Promise<void> {
    await this.kbService.handleQuestion(ctx);
  }
}
