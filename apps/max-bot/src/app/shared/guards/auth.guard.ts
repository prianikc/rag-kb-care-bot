import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Context } from '@maxhub/max-bot-api';
import { DbService } from '../services/db.service';

@Injectable()
export class OrgGuard implements CanActivate {
  constructor(private readonly dbService: DbService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const args = context.getArgs();
    const ctx: Context = args.find(
      (arg): arg is Context => arg && typeof arg === 'object' && 'user' in arg && 'reply' in arg,
    );

    if (!ctx) {
      return false;
    }

    const maxUserId = ctx.user.user_id;
    await this.dbService.findOrCreateOrganization(maxUserId);
    return true;
  }
}
