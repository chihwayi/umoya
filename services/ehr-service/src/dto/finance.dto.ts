import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsDateString, IsEnum, IsNotEmpty, IsNumber, IsObject, IsOptional, IsPositive, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentStatus } from '../constants/payment-status';

export enum PaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  MOBILE_MONEY = 'mobile_money',
  BANK_TRANSFER = 'bank_transfer',
  MEDICAL_AID = 'medical_aid',
  WRITE_OFF = 'write_off',
}

export class RecordPaymentDto {
  @ApiProperty({ example: 150.0 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.CARD })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiProperty({ example: 'POS-123456', required: false })
  @IsOptional()
  @IsString()
  paymentReference?: string;

  @ApiProperty({ example: 'STRIPE-789456', required: false })
  @IsOptional()
  @IsString()
  gatewayReference?: string;

  @ApiProperty({ example: 'Payment for Consultation', required: false })
  @IsOptional()
  @IsString()
  note?: string;
}

export class FinanceLineItemDto {
  @ApiProperty({ example: 'Consultation fee' })
  @IsString()
  description: string;

  @ApiProperty({ example: 'CONSULT-001', required: false })
  @IsOptional()
  @IsString()
  billingCode?: string;

  @ApiProperty({ example: 30 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  unitPrice: number;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsNumber()
  quantity: number;

  @ApiProperty({ example: 0, required: false })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  discount?: number;

  @ApiProperty({ example: 0, required: false })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  tax?: number;
}

export class CreateFinanceTransactionDto {
  @ApiProperty({ example: 'appointments' })
  @IsString()
  sourceModule: string;

  @ApiProperty({ example: 'c2e8e2b2-bae5-4cb4-8d0b-0e5ba6d148e3', required: false })
  @IsOptional()
  @IsUUID()
  sourceReferenceId?: string;

  @ApiProperty({ example: 'c2e8e2b2-bae5-4cb4-8d0b-0e5ba6d148e3', required: false })
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @ApiProperty({ example: 40 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({ enum: ['USD', 'ZWL'], default: 'USD', required: false })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ example: 'Consultation with Dr. Ncube', required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ enum: ['self', 'medical_aid', 'corporate'], required: false, default: 'self' })
  @IsOptional()
  @IsString()
  payerType?: string;

  @ApiProperty({ type: [FinanceLineItemDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FinanceLineItemDto)
  lineItems?: FinanceLineItemDto[];

  @ApiProperty({ enum: ['awaiting_payment', 'payment_confirmed', 'in_progress', 'completed', 'cancelled'], required: false })
  @IsOptional()
  @IsString()
  paymentStatus?: PaymentStatus;

  @ApiProperty({ example: '2025-11-11T08:00:00Z', required: false })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class CreateInvoiceTemplateDto {
  @ApiProperty({ example: 'Standard Invoice' })
  @IsString()
  name: string;

  @ApiProperty({
    example: {
      headerTitle: 'MediCore Health',
      headerSubtitle: 'Excellence in Care',
      addressLines: ['123 Health St.', 'Bulawayo'],
      brandColor: '#2563eb',
      footerNotes: ['Thank you for your payment.'],
    },
  })
  @IsObject()
  templateContent: Record<string, any>;

  @ApiProperty({ example: ['patient.first_name', 'transaction.amount'], required: false })
  @IsOptional()
  @IsArray()
  variables?: string[];

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateInvoiceTemplateDto extends PartialType(CreateInvoiceTemplateDto) {}
