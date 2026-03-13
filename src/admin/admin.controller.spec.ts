import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

describe('AdminController', () => {
  const mockAdminService = {
    getOverview: jest.fn(),
    listReports: jest.fn(),
    getReportDetail: jest.fn(),
    resolveReport: jest.fn(),
    listReservationObjections: jest.fn(),
    resolveReservationObjection: jest.fn(),
    listUsers: jest.fn(),
    getUser: jest.fn(),
    getUserAdminDetail: jest.fn(),
    suspendUser: jest.fn(),
    closeUser: jest.fn(),
    applyUserAction: jest.fn(),
    listBrands: jest.fn(),
    getBrand: jest.fn(),
    getBrandAdminDetail: jest.fn(),
    listServices: jest.fn(),
    getService: jest.fn(),
    getServiceAdminDetail: jest.fn(),
    listVisibilityLabels: jest.fn(),
    createVisibilityLabel: jest.fn(),
    assignVisibilityLabel: jest.fn(),
    unassignVisibilityLabel: jest.fn(),
    listSponsoredVisibility: jest.fn(),
    createSponsoredVisibility: jest.fn(),
    listActivity: jest.fn(),
    getAnalyticsOverview: jest.fn(),
    applyReportAction: jest.fn(),
  } as unknown as AdminService;

  const controller = new AdminController(mockAdminService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates getOverview to admin service', async () => {
    const expected = { usersCount: 10 };
    (mockAdminService.getOverview as jest.Mock).mockResolvedValue(expected);
    const result = await controller.getOverview();
    expect(mockAdminService.getOverview).toHaveBeenCalled();
    expect(result).toBe(expected);
  });

  it('delegates listReports to admin service with query', async () => {
    const query = { status: 'OPEN' } as any;
    const expected = { items: [] };
    (mockAdminService.listReports as jest.Mock).mockResolvedValue(expected);
    const result = await controller.listReports(query);
    expect(mockAdminService.listReports).toHaveBeenCalledWith(query);
    expect(result).toBe(expected);
  });

  it('delegates getReportDetail with reportId', async () => {
    const expected = { report: { id: 'r-1' } };
    (mockAdminService.getReportDetail as jest.Mock).mockResolvedValue(expected);
    const result = await controller.getReportDetail('r-1');
    expect(mockAdminService.getReportDetail).toHaveBeenCalledWith('r-1');
    expect(result).toBe(expected);
  });

  it('delegates resolveReport with user, id, and dto', async () => {
    const user = { sub: 'admin-1' } as any;
    const dto = { status: 'RESOLVED' } as any;
    const expected = { report: {} };
    (mockAdminService.resolveReport as jest.Mock).mockResolvedValue(expected);
    const result = await controller.resolveReport(user, 'r-1', dto);
    expect(mockAdminService.resolveReport).toHaveBeenCalledWith(
      'admin-1',
      'r-1',
      dto,
    );
    expect(result).toBe(expected);
  });

  it('delegates listUsers to admin service', async () => {
    const query = {} as any;
    const expected = { items: [] };
    (mockAdminService.listUsers as jest.Mock).mockResolvedValue(expected);
    const result = await controller.listUsers(query);
    expect(mockAdminService.listUsers).toHaveBeenCalledWith(query);
    expect(result).toBe(expected);
  });

  it('delegates suspendUser with correct params', async () => {
    const user = { sub: 'admin-1' } as any;
    const dto = { durationDays: 7, reason: 'Abuse' } as any;
    const expected = { user: {} };
    (mockAdminService.suspendUser as jest.Mock).mockResolvedValue(expected);
    const result = await controller.suspendUser(user, 'user-1', dto);
    expect(mockAdminService.suspendUser).toHaveBeenCalledWith(
      'admin-1',
      'user-1',
      dto,
    );
    expect(result).toBe(expected);
  });

  it('delegates listBrands to admin service', async () => {
    const query = {} as any;
    const expected = { items: [] };
    (mockAdminService.listBrands as jest.Mock).mockResolvedValue(expected);
    const result = await controller.listBrands(query);
    expect(mockAdminService.listBrands).toHaveBeenCalledWith(query);
    expect(result).toBe(expected);
  });

  it('delegates listServices to admin service', async () => {
    const query = {} as any;
    const expected = { items: [] };
    (mockAdminService.listServices as jest.Mock).mockResolvedValue(expected);
    const result = await controller.listServices(query);
    expect(mockAdminService.listServices).toHaveBeenCalledWith(query);
    expect(result).toBe(expected);
  });

  it('delegates createSponsoredVisibility with user and dto', async () => {
    const user = { sub: 'admin-1' } as any;
    const dto = { targetType: 'SERVICE', targetId: 's-1' } as any;
    const expected = { id: 'sv-1' };
    (mockAdminService.createSponsoredVisibility as jest.Mock).mockResolvedValue(
      expected,
    );
    const result = await controller.createSponsoredVisibility(user, dto);
    expect(mockAdminService.createSponsoredVisibility).toHaveBeenCalledWith(
      'admin-1',
      dto,
    );
    expect(result).toBe(expected);
  });

  it('delegates getAnalyticsOverview to admin service', async () => {
    const expected = [{ month: '2026-01', reservations: 42 }];
    (mockAdminService.getAnalyticsOverview as jest.Mock).mockResolvedValue(
      expected,
    );
    const result = await controller.getAnalyticsOverview();
    expect(mockAdminService.getAnalyticsOverview).toHaveBeenCalled();
    expect(result).toBe(expected);
  });
});
