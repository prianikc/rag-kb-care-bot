import { Injectable } from '@nestjs/common';
import { Context, Keyboard } from '@maxhub/max-bot-api';
import { RedisStateService } from '../shared/services/redis-state.service';
import { DbService } from '../shared/services/db.service';
import { UserFlow } from '../shared/types/user-state.types';
import { KbPayload } from '../knowledge-base/knowledge-base.types';

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
      [Keyboard.button.callback('📄 Загрузить документ', KbPayload.startUpload)],
      [Keyboard.button.callback('❓ Задать вопрос', KbPayload.startQuestion)],
      [Keyboard.button.callback('📋 Мои документы', KbPayload.listDocs)],
    ]);

    await ctx.reply('<b>📚 База знаний</b>\nВыберите действие:', {
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
