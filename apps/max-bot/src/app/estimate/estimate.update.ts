import { MaxAction, MaxContext, MaxUpdate } from 'nestjs-max';
import { Context } from '@maxhub/max-bot-api';
import { UseGuards } from '@nestjs/common';
import { OrgGuard } from '../shared/guards/auth.guard';
import { EstimatePayload } from './estimate.types';
import { EstimateService } from './estimate.service';

@UseGuards(OrgGuard)
@MaxUpdate()
export class EstimateUpdate {
  constructor(private readonly estimateService: EstimateService) {}

  @MaxAction(EstimatePayload.startEstimate)
  startEstimate(@MaxContext() ctx: Context): Promise<void> {
    return this.estimateService.showEstimateMenu(ctx);
  }

  @MaxAction(EstimatePayload.generateEstimate)
  generate(@MaxContext() ctx: Context): Promise<void> {
    return this.estimateService.generateEstimate(ctx);
  }

  @MaxAction(EstimatePayload.exportEstimate)
  export(@MaxContext() ctx: Context): Promise<void> {
    return this.estimateService.exportEstimate(ctx);
  }

  @MaxAction(EstimatePayload.listEstimates)
  list(@MaxContext() ctx: Context): Promise<void> {
    return this.estimateService.showEstimateList(ctx);
  }

  @MaxAction(EstimatePayload.editWorkTypes)
  editWorkTypes(@MaxContext() ctx: Context): Promise<void> {
    return this.estimateService.showEstimateMenu(ctx);
  }

  @MaxAction(EstimatePayload.editParameters)
  editParameters(@MaxContext() ctx: Context): Promise<void> {
    return this.estimateService.showEstimateMenu(ctx);
  }
}
