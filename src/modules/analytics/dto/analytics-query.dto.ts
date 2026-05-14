import { IsDateString, IsOptional } from 'class-validator';

export class AnalyticsQueryDto {
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}
