import { Context } from '@maxhub/max-bot-api';
import { UserSessionState } from './user-state.types';

export interface MessageCreatedHandler<T = unknown> {
  handle(ctx: Context, state: UserSessionState<T>): Promise<void>;
}
