import { Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';

@Catch()
export class BotExceptionFilter implements ExceptionFilter {
  catch(exception: unknown): void {
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
  }
}
