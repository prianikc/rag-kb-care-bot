import { Injectable } from '@nestjs/common';
import { Context } from '@maxhub/max-bot-api';
import { MessageCreatedHandler } from '../shared/types/message-created-handler.types';
import { UserSessionState } from '../shared/types/user-state.types';
import { EstimateFlowData, EstimateStep } from './estimate.types';
import { EstimateService } from './estimate.service';

@Injectable()
export class EstimateMessageCreatedHandler implements MessageCreatedHandler<EstimateFlowData> {
  constructor(private readonly estimateService: EstimateService) {}

  async handle(ctx: Context, state: UserSessionState<EstimateFlowData>): Promise<void> {
    switch (state.flowData?.step) {
      case EstimateStep.awaitingWorkTypes:
        return this.estimateService.handleWorkTypeInput(ctx, state);
      case EstimateStep.awaitingParameters:
        return this.estimateService.handleParametersInput(ctx, state);
      default:
        return this.estimateService.showEstimateMenu(ctx);
    }
  }
}
