import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

describe('NotificationsController', () => {
  const mockService = {
    listNotifications: jest.fn(),
    markRead: jest.fn(),
    markAllRead: jest.fn(),
    getUnreadCount: jest.fn(),
  } as unknown as NotificationsService;

  const controller = new NotificationsController(mockService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates listNotifications with user sub', async () => {
    const user = { sub: 'user-1' } as any;
    const query = {} as any;
    const expected = { items: [] };
    (mockService.listNotifications as jest.Mock).mockResolvedValue(expected);
    const result = await controller.listNotifications(user, query);
    expect(mockService.listNotifications).toHaveBeenCalledWith(
      'user-1',
      query,
    );
    expect(result).toBe(expected);
  });

  it('delegates markRead with user sub and notification id', async () => {
    const user = { sub: 'user-1' } as any;
    const expected = { id: 'n-1', isRead: true };
    (mockService.markRead as jest.Mock).mockResolvedValue(expected);
    const result = await controller.markRead(user, 'n-1');
    expect(mockService.markRead).toHaveBeenCalledWith('user-1', 'n-1');
    expect(result).toBe(expected);
  });

  it('delegates markAllRead with user sub', async () => {
    const user = { sub: 'user-1' } as any;
    const expected = { markedCount: 5 };
    (mockService.markAllRead as jest.Mock).mockResolvedValue(expected);
    const result = await controller.markAllRead(user);
    expect(mockService.markAllRead).toHaveBeenCalledWith('user-1');
    expect(result).toBe(expected);
  });

  it('delegates getUnreadCount with user sub', async () => {
    const user = { sub: 'user-1' } as any;
    const expected = { unreadCount: 3 };
    (mockService.getUnreadCount as jest.Mock).mockResolvedValue(expected);
    const result = await controller.getUnreadCount(user);
    expect(mockService.getUnreadCount).toHaveBeenCalledWith('user-1');
    expect(result).toBe(expected);
  });
});
