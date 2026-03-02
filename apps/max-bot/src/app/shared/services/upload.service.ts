import { Injectable } from '@nestjs/common';
import { InjectBot } from 'nestjs-max';
import { Bot, ImageAttachment } from 'max-io';
import { randomUUID } from 'node:crypto';

const DEFAULT_TIMEOUT = 20_000;

@Injectable()
export class UploadService {
  constructor(@InjectBot() private readonly bot: Bot) {}

  async uploadImage(buffer: Buffer, timeout = DEFAULT_TIMEOUT): Promise<ImageAttachment> {
    const { url } = await this.bot.api.raw.uploads.getUploadUrl({ type: 'image' });
    const blob = new Blob([new Uint8Array(buffer)], { type: 'image/png' });
    const formData = new FormData();
    const fileName = `${randomUUID()}.png`;
    formData.append('data', blob, fileName);

    const uploadRes = await fetch(url, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(timeout),
    });

    const response = await uploadRes.json();
    return new ImageAttachment(response);
  }
}
