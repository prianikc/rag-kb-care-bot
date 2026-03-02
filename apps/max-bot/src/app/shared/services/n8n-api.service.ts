import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, map, catchError, throwError } from 'rxjs';

export interface RagUploadRequest {
  org_id: number;
  filename: string;
  mime_type: string;
  content_base64: string;
}

export interface RagUploadResponse {
  success: boolean;
  document_id: number;
  chunk_count: number;
}

export interface RagQuestionRequest {
  org_id: number;
  user_max_id: number;
  question: string;
}

export interface RagQuestionResponse {
  answer: string;
  sources: Array<{ filename: string; score: number }>;
  query_id: number;
}

export interface RagDocsRequest {
  action: 'list' | 'delete';
  org_id: number;
  doc_id?: number;
}

export interface RagDocsResponse {
  documents?: Array<{
    id: number;
    filename: string;
    status: string;
    chunk_count: number;
    created_at: string;
  }>;
  success?: boolean;
}

@Injectable()
export class N8nApiService {
  private readonly logger = new Logger(N8nApiService.name);
  private readonly webhookBaseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.webhookBaseUrl = this.configService.get<string>(
      'N8N_WEBHOOK_BASE_URL',
      'http://n8n:5678/webhook',
    );
  }

  async upload(data: RagUploadRequest): Promise<RagUploadResponse> {
    return firstValueFrom(
      this.httpService.post<RagUploadResponse>(`${this.webhookBaseUrl}/rag-upload`, data).pipe(
        map(({ data }) => data),
        catchError((e) => {
          this.logger.error(`Upload failed: ${e.message}`);
          return throwError(() => new Error(`Upload failed: ${e.message}`));
        }),
      ),
    );
  }

  async askQuestion(data: RagQuestionRequest): Promise<RagQuestionResponse> {
    return firstValueFrom(
      this.httpService.post<RagQuestionResponse>(`${this.webhookBaseUrl}/rag-question`, data).pipe(
        map(({ data }) => data),
        catchError((e) => {
          this.logger.error(`Question failed: ${e.message}`);
          return throwError(() => new Error(`Question failed: ${e.message}`));
        }),
      ),
    );
  }

  async manageDocs(data: RagDocsRequest): Promise<RagDocsResponse> {
    return firstValueFrom(
      this.httpService.post<RagDocsResponse>(`${this.webhookBaseUrl}/rag-docs`, data).pipe(
        map(({ data }) => data),
        catchError((e) => {
          this.logger.error(`Doc management failed: ${e.message}`);
          return throwError(() => new Error(`Doc management failed: ${e.message}`));
        }),
      ),
    );
  }
}
