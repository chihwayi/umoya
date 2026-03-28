import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { DemoAccessRequestStatus } from '../entities/demo-access-request.entity';

export class UpdateDemoAccessRequestDto {
  @IsIn(['new', 'reviewing', 'approved', 'provisioned', 'rejected'])
  status: DemoAccessRequestStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(36)
  assignedTenantId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  assignedSubdomain?: string;
}
