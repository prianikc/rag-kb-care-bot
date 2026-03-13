import { Injectable, Logger } from "@nestjs/common";
import { Context, Keyboard } from "@maxhub/max-bot-api";
import { RedisStateService } from "../shared/services/redis-state.service";
import { DbService } from "../shared/services/db.service";
import { N8nApiService } from "../shared/services/n8n-api.service";
import { UserFlow, UserSessionState } from "../shared/types/user-state.types";
import { FileBatchCollectorService } from "./file-batch-collector.service";
import { MenuPayload } from "../menu/menu.types";
import {
  KbPayload,
  KB_DOCS_PAGE_PREFIX,
  KB_FOLDER_PREFIX,
  KB_FOLDER_PAGE_PREFIX,
  KB_FOLDER_DELETE_PREFIX,
  KB_FOLDER_DELETE_CONFIRM_PREFIX,
} from "./knowledge-base.types";
import { extname } from "path";

const STATUS_EMOJI: Record<string, string> = {
  pending: "⏳",
  indexing: "🔄",
  ready: "✅",
  partial: "⚠️",
  error: "❌",
};

const EXT_TO_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".csv": "text/csv",
  ".json": "application/json",
  ".html": "text/html",
  ".htm": "text/html",
  ".xml": "application/xml",
  ".log": "text/plain",
  ".rst": "text/x-rst",

  // Изображения (OCR)
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".tiff": "image/tiff",
  ".tif": "image/tiff",
  ".bmp": "image/bmp",
  ".webp": "image/webp",

  // Офисные форматы
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".doc": "application/msword",
  ".odt": "application/vnd.oasis.opendocument.text",
  ".rtf": "application/rtf",
};

interface ValidatedAttachment {
  filename: string;
  mimeType: string;
  fileUrl: string;
}

interface SingleFileResult {
  filename: string;
  status: 'success' | 'duplicate' | 'unsupported' | 'download_error' | 'index_error' | 'no_chunks';
  chunkCount?: number;
  ocrPages?: number;
  skippedPages?: number;
  totalPages?: number;
}

const ITEMS_PER_PAGE = 20;
const MAX_FOLDER_DEPTH = 3;
const INVALID_CHARS = /[\\/:*?"<>|]/;
const GENERIC_ERROR = "Что-то пошло не так. Попробуйте позже.";

@Injectable()
export class KnowledgeBaseService {
  private readonly logger = new Logger(KnowledgeBaseService.name);

  constructor(
    private readonly redisStateService: RedisStateService,
    private readonly dbService: DbService,
    private readonly n8nApiService: N8nApiService,
    private readonly batchCollector: FileBatchCollectorService,
  ) {}

  // --- Folder Navigation ---

  private async buildTreeLines(
    orgId: number,
    parentId: number | null,
    prefix: string,
    depth: number,
  ): Promise<string[]> {
    const { subfolders, docs } = await this.dbService.getFolderContents(orgId, parentId);
    const items: Array<{ line: string; children?: string[] }> = [];

    for (const f of subfolders) {
      const folderLine = `📁 <b>${f.name}</b> <i>(${f.docCount} док.)</i>`;
      let children: string[] = [];
      if (depth < MAX_FOLDER_DEPTH) {
        children = await this.buildTreeLines(orgId, f.id, '', depth + 1);
      }
      items.push({ line: folderLine, children });
    }
    for (const d of docs) {
      const emoji = STATUS_EMOJI[d.status] ?? "❓";
      items.push({ line: `${emoji} ${d.filename} <i>(${d.chunk_count} фрагм.)</i>` });
    }

    const result: string[] = [];
    for (let i = 0; i < items.length; i++) {
      const isLast = i === items.length - 1;
      const branch = isLast ? '└ ' : '├ ';
      const childPrefix = isLast ? '  ' : '│ ';

      result.push(`${prefix}${branch}${items[i].line}`);
      if (items[i].children?.length) {
        for (const childLine of items[i].children!) {
          result.push(`${prefix}${childPrefix}${childLine}`);
        }
      }
    }
    return result;
  }

  private async buildFolderContentsText(
    orgId: number,
    folderId: number | null,
    subfolders: Array<{ id: number; name: string; docCount: number }>,
    docs: Array<{ id: number; filename: string; status: string; chunk_count: number }>,
    page = 0,
  ): Promise<string> {
    let breadcrumb = '';
    if (folderId) {
      const crumbs = await this.dbService.getFolderBreadcrumbs(folderId);
      breadcrumb = crumbs.map((c) => c.name).join(' / ');
    }

    let text: string;
    if (folderId) {
      text = `<b>📂 ${breadcrumb}:</b>\n\n`;
    } else {
      const totalDocCount = await this.dbService.getTotalDocCount(orgId);
      text = `<b>📋 Мои документы (${docs.length} в корне / ${totalDocCount} всего):</b>\n\n`;
    }

    const totalItems = subfolders.length + docs.length;
    if (totalItems === 0) {
      text += folderId ? "Папка пуста." : "У вас пока нет загруженных документов.";
    } else {
      const treeLines = await this.buildTreeLines(orgId, folderId, '', 0);

      const totalPages = Math.ceil(treeLines.length / ITEMS_PER_PAGE);
      const safePage = Math.max(0, Math.min(page, totalPages - 1));
      const start = safePage * ITEMS_PER_PAGE;
      const pageLines = treeLines.slice(start, start + ITEMS_PER_PAGE);

      text += pageLines.join("\n");

      if (totalPages > 1) {
        text += `\n\n<i>Стр. ${safePage + 1}/${totalPages}</i>`;
      }
    }

    return text;
  }

  async showFolderContents(ctx: Context, folderId: number | null, page = 0): Promise<void> {
    const userId = ctx.user.user_id;
    const triggeringId = ctx.messageId ?? ctx.message?.body?.mid;

    await this.redisStateService.clearAllMessages(ctx, userId, triggeringId);

    const org = await this.dbService.findOrCreateOrganization(userId);

    try {
      const { subfolders, docs } = await this.dbService.getFolderContents(org.id, folderId);
      const totalItems = subfolders.length + docs.length;

      const text = await this.buildFolderContentsText(org.id, folderId, subfolders, docs, page);

      const rows: ReturnType<typeof Keyboard.button.callback>[][] = [];

      // Кнопки навигации в подпапки (по 2 в ряд)
      for (let i = 0; i < subfolders.length; i += 2) {
        const row: ReturnType<typeof Keyboard.button.callback>[] = [];
        row.push(
          Keyboard.button.callback(
            `📁 ${subfolders[i].name}`,
            `${KB_FOLDER_PREFIX}${subfolders[i].id}`,
          ),
        );
        if (i + 1 < subfolders.length) {
          row.push(
            Keyboard.button.callback(
              `📁 ${subfolders[i + 1].name}`,
              `${KB_FOLDER_PREFIX}${subfolders[i + 1].id}`,
            ),
          );
        }
        rows.push(row);
      }

      // Пагинация
      const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
      if (totalPages > 1) {
        const safePage = Math.max(0, Math.min(page, totalPages - 1));
        const paginationRow: ReturnType<typeof Keyboard.button.callback>[] = [];
        const prefix = folderId ? `${KB_FOLDER_PAGE_PREFIX}${folderId}_` : KB_DOCS_PAGE_PREFIX;
        if (safePage > 0) {
          paginationRow.push(Keyboard.button.callback("⬅️ Назад", `${prefix}${safePage - 1}`));
        }
        if (safePage < totalPages - 1) {
          paginationRow.push(Keyboard.button.callback("Вперёд ➡️", `${prefix}${safePage + 1}`));
        }
        if (paginationRow.length) rows.push(paginationRow);
      }

      // Действия
      const actionRow: ReturnType<typeof Keyboard.button.callback>[] = [
        Keyboard.button.callback("📁+ Создать папку", KbPayload.createFolder),
        Keyboard.button.callback("📦 Переместить", KbPayload.moveDoc),
      ];
      rows.push(actionRow);

      if (folderId) {
        rows.push([
          Keyboard.button.callback("🗑 Удалить папку", `${KB_FOLDER_DELETE_PREFIX}${folderId}`),
        ]);
      }

      // Навигация
      const navRow: ReturnType<typeof Keyboard.button.callback>[] = [];
      if (folderId) {
        const folder = await this.dbService.getFolderById(folderId);
        const parentPayload = folder?.parent_id
          ? `${KB_FOLDER_PREFIX}${folder.parent_id}`
          : KbPayload.listDocs;
        navRow.push(Keyboard.button.callback("⬆️ Наверх", parentPayload));
        if (folder?.parent_id) {
          navRow.push(Keyboard.button.callback("🏠 В корень", KbPayload.listDocs));
        }
      }
      navRow.push(Keyboard.button.callback("🏠 В начало", MenuPayload.menu));
      rows.push(navRow);

      const keyboard = Keyboard.inlineKeyboard(rows);
      const msg = await ctx.reply(text, { format: "html", attachments: [keyboard] });

      await this.redisStateService.setUserState({
        userId,
        flow: UserFlow.menu,
        messageIds: [msg.body.mid],
        currentFolderId: folderId,
      });
    } catch (error) {
      this.logger.error(`Folder contents failed: ${(error as Error).message}`);
      const keyboard = Keyboard.inlineKeyboard([
        [Keyboard.button.callback("🏠 В начало", MenuPayload.menu)],
      ]);
      const msg = await ctx.reply(GENERIC_ERROR, { attachments: [keyboard] });
      await this.redisStateService.setUserState({
        userId,
        flow: UserFlow.menu,
        messageIds: [msg.body.mid],
      });
    }
  }

  // --- Create Folder ---

  async promptCreateFolder(ctx: Context): Promise<void> {
    const userId = ctx.user.user_id;
    const triggeringId = ctx.messageId ?? ctx.message?.body?.mid;

    await this.redisStateService.clearAllMessages(ctx, userId, triggeringId);

    const state = await this.redisStateService.getUserState(userId);
    const currentFolderId = state?.currentFolderId ?? null;
    const org = await this.dbService.findOrCreateOrganization(userId);

    const { subfolders, docs } = await this.dbService.getFolderContents(org.id, currentFolderId);
    const treeText = await this.buildFolderContentsText(org.id, currentFolderId, subfolders, docs);

    const keyboard = Keyboard.inlineKeyboard([
      [Keyboard.button.callback("❌ Отмена", KbPayload.cancelAction)],
    ]);
    const msg = await ctx.reply(
      `${treeText}\n\n📁 <b>Введите название новой папки</b> (несколько через запятую):`,
      { format: "html", attachments: [keyboard] },
    );

    await this.redisStateService.setUserState({
      userId,
      flow: UserFlow.createFolder,
      messageIds: [msg.body.mid],
      currentFolderId,
      createFolderParentId: currentFolderId,
    });
  }

  async handleCreateFolderName(ctx: Context): Promise<void> {
    const userId = ctx.user.user_id;
    const triggeringId = ctx.message?.body?.mid;
    const rawInput = ctx.message?.body?.text?.trim() ?? "";

    const state = await this.redisStateService.getUserState(userId);
    const parentId = state?.createFolderParentId ?? null;
    const org = await this.dbService.findOrCreateOrganization(userId);

    const names = rawInput.split(',').map((s) => s.trim()).filter(Boolean);

    if (!names.length) {
      await this.redisStateService.clearAllMessages(ctx, userId, triggeringId);
      const keyboard = Keyboard.inlineKeyboard([
        [Keyboard.button.callback("❌ Отмена", KbPayload.cancelAction)],
      ]);
      const msg = await ctx.reply("❌ Введите хотя бы одно название папки. Попробуйте снова:", {
        attachments: [keyboard],
      });
      await this.redisStateService.setUserState({ ...state!, messageIds: [msg.body.mid] });
      return;
    }

    // Валидация всех имён
    const invalidNames = names.filter((n) => n.length > 100);
    if (invalidNames.length) {
      await this.redisStateService.clearAllMessages(ctx, userId, triggeringId);
      const keyboard = Keyboard.inlineKeyboard([
        [Keyboard.button.callback("❌ Отмена", KbPayload.cancelAction)],
      ]);
      const msg = await ctx.reply(
        `❌ Слишком длинные названия (макс. 100 символов): ${invalidNames.join(', ')}\nПопробуйте снова:`,
        { attachments: [keyboard] },
      );
      await this.redisStateService.setUserState({ ...state!, messageIds: [msg.body.mid] });
      return;
    }

    const badChars = names.filter((n) => INVALID_CHARS.test(n));
    if (badChars.length) {
      await this.redisStateService.clearAllMessages(ctx, userId, triggeringId);
      const keyboard = Keyboard.inlineKeyboard([
        [Keyboard.button.callback("❌ Отмена", KbPayload.cancelAction)],
      ]);
      const msg = await ctx.reply(
        `❌ Недопустимые символы в названиях: ${badChars.join(', ')}\nЗапрещены: \\ / : * ? " < > |\nПопробуйте снова:`,
        { attachments: [keyboard] },
      );
      await this.redisStateService.setUserState({ ...state!, messageIds: [msg.body.mid] });
      return;
    }

    // Проверка глубины
    if (parentId) {
      const depth = await this.dbService.getFolderDepth(parentId);
      if (depth >= MAX_FOLDER_DEPTH) {
        await this.redisStateService.clearAllMessages(ctx, userId, triggeringId);
        const keyboard = Keyboard.inlineKeyboard([
          [Keyboard.button.callback("❌ Отмена", KbPayload.cancelAction)],
        ]);
        const msg = await ctx.reply(`❌ Достигнут максимум вложенности (${MAX_FOLDER_DEPTH} уровня). Выберите другое расположение.`, {
          attachments: [keyboard],
        });
        await this.redisStateService.setUserState({ ...state!, flow: UserFlow.menu, messageIds: [msg.body.mid] });
        return;
      }
    }

    try {
      const created: string[] = [];
      const duplicates: string[] = [];

      for (const name of names) {
        const isDuplicate = await this.dbService.checkDuplicateFolderName(org.id, name, parentId);
        if (isDuplicate) {
          duplicates.push(name);
        } else {
          await this.dbService.createFolder(org.id, name, parentId);
          created.push(name);
        }
      }

      if (duplicates.length && !created.length) {
        await this.redisStateService.clearAllMessages(ctx, userId, triggeringId);
        const keyboard = Keyboard.inlineKeyboard([
          [Keyboard.button.callback("❌ Отмена", KbPayload.cancelAction)],
        ]);
        const msg = await ctx.reply(
          `❌ Все папки уже существуют: ${duplicates.join(', ')}\nВведите другие названия:`,
          { attachments: [keyboard] },
        );
        await this.redisStateService.setUserState({ ...state!, messageIds: [msg.body.mid] });
        return;
      }

      // Показываем содержимое — дубликаты упомянем в тексте через showFolderContents
      await this.showFolderContents(ctx, parentId);
    } catch (error) {
      this.logger.error(`Create folder failed: ${(error as Error).message}`);
      await this.redisStateService.clearAllMessages(ctx, userId, triggeringId);
      const keyboard = Keyboard.inlineKeyboard([
        [Keyboard.button.callback("🏠 В начало", MenuPayload.menu)],
      ]);
      const msg = await ctx.reply(GENERIC_ERROR, { attachments: [keyboard] });
      await this.redisStateService.setUserState({
        userId,
        flow: UserFlow.menu,
        messageIds: [msg.body.mid],
      });
    }
  }

  // --- Delete Folder ---

  async confirmDeleteFolder(ctx: Context, folderId: number): Promise<void> {
    const userId = ctx.user.user_id;
    const triggeringId = ctx.messageId ?? ctx.message?.body?.mid;

    await this.redisStateService.clearAllMessages(ctx, userId, triggeringId);

    const folder = await this.dbService.getFolderById(folderId);
    if (!folder) {
      await this.showFolderContents(ctx, null);
      return;
    }

    const keyboard = Keyboard.inlineKeyboard([
      [
        Keyboard.button.callback("✅ Да, удалить", `${KB_FOLDER_DELETE_CONFIRM_PREFIX}${folderId}`),
        Keyboard.button.callback("❌ Отмена", KbPayload.cancelAction),
      ],
    ]);

    const msg = await ctx.reply(
      `⚠️ Удалить папку «${folder.name}»?\nВсе документы из неё и вложенных папок переместятся в корень.`,
      { attachments: [keyboard] },
    );

    const state = await this.redisStateService.getUserState(userId);
    await this.redisStateService.setUserState({
      userId,
      flow: UserFlow.menu,
      messageIds: [msg.body.mid],
      currentFolderId: state?.currentFolderId,
    });
  }

  async executeDeleteFolder(ctx: Context, folderId: number): Promise<void> {
    const userId = ctx.user.user_id;
    const triggeringId = ctx.messageId ?? ctx.message?.body?.mid;

    const folder = await this.dbService.getFolderById(folderId);
    if (!folder) {
      await this.showFolderContents(ctx, null);
      return;
    }

    const parentId = folder.parent_id;

    try {
      await this.redisStateService.clearAllMessages(ctx, userId, triggeringId);
      await this.dbService.deleteFolder(folderId);
      await this.showFolderContents(ctx, parentId);
    } catch (error) {
      this.logger.error(`Delete folder failed: ${(error as Error).message}`);
      await this.redisStateService.clearAllMessages(ctx, userId, triggeringId);
      const keyboard = Keyboard.inlineKeyboard([
        [Keyboard.button.callback("🏠 В начало", MenuPayload.menu)],
      ]);
      const msg = await ctx.reply(GENERIC_ERROR, { attachments: [keyboard] });
      await this.redisStateService.setUserState({
        userId,
        flow: UserFlow.menu,
        messageIds: [msg.body.mid],
      });
    }
  }

  // --- Move Document ---

  async promptMoveDocFilename(ctx: Context): Promise<void> {
    const userId = ctx.user.user_id;
    const triggeringId = ctx.messageId ?? ctx.message?.body?.mid;

    await this.redisStateService.clearAllMessages(ctx, userId, triggeringId);

    const state = await this.redisStateService.getUserState(userId);
    const currentFolderId = state?.currentFolderId ?? null;
    const org = await this.dbService.findOrCreateOrganization(userId);

    const { subfolders, docs } = await this.dbService.getFolderContents(org.id, currentFolderId);
    const treeText = await this.buildFolderContentsText(org.id, currentFolderId, subfolders, docs);

    const keyboard = Keyboard.inlineKeyboard([
      [Keyboard.button.callback("❌ Отмена", KbPayload.cancelAction)],
    ]);
    const msg = await ctx.reply(
      `${treeText}\n\n📦 <b>Введите название файла для перемещения</b> (несколько через запятую):`,
      { format: "html", attachments: [keyboard] },
    );

    await this.redisStateService.setUserState({
      userId,
      flow: UserFlow.moveDocFilename,
      messageIds: [msg.body.mid],
      currentFolderId,
    });
  }

  async handleMoveDocFilename(ctx: Context): Promise<void> {
    const userId = ctx.user.user_id;
    const triggeringId = ctx.message?.body?.mid;
    const rawInput = ctx.message?.body?.text?.trim() ?? "";

    const state = await this.redisStateService.getUserState(userId);
    const org = await this.dbService.findOrCreateOrganization(userId);
    const filenames = rawInput.split(',').map((s) => s.trim()).filter(Boolean);

    if (!filenames.length) {
      await this.redisStateService.clearAllMessages(ctx, userId, triggeringId);
      const keyboard = Keyboard.inlineKeyboard([
        [Keyboard.button.callback("❌ Отмена", KbPayload.cancelAction)],
      ]);
      const msg = await ctx.reply("❌ Введите хотя бы одно название файла.", {
        attachments: [keyboard],
      });
      await this.redisStateService.setUserState({ ...state!, messageIds: [msg.body.mid] });
      return;
    }

    const foundDocs: Array<{ id: number; filename: string }> = [];
    const notFound: string[] = [];

    for (const name of filenames) {
      const doc = await this.dbService.findDocumentByName(org.id, name);
      if (doc) {
        foundDocs.push({ id: doc.id, filename: doc.filename });
      } else {
        notFound.push(name);
      }
    }

    if (!foundDocs.length) {
      await this.redisStateService.clearAllMessages(ctx, userId, triggeringId);
      const keyboard = Keyboard.inlineKeyboard([
        [Keyboard.button.callback("❌ Отмена", KbPayload.cancelAction)],
      ]);
      const label = notFound.length === 1
        ? `❌ Документ «${notFound[0]}» не найден.`
        : `❌ Документы не найдены: ${notFound.join(', ')}`;
      const msg = await ctx.reply(`${label}\nПроверьте имена и попробуйте снова:`, {
        attachments: [keyboard],
      });
      await this.redisStateService.setUserState({ ...state!, messageIds: [msg.body.mid] });
      return;
    }

    await this.redisStateService.clearAllMessages(ctx, userId, triggeringId);

    const currentFolderId = state?.currentFolderId ?? null;
    const { subfolders, docs } = await this.dbService.getFolderContents(org.id, currentFolderId);
    const treeText = await this.buildFolderContentsText(org.id, currentFolderId, subfolders, docs);

    const filesList = foundDocs.map((d) => `  • ${d.filename}`).join('\n');
    let extraText = '';
    if (notFound.length) {
      extraText = `\n⚠️ Не найдены: ${notFound.join(', ')}`;
    }

    const keyboard = Keyboard.inlineKeyboard([
      [Keyboard.button.callback("❌ Отмена", KbPayload.cancelAction)],
    ]);
    const msg = await ctx.reply(
      `${treeText}\n\n📁 Файлы для перемещения:\n${filesList}${extraText}\n\n<b>Введите папку назначения</b> (или "корень").\nДля вложенных: <b>Папка/Подпапка</b>`,
      { format: "html", attachments: [keyboard] },
    );

    await this.redisStateService.setUserState({
      ...state!,
      flow: UserFlow.moveDocFolder,
      messageIds: [msg.body.mid],
      moveDocIds: foundDocs.map((d) => d.id),
      moveDocNames: foundDocs.map((d) => d.filename),
    });
  }

  async handleMoveDocFolder(ctx: Context): Promise<void> {
    const userId = ctx.user.user_id;
    const triggeringId = ctx.message?.body?.mid;
    const folderName = ctx.message?.body?.text?.trim() ?? "";

    const state = await this.redisStateService.getUserState(userId);
    const org = await this.dbService.findOrCreateOrganization(userId);
    const docIds = state?.moveDocIds ?? [];
    const docNames = state?.moveDocNames ?? [];

    if (!docIds.length) {
      await this.showFolderContents(ctx, state?.currentFolderId ?? null);
      return;
    }

    let targetFolderId: number | null = null;
    let targetFolderName = "корень";

    if (folderName.toLowerCase() !== "корень") {
      const folder = folderName.includes('/')
        ? await this.dbService.findFolderByPath(org.id, folderName)
        : await this.dbService.findFolderByName(org.id, folderName);
      if (!folder) {
        await this.promptCreateFolderAndMove(ctx, folderName, docIds, docNames, state!);
        return;
      }
      targetFolderId = folder.id;
      targetFolderName = folderName;
    }

    // Проверка дубликатов в целевой папке
    const duplicates: string[] = [];
    const toMove: Array<{ id: number; name: string }> = [];

    for (let i = 0; i < docIds.length; i++) {
      const isDuplicate = await this.dbService.checkDuplicateDocInFolder(org.id, docNames[i], targetFolderId);
      if (isDuplicate) {
        duplicates.push(docNames[i]);
      } else {
        toMove.push({ id: docIds[i], name: docNames[i] });
      }
    }

    if (!toMove.length) {
      await this.redisStateService.clearAllMessages(ctx, userId, triggeringId);
      const keyboard = Keyboard.inlineKeyboard([
        [Keyboard.button.callback("❌ Отмена", KbPayload.cancelAction)],
      ]);
      const location = targetFolderId ? `папке «${targetFolderName}»` : "корне";
      const msg = await ctx.reply(
        `❌ Все файлы уже есть в ${location}. Введите другую папку:`,
        { attachments: [keyboard] },
      );
      await this.redisStateService.setUserState({ ...state!, messageIds: [msg.body.mid] });
      return;
    }

    try {
      await Promise.all(toMove.map((d) => this.dbService.moveDocumentToFolder(d.id, targetFolderId)));
      await this.showFolderContents(ctx, state?.currentFolderId ?? null);
    } catch (error) {
      this.logger.error(`Move doc failed: ${(error as Error).message}`);
      await this.redisStateService.clearAllMessages(ctx, userId, triggeringId);
      const keyboard = Keyboard.inlineKeyboard([
        [Keyboard.button.callback("🏠 В начало", MenuPayload.menu)],
      ]);
      const msg = await ctx.reply(GENERIC_ERROR, { attachments: [keyboard] });
      await this.redisStateService.setUserState({
        userId,
        flow: UserFlow.menu,
        messageIds: [msg.body.mid],
      });
    }
  }

  // --- Create Folder & Move ---

  private async promptCreateFolderAndMove(
    ctx: Context,
    folderName: string,
    docIds: number[],
    docNames: string[],
    state: UserSessionState,
  ): Promise<void> {
    const userId = ctx.user.user_id;
    const triggeringId = ctx.message?.body?.mid;
    const org = await this.dbService.findOrCreateOrganization(userId);

    const parts = folderName.split('/').map((s) => s.trim()).filter(Boolean);

    // Валидация сегментов
    const tooLong = parts.filter((p) => p.length > 100);
    if (tooLong.length) {
      await this.redisStateService.clearAllMessages(ctx, userId, triggeringId);
      const keyboard = Keyboard.inlineKeyboard([
        [Keyboard.button.callback("❌ Отмена", KbPayload.cancelAction)],
      ]);
      const msg = await ctx.reply(
        `❌ Слишком длинные названия (макс. 100 символов): ${tooLong.join(', ')}\nПопробуйте снова:`,
        { attachments: [keyboard] },
      );
      await this.redisStateService.setUserState({ ...state, messageIds: [msg.body.mid] });
      return;
    }

    const badChars = parts.filter((p) => INVALID_CHARS.test(p));
    if (badChars.length) {
      await this.redisStateService.clearAllMessages(ctx, userId, triggeringId);
      const keyboard = Keyboard.inlineKeyboard([
        [Keyboard.button.callback("❌ Отмена", KbPayload.cancelAction)],
      ]);
      const msg = await ctx.reply(
        `❌ Недопустимые символы в названиях: ${badChars.join(', ')}\nЗапрещены: \\ / : * ? " < > |\nПопробуйте снова:`,
        { attachments: [keyboard] },
      );
      await this.redisStateService.setUserState({ ...state, messageIds: [msg.body.mid] });
      return;
    }

    // Проверка глубины: найти существующий родитель + новые сегменты
    let existingDepth = 0;
    let existingParentId: number | null = null;
    let newSegments = [...parts];

    for (let i = 0; i < parts.length; i++) {
      const existing = await this.dbService.checkDuplicateFolderName(org.id, parts[i], existingParentId);
      if (existing) {
        const found = folderName.includes('/')
          ? await this.dbService.findFolderByPath(org.id, parts.slice(0, i + 1).join('/'))
          : await this.dbService.findFolderByName(org.id, parts[i]);
        if (found) {
          existingParentId = found.id;
          newSegments = parts.slice(i + 1);
        } else {
          break;
        }
      } else {
        break;
      }
    }

    if (existingParentId) {
      existingDepth = await this.dbService.getFolderDepth(existingParentId);
    }

    const totalDepth = existingDepth + newSegments.length;
    if (totalDepth > MAX_FOLDER_DEPTH) {
      await this.redisStateService.clearAllMessages(ctx, userId, triggeringId);
      const keyboard = Keyboard.inlineKeyboard([
        [Keyboard.button.callback("❌ Отмена", KbPayload.cancelAction)],
      ]);
      const msg = await ctx.reply(
        `❌ Достигнут максимум вложенности (${MAX_FOLDER_DEPTH} уровня). Выберите другое расположение.`,
        { attachments: [keyboard] },
      );
      await this.redisStateService.setUserState({ ...state, messageIds: [msg.body.mid] });
      return;
    }

    // Формируем сообщение
    await this.redisStateService.clearAllMessages(ctx, userId, triggeringId);

    let promptText: string;
    if (parts.length === 1) {
      promptText = `📁 Папка «${folderName}» не найдена.\nСоздать её и переместить документы?`;
    } else if (newSegments.length < parts.length) {
      promptText = `📁 Путь «${folderName}» не найден полностью.\nСоздать недостающие папки (${newSegments.join(' / ')}) и переместить документы?`;
    } else {
      promptText = `📁 Путь «${folderName}» не найден.\nСоздать все папки и переместить документы?`;
    }

    const keyboard = Keyboard.inlineKeyboard([
      [
        Keyboard.button.callback("📁+ Создать и переместить", KbPayload.createFolderAndMove),
        Keyboard.button.callback("❌ Отмена", KbPayload.cancelAction),
      ],
    ]);
    const msg = await ctx.reply(promptText, { attachments: [keyboard] });

    await this.redisStateService.setUserState({
      ...state,
      flow: UserFlow.menu,
      messageIds: [msg.body.mid],
      pendingMoveFolder: folderName,
      moveDocIds: docIds,
      moveDocNames: docNames,
    });
  }

  async executeCreateFolderAndMove(ctx: Context): Promise<void> {
    const userId = ctx.user.user_id;
    const triggeringId = ctx.messageId ?? ctx.message?.body?.mid;

    const state = await this.redisStateService.getUserState(userId);
    const folderName = state?.pendingMoveFolder;
    const docIds = state?.moveDocIds ?? [];
    const docNames = state?.moveDocNames ?? [];

    if (!folderName || !docIds.length) {
      await this.showFolderContents(ctx, state?.currentFolderId ?? null);
      return;
    }

    const org = await this.dbService.findOrCreateOrganization(userId);

    try {
      await this.redisStateService.clearAllMessages(ctx, userId, triggeringId);

      const { id: targetFolderId } = await this.dbService.createFolderPath(org.id, folderName);

      // Проверка дубликатов в целевой папке
      const duplicates: string[] = [];
      const toMove: Array<{ id: number; name: string }> = [];

      for (let i = 0; i < docIds.length; i++) {
        const isDuplicate = await this.dbService.checkDuplicateDocInFolder(org.id, docNames[i], targetFolderId);
        if (isDuplicate) {
          duplicates.push(docNames[i]);
        } else {
          toMove.push({ id: docIds[i], name: docNames[i] });
        }
      }

      if (!toMove.length) {
        const keyboard = Keyboard.inlineKeyboard([
          [Keyboard.button.callback("❌ Отмена", KbPayload.cancelAction)],
        ]);
        const msg = await ctx.reply(
          `❌ Все файлы уже есть в папке «${folderName}». Введите другую папку:`,
          { attachments: [keyboard] },
        );
        await this.redisStateService.setUserState({
          ...state!,
          flow: UserFlow.moveDocFolder,
          messageIds: [msg.body.mid],
          pendingMoveFolder: undefined,
        });
        return;
      }

      await Promise.all(toMove.map((d) => this.dbService.moveDocumentToFolder(d.id, targetFolderId)));
      await this.showFolderContents(ctx, state?.currentFolderId ?? null);
    } catch (error) {
      this.logger.error(`Create folder & move failed: ${(error as Error).message}`);
      await this.redisStateService.clearAllMessages(ctx, userId, triggeringId);
      const keyboard = Keyboard.inlineKeyboard([
        [Keyboard.button.callback("🏠 В начало", MenuPayload.menu)],
      ]);
      const msg = await ctx.reply(GENERIC_ERROR, { attachments: [keyboard] });
      await this.redisStateService.setUserState({
        userId,
        flow: UserFlow.menu,
        messageIds: [msg.body.mid],
      });
    }
  }

  // --- Upload Flow ---

  private validateAttachment(
    attachment: { type: string; payload?: { url?: string; photo_id?: number }; filename?: string },
  ): ValidatedAttachment | null {
    let filename: string;
    if (attachment.type === 'image') {
      const url = attachment.payload?.url ?? '';
      const urlExt = extname(url.split('?')[0]).toLowerCase() || '.jpg';
      const photoId = attachment.payload?.photo_id;
      filename = photoId ? `image_${photoId}${urlExt}` : `image_${Date.now()}${urlExt}`;
    } else if (attachment.type === 'file') {
      filename = (attachment as { filename?: string }).filename ?? 'document';
    } else {
      return null;
    }

    const ext = extname(filename).toLowerCase();
    const mimeType = EXT_TO_MIME[ext];
    if (!mimeType) return null;

    const fileUrl = attachment.payload?.url ?? '';
    if (!fileUrl) return null;

    return { filename, mimeType, fileUrl };
  }

  private async processOneFile(
    orgId: number,
    att: ValidatedAttachment,
    folderId: number | null,
  ): Promise<SingleFileResult> {
    let contentBase64: string;
    try {
      const response = await fetch(att.fileUrl);
      const buffer = Buffer.from(await response.arrayBuffer());
      contentBase64 = buffer.toString('base64');
    } catch (err) {
      this.logger.error(`File download failed for ${att.filename}: ${err}`);
      return { filename: att.filename, status: 'download_error' };
    }

    try {
      const result = await this.n8nApiService.upload({
        org_id: orgId,
        filename: att.filename,
        mime_type: att.mimeType,
        content_base64: contentBase64,
        folder_id: folderId,
      });

      if (!result?.chunk_count) {
        this.logger.warn(
          `Indexing returned no chunks for ${att.filename} (result: ${JSON.stringify(result)})`,
        );
        return { filename: att.filename, status: 'no_chunks' };
      }

      return {
        filename: att.filename,
        status: 'success',
        chunkCount: result.chunk_count,
        ocrPages: result.ocr_pages ?? 0,
        skippedPages: result.skipped_pages ?? 0,
        totalPages: result.total_pages ?? 0,
      };
    } catch (error) {
      this.logger.error(
        `Indexing failed for ${att.filename}: ${(error as Error).message}`,
      );
      return { filename: att.filename, status: 'index_error' };
    }
  }

  private buildBatchResultMessage(results: SingleFileResult[]): string {
    if (results.length === 1) {
      const r = results[0];
      switch (r.status) {
        case 'success': {
          let text = `✅ Документ «${r.filename}» проиндексирован!\nФрагментов: ${r.chunkCount}`;
          if ((r.ocrPages ?? 0) > 0) {
            text += `\n🔍 OCR-распознано: ${r.ocrPages} стр.`;
          }
          if ((r.skippedPages ?? 0) > 0) {
            text = `⚠️ Документ «${r.filename}» проиндексирован частично.\nФрагментов: ${r.chunkCount}\nOCR-распознано: ${r.ocrPages} стр.\nПропущено: ${r.skippedPages} из ${r.totalPages} стр.`;
          }
          return text;
        }
        case 'duplicate':
          return `⚠️ Документ «${r.filename}» уже загружен.\nДля повторной загрузки сначала удалите существующий документ.`;
        case 'unsupported':
          return `❌ Формат файла «${r.filename}» не поддерживается.\n\n<b>Документы:</b> PDF, DOCX, DOC, XLSX, PPTX, ODT, RTF, TXT, MD, CSV, JSON, HTML, XML\n<b>Изображения (OCR):</b> PNG, JPG, TIFF, BMP, WebP`;
        case 'download_error':
          return `❌ Не удалось скачать файл «${r.filename}». Попробуйте позже.`;
        case 'no_chunks':
        case 'index_error':
          return `❌ Ошибка при индексации документа «${r.filename}». Возможно, формат не поддерживается или файл повреждён.`;
      }
    }

    const lines: string[] = ['<b>📦 Результаты загрузки:</b>\n'];

    for (const r of results) {
      switch (r.status) {
        case 'success':
          if ((r.skippedPages ?? 0) > 0) {
            lines.push(`⚠️ ${r.filename} — частично (${r.chunkCount} фрагм., пропущено ${r.skippedPages} стр.)`);
          } else {
            lines.push(`✅ ${r.filename} — ${r.chunkCount} фрагм.${(r.ocrPages ?? 0) > 0 ? ` (OCR: ${r.ocrPages} стр.)` : ''}`);
          }
          break;
        case 'duplicate':
          lines.push(`⚠️ ${r.filename} — уже загружен`);
          break;
        case 'unsupported':
          lines.push(`❌ ${r.filename} — формат не поддерживается`);
          break;
        case 'download_error':
          lines.push(`❌ ${r.filename} — ошибка скачивания`);
          break;
        case 'no_chunks':
        case 'index_error':
          lines.push(`❌ ${r.filename} — ошибка индексации`);
          break;
      }
    }

    return lines.join('\n');
  }

  async handleFileUpload(ctx: Context): Promise<void> {
    const userId = ctx.user.user_id;
    const messageId = ctx.message?.body?.mid;

    const attachments = ctx.message?.body?.attachments ?? [];
    const fileAttachments = attachments.filter(
      (a) => a.type === 'file' || a.type === 'image',
    );
    if (!fileAttachments.length) return;

    // Валидация вложений текущего сообщения
    const validated: ValidatedAttachment[] = [];
    for (const att of fileAttachments) {
      const v = this.validateAttachment(att as { type: string; payload?: { url?: string; photo_id?: number }; filename?: string });
      if (v) validated.push(v);
    }

    const isCollecting = this.batchCollector.isCollecting(userId);

    // Только неподдерживаемые файлы и нет активного сбора → ошибка сразу
    if (!validated.length && !isCollecting) {
      const state = await this.redisStateService.getUserState(userId);
      const currentFolderId = state?.currentFolderId ?? null;
      const unsupportedResults: SingleFileResult[] = fileAttachments.map((a) => ({
        filename: (a as { filename?: string }).filename ?? 'file',
        status: 'unsupported' as const,
      }));
      await this.redisStateService.clearAllMessages(ctx, userId, messageId);
      const resultText = this.buildBatchResultMessage(unsupportedResults);
      const keyboard = Keyboard.inlineKeyboard([
        [Keyboard.button.callback("📋 Мои документы", KbPayload.listDocs)],
        [Keyboard.button.callback("🏠 В начало", MenuPayload.menu)],
      ]);
      const msg = await ctx.reply(resultText, { format: "html", attachments: [keyboard] });
      await this.redisStateService.setUserState({
        userId,
        flow: UserFlow.menu,
        messageIds: [msg.body.mid],
        currentFolderId,
      });
      return;
    }

    // Накапливаем файлы в state
    const state = await this.redisStateService.getUserState(userId);
    const batchFiles = [...(state?.batchFiles ?? []), ...validated];
    const batchUserMessageIds = [...(state?.batchUserMessageIds ?? [])];
    if (messageId) batchUserMessageIds.push(messageId);

    await this.redisStateService.setUserState({
      ...state!,
      userId,
      flow: UserFlow.collectingFiles,
      batchFiles,
      batchUserMessageIds,
    });

    // Запуск/перезапуск debounce через RxJS
    this.batchCollector.push(userId, ctx, (latestCtx) => {
      this.processBatch(latestCtx, userId).catch((err) =>
        this.logger.error(`Batch processing failed for user ${userId}: ${err}`),
      );
    });
  }

  private async processBatch(ctx: Context, userId: number): Promise<void> {
    const state = await this.redisStateService.getUserState(userId);
    if (!state) return;

    const batchFiles = state.batchFiles ?? [];
    const batchUserMessageIds = state.batchUserMessageIds ?? [];
    const currentFolderId = state.currentFolderId ?? null;

    if (!batchFiles.length) return;

    // Сразу очищаем batch-поля (свежий read чтобы не перезатереть файлы,
    // пришедшие между первым read и этим моментом)
    const freshState = await this.redisStateService.getUserState(userId);
    await this.redisStateService.setUserState({
      ...freshState!,
      flow: UserFlow.menu,
      messageIds: [],
      batchFiles: undefined,
      batchUserMessageIds: undefined,
    });

    // Удаляем ВСЕ сообщения: старые бота + пользовательские файловые
    const botMessageIds = state.messageIds ?? [];
    const allToDelete = new Set([...botMessageIds, ...batchUserMessageIds]);
    await Promise.allSettled(
      [...allToDelete].map((id) => ctx.api.deleteMessage(id)),
    );

    const org = await this.dbService.findOrCreateOrganization(userId);

    // Дедупликация имён внутри батча
    const nameCounts = new Map<string, number>();
    for (const att of batchFiles) {
      const count = nameCounts.get(att.filename) ?? 0;
      nameCounts.set(att.filename, count + 1);
      if (count > 0) {
        const ext = extname(att.filename);
        const base = att.filename.slice(0, -ext.length || undefined);
        att.filename = `${base}_${count + 1}${ext}`;
      }
    }

    // Проверка дубликатов в БД
    const toProcess: ValidatedAttachment[] = [];
    const duplicateResults: SingleFileResult[] = [];

    for (const att of batchFiles) {
      const existingDoc = await this.dbService.findDocumentByFilename(org.id, att.filename, currentFolderId);
      if (existingDoc) {
        duplicateResults.push({ filename: att.filename, status: 'duplicate' });
      } else {
        toProcess.push(att);
      }
    }

    if (!toProcess.length) {
      const resultText = this.buildBatchResultMessage(duplicateResults);
      const keyboard = Keyboard.inlineKeyboard([
        [Keyboard.button.callback("📋 Мои документы", KbPayload.listDocs)],
        [Keyboard.button.callback("🏠 В начало", MenuPayload.menu)],
      ]);
      const msg = await ctx.reply(resultText, { format: "html", attachments: [keyboard] });
      await this.redisStateService.setUserState({
        userId,
        flow: UserFlow.menu,
        messageIds: [msg.body.mid],
        currentFolderId,
      });
      return;
    }

    // Фото → диалог подтверждения
    const hasPhotoAttachments = toProcess.some((a) => a.mimeType.startsWith('image/'));
    if (hasPhotoAttachments) {
      const photoNames = toProcess
        .filter((a) => a.mimeType.startsWith('image/'))
        .map((a) => `  • ${a.filename}`)
        .join('\n');

      let warningText = `⚠️ Изображения, отправленные через «Фото и видео», будут обработаны с системными названиями:\n${photoNames}\n\nЧтобы сохранить оригинальные имена, отправьте через 📎 «Файл».`;

      if (duplicateResults.length) {
        const dupNames = duplicateResults.map((d) => d.filename).join(', ');
        warningText += `\n\n⚠️ Пропущены дубликаты: ${dupNames}`;
      }

      const keyboard = Keyboard.inlineKeyboard([
        [
          Keyboard.button.callback("✅ Продолжить", KbPayload.confirmPhotoUpload),
          Keyboard.button.callback("❌ Отмена", KbPayload.cancelAction),
        ],
      ]);
      const msg = await ctx.reply(warningText, { format: "html", attachments: [keyboard] });

      await this.redisStateService.setUserState({
        userId,
        flow: UserFlow.menu,
        messageIds: [msg.body.mid],
        currentFolderId,
        pendingAttachments: toProcess,
      });
      return;
    }

    // Только файлы → executeUpload
    await this.executeUpload(ctx, userId, org.id, toProcess, duplicateResults, [], currentFolderId);
  }

  async flushBatch(userId: number): Promise<void> {
    await this.batchCollector.flush(userId);
  }

  private async executeUpload(
    ctx: Context,
    userId: number,
    orgId: number,
    toProcess: ValidatedAttachment[],
    duplicateResults: SingleFileResult[],
    unsupportedResults: SingleFileResult[],
    currentFolderId: number | null,
  ): Promise<void> {
    // --- Status message ---
    let statusText: string;
    if (toProcess.length === 1) {
      statusText = `⏳ Документ «${toProcess[0].filename}» загружен. Индексация...`;
    } else {
      const fileList = toProcess.map((a) => `  • ${a.filename}`).join('\n');
      statusText = `⏳ Обрабатываю ${toProcess.length} файлов:\n${fileList}\n\nОбработка 1/${toProcess.length}...`;
    }

    const statusMsg = await ctx.reply(statusText);
    const statusMid = statusMsg.body.mid;
    await this.redisStateService.setUserState({
      userId,
      flow: UserFlow.menu,
      messageIds: [statusMid],
      currentFolderId,
    });

    // --- Process in chunks of UPLOAD_CONCURRENCY ---
    const UPLOAD_CONCURRENCY = 3;
    const processResults: SingleFileResult[] = [];

    for (let i = 0; i < toProcess.length; i += UPLOAD_CONCURRENCY) {
      const chunk = toProcess.slice(i, i + UPLOAD_CONCURRENCY);

      if (toProcess.length > 1 && i > 0) {
        const progressText = `⏳ Загрузка файлов (${toProcess.length}):\n${toProcess.map((a) => `  • ${a.filename}`).join('\n')}\n\nОбработка ${i + 1}–${Math.min(i + UPLOAD_CONCURRENCY, toProcess.length)}/${toProcess.length}...`;
        await ctx.api.editMessage(statusMid, { text: progressText }).catch(() => {});
      }

      const chunkResults = await Promise.all(
        chunk.map((att) => this.processOneFile(orgId, att, currentFolderId)),
      );
      processResults.push(...chunkResults);
    }

    // --- Final message ---
    await this.redisStateService.clearAllMessages(ctx, userId);

    const allResults = [...processResults, ...duplicateResults, ...unsupportedResults];
    const resultText = this.buildBatchResultMessage(allResults);

    const keyboard = Keyboard.inlineKeyboard([
      [Keyboard.button.callback("📋 Мои документы", KbPayload.listDocs)],
      [Keyboard.button.callback("🏠 В начало", MenuPayload.menu)],
    ]);
    const msg = await ctx.reply(resultText, { format: "html", attachments: [keyboard] });

    await this.redisStateService.setUserState({
      userId,
      flow: UserFlow.menu,
      messageIds: [msg.body.mid],
      currentFolderId,
    });
  }

  async processConfirmedUpload(ctx: Context): Promise<void> {
    const userId = ctx.user.user_id;
    const triggeringId = ctx.messageId ?? ctx.message?.body?.mid;

    const state = await this.redisStateService.getUserState(userId);
    const pendingAttachments = state?.pendingAttachments;

    if (!pendingAttachments?.length) {
      await this.showFolderContents(ctx, state?.currentFolderId ?? null);
      return;
    }

    const org = await this.dbService.findOrCreateOrganization(userId);
    const currentFolderId = state?.currentFolderId ?? null;

    await this.redisStateService.clearAllMessages(ctx, userId, triggeringId);

    // Очищаем pendingAttachments из стейта
    await this.redisStateService.setUserState({
      userId,
      flow: UserFlow.menu,
      currentFolderId,
      pendingAttachments: undefined,
    });

    await this.executeUpload(ctx, userId, org.id, pendingAttachments, [], [], currentFolderId);
  }

  // --- Q&A Flow ---

  async handleQuestion(ctx: Context): Promise<void> {
    const userId = ctx.user.user_id;
    const triggeringId = ctx.message?.body?.mid;
    const question = ctx.message?.body?.text ?? "";

    if (!question.trim()) {
      return;
    }

    const org = await this.dbService.findOrCreateOrganization(userId);

    const totalDocs = await this.dbService.getTotalDocCount(org.id);
    if (totalDocs === 0) {
      await this.redisStateService.clearAllMessages(ctx, userId, triggeringId);
      const keyboard = Keyboard.inlineKeyboard([
        [Keyboard.button.callback("🏠 В начало", MenuPayload.menu)],
      ]);
      const msg = await ctx.reply(
        "📭 У вас пока нет загруженных документов.\nЗагрузите документы, чтобы задавать вопросы.",
        { attachments: [keyboard] },
      );
      await this.redisStateService.setUserState({
        userId,
        flow: UserFlow.menu,
        messageIds: [msg.body.mid],
      });
      return;
    }

    await this.redisStateService.clearAllMessages(ctx, userId, triggeringId);
    const statusMsg = await ctx.reply("🔍 Ищу ответ...");
    await this.redisStateService.setUserState({
      userId,
      flow: UserFlow.menu,
      messageIds: [statusMsg.body.mid],
    });

    try {
      const folderStructure = await this.dbService.buildFolderStructureText(org.id);
      const result = await this.n8nApiService.askQuestion({
        org_id: org.id,
        user_max_id: userId,
        question,
        folder_structure: folderStructure,
      });

      const answer = result?.answer ?? "Не удалось получить ответ.";
      let responseText = `📚 <b>Ответ:</b>\n${answer}`;

      if (result.sources?.length) {
        const sourcesText = result.sources
          .map((s, i) => `${i + 1}. ${s.filename}`)
          .join("\n");
        responseText += `\n\n<i>Источники:</i>\n${sourcesText}`;
      }

      await this.redisStateService.clearAllMessages(ctx, userId);

      const keyboard = Keyboard.inlineKeyboard([
        [Keyboard.button.callback("📋 Мои документы", KbPayload.listDocs)],
        [Keyboard.button.callback("🏠 В начало", MenuPayload.menu)],
      ]);

      const msg = await ctx.reply(responseText, {
        format: "html",
        attachments: [keyboard],
      });
      await this.redisStateService.setUserState({
        userId,
        flow: UserFlow.menu,
        messageIds: [msg.body.mid],
      });
    } catch (error) {
      this.logger.error(`Question failed: ${(error as Error).message}`);
      await this.redisStateService.clearAllMessages(ctx, userId);

      const keyboard = Keyboard.inlineKeyboard([
        [Keyboard.button.callback("🏠 В начало", MenuPayload.menu)],
      ]);
      const msg = await ctx.reply(GENERIC_ERROR, { attachments: [keyboard] });
      await this.redisStateService.setUserState({
        userId,
        flow: UserFlow.menu,
        messageIds: [msg.body.mid],
      });
    }
  }

  // --- Document List (legacy, redirects to folder view) ---

  async showDocumentList(ctx: Context, page = 0): Promise<void> {
    return this.showFolderContents(ctx, null, page);
  }
}
