import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, defer } from 'rxjs';
import { ClsService } from 'nestjs-cls';
import { Context } from '@maxhub/max-bot-api';
import { BOT_ID_KEY } from '../services/bot-context.service';

@Injectable()
export class BotContextInterceptor implements NestInterceptor {
  constructor(private readonly cls: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const args = context.getArgs();
    const ctx: Context | undefined = args.find(
      (arg): arg is Context => arg && typeof arg === 'object' && 'user' in arg && 'reply' in arg,
    );

    const botId = ctx?.user?.user_id;

    if (!this.cls.isActive()) {
      return defer(() =>
        this.cls.run(() => {
          if (botId) {
            this.cls.set(BOT_ID_KEY, botId);
          }
          return next.handle();
        }),
      );
    }

    if (botId) {
      this.cls.set(BOT_ID_KEY, botId);
    }

    return next.handle();
  }
}
