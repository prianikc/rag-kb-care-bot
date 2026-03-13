import { MaxAction, MaxContext, MaxUpdate } from 'nestjs-max';
import { Context } from '@maxhub/max-bot-api';
import { UseGuards } from '@nestjs/common';
import { OrgGuard } from '../shared/guards/auth.guard';
import { RedisStateService } from '../shared/services/redis-state.service';
import {
  KbPayload,
  KB_DOCS_PAGE_PREFIX,
  KB_FOLDER_PREFIX,
  KB_FOLDER_PAGE_PREFIX,
  KB_FOLDER_DELETE_PREFIX,
  KB_FOLDER_DELETE_CONFIRM_PREFIX,
} from './knowledge-base.types';
import { KnowledgeBaseService } from './knowledge-base.service';

@UseGuards(OrgGuard)
@MaxUpdate()
export class KnowledgeBaseUpdate {
  constructor(
    private readonly kbService: KnowledgeBaseService,
    private readonly redisStateService: RedisStateService,
  ) {}

  @MaxAction(KbPayload.listDocs)
  showDocs(@MaxContext() ctx: Context): Promise<void> {
    return this.kbService.showFolderContents(ctx, null);
  }

  @MaxAction(new RegExp(`^${KB_DOCS_PAGE_PREFIX}(\\d+)$`))
  showDocsPage(@MaxContext() ctx: Context): Promise<void> {
    const page = parseInt(ctx.match?.[1] ?? '0', 10);
    return this.kbService.showFolderContents(ctx, null, page);
  }

  @MaxAction(new RegExp(`^${KB_FOLDER_PREFIX}(\\d+)$`))
  openFolder(@MaxContext() ctx: Context): Promise<void> {
    const folderId = parseInt(ctx.match?.[1] ?? '0', 10);
    return this.kbService.showFolderContents(ctx, folderId);
  }

  @MaxAction(new RegExp(`^${KB_FOLDER_PAGE_PREFIX}(\\d+)_(\\d+)$`))
  showFolderPage(@MaxContext() ctx: Context): Promise<void> {
    const folderId = parseInt(ctx.match?.[1] ?? '0', 10);
    const page = parseInt(ctx.match?.[2] ?? '0', 10);
    return this.kbService.showFolderContents(ctx, folderId, page);
  }

  @MaxAction(KbPayload.createFolder)
  promptCreateFolder(@MaxContext() ctx: Context): Promise<void> {
    return this.kbService.promptCreateFolder(ctx);
  }

  @MaxAction(KbPayload.moveDoc)
  promptMoveDoc(@MaxContext() ctx: Context): Promise<void> {
    return this.kbService.promptMoveDocFilename(ctx);
  }

  @MaxAction(KbPayload.confirmPhotoUpload)
  confirmPhotoUpload(@MaxContext() ctx: Context): Promise<void> {
    return this.kbService.processConfirmedUpload(ctx);
  }

  @MaxAction(KbPayload.createFolderAndMove)
  createFolderAndMove(@MaxContext() ctx: Context): Promise<void> {
    return this.kbService.executeCreateFolderAndMove(ctx);
  }

  @MaxAction(KbPayload.cancelAction)
  async cancelAction(@MaxContext() ctx: Context): Promise<void> {
    const state = await this.redisStateService.getUserState(ctx.user.user_id);
    return this.kbService.showFolderContents(ctx, state?.currentFolderId ?? null);
  }

  @MaxAction(new RegExp(`^${KB_FOLDER_DELETE_PREFIX}(\\d+)$`))
  confirmDeleteFolder(@MaxContext() ctx: Context): Promise<void> {
    const folderId = parseInt(ctx.match?.[1] ?? '0', 10);
    return this.kbService.confirmDeleteFolder(ctx, folderId);
  }

  @MaxAction(new RegExp(`^${KB_FOLDER_DELETE_CONFIRM_PREFIX}(\\d+)$`))
  executeDeleteFolder(@MaxContext() ctx: Context): Promise<void> {
    const folderId = parseInt(ctx.match?.[1] ?? '0', 10);
    return this.kbService.executeDeleteFolder(ctx, folderId);
  }
}
