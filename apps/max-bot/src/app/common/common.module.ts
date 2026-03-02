import { Module } from '@nestjs/common';
import { BotContextService } from './services/bot-context.service';

@Module({
  providers: [BotContextService],
  exports: [BotContextService],
})
export class CommonModule {}
