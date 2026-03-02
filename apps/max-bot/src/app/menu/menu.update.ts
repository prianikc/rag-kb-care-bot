import { MaxAction, MaxCommand, MaxContext, MaxNext, MaxOn, MaxStarted, MaxUpdate } from 'nestjs-max';
import { Context } from '@maxhub/max-bot-api';
import { UseGuards } from '@nestjs/common';
import { MenuService } from './menu.service';
import { OrgGuard } from '../shared/guards/auth.guard';
import { MenuPayload } from './menu.types';
import { RedisStateService } from '../shared/services/redis-state.service';
import { MessageCreatedHandlerRegistry } from './message-created-handler-registry.service';

const COMMAND_PREFIX = '/';

function isCommand(text: string | null | undefined): boolean {
  const t = text?.trim();
  return Boolean(t?.startsWith(COMMAND_PREFIX) && t.length > 1);
}

@MaxUpdate()
export class MenuUpdate {
  constructor(
    private readonly menuService: MenuService,
    private readonly redisStateService: RedisStateService,
    private readonly messageCreatedHandlerRegistry: MessageCreatedHandlerRegistry,
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
    const userId = ctx.user.user_id;
    const state = await this.redisStateService.getUserState(userId);

    if (state) {
      const handler = this.messageCreatedHandlerRegistry.getHandler(state.flow);
      if (handler) {
        await handler.handle(ctx, state);
        return;
      }
    }

    await this.menuService.showMainMenu(ctx);
  }
}
