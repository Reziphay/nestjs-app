/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { ReportTargetType } from '@prisma/client';

import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  it('creates a service report and notifies admins', async () => {
    const serviceFindUnique = jest.fn().mockResolvedValue({
      id: 'service-1',
      name: 'Classic Haircut',
      ownerUserId: 'owner-1',
      isActive: true,
      ownerUser: {
        fullName: 'Demo Owner',
      },
    });
    const reportFindFirst = jest.fn().mockResolvedValue(null);
    const reportCreate = jest.fn().mockResolvedValue({
      id: 'report-1',
      reporterUserId: 'customer-1',
      targetType: ReportTargetType.SERVICE,
      targetId: 'service-1',
      reason: 'This listing is misleading.',
      status: 'OPEN',
      createdAt: new Date('2026-03-13T10:00:00.000Z'),
    });
    const notifyReportReceived = jest.fn().mockResolvedValue(undefined);

    const service = new ReportsService(
      {
        service: {
          findUnique: serviceFindUnique,
        },
        report: {
          findFirst: reportFindFirst,
          create: reportCreate,
        },
      } as any,
      {
        notifyReportReceived,
      } as any,
    );

    const result = await service.createReport('customer-1', {
      targetType: ReportTargetType.SERVICE,
      targetId: 'service-1',
      reason: 'This listing is misleading.',
    });

    expect(reportCreate).toHaveBeenCalledWith({
      data: {
        reporterUserId: 'customer-1',
        targetType: ReportTargetType.SERVICE,
        targetId: 'service-1',
        reason: 'This listing is misleading.',
      },
    });
    expect(notifyReportReceived).toHaveBeenCalledWith({
      reportId: 'report-1',
      targetType: ReportTargetType.SERVICE,
    });
    expect(result).toEqual({
      report: expect.objectContaining({
        id: 'report-1',
        targetType: ReportTargetType.SERVICE,
        targetSummary: {
          id: 'service-1',
          type: ReportTargetType.SERVICE,
          name: 'Classic Haircut',
          ownerUserId: 'owner-1',
          ownerFullName: 'Demo Owner',
          isActive: true,
        },
      }),
    });
  });

  it('rejects duplicate open reports for the same target', async () => {
    const reviewFindUnique = jest.fn().mockResolvedValue({
      id: 'review-1',
      rating: 4,
      comment: 'Spam',
      isDeleted: false,
      authorUserId: 'author-1',
    });
    const reportFindFirst = jest.fn().mockResolvedValue({
      id: 'report-1',
    });

    const service = new ReportsService(
      {
        review: {
          findUnique: reviewFindUnique,
        },
        report: {
          findFirst: reportFindFirst,
        },
      } as any,
      {} as any,
    );

    await expect(
      service.createReviewReport('customer-1', 'review-1', 'Spam content'),
    ).rejects.toThrow('You already have an open report for this target.');
  });
});
