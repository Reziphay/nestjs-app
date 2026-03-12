import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';

import { ResponseEnvelopeInterceptor } from '../src/common/interceptors/response-envelope.interceptor';
import { HealthController } from '../src/health/health.controller';
import { HealthService } from '../src/health/health.service';

type HealthResponseBody = {
  success: boolean;
  data: {
    status: string;
    services: {
      database: {
        status: string;
      };
      redis: {
        status: string;
      };
    };
  };
  timestamp: string;
};

describe('HealthController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: {
            getHealth: jest.fn().mockResolvedValue({
              status: 'ok',
              services: {
                database: {
                  status: 'up',
                },
                redis: {
                  status: 'up',
                },
              },
            }),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/health (GET)', async () => {
    const httpServer = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(httpServer).get('/health').expect(200);
    const body = response.body as HealthResponseBody;

    expect(body.success).toBe(true);
    expect(body.data).toEqual({
      status: 'ok',
      services: {
        database: {
          status: 'up',
        },
        redis: {
          status: 'up',
        },
      },
    });
    expect(typeof body.timestamp).toBe('string');
  });
});
