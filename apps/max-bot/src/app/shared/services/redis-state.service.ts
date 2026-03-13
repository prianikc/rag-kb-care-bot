import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { UserSessionState } from '../types/user-state.types';
import { Context } from '@maxhub/max-bot-api';

const DEFAULT_TTL_SECONDS = 86400;
const USER_STATE_KEY = (userId: number): string => `user:state:${userId}`;

@Injectable()
export class RedisStateService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async getUserState(userId: number): Promise<UserSessionState | null> {
    const raw = await this.redis.get(USER_STATE_KEY(userId));
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async setUserState(state: UserSessionState, ttlSeconds = DEFAULT_TTL_SECONDS): Promise<void> {
    const key = USER_STATE_KEY(state.userId);
    const stateWithTimestamp: UserSessionState = {
      ...state,
      lastActivityAt: Date.now(),
    };
    const serialized = JSON.stringify(stateWithTimestamp);
    await this.redis.setex(key, ttlSeconds, serialized);
  }

  async deleteUserState(userId: number): Promise<void> {
    await this.redis.del(USER_STATE_KEY(userId));
  }

  async clearMessages(ctx: Context, userId: number): Promise<void> {
    const state = await this.getUserState(userId);
    if (!state) return;
    await Promise.all((state.messageIds ?? []).map((m) => ctx.api.deleteMessage(m)));
    await this.setUserState({ ...state, messageIds: [] });
  }

  async clearAllMessages(ctx: Context, userId: number, triggeringMsgId?: string | null): Promise<void> {
    const state = await this.getUserState(userId);
    const toDelete = new Set<string>(state?.messageIds ?? []);
    if (triggeringMsgId) toDelete.add(triggeringMsgId);
    await Promise.allSettled([...toDelete].map((id) => ctx.api.deleteMessage(id)));
    if (state) {
      await this.setUserState({ ...state, messageIds: [] });
    }
  }
}
