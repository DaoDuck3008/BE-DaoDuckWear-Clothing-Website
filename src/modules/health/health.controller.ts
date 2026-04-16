import { Controller, Get, Param } from '@nestjs/common';
import { HealthService } from './health.service';
import { NotFoundException } from '@nestjs/common';

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  checkHealth() {
    return this.healthService.checkHealth();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    throw new NotFoundException('User not found');
  }
}
