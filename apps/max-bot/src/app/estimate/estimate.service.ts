import { Injectable, Logger } from '@nestjs/common';
import { Context, Keyboard } from '@maxhub/max-bot-api';
import { RedisStateService } from '../shared/services/redis-state.service';
import { DbService } from '../shared/services/db.service';
import { N8nApiService } from '../shared/services/n8n-api.service';
import { UserFlow, UserSessionState } from '../shared/types/user-state.types';
import { MenuPayload } from '../menu/menu.types';
import {
  EstimatePayload,
  EstimateStep,
  EstimateFlowData,
  EstimateParameters,
} from './estimate.types';

const ESTIMATE_STATUS_EMOJI: Record<string, string> = {
  pending: '\u23F3',
  generating: '\uD83D\uDD04',
  ready: '\u2705',
  error: '\u274C',
};

@Injectable()
export class EstimateService {
  private readonly logger = new Logger(EstimateService.name);

  constructor(
    private readonly redisStateService: RedisStateService,
    private readonly dbService: DbService,
    private readonly n8nApiService: N8nApiService,
  ) {}

  async showEstimateMenu(ctx: Context): Promise<void> {
    const userId = ctx.user.user_id;
    const keyboard = Keyboard.inlineKeyboard([
      [Keyboard.button.callback('\uD83D\uDCCB \u041C\u043E\u0438 \u0441\u043C\u0435\u0442\u044B', EstimatePayload.listEstimates)],
      [Keyboard.button.callback('\uD83C\uDFE0 \u0412 \u043D\u0430\u0447\u0430\u043B\u043E', MenuPayload.menu)],
    ]);

    const message = await ctx.reply(
      '<b>\uD83E\uDDEE \u0421\u043E\u0437\u0434\u0430\u043D\u0438\u0435 \u0441\u043C\u0435\u0442\u044B</b>\n\u041E\u043F\u0438\u0448\u0438\u0442\u0435 \u0432\u0438\u0434\u044B \u0440\u0430\u0431\u043E\u0442 \u0447\u0435\u0440\u0435\u0437 \u0437\u0430\u043F\u044F\u0442\u0443\u044E, \u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440:\n<i>\u0441\u0442\u044F\u0436\u043A\u0430 \u043F\u043E\u043B\u0430, \u0448\u0442\u0443\u043A\u0430\u0442\u0443\u0440\u043A\u0430 \u0441\u0442\u0435\u043D, \u043F\u043E\u043A\u0440\u0430\u0441\u043A\u0430 \u043F\u043E\u0442\u043E\u043B\u043A\u0430</i>',
      { format: 'html', attachments: [keyboard] },
    );

    await this.redisStateService.setUserState({
      userId,
      flow: UserFlow.estimate,
      flowData: { step: EstimateStep.awaitingWorkTypes },
      messageIds: [message.body.mid],
    });

    const { messageId } = ctx;
    if (messageId) await ctx.api.deleteMessage(messageId);
  }

  async handleWorkTypeInput(ctx: Context, state: UserSessionState<EstimateFlowData>): Promise<void> {
    const userId = ctx.user.user_id;
    const text = ctx.message?.body?.text ?? '';

    if (!text.trim()) {
      await ctx.reply('\u041F\u043E\u0436\u0430\u043B\u0443\u0439\u0441\u0442\u0430, \u0432\u0432\u0435\u0434\u0438\u0442\u0435 \u0432\u0438\u0434\u044B \u0440\u0430\u0431\u043E\u0442 \u0447\u0435\u0440\u0435\u0437 \u0437\u0430\u043F\u044F\u0442\u0443\u044E.');
      return;
    }

    const workTypes = text.split(',').map((s) => s.trim()).filter(Boolean);

    if (!workTypes.length) {
      await ctx.reply('\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0440\u0430\u0441\u043F\u043E\u0437\u043D\u0430\u0442\u044C \u0432\u0438\u0434\u044B \u0440\u0430\u0431\u043E\u0442. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0441\u043D\u043E\u0432\u0430.');
      return;
    }

    const keyboard = Keyboard.inlineKeyboard([
      [Keyboard.button.callback('\uD83C\uDFE0 \u0412 \u043D\u0430\u0447\u0430\u043B\u043E', MenuPayload.menu)],
    ]);

    const workList = workTypes.map((w, i) => `${i + 1}. ${w}`).join('\n');
    const message = await ctx.reply(
      `<b>\u0412\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0435 \u0440\u0430\u0431\u043E\u0442\u044B:</b>\n${workList}\n\n<b>\u0422\u0435\u043F\u0435\u0440\u044C \u0443\u043A\u0430\u0436\u0438\u0442\u0435 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u044B \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F:</b>\n<i>\u041F\u043B\u043E\u0449\u0430\u0434\u044C: 50\n\u0412\u044B\u0441\u043E\u0442\u0430: 2.7\n\u041A\u043E\u043C\u043D\u0430\u0442: 3</i>\n\n\u0418\u043B\u0438 \u0432 \u0441\u0432\u043E\u0431\u043E\u0434\u043D\u043E\u0439 \u0444\u043E\u0440\u043C\u0435, \u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440: <i>50 \u043C\u00B2, \u0432\u044B\u0441\u043E\u0442\u0430 2.7, 3 \u043A\u043E\u043C\u043D\u0430\u0442\u044B</i>`,
      { format: 'html', attachments: [keyboard] },
    );

    await this.redisStateService.setUserState({
      userId,
      flow: UserFlow.estimate,
      flowData: { step: EstimateStep.awaitingParameters, workTypes },
      messageIds: [message.body.mid],
    });
  }

  async handleParametersInput(ctx: Context, state: UserSessionState<EstimateFlowData>): Promise<void> {
    const userId = ctx.user.user_id;
    const text = ctx.message?.body?.text ?? '';

    if (!text.trim()) {
      await ctx.reply('\u041F\u043E\u0436\u0430\u043B\u0443\u0439\u0441\u0442\u0430, \u0432\u0432\u0435\u0434\u0438\u0442\u0435 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u044B \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F.');
      return;
    }

    const parameters = this.parseParameters(text);

    if (!parameters.roomArea) {
      await ctx.reply('\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0440\u0430\u0441\u043F\u043E\u0437\u043D\u0430\u0442\u044C \u043F\u043B\u043E\u0449\u0430\u0434\u044C. \u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u0445\u043E\u0442\u044F \u0431\u044B \u043F\u043B\u043E\u0449\u0430\u0434\u044C, \u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440: <i>\u041F\u043B\u043E\u0449\u0430\u0434\u044C: 50</i>', {
        format: 'html',
      });
      return;
    }

    const workTypes = state.flowData?.workTypes ?? [];
    const workList = workTypes.map((w, i) => `${i + 1}. ${w}`).join('\n');

    const paramLines: string[] = [];
    paramLines.push(`\u041F\u043B\u043E\u0449\u0430\u0434\u044C: ${parameters.roomArea} \u043C\u00B2`);
    if (parameters.roomHeight) paramLines.push(`\u0412\u044B\u0441\u043E\u0442\u0430: ${parameters.roomHeight} \u043C`);
    if (parameters.roomCount) paramLines.push(`\u041A\u043E\u043C\u043D\u0430\u0442: ${parameters.roomCount}`);
    if (parameters.additionalNotes) paramLines.push(`\u041F\u0440\u0438\u043C\u0435\u0447\u0430\u043D\u0438\u0435: ${parameters.additionalNotes}`);

    const keyboard = Keyboard.inlineKeyboard([
      [Keyboard.button.callback('\u2705 \u0421\u0433\u0435\u043D\u0435\u0440\u0438\u0440\u043E\u0432\u0430\u0442\u044C', EstimatePayload.generateEstimate)],
      [Keyboard.button.callback('\u270F\uFE0F \u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u0440\u0430\u0431\u043E\u0442\u044B', EstimatePayload.editWorkTypes)],
      [Keyboard.button.callback('\u270F\uFE0F \u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u044B', EstimatePayload.editParameters)],
      [Keyboard.button.callback('\uD83C\uDFE0 \u0412 \u043D\u0430\u0447\u0430\u043B\u043E', MenuPayload.menu)],
    ]);

    const message = await ctx.reply(
      `<b>\uD83D\uDCCB \u0421\u0432\u043E\u0434\u043A\u0430 \u0441\u043C\u0435\u0442\u044B:</b>\n\n<b>\u0420\u0430\u0431\u043E\u0442\u044B:</b>\n${workList}\n\n<b>\u041F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u044B:</b>\n${paramLines.join('\n')}`,
      { format: 'html', attachments: [keyboard] },
    );

    await this.redisStateService.setUserState({
      userId,
      flow: UserFlow.estimate,
      flowData: {
        step: EstimateStep.confirming,
        workTypes,
        parameters,
      },
      messageIds: [message.body.mid],
    });
  }

  async generateEstimate(ctx: Context): Promise<void> {
    const userId = ctx.user.user_id;
    const state = await this.redisStateService.getUserState<EstimateFlowData>(userId);
    const flowData = state?.flowData;

    if (!flowData?.workTypes?.length || !flowData?.parameters?.roomArea) {
      await ctx.reply('\u274C \u041D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E \u0434\u0430\u043D\u043D\u044B\u0445 \u0434\u043B\u044F \u0433\u0435\u043D\u0435\u0440\u0430\u0446\u0438\u0438 \u0441\u043C\u0435\u0442\u044B.');
      return;
    }

    const org = await this.dbService.findOrCreateOrganization(userId);

    await ctx.reply('\u23F3 \u0413\u0435\u043D\u0435\u0440\u0438\u0440\u0443\u044E \u0441\u043C\u0435\u0442\u0443...');

    try {
      const result = await this.n8nApiService.generateEstimate({
        org_id: org.id,
        user_max_id: userId,
        work_types: flowData.workTypes,
        parameters: flowData.parameters,
      });

      const itemLines = result.items.map((item, i) => {
        const materialsText = item.materials
          .map((m) => `   \u2022 ${m.name}: ${m.quantity} ${m.unit}`)
          .join('\n');
        return `${i + 1}. <b>${item.work_type}</b> \u2014 ${this.formatCost(item.total_cost)} \u20BD\n${materialsText}`;
      });

      const responseText = [
        `<b>\u2705 \u0421\u043C\u0435\u0442\u0430 \u0433\u043E\u0442\u043E\u0432\u0430!</b>\n`,
        `<b>\uD83D\uDCCA \u0420\u0430\u0431\u043E\u0442\u044B:</b>`,
        itemLines.join('\n\n'),
        `\n<b>\uD83D\uDCB0 \u0418\u0442\u043E\u0433\u043E: ${this.formatCost(result.total_cost)} \u20BD</b>`,
      ].join('\n');

      const keyboard = Keyboard.inlineKeyboard([
        [Keyboard.button.callback('\uD83D\uDCE4 \u042D\u043A\u0441\u043F\u043E\u0440\u0442 \u0432 Google Sheets', EstimatePayload.exportEstimate)],
        [Keyboard.button.callback('\uD83E\uDDEE \u041D\u043E\u0432\u0430\u044F \u0441\u043C\u0435\u0442\u0430', EstimatePayload.startEstimate)],
        [Keyboard.button.callback('\uD83D\uDCCB \u041C\u043E\u0438 \u0441\u043C\u0435\u0442\u044B', EstimatePayload.listEstimates)],
        [Keyboard.button.callback('\uD83C\uDFE0 \u0412 \u043D\u0430\u0447\u0430\u043B\u043E', MenuPayload.menu)],
      ]);

      await ctx.reply(responseText, { format: 'html', attachments: [keyboard] });

      await this.redisStateService.setUserState({
        userId,
        flow: UserFlow.estimate,
        flowData: { step: EstimateStep.confirming, estimateId: result.estimate_id },
      });
    } catch (error) {
      const keyboard = Keyboard.inlineKeyboard([
        [Keyboard.button.callback('\uD83D\uDD04 \u041F\u043E\u043F\u0440\u043E\u0431\u043E\u0432\u0430\u0442\u044C \u0441\u043D\u043E\u0432\u0430', EstimatePayload.generateEstimate)],
        [Keyboard.button.callback('\uD83C\uDFE0 \u0412 \u043D\u0430\u0447\u0430\u043B\u043E', MenuPayload.menu)],
      ]);
      await ctx.reply(`\u274C \u041E\u0448\u0438\u0431\u043A\u0430 \u0433\u0435\u043D\u0435\u0440\u0430\u0446\u0438\u0438: ${(error as Error).message}`, {
        attachments: [keyboard],
      });
      await this.redisStateService.setUserState({ userId, flow: UserFlow.menu });
    }

    const { messageId } = ctx;
    if (messageId) await ctx.api.deleteMessage(messageId);
  }

  async exportEstimate(ctx: Context): Promise<void> {
    const userId = ctx.user.user_id;
    const state = await this.redisStateService.getUserState<EstimateFlowData>(userId);
    const estimateId = state?.flowData?.estimateId;

    if (!estimateId) {
      await ctx.reply('\u274C \u0421\u043C\u0435\u0442\u0430 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430. \u0421\u043E\u0437\u0434\u0430\u0439\u0442\u0435 \u043D\u043E\u0432\u0443\u044E.');
      return;
    }

    const org = await this.dbService.findOrCreateOrganization(userId);

    await ctx.reply('\u23F3 \u042D\u043A\u0441\u043F\u043E\u0440\u0442\u0438\u0440\u0443\u044E \u0432 Google Sheets...');

    try {
      const result = await this.n8nApiService.exportEstimate({
        org_id: org.id,
        estimate_id: estimateId,
      });

      const keyboard = Keyboard.inlineKeyboard([
        [Keyboard.button.callback('\uD83E\uDDEE \u041D\u043E\u0432\u0430\u044F \u0441\u043C\u0435\u0442\u0430', EstimatePayload.startEstimate)],
        [Keyboard.button.callback('\uD83C\uDFE0 \u0412 \u043D\u0430\u0447\u0430\u043B\u043E', MenuPayload.menu)],
      ]);

      await ctx.reply(
        `\u2705 \u0421\u043C\u0435\u0442\u0430 \u044D\u043A\u0441\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0430!\n\uD83D\uDD17 <a href="${result.sheet_url}">\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0432 Google Sheets</a>`,
        { format: 'html', attachments: [keyboard] },
      );
    } catch (error) {
      const keyboard = Keyboard.inlineKeyboard([
        [Keyboard.button.callback('\uD83C\uDFE0 \u0412 \u043D\u0430\u0447\u0430\u043B\u043E', MenuPayload.menu)],
      ]);
      await ctx.reply(`\u274C \u041E\u0448\u0438\u0431\u043A\u0430 \u044D\u043A\u0441\u043F\u043E\u0440\u0442\u0430: ${(error as Error).message}`, {
        attachments: [keyboard],
      });
    }

    const { messageId } = ctx;
    if (messageId) await ctx.api.deleteMessage(messageId);
  }

  async showEstimateList(ctx: Context): Promise<void> {
    const userId = ctx.user.user_id;
    const org = await this.dbService.findOrCreateOrganization(userId);

    try {
      const result = await this.n8nApiService.listEstimates({
        org_id: org.id,
      });

      const estimates = result.estimates ?? [];
      let text: string;

      if (!estimates.length) {
        text = '<b>\uD83D\uDCCB \u041C\u043E\u0438 \u0441\u043C\u0435\u0442\u044B</b>\n\n\u0423 \u0432\u0430\u0441 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442 \u0441\u043C\u0435\u0442.';
      } else {
        const lines = estimates.map((e, i) => {
          const emoji = ESTIMATE_STATUS_EMOJI[e.status] ?? '\u2753';
          const cost = e.total_cost ? ` \u2014 ${this.formatCost(e.total_cost)} \u20BD` : '';
          return `${i + 1}. ${emoji} <b>${e.title}</b>${cost}`;
        });
        text = `<b>\uD83D\uDCCB \u041C\u043E\u0438 \u0441\u043C\u0435\u0442\u044B (${estimates.length}):</b>\n\n${lines.join('\n')}`;
      }

      const keyboard = Keyboard.inlineKeyboard([
        [Keyboard.button.callback('\uD83E\uDDEE \u041D\u043E\u0432\u0430\u044F \u0441\u043C\u0435\u0442\u0430', EstimatePayload.startEstimate)],
        [Keyboard.button.callback('\uD83C\uDFE0 \u0412 \u043D\u0430\u0447\u0430\u043B\u043E', MenuPayload.menu)],
      ]);

      await ctx.reply(text, { format: 'html', attachments: [keyboard] });
    } catch (error) {
      await ctx.reply(`\u274C \u041E\u0448\u0438\u0431\u043A\u0430: ${(error as Error).message}`);
    }

    const { messageId } = ctx;
    if (messageId) await ctx.api.deleteMessage(messageId);
  }

  private parseParameters(text: string): EstimateParameters {
    const params: EstimateParameters = {};

    const areaMatch = text.match(/(?:\u043F\u043B\u043E\u0449\u0430\u0434\u044C|S)\s*[:\-=]?\s*([\d.,]+)/i)
      ?? text.match(/([\d.,]+)\s*(?:\u043C\u00B2|\u043C2|\u043A\u0432\.?\s*\u043C)/i)
      ?? text.match(/^([\d.,]+)$/m);
    if (areaMatch) {
      params.roomArea = parseFloat(areaMatch[1].replace(',', '.'));
    }

    const heightMatch = text.match(/(?:\u0432\u044B\u0441\u043E\u0442\u0430|H|h)\s*[:\-=]?\s*([\d.,]+)/i);
    if (heightMatch) {
      params.roomHeight = parseFloat(heightMatch[1].replace(',', '.'));
    }

    const roomMatch = text.match(/(?:\u043A\u043E\u043C\u043D\u0430\u0442|\u043A\u043E\u043C\u043D\.?)\s*[:\-=]?\s*(\d+)/i)
      ?? text.match(/(\d+)\s*(?:\u043A\u043E\u043C\u043D)/i);
    if (roomMatch) {
      params.roomCount = parseInt(roomMatch[1], 10);
    }

    return params;
  }

  private formatCost(value: number): string {
    return new Intl.NumberFormat('ru-RU').format(value);
  }
}
