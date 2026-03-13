import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Public } from '../common/decorators/public.decorator';
import { ReverseGeocodeDto } from './dto/reverse-geocode.dto';
import { SearchLocationsDto } from './dto/search-locations.dto';
import { LocationsService } from './locations.service';

@ApiTags('Locations')
@Public()
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('search')
  searchLocations(
    @Query() query: SearchLocationsDto,
  ): Promise<Record<string, unknown>> {
    return this.locationsService.searchLocations(query);
  }

  @Get('reverse')
  reverseGeocode(
    @Query() query: ReverseGeocodeDto,
  ): Promise<Record<string, unknown>> {
    return this.locationsService.reverseGeocode(query);
  }
}
