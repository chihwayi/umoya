import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateIf,
  IsArray,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  SupplierStatus,
} from '../entities/pharmacy-supplier.entity';
import {
  InventoryStatus,
} from '../entities/pharmacy-inventory.entity';
import {
  PurchaseOrderStatus,
} from '../entities/pharmacy-purchase-order.entity';
import {
  ReceiptStatus,
} from '../entities/pharmacy-receipt.entity';
import {
  DispensingStatus,
  PaymentStatus,
} from '../entities/pharmacy-dispensing.entity';
import {
  ReturnStatus,
} from '../entities/pharmacy-return.entity';
import {
  AdjustmentType,
  AdjustmentStatus,
} from '../entities/pharmacy-stock-adjustment.entity';
import {
  PricingRuleType,
  PricingRuleAppliesTo,
} from '../entities/pharmacy-pricing-rule.entity';
import {
  AlertType,
  AlertSeverity,
} from '../entities/pharmacy-alert.entity';

// Supplier DTOs
export class CreateSupplierDto {
  @ApiProperty({ description: 'Supplier name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Contact person' })
  @IsString()
  @IsOptional()
  contactPerson?: string;

  @ApiPropertyOptional({ description: 'Email address' })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: 'Address' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ description: 'City' })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ description: 'Country' })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({ description: 'Payment terms (e.g., "Net 30")' })
  @IsString()
  @IsOptional()
  paymentTerms?: string;

  @ApiPropertyOptional({ description: 'Tax ID' })
  @IsString()
  @IsOptional()
  taxId?: string;

  @ApiPropertyOptional({ description: 'Status', enum: ['active', 'inactive'], default: 'active' })
  @IsEnum(['active', 'inactive'])
  @IsOptional()
  status?: SupplierStatus;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateSupplierDto extends PartialType(CreateSupplierDto) {}

// Inventory DTOs
export class CreateInventoryDto {
  @ApiProperty({ description: 'Drug ID' })
  @IsUUID()
  @IsNotEmpty()
  drugId: string;

  @ApiPropertyOptional({ description: 'RxNorm code' })
  @IsString()
  @IsOptional()
  rxnormCode?: string;

  @ApiPropertyOptional({ description: 'RxNorm name' })
  @IsString()
  @IsOptional()
  rxnormName?: string;

  @ApiPropertyOptional({ description: 'Batch number' })
  @IsString()
  @IsOptional()
  batchNumber?: string;

  @ApiProperty({ description: 'Expiry date' })
  @IsDateString()
  @IsNotEmpty()
  expiryDate: string;

  @ApiPropertyOptional({ description: 'Manufacturing date' })
  @IsDateString()
  @IsOptional()
  manufacturingDate?: string;

  @ApiProperty({ description: 'Quantity on hand', default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  quantityOnHand?: number;

  @ApiProperty({ description: 'Unit cost' })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  unitCost: number;

  @ApiProperty({ description: 'Unit price' })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  unitPrice: number;

  @ApiPropertyOptional({ description: 'Reorder level', default: 10 })
  @IsInt()
  @Min(0)
  @IsOptional()
  reorderLevel?: number;

  @ApiPropertyOptional({ description: 'Reorder quantity', default: 50 })
  @IsInt()
  @Min(1)
  @IsOptional()
  reorderQuantity?: number;

  @ApiPropertyOptional({ description: 'Maximum stock level' })
  @IsInt()
  @Min(1)
  @IsOptional()
  maximumStockLevel?: number;

  @ApiPropertyOptional({ description: 'Storage location' })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiPropertyOptional({ description: 'Storage conditions' })
  @IsString()
  @IsOptional()
  storageConditions?: string;

  @ApiPropertyOptional({ description: 'Supplier ID' })
  @IsUUID()
  @IsOptional()
  supplierId?: string;

  @ApiPropertyOptional({ description: 'Status', enum: ['active', 'discontinued', 'expired', 'recalled'], default: 'active' })
  @IsEnum(['active', 'discontinued', 'expired', 'recalled'])
  @IsOptional()
  status?: InventoryStatus;
}

export class UpdateInventoryDto extends PartialType(CreateInventoryDto) {}

// Purchase Order DTOs
export class CreatePurchaseOrderItemDto {
  @ApiPropertyOptional({ description: 'Inventory ID (if ordering existing inventory item)' })
  @IsUUID()
  @IsOptional()
  inventoryId?: string;

  @ApiPropertyOptional({ description: 'Drug ID (if creating new inventory item)' })
  @IsUUID()
  @IsOptional()
  drugId?: string;

  @ApiPropertyOptional({ description: 'RxNorm code' })
  @IsString()
  @IsOptional()
  rxnormCode?: string;

  @ApiProperty({ description: 'Quantity ordered' })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  quantityOrdered: number;

  @ApiProperty({ description: 'Unit cost' })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  unitCost: number;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreatePurchaseOrderDto {
  @ApiProperty({ description: 'Supplier ID' })
  @IsUUID()
  @IsNotEmpty()
  supplierId: string;

  @ApiPropertyOptional({ description: 'Order date', default: 'Current date' })
  @IsDateString()
  @IsOptional()
  orderDate?: string;

  @ApiPropertyOptional({ description: 'Expected delivery date' })
  @IsDateString()
  @IsOptional()
  expectedDeliveryDate?: string;

  @ApiPropertyOptional({ description: 'Status', enum: ['draft', 'pending', 'approved', 'ordered', 'received', 'cancelled'], default: 'draft' })
  @IsEnum(['draft', 'pending', 'approved', 'ordered', 'received', 'cancelled'])
  @IsOptional()
  status?: PurchaseOrderStatus;

  @ApiPropertyOptional({ description: 'Currency', default: 'USD' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ description: 'Purchase order items', type: [CreatePurchaseOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderItemDto)
  items: CreatePurchaseOrderItemDto[];
}

export class UpdatePurchaseOrderDto extends PartialType(CreatePurchaseOrderDto) {}

// Receipt DTOs
export class CreateReceiptItemDto {
  @ApiPropertyOptional({ description: 'Purchase order item ID' })
  @IsUUID()
  @IsOptional()
  purchaseOrderItemId?: string;

  @ApiProperty({ description: 'Drug ID' })
  @IsUUID()
  @IsNotEmpty()
  drugId: string;

  @ApiPropertyOptional({ description: 'Batch number' })
  @IsString()
  @IsOptional()
  batchNumber?: string;

  @ApiProperty({ description: 'Expiry date' })
  @IsDateString()
  @IsNotEmpty()
  expiryDate: string;

  @ApiPropertyOptional({ description: 'Manufacturing date' })
  @IsDateString()
  @IsOptional()
  manufacturingDate?: string;

  @ApiProperty({ description: 'Quantity received' })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  quantityReceived: number;

  @ApiProperty({ description: 'Unit cost' })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  unitCost: number;

  @ApiPropertyOptional({ description: 'Condition', enum: ['good', 'damaged', 'expired', 'short_supply'], default: 'good' })
  @IsEnum(['good', 'damaged', 'expired', 'short_supply'])
  @IsOptional()
  condition?: 'good' | 'damaged' | 'expired' | 'short_supply';

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateReceiptDto {
  @ApiPropertyOptional({ description: 'Purchase order ID' })
  @IsUUID()
  @IsOptional()
  purchaseOrderId?: string;

  @ApiProperty({ description: 'Supplier ID' })
  @IsUUID()
  @IsNotEmpty()
  supplierId: string;

  @ApiPropertyOptional({ description: 'Receipt date', default: 'Current date' })
  @IsDateString()
  @IsOptional()
  receiptDate?: string;

  @ApiPropertyOptional({ description: 'Status', enum: ['pending', 'verified', 'rejected', 'processed'], default: 'pending' })
  @IsEnum(['pending', 'verified', 'rejected', 'processed'])
  @IsOptional()
  status?: ReceiptStatus;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ description: 'Receipt items', type: [CreateReceiptItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateReceiptItemDto)
  items: CreateReceiptItemDto[];
}

// Dispensing DTOs
export class CreateDispensingItemDto {
  @ApiProperty({ description: 'Inventory ID' })
  @IsUUID()
  @IsNotEmpty()
  inventoryId: string;

  @ApiProperty({ description: 'Drug ID' })
  @IsUUID()
  @IsNotEmpty()
  drugId: string;

  @ApiProperty({ description: 'Quantity to dispense' })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  quantityDispensed: number;

  @ApiPropertyOptional({ description: 'Unit price (if different from inventory price)' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  unitPrice?: number;

  @ApiPropertyOptional({ description: 'Patient instructions' })
  @IsString()
  @IsOptional()
  instructions?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateDispensingDto {
  @ApiPropertyOptional({ description: 'Prescription ID' })
  @IsUUID()
  @IsOptional()
  prescriptionId?: string;

  @ApiProperty({ description: 'Patient ID' })
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @ApiPropertyOptional({ description: 'Dispensing date', default: 'Current date' })
  @IsDateString()
  @IsOptional()
  dispensingDate?: string;

  @ApiPropertyOptional({ description: 'Payment method' })
  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'Discount amount' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  discountAmount?: number;

  @ApiPropertyOptional({ description: 'Amount paid' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  amountPaid?: number;

  @ApiPropertyOptional({ description: 'Medical aid ID' })
  @IsUUID()
  @IsOptional()
  medicalAidId?: string;

  @ApiPropertyOptional({ description: 'Medical aid name' })
  @IsString()
  @IsOptional()
  medicalAidName?: string;

  @ApiPropertyOptional({ description: 'Policy number' })
  @IsString()
  @IsOptional()
  policyNumber?: string;

  @ApiPropertyOptional({ description: 'Coverage percentage' })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  coveragePercentage?: number;

  @ApiPropertyOptional({ description: 'Prepared medication review ID used for this dispensing' })
  @IsUUID()
  @IsOptional()
  medicationReviewId?: string;

  @ApiPropertyOptional({ description: 'Selected substitution recommendation IDs', type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  selectedSubstitutionRecommendationIds?: string[];

  @ApiPropertyOptional({ description: 'Selected stewardship review IDs', type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  stewardshipReviewIds?: string[];

  @ApiPropertyOptional({ description: 'Whether the pharmacist explicitly reviewed the AI guidance before dispensing' })
  @IsBoolean()
  @IsOptional()
  aiReviewAcknowledged?: boolean;

  @ApiPropertyOptional({ description: 'Persisted AI review summary captured at dispense time' })
  @IsObject()
  @IsOptional()
  aiReviewSummary?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ description: 'Dispensing items', type: [CreateDispensingItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDispensingItemDto)
  items: CreateDispensingItemDto[];
}

// Return DTOs
export class CreateReturnItemDto {
  @ApiPropertyOptional({ description: 'Dispensing item ID' })
  @IsUUID()
  @IsOptional()
  dispensingItemId?: string;

  @ApiPropertyOptional({ description: 'Inventory ID (if restocking)' })
  @IsUUID()
  @IsOptional()
  inventoryId?: string;

  @ApiProperty({ description: 'Quantity returned' })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  quantityReturned: number;

  @ApiPropertyOptional({ description: 'Condition', enum: ['good', 'damaged', 'expired'], default: 'good' })
  @IsEnum(['good', 'damaged', 'expired'])
  @IsOptional()
  condition?: 'good' | 'damaged' | 'expired';

  @ApiPropertyOptional({ description: 'Can be restocked?', default: false })
  @IsBoolean()
  @IsOptional()
  restockable?: boolean;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateReturnDto {
  @ApiProperty({ description: 'Dispensing ID' })
  @IsUUID()
  @IsNotEmpty()
  dispensingId: string;

  @ApiPropertyOptional({ description: 'Return date', default: 'Current date' })
  @IsDateString()
  @IsOptional()
  returnDate?: string;

  @ApiProperty({ description: 'Return reason' })
  @IsString()
  @IsNotEmpty()
  returnReason: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ description: 'Return items', type: [CreateReturnItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateReturnItemDto)
  items: CreateReturnItemDto[];
}

// Stock Adjustment DTOs
export class CreateStockAdjustmentItemDto {
  @ApiProperty({ description: 'Inventory ID' })
  @IsUUID()
  @IsNotEmpty()
  inventoryId: string;

  @ApiProperty({ description: 'Quantity adjustment (positive for increase, negative for decrease)' })
  @IsInt()
  @IsNotEmpty()
  quantityAdjustment: number;

  @ApiPropertyOptional({ description: 'Unit cost' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  unitCost?: number;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateStockAdjustmentDto {
  @ApiProperty({ description: 'Adjustment date', default: 'Current date' })
  @IsDateString()
  @IsOptional()
  adjustmentDate?: string;

  @ApiProperty({ description: 'Adjustment type', enum: ['increase', 'decrease', 'correction'] })
  @IsEnum(['increase', 'decrease', 'correction'])
  @IsNotEmpty()
  adjustmentType: AdjustmentType;

  @ApiProperty({ description: 'Reason for adjustment' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ description: 'Adjustment items', type: [CreateStockAdjustmentItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateStockAdjustmentItemDto)
  items: CreateStockAdjustmentItemDto[];
}

// Pricing Rule DTOs
export class CreatePricingRuleDto {
  @ApiProperty({ description: 'Rule name' })
  @IsString()
  @IsNotEmpty()
  ruleName: string;

  @ApiProperty({ description: 'Rule type', enum: ['markup_percentage', 'markup_fixed', 'discount_percentage', 'discount_fixed', 'fixed_price'] })
  @IsEnum(['markup_percentage', 'markup_fixed', 'discount_percentage', 'discount_fixed', 'fixed_price'])
  @IsNotEmpty()
  ruleType: PricingRuleType;

  @ApiPropertyOptional({ description: 'Markup percentage (for markup_percentage type)' })
  @ValidateIf(o => o.ruleType === 'markup_percentage')
  @IsNumber()
  @Min(0)
  @IsOptional()
  markupPercentage?: number;

  @ApiPropertyOptional({ description: 'Markup fixed amount (for markup_fixed type)' })
  @ValidateIf(o => o.ruleType === 'markup_fixed')
  @IsNumber()
  @Min(0)
  @IsOptional()
  markupFixed?: number;

  @ApiPropertyOptional({ description: 'Discount percentage (for discount_percentage type)' })
  @ValidateIf(o => o.ruleType === 'discount_percentage')
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  discountPercentage?: number;

  @ApiPropertyOptional({ description: 'Discount fixed amount (for discount_fixed type)' })
  @ValidateIf(o => o.ruleType === 'discount_fixed')
  @IsNumber()
  @Min(0)
  @IsOptional()
  discountFixed?: number;

  @ApiPropertyOptional({ description: 'Fixed price (for fixed_price type)' })
  @ValidateIf(o => o.ruleType === 'fixed_price')
  @IsNumber()
  @Min(0)
  @IsOptional()
  fixedPrice?: number;

  @ApiProperty({ description: 'Applies to', enum: ['all', 'category', 'drug', 'supplier'] })
  @IsEnum(['all', 'category', 'drug', 'supplier'])
  @IsNotEmpty()
  appliesTo: PricingRuleAppliesTo;

  @ApiPropertyOptional({ description: 'Category ID (if applies_to is category)' })
  @ValidateIf(o => o.appliesTo === 'category')
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Drug ID (if applies_to is drug)' })
  @ValidateIf(o => o.appliesTo === 'drug')
  @IsUUID()
  @IsOptional()
  drugId?: string;

  @ApiPropertyOptional({ description: 'Supplier ID (if applies_to is supplier)' })
  @ValidateIf(o => o.appliesTo === 'supplier')
  @IsUUID()
  @IsOptional()
  supplierId?: string;

  @ApiPropertyOptional({ description: 'Priority (higher = applied first)', default: 0 })
  @IsInt()
  @IsOptional()
  priority?: number;

  @ApiPropertyOptional({ description: 'Active', default: true })
  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @ApiPropertyOptional({ description: 'Valid from date', default: 'Current date' })
  @IsDateString()
  @IsOptional()
  validFrom?: string;

  @ApiPropertyOptional({ description: 'Valid to date' })
  @IsDateString()
  @IsOptional()
  validTo?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdatePricingRuleDto extends PartialType(CreatePricingRuleDto) {}

// Formulary DTOs
export class CreateFormularyDto {
  @ApiPropertyOptional({ description: 'Medical aid ID' })
  @IsUUID()
  @IsOptional()
  medicalAidId?: string;

  @ApiPropertyOptional({ description: 'Medical aid name' })
  @IsString()
  @IsOptional()
  medicalAidName?: string;

  @ApiProperty({ description: 'Drug ID' })
  @IsUUID()
  @IsNotEmpty()
  drugId: string;

  @ApiPropertyOptional({ description: 'RxNorm code' })
  @IsString()
  @IsOptional()
  rxnormCode?: string;

  @ApiPropertyOptional({ description: 'Covered by insurance', default: true })
  @IsBoolean()
  @IsOptional()
  covered?: boolean;

  @ApiPropertyOptional({ description: 'Requires prior authorization', default: false })
  @IsBoolean()
  @IsOptional()
  requiresPriorAuth?: boolean;

  @ApiPropertyOptional({ description: 'Co-pay amount' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  coPayAmount?: number;

  @ApiPropertyOptional({ description: 'Co-pay percentage' })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  coPayPercentage?: number;

  @ApiPropertyOptional({ description: 'Maximum quantity per month' })
  @IsInt()
  @Min(1)
  @IsOptional()
  maxQuantityPerMonth?: number;

  @ApiPropertyOptional({ description: 'Maximum days supply' })
  @IsInt()
  @Min(1)
  @IsOptional()
  maxDaysSupply?: number;

  @ApiPropertyOptional({ description: 'Formulary tier' })
  @IsString()
  @IsOptional()
  tier?: string;

  @ApiPropertyOptional({ description: 'Effective date', default: 'Current date' })
  @IsDateString()
  @IsOptional()
  effectiveDate?: string;

  @ApiPropertyOptional({ description: 'Expiry date' })
  @IsDateString()
  @IsOptional()
  expiryDate?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateFormularyDto extends PartialType(CreateFormularyDto) {}

// Bulk Formulary Import DTO
export class BulkFormularyImportDto {
  @ApiProperty({ description: 'Medical aid ID' })
  @IsUUID()
  @IsNotEmpty()
  medicalAidId: string;

  @ApiProperty({ description: 'Formulary entries', type: [CreateFormularyDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFormularyDto)
  entries: CreateFormularyDto[];
}

// Query DTOs
export class PharmacyInventoryFiltersDto {
  @ApiPropertyOptional({ description: 'Search term (drug name, RxNorm code)' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Drug ID' })
  @IsUUID()
  @IsOptional()
  drugId?: string;

  @ApiPropertyOptional({ description: 'Supplier ID' })
  @IsUUID()
  @IsOptional()
  supplierId?: string;

  @ApiPropertyOptional({ description: 'Status', enum: ['active', 'discontinued', 'expired', 'recalled'] })
  @IsEnum(['active', 'discontinued', 'expired', 'recalled'])
  @IsOptional()
  status?: InventoryStatus;

  @ApiPropertyOptional({ description: 'Low stock only', default: false })
  @IsBoolean()
  @IsOptional()
  lowStockOnly?: boolean;

  @ApiPropertyOptional({ description: 'Expiring soon (days ahead)', default: 30 })
  @IsInt()
  @Min(1)
  @IsOptional()
  expiringDaysAhead?: number;
}

export class PharmacyDispensingFiltersDto {
  @ApiPropertyOptional({ description: 'Prescription ID' })
  @IsUUID()
  @IsOptional()
  prescriptionId?: string;

  @ApiPropertyOptional({ description: 'Patient ID' })
  @IsUUID()
  @IsOptional()
  patientId?: string;

  @ApiPropertyOptional({ description: 'Status', enum: ['pending', 'dispensed', 'partial', 'cancelled', 'returned'] })
  @IsEnum(['pending', 'dispensed', 'partial', 'cancelled', 'returned'])
  @IsOptional()
  status?: DispensingStatus;

  @ApiPropertyOptional({ description: 'Payment status', enum: ['pending', 'paid', 'partially_paid', 'refunded'] })
  @IsEnum(['pending', 'paid', 'partially_paid', 'refunded'])
  @IsOptional()
  paymentStatus?: PaymentStatus;

  @ApiPropertyOptional({ description: 'Date from' })
  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Date to' })
  @IsDateString()
  @IsOptional()
  dateTo?: string;
}

export class CalculatePriceDto {
  @ApiProperty({ description: 'Drug ID' })
  @IsUUID()
  @IsNotEmpty()
  drugId: string;

  @ApiProperty({ description: 'Quantity' })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  quantity: number;

  @ApiPropertyOptional({ description: 'Medical aid ID (for formulary checking)' })
  @IsUUID()
  @IsOptional()
  medicalAidId?: string;
}

export class CheckFormularyDto {
  @ApiProperty({ description: 'Prescription ID' })
  @IsUUID()
  @IsNotEmpty()
  prescriptionId: string;

  @ApiProperty({ description: 'Medical aid ID' })
  @IsUUID()
  @IsNotEmpty()
  medicalAidId: string;
}

// Dispensing Update DTO
export class UpdateDispensingDto {
  @ApiPropertyOptional({ description: 'Status', enum: ['pending', 'dispensed', 'partial', 'cancelled', 'returned'] })
  @IsEnum(['pending', 'dispensed', 'partial', 'cancelled', 'returned'])
  @IsOptional()
  status?: DispensingStatus;

  @ApiPropertyOptional({ description: 'Payment status', enum: ['pending', 'paid', 'partially_paid', 'refunded'] })
  @IsEnum(['pending', 'paid', 'partially_paid', 'refunded'])
  @IsOptional()
  paymentStatus?: PaymentStatus;

  @ApiPropertyOptional({ description: 'Payment method' })
  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

// Alert DTOs
export class CreateAlertDto {
  @ApiProperty({ description: 'Alert type', enum: ['low_stock', 'out_of_stock', 'expiring_soon', 'expired', 'reorder_due', 'price_change'] })
  @IsEnum(['low_stock', 'out_of_stock', 'expiring_soon', 'expired', 'reorder_due', 'price_change'])
  @IsNotEmpty()
  alertType: AlertType;

  @ApiPropertyOptional({ description: 'Inventory ID' })
  @IsUUID()
  @IsOptional()
  inventoryId?: string;

  @ApiProperty({ description: 'Severity', enum: ['low', 'medium', 'high', 'critical'], default: 'medium' })
  @IsEnum(['low', 'medium', 'high', 'critical'])
  @IsOptional()
  severity?: AlertSeverity;

  @ApiProperty({ description: 'Alert message' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({ description: 'Resolved', default: false })
  @IsBoolean()
  @IsOptional()
  resolved?: boolean;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateAlertDto {
  @ApiPropertyOptional({ description: 'Resolved', default: false })
  @IsBoolean()
  @IsOptional()
  resolved?: boolean;

  @ApiPropertyOptional({ description: 'Resolved at' })
  @IsDateString()
  @IsOptional()
  resolvedAt?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

