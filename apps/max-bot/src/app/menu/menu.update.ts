import { MaxAction, MaxCommand, MaxContext, MaxNext, MaxOn, MaxStarted, MaxUpdate } from 'nestjs-max';
import { Context } from '@maxhub/max-bot-api';
import { UseGuards } from '@nestjs/common';
import { MenuService } from './menu.service';
import { OrgGuard } from '../shared/guards/auth.guard';
import { MenuPayload } from './menu.types';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';
import { FileBatchCollectorService } from '../knowledge-base/file-batch-collector.service';
import { RedisStateService } from '../shared/services/redis-state.service';
import { UserFlow } from '../shared/types/user-state.types';

const COMMAND_PREFIX = '/';

function isCommand(text: string | null | undefined): boolean {
  const t = text?.trim();
  return Boolean(t?.startsWith(COMMAND_PREFIX) && t.length > 1);
}

function hasFileAttachment(ctx: Context): boolean {
  const attachments = ctx.message?.body?.attachments;
  if (!attachments?.length) return false;
  return attachments.some(
    (a) => a.type === 'file' || a.type === 'image',
  );
}

@MaxUpdate()
export class MenuUpdate {
  constructor(
    private readonly menuService: MenuService,
    private readonly kbService: KnowledgeBaseService,
    private readonly redisStateService: RedisStateService,
    private readonly batchCollector: FileBatchCollectorService,
  ) {}

  @UseGuards(OrgGuard)
  @MaxAction(MenuPayload.menu)
  onMenu(@MaxContext() ctx: Context): Promise<void> {
    return this.menuService.showMainMenu(ctx);
  }

  @MaxStarted()
  @MaxCommand('start')
  onStart(@MaxContext() ctx: Context): Promise<void> {
    return this.menuService.start(ctx);
  }

  @MaxOn('message_created')
  async routeMessage(@MaxContext() ctx: Context, @MaxNext() next: () => Promise<void>): Promise<void> {
    const text = ctx.message?.body?.text;
    if (isCommand(text)) {
      await next();
      return;
    }

    if (hasFileAttachment(ctx)) {
      await this.kbService.handleFileUpload(ctx);
      return;
    }

    const userId = ctx.user.user_id;

    // Если идёт сбор файлов — сбросить и обработать батч
    if (this.batchCollector.isCollecting(userId)) {
      await this.kbService.flushBatch(userId);
    }

    const state = await this.redisStateService.getUserState(userId);

    if (state?.flow === UserFlow.createFolder && text?.trim()) {
      await this.kbService.handleCreateFolderName(ctx);
      return;
    }
    if (state?.flow === UserFlow.moveDocFilename && text?.trim()) {
      await this.kbService.handleMoveDocFilename(ctx);
      return;
    }
    if (state?.flow === UserFlow.moveDocFolder && text?.trim()) {
      await this.kbService.handleMoveDocFolder(ctx);
      return;
    }

    if (text?.trim()) {
      await this.kbService.handleQuestion(ctx);
      return;
    }

    await this.menuService.showMainMenu(ctx);
  }
}
