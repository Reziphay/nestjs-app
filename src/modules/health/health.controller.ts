import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

type HealthPayload = {
  status: 'ok';
  service: string;
  timestamp: string;
};

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiOkResponse({ description: 'Returns API health status.' })
  getHealth(): HealthPayload {
    return {
      status: 'ok',
      service: 'reziphay-backend',
      timestamp: new Date().toISOString(),
    };
  }
}
