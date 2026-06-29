import { IsUUID, IsString, IsDateString, IsInt, IsOptional } from 'class-validator';

export class RecordOutcomeDto {
  @IsUUID() encounterId: string;
  @IsString() encounterType: string;
  @IsUUID() patientId: string;
  @IsString() outcomeType: string;
  @IsDateString() outcomeDate: string;
  @IsInt() followUpWindowDays: number;
  @IsOptional() @IsString() clinicalNotes?: string;
  @IsOptional() @IsString() dataSource?: string;
}

export class ScheduleFollowUpDto {
  @IsUUID() encounterId: string;
  @IsString() encounterType: string;
  @IsUUID() patientId: string;
  @IsDateString() baseDate: string;
}

export class GetOutcomeRatesDto {
  @IsString() encounterType: string;
  @IsInt() windowDays: number;
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
}
