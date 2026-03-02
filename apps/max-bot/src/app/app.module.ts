import { Module } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { HttpModule, HttpModuleOptions } from "@nestjs/axios";
import { ConfigModule, ConfigService } from "@nestjs/config";
import Joi from "joi";
import { RedisModule } from "@nestjs-modules/ioredis";
import { ClsModule } from "nestjs-cls";
import * as https from "https";

import { MenuModule } from "./menu/menu.module";
import { KnowledgeBaseModule } from "./knowledge-base/knowledge-base.module";
import { MaxModule, MaxModuleOptions } from "nestjs-max";
import { BotContextInterceptor } from "./common/interceptors/bot-context.interceptor";
import { BotExceptionFilter } from "./common/filters/bot-exception-filter";
import { CommonModule } from "./common/common.module";

@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: false,
      },
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        BOT_TOKEN: Joi.string().required(),
        REDIS_HOST: Joi.string().optional().default("redis"),
        N8N_WEBHOOK_BASE_URL: Joi.string()
          .optional()
          .default("http://n8n:5678/webhook"),
        DATABASE_URL: Joi.string().required(),
      }),
    }),
    HttpModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): HttpModuleOptions => {
        const allowInsecure =
          configService.get<string>("NODE_ENV") !== "production";
        return {
          httpsAgent: allowInsecure
            ? new https.Agent({ rejectUnauthorized: false })
            : undefined,
          timeout: 60000,
        };
      },
    }),
    RedisModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (
        configService: ConfigService,
      ): { type: "single"; url: string } => {
        const host = configService.get<string>("REDIS_HOST");
        const port = configService.get("REDIS_PORT");
        console.log(host);
        return { type: "single", url: `redis://${host}:${port}` };
      },
    }),
    MaxModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService): MaxModuleOptions => ({
        token: configService.get<string>("BOT_TOKEN", ""),
      }),
    }),
    MenuModule,
    KnowledgeBaseModule,
    CommonModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: BotContextInterceptor,
    },
    { provide: APP_FILTER, useClass: BotExceptionFilter },
  ],
  exports: [HttpModule],
})
export class AppModule {}
