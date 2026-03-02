import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class DbService {
  constructor(private readonly prismaService: PrismaService) {}

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
}
