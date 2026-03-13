import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class DbService {
  constructor(private readonly prismaService: PrismaService) {}

  // --- Organization ---

  async findOrCreateOrganization(maxUserId: number, name?: string) {
    return this.prismaService.organization.upsert({
      where: { max_user_id: maxUserId },
      update: {},
      create: {
        max_user_id: maxUserId,
        name: name ?? `Org-${maxUserId}`,
      },
    });
  }

  async getOrganizationByMaxUserId(maxUserId: number) {
    return this.prismaService.organization.findUnique({
      where: { max_user_id: maxUserId },
    });
  }

  // --- Folder CRUD ---

  async getFolderById(folderId: number) {
    return this.prismaService.folder.findUnique({
      where: { id: folderId },
    });
  }

  async getFolderContents(orgId: number, parentId: number | null) {
    const [folders, docs] = await Promise.all([
      this.prismaService.folder.findMany({
        where: { organization_id: orgId, parent_id: parentId },
        orderBy: { name: 'asc' },
        include: { _count: { select: { documents: true } } },
      }),
      this.prismaService.document.findMany({
        where: { organization_id: orgId, folder_id: parentId },
        orderBy: { filename: 'asc' },
        select: { id: true, filename: true, status: true, chunk_count: true },
      }),
    ]);

    const subfolders = folders.map((f) => ({
      id: f.id,
      name: f.name,
      docCount: f._count.documents,
    }));

    return { subfolders, docs };
  }

  async getFolderBreadcrumbs(folderId: number): Promise<Array<{ name: string }>> {
    const crumbs: Array<{ name: string }> = [];
    let currentId: number | null = folderId;

    while (currentId) {
      const folder = await this.prismaService.folder.findUnique({
        where: { id: currentId },
        select: { name: true, parent_id: true },
      });
      if (!folder) break;
      crumbs.unshift({ name: folder.name });
      currentId = folder.parent_id;
    }

    return crumbs;
  }

  async getFolderDepth(folderId: number): Promise<number> {
    let depth = 0;
    let currentId: number | null = folderId;

    while (currentId) {
      depth++;
      const folder = await this.prismaService.folder.findUnique({
        where: { id: currentId },
        select: { parent_id: true },
      });
      if (!folder) break;
      currentId = folder.parent_id;
    }

    return depth;
  }

  async checkDuplicateFolderName(orgId: number, name: string, parentId: number | null): Promise<boolean> {
    const existing = await this.prismaService.folder.findFirst({
      where: { organization_id: orgId, name, parent_id: parentId },
      select: { id: true },
    });
    return !!existing;
  }

  async createFolder(orgId: number, name: string, parentId: number | null) {
    return this.prismaService.folder.create({
      data: {
        organization_id: orgId,
        name,
        parent_id: parentId,
      },
    });
  }

  async deleteFolder(folderId: number): Promise<void> {
    // Переместить документы из удаляемой папки и вложенных в корень
    const folderIds = await this.collectFolderIds(folderId);

    await this.prismaService.document.updateMany({
      where: { folder_id: { in: folderIds } },
      data: { folder_id: null },
    });

    // Удаление каскадно (parent → children через Prisma onDelete: Cascade)
    await this.prismaService.folder.delete({
      where: { id: folderId },
    });
  }

  private async collectFolderIds(folderId: number): Promise<number[]> {
    const ids = [folderId];
    const children = await this.prismaService.folder.findMany({
      where: { parent_id: folderId },
      select: { id: true },
    });
    for (const child of children) {
      const childIds = await this.collectFolderIds(child.id);
      ids.push(...childIds);
    }
    return ids;
  }

  async findFolderByName(orgId: number, name: string) {
    return this.prismaService.folder.findFirst({
      where: { organization_id: orgId, name },
    });
  }

  async findFolderByPath(orgId: number, path: string) {
    const parts = path.split('/').map((s) => s.trim()).filter(Boolean);
    let parentId: number | null = null;

    for (const part of parts) {
      const folder = await this.prismaService.folder.findFirst({
        where: { organization_id: orgId, name: part, parent_id: parentId },
      });
      if (!folder) return null;
      parentId = folder.id;
    }

    return parentId ? { id: parentId } : null;
  }

  async createFolderPath(orgId: number, path: string): Promise<{ id: number }> {
    const parts = path.split('/').map((s) => s.trim()).filter(Boolean);
    let parentId: number | null = null;

    for (const part of parts) {
      const existing = await this.prismaService.folder.findFirst({
        where: { organization_id: orgId, name: part, parent_id: parentId },
      });
      if (existing) {
        parentId = existing.id;
      } else {
        const created = await this.prismaService.folder.create({
          data: { organization_id: orgId, name: part, parent_id: parentId },
        });
        parentId = created.id;
      }
    }

    return { id: parentId! };
  }

  // --- Document ---

  async getTotalDocCount(orgId: number): Promise<number> {
    return this.prismaService.document.count({
      where: { organization_id: orgId },
    });
  }

  async findDocumentByName(orgId: number, name: string) {
    return this.prismaService.document.findFirst({
      where: { organization_id: orgId, filename: name },
      select: { id: true, filename: true },
    });
  }

  async findDocumentByFilename(orgId: number, filename: string, folderId: number | null) {
    return this.prismaService.document.findFirst({
      where: { organization_id: orgId, filename, folder_id: folderId },
      select: { id: true, filename: true },
    });
  }

  async checkDuplicateDocInFolder(orgId: number, filename: string, folderId: number | null): Promise<boolean> {
    const existing = await this.prismaService.document.findFirst({
      where: { organization_id: orgId, filename, folder_id: folderId },
      select: { id: true },
    });
    return !!existing;
  }

  async moveDocumentToFolder(docId: number, folderId: number | null): Promise<void> {
    await this.prismaService.document.update({
      where: { id: docId },
      data: { folder_id: folderId },
    });
  }

  // --- Folder structure text (for RAG context) ---

  async buildFolderStructureText(orgId: number): Promise<string> {
    const lines: string[] = [];

    const build = async (parentId: number | null, depth: number) => {
      const prefix = '  '.repeat(depth);

      const folders = await this.prismaService.folder.findMany({
        where: { organization_id: orgId, parent_id: parentId },
        orderBy: { name: 'asc' },
      });

      const docs = await this.prismaService.document.findMany({
        where: { organization_id: orgId, folder_id: parentId },
        orderBy: { filename: 'asc' },
        select: { filename: true, status: true },
      });

      for (const f of folders) {
        lines.push(`${prefix}[folder] ${f.name}`);
        await build(f.id, depth + 1);
      }
      for (const d of docs) {
        lines.push(`${prefix}[${d.status}] ${d.filename}`);
      }
    };

    await build(null, 0);
    if (!lines.length) return 'No documents or folders.';
    return lines.join('\n');
  }
}
