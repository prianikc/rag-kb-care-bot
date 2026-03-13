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
    const triggeringId = ctx.messageId ?? ctx.message?.body?.mid;

    await this.redisStateService.clearAllMessages(ctx, userId, triggeringId);

    const startKeyboard = Keyboard.inlineKeyboard([
      [Keyboard.button.callback('📋 Мои документы', KbPayload.listDocs)],
    ]);

    const message = await ctx.reply(
      '<b>📚 База знаний</b>\n\nПросто напишите вопрос — я найду ответ в ваших документах.\nЧтобы добавить документ — отправьте файл в чат.\n\nПоддерживаемые форматы: PDF, DOCX, XLSX, TXT, MD, CSV, изображения (OCR)',
      {
        format: 'html',
        attachments: [startKeyboard],
      },
    );

    await this.redisStateService.setUserState({
      userId,
      flow: UserFlow.menu,
      messageIds: [message.body.mid],
    });
  }
}
