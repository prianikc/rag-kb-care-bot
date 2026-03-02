import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

export const BOT_ID_KEY = 'botId';

@Injectable()
export class BotContextService {
  constructor(private readonly cls: ClsService) {}
  getBotId(): number | undefined {
    return this.cls.get<number>(BOT_ID_KEY);
  }
}
