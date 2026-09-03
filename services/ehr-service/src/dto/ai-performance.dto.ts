import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsNumber,
  Min,
  Max,
  IsObject,
} from 'class-validator';

// F21 fix (S273) — recordPrediction() previously accepted `dto: any` with zero
// validation, so any internal service could write arbitrary confidence scores /
// model versions / unvalidated JSON into ai_predictions — data other governance
// dashboards (ai-performance.service.ts's drift/fairness/calibration queries)
// trust as ground truth. Matches ai_predictions' real column constraints
// (patient_id/encounter_id are UUID, predicted_probability/threshold_used are
// NUMERIC(5,4) i.e. a 0-1 probability).
export class RecordAiPredictionDto {
  @ApiProperty({ description: 'Model name, e.g. readmission_risk' })
  @IsString()
  @IsNotEmpty()
  model_name: string;

  @ApiPropertyOptional({ description: 'Model version', default: '1.0' })
  @IsString()
  @IsOptional()
  model_version?: string;

  @ApiProperty({ description: 'Patient the prediction was made for' })
  @IsUUID()
  @IsNotEmpty()
  patient_id: string;

  @ApiPropertyOptional({ description: 'Associated encounter' })
  @IsUUID()
  @IsOptional()
  encounter_id?: string;

  @ApiProperty({ description: 'Predicted class label, e.g. high_risk / low_risk' })
  @IsString()
  @IsNotEmpty()
  predicted_class: string;

  @ApiPropertyOptional({ description: 'Predicted probability (0-1)' })
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  predicted_probability?: number;

  @ApiPropertyOptional({ description: 'Decision threshold used (0-1)' })
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  threshold_used?: number;

  @ApiPropertyOptional({ description: 'Input feature snapshot used for the prediction' })
  @IsObject()
  @IsOptional()
  input_features?: Record<string, any>;
}
