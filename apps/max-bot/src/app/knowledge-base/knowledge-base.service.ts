import { Injectable, Logger } from '@nestjs/common';
import { Context, Keyboard } from '@maxhub/max-bot-api';
import { RedisStateService } from '../shared/services/redis-state.service';
import { DbService } from '../shared/services/db.service';
import { N8nApiService } from '../shared/services/n8n-api.service';
import { UserFlow } from '../shared/types/user-state.types';
import { MenuPayload } from '../menu/menu.types';
import { KbPayload, UploadStep, QuestionStep } from './knowledge-base.types';
import { extname } from 'path';

const STATUS_EMOJI: Record<string, string> = {
  pending: '⏳',
  indexing: '🔄',
  ready: '✅',
  error: '❌',
};

const EXT_TO_MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

@Injectable()
export class KnowledgeBaseService {
  private readonly logger = new Logger(KnowledgeBaseService.name);

  constructor(
    private readonly redisStateService: RedisStateService,
    private readonly dbService: DbService,
    private readonly n8nApiService: N8nApiService,
  ) {}

  // --- Upload Flow ---

  async showUploadPrompt(ctx: Context): Promise<void> {
    const userId = ctx.user.user_id;
    const keyboard = Keyboard.inlineKeyboard([
      [Keyboard.button.callback('🏠 В начало', MenuPayload.menu)],
    ]);

    const message = await ctx.reply(
      '<b>📄 Загрузка документа</b>\nОтправьте файл (PDF, DOCX или XLSX). Максимум 20 МБ.',
      { format: 'html', attachments: [keyboard] },
    );

    await this.redisStateService.setUserState({
      userId,
      flow: UserFlow.upload,
      flowData: { step: UploadStep.awaitingFile },
      messageIds: [message.body.mid],
    });

    const { messageId } = ctx;
    if (messageId) await ctx.api.deleteMessage(messageId);
  }

  async handleFileUpload(ctx: Context): Promise<void> {
    const userId = ctx.user.user_id;
    const org = await this.dbService.findOrCreateOrganization(userId);

    const attachment = ctx.message?.body?.attachments?.[0];
    if (!attachment || attachment.type !== 'file') {
      await ctx.reply('Пожалуйста, отправьте файл документа (PDF, DOCX или XLSX).');
      return;
    }

    // FileAttachment: { type: 'file', payload: { url, token }, filename, size }
    const filename = (attachment as { filename?: string }).filename ?? 'document';
    const ext = extname(filename).toLowerCase();
    const mimeType = EXT_TO_MIME[ext];

    if (!mimeType) {
      const keyboard = Keyboard.inlineKeyboard([
        [Keyboard.button.callback('🔄 Попробовать снова', KbPayload.startUpload)],
        [Keyboard.button.callback('🏠 В начало', MenuPayload.menu)],
      ]);
      await ctx.reply('❌ Формат не поддерживается. Отправьте PDF, DOCX или XLSX.', {
        attachments: [keyboard],
      });
      return;
    }

    const fileUrl = attachment.payload.url;
    let contentBase64: string;
    try {
      const response = await fetch(fileUrl);
      const buffer = Buffer.from(await response.arrayBuffer());
      contentBase64 = buffer.toString('base64');
    } catch (err) {
      this.logger.error(`File download failed: ${err}`);
      await ctx.reply('❌ Не удалось скачать файл. Попробуйте снова.');
      return;
    }

    await ctx.reply(`⏳ Документ «${filename}» загружен. Индексация...`);

    try {
      const result = await this.n8nApiService.upload({
        org_id: org.id,
        filename,
        mime_type: mimeType,
        content_base64: contentBase64,
      });

      const keyboard = Keyboard.inlineKeyboard([
        [Keyboard.button.callback('📄 Загрузить ещё', KbPayload.startUpload)],
        [Keyboard.button.callback('❓ Задать вопрос', KbPayload.startQuestion)],
        [Keyboard.button.callback('🏠 В начало', MenuPayload.menu)],
      ]);

      await ctx.reply(
        `✅ Документ «${filename}» проиндексирован!\nФрагментов: ${result.chunk_count}`,
        { attachments: [keyboard] },
      );
    } catch (error) {
      const keyboard = Keyboard.inlineKeyboard([
        [Keyboard.button.callback('🔄 Попробовать снова', KbPayload.startUpload)],
        [Keyboard.button.callback('🏠 В начало', MenuPayload.menu)],
      ]);
      await ctx.reply(`❌ Ошибка индексации: ${(error as Error).message}`, {
        attachments: [keyboard],
      });
    }

    await this.redisStateService.setUserState({ userId, flow: UserFlow.menu });
  }

  // --- Q&A Flow ---

  async showQuestionPrompt(ctx: Context): Promise<void> {
    const userId = ctx.user.user_id;
    const keyboard = Keyboard.inlineKeyboard([
      [Keyboard.button.callback('🏠 В начало', MenuPayload.menu)],
    ]);

    const message = await ctx.reply(
      '<b>❓ Задать вопрос</b>\nНапишите ваш вопрос по загруженным документам:',
      { format: 'html', attachments: [keyboard] },
    );

    await this.redisStateService.setUserState({
      userId,
      flow: UserFlow.question,
      flowData: { step: QuestionStep.awaitingQuestion },
      messageIds: [message.body.mid],
    });

    const { messageId } = ctx;
    if (messageId) await ctx.api.deleteMessage(messageId);
  }

  async handleQuestion(ctx: Context): Promise<void> {
    const userId = ctx.user.user_id;
    const question = ctx.message?.body?.text ?? '';

    if (!question.trim()) {
      await ctx.reply('Пожалуйста, введите текст вопроса.');
      return;
    }

    const org = await this.dbService.findOrCreateOrganization(userId);
    await ctx.reply('🔍 Ищу ответ...');

    try {
      const result = await this.n8nApiService.askQuestion({
        org_id: org.id,
        user_max_id: userId,
        question,
      });

      let responseText = `📚 <b>Ответ:</b>\n${result.answer}`;

      if (result.sources?.length) {
        const sourcesText = result.sources
          .map((s, i) => `${i + 1}. ${s.filename}`)
          .join('\n');
        responseText += `\n\n<i>Источники:</i>\n${sourcesText}`;
      }

      const keyboard = Keyboard.inlineKeyboard([
        [Keyboard.button.callback('❓ Новый вопрос', KbPayload.startQuestion)],
        [Keyboard.button.callback('🏠 В начало', MenuPayload.menu)],
      ]);

      await ctx.reply(responseText, { format: 'html', attachments: [keyboard] });
    } catch (error) {
      const keyboard = Keyboard.inlineKeyboard([
        [Keyboard.button.callback('🔄 Попробовать снова', KbPayload.startQuestion)],
        [Keyboard.button.callback('🏠 В начало', MenuPayload.menu)],
      ]);
      await ctx.reply(`❌ Ошибка: ${(error as Error).message}`, { attachments: [keyboard] });
    }

    await this.redisStateService.setUserState({ userId, flow: UserFlow.menu });
  }

  // --- Document Management ---

  async showDocumentList(ctx: Context): Promise<void> {
    const userId = ctx.user.user_id;
    const org = await this.dbService.findOrCreateOrganization(userId);

    try {
      const result = await this.n8nApiService.manageDocs({
        action: 'list',
        org_id: org.id,
      });

      const docs = result.documents ?? [];
      let text: string;

      if (!docs.length) {
        text = '<b>📋 Мои документы</b>\n\nУ вас пока нет загруженных документов.';
      } else {
        const lines = docs.map((d, i) => {
          const emoji = STATUS_EMOJI[d.status] ?? '❓';
          return `${i + 1}. ${emoji} <b>${d.filename}</b> (${d.chunk_count} фрагм.)`;
        });
        text = `<b>📋 Мои документы (${docs.length}):</b>\n\n${lines.join('\n')}`;
      }

      const keyboard = Keyboard.inlineKeyboard([
        [Keyboard.button.callback('📄 Загрузить документ', KbPayload.startUpload)],
        [Keyboard.button.callback('❓ Задать вопрос', KbPayload.startQuestion)],
        [Keyboard.button.callback('🏠 В начало', MenuPayload.menu)],
      ]);

      await ctx.reply(text, { format: 'html', attachments: [keyboard] });
    } catch (error) {
      await ctx.reply(`❌ Ошибка: ${(error as Error).message}`);
    }

    const { messageId } = ctx;
    if (messageId) await ctx.api.deleteMessage(messageId);
  }
}
