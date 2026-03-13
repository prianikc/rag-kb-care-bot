import { Injectable } from '@nestjs/common';
import { Context, Keyboard } from '@maxhub/max-bot-api';
import { RedisStateService } from '../shared/services/redis-state.service';
import { DbService } from '../shared/services/db.service';
import { UserFlow } from '../shared/types/user-state.types';
import { KbPayload } from '../knowledge-base/knowledge-base.types';
import { EstimatePayload } from '../estimate/estimate.types';

@Injectable()
export class MenuService {
  constructor(
    private readonly redisStateService: RedisStateService,
    private readonly dbService: DbService,
  ) {}

  async start(ctx: Context): Promise<void> {
    const maxUserId = ctx.user.user_id;
    await this.dbService.findOrCreateOrganization(maxUserId);
    return this.showMainMenu(ctx);
  }

  async showMainMenu(ctx: Context): Promise<void> {
    const userId = ctx.user.user_id;

    const startKeyboard = Keyboard.inlineKeyboard([
      [Keyboard.button.callback('\uD83D\uDCC4 \u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442', KbPayload.startUpload)],
      [Keyboard.button.callback('\u2753 \u0417\u0430\u0434\u0430\u0442\u044C \u0432\u043E\u043F\u0440\u043E\u0441', KbPayload.startQuestion)],
      [Keyboard.button.callback('\uD83D\uDCCB \u041C\u043E\u0438 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u044B', KbPayload.listDocs)],
      [Keyboard.button.callback('\uD83E\uDDEE \u0421\u043C\u0435\u0442\u0430', EstimatePayload.startEstimate)],
    ]);

    await ctx.reply('<b>\uD83D\uDCDA \u0411\u0430\u0437\u0430 \u0437\u043D\u0430\u043D\u0438\u0439</b>\n\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435:', {
      format: 'html',
      attachments: [startKeyboard],
    });

    await this.redisStateService.clearMessages(ctx, userId);

    await this.redisStateService.setUserState({
      userId,
      flow: UserFlow.menu,
    });

    const { messageId } = ctx;
    if (messageId) {
      await ctx.api.deleteMessage(messageId);
    }
  }
}
