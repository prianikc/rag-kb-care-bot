import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { RedisStateService } from '../../shared/services/redis-state.service';

const GENERIC_ERROR = 'Что-то пошло не так. Попробуйте позже.';

@Catch()
export class BotExceptionFilter implements ExceptionFilter {
  constructor(private readonly redisStateService: RedisStateService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    let message = 'Unexpected error';

    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object') {
        const body = res as { message: string };
        message = body.message || exception.message || message;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }
    Logger.error(message, 'BotExceptionFilter');

    // Try to notify the user with a friendly message
    const args = host.getArgs();
    const ctx = args.find((arg: unknown) => arg && typeof arg === 'object' && 'user' in arg && 'reply' in arg);
    if (ctx) {
      (async () => {
        try {
          const userId = ctx.user?.user_id;
          if (userId) {
            await this.redisStateService.clearAllMessages(ctx, userId);
          }
          await ctx.reply(GENERIC_ERROR);
        } catch {
          // Ignore errors during error notification
        }
      })();
    }
  }
}
