import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ServiceCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async listCategories(): Promise<Record<string, unknown>> {
    const categories = await this.prisma.serviceCategory.findMany({
      where: {
        isActive: true,
      },
      include: {
        children: {
          where: {
            isActive: true,
          },
          orderBy: {
            name: 'asc',
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    return {
      items: categories
        .filter((category) => category.parentId === null)
        .map((category) => ({
          id: category.id,
          name: category.name,
          slug: category.slug,
          children: category.children.map((child) => ({
            id: child.id,
            name: child.name,
            slug: child.slug,
          })),
        })),
    };
  }
}
