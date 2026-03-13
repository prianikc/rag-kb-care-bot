import { Injectable } from '@nestjs/common';
import { MessageCreatedHandler } from '../shared/types/message-created-handler.types';
import { UserFlow } from '../shared/types/user-state.types';
import { UploadMessageCreatedHandler } from '../knowledge-base/upload-message-created.handler';
import { QuestionMessageCreatedHandler } from '../knowledge-base/question-message-created.handler';
import { EstimateMessageCreatedHandler } from '../estimate/estimate-message-created.handler';

@Injectable()
export class MessageCreatedHandlerRegistry {
  private readonly handlers = new Map<UserFlow, MessageCreatedHandler>();

  constructor(
    uploadHandler: UploadMessageCreatedHandler,
    questionHandler: QuestionMessageCreatedHandler,
    estimateHandler: EstimateMessageCreatedHandler,
  ) {
    this.handlers.set(UserFlow.upload, uploadHandler);
    this.handlers.set(UserFlow.question, questionHandler);
    this.handlers.set(UserFlow.estimate, estimateHandler);
  }

  getHandler(flow: UserFlow): MessageCreatedHandler | null {
    return this.handlers.get(flow) ?? null;
  }
}
