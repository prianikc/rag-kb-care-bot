import { Module } from '@nestjs/common';
import { EstimateService } from './estimate.service';
import { EstimateUpdate } from './estimate.update';
import { EstimateMessageCreatedHandler } from './estimate-message-created.handler';
import { SharedServicesModule } from '../shared/services/shared-services.module';

@Module({
  imports: [SharedServicesModule],
  providers: [
    EstimateService,
    EstimateUpdate,
    EstimateMessageCreatedHandler,
  ],
  exports: [
    EstimateService,
    EstimateMessageCreatedHandler,
    EstimateUpdate,
  ],
})
export class EstimateModule {}
