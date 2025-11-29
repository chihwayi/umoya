# Sprint 8: Pharmacy Management System

## Overview

**Sprint Duration**: 4-6 weeks  
**Goal**: Implement comprehensive pharmacy management system with inventory tracking, prescription dispensing, supplier management, and financial analytics.

**Priority**: High - Critical for complete clinic operations

---

## Phase 1: Database Schema & Core Infrastructure (Week 1-2)

### 1.1 Database Schema Creation

#### Core Inventory Tables
- [ ] `pharmacy_inventory` - Main inventory table
  - `id` (UUID, PK)
  - `drug_id` (FK to drugs table)
  - `rxnorm_code` (VARCHAR) - RxNorm code for the drug
  - `rxnorm_name` (TEXT) - RxNorm name
  - `batch_number` (VARCHAR) - Batch/lot number
  - `expiry_date` (DATE) - Expiry date
  - `manufacturing_date` (DATE) - Manufacturing date
  - `quantity_on_hand` (INTEGER) - Current stock quantity
  - `quantity_reserved` (INTEGER) - Reserved for pending prescriptions
  - `quantity_available` (INTEGER) - Available = on_hand - reserved
  - `unit_cost` (DECIMAL) - Cost per unit (purchase price)
  - `unit_price` (DECIMAL) - Selling price per unit
  - `reorder_level` (INTEGER) - Minimum stock level
  - `reorder_quantity` (INTEGER) - Quantity to order when reordering
  - `maximum_stock_level` (INTEGER) - Maximum stock to maintain
  - `location` (VARCHAR) - Storage location (shelf, fridge, etc.)
  - `storage_conditions` (VARCHAR) - Temperature, light, etc.
  - `supplier_id` (FK to pharmacy_suppliers)
  - `last_purchase_date` (DATE)
  - `last_purchase_price` (DECIMAL)
  - `status` (ENUM: active, discontinued, expired, recalled)
  - Audit fields (created_at, updated_at, created_by, updated_by)

- [ ] `pharmacy_suppliers` - Supplier management
  - `id` (UUID, PK)
  - `name` (VARCHAR) - Supplier name
  - `contact_person` (VARCHAR)
  - `email` (VARCHAR)
  - `phone` (VARCHAR)
  - `address` (TEXT)
  - `city` (VARCHAR)
  - `country` (VARCHAR)
  - `payment_terms` (VARCHAR) - e.g., "Net 30", "COD"
  - `tax_id` (VARCHAR)
  - `status` (ENUM: active, inactive)
  - `notes` (TEXT)
  - Audit fields

- [ ] `pharmacy_purchase_orders` - Purchase orders
  - `id` (UUID, PK)
  - `order_number` (VARCHAR, UNIQUE) - Auto-generated PO number
  - `supplier_id` (FK to pharmacy_suppliers)
  - `order_date` (DATE)
  - `expected_delivery_date` (DATE)
  - `status` (ENUM: draft, pending, approved, ordered, received, cancelled)
  - `total_amount` (DECIMAL)
  - `currency` (VARCHAR) - USD, ZWL, etc.
  - `notes` (TEXT)
  - `approved_by` (FK to users)
  - `approved_at` (TIMESTAMP)
  - `ordered_by` (FK to users)
  - Audit fields

- [ ] `pharmacy_purchase_order_items` - PO line items
  - `id` (UUID, PK)
  - `purchase_order_id` (FK to pharmacy_purchase_orders)
  - `drug_id` (FK to drugs)
  - `rxnorm_code` (VARCHAR)
  - `quantity_ordered` (INTEGER)
  - `unit_cost` (DECIMAL)
  - `total_cost` (DECIMAL)
  - `quantity_received` (INTEGER) - Default 0
  - `notes` (TEXT)
  - Audit fields

- [ ] `pharmacy_receipts` - Goods received notes
  - `id` (UUID, PK)
  - `receipt_number` (VARCHAR, UNIQUE) - Auto-generated GRN number
  - `purchase_order_id` (FK to pharmacy_purchase_orders)
  - `supplier_id` (FK to pharmacy_suppliers)
  - `receipt_date` (DATE)
  - `received_by` (FK to users)
  - `verified_by` (FK to users)
  - `status` (ENUM: pending, verified, rejected)
  - `notes` (TEXT)
  - Audit fields

- [ ] `pharmacy_receipt_items` - GRN line items
  - `id` (UUID, PK)
  - `receipt_id` (FK to pharmacy_receipts)
  - `purchase_order_item_id` (FK to pharmacy_purchase_order_items)
  - `drug_id` (FK to drugs)
  - `batch_number` (VARCHAR)
  - `expiry_date` (DATE)
  - `manufacturing_date` (DATE)
  - `quantity_received` (INTEGER)
  - `unit_cost` (DECIMAL)
  - `total_cost` (DECIMAL)
  - `condition` (ENUM: good, damaged, expired, short_supply)
  - `notes` (TEXT)
  - Audit fields

#### Dispensing Tables
- [ ] `pharmacy_dispensings` - Prescription dispensing
  - `id` (UUID, PK)
  - `prescription_id` (FK to prescriptions)
  - `patient_id` (FK to patients)
  - `dispensing_number` (VARCHAR, UNIQUE) - Auto-generated
  - `dispensing_date` (DATE)
  - `dispensed_by` (FK to users) - Pharmacist
  - `status` (ENUM: pending, dispensed, partial, cancelled, returned)
  - `payment_status` (ENUM: pending, paid, partially_paid, refunded)
  - `payment_method` (VARCHAR) - cash, card, medical_aid, etc.
  - `total_amount` (DECIMAL)
  - `amount_paid` (DECIMAL)
  - `discount_amount` (DECIMAL)
  - `notes` (TEXT)
  - Audit fields

- [ ] `pharmacy_dispensing_items` - Dispensed medications
  - `id` (UUID, PK)
  - `dispensing_id` (FK to pharmacy_dispensings)
  - `inventory_id` (FK to pharmacy_inventory)
  - `drug_id` (FK to drugs)
  - `rxnorm_code` (VARCHAR)
  - `batch_number` (VARCHAR)
  - `expiry_date` (DATE)
  - `quantity_dispensed` (INTEGER)
  - `unit_price` (DECIMAL)
  - `total_price` (DECIMAL)
  - `instructions` (TEXT) - Patient instructions
  - `notes` (TEXT)
  - Audit fields

- [ ] `pharmacy_returns` - Returned medications
  - `id` (UUID, PK)
  - `dispensing_id` (FK to pharmacy_dispensings)
  - `return_date` (DATE)
  - `return_reason` (VARCHAR) - expired, damaged, patient_request, error, etc.
  - `returned_by` (FK to users)
  - `approved_by` (FK to users)
  - `status` (ENUM: pending, approved, rejected, processed)
  - `refund_amount` (DECIMAL)
  - `notes` (TEXT)
  - Audit fields

- [ ] `pharmacy_return_items` - Return line items
  - `id` (UUID, PK)
  - `return_id` (FK to pharmacy_returns)
  - `dispensing_item_id` (FK to pharmacy_dispensing_items)
  - `inventory_id` (FK to pharmacy_inventory)
  - `quantity_returned` (INTEGER)
  - `condition` (ENUM: good, damaged, expired)
  - `restockable` (BOOLEAN) - Can be restocked?
  - `notes` (TEXT)
  - Audit fields

#### Stock Movement & Adjustments
- [ ] `pharmacy_stock_movements` - Stock transaction log
  - `id` (UUID, PK)
  - `inventory_id` (FK to pharmacy_inventory)
  - `movement_type` (ENUM: purchase, sale, return, adjustment, expiry, damage, transfer)
  - `reference_type` (VARCHAR) - purchase_order, dispensing, return, adjustment, etc.
  - `reference_id` (UUID) - ID of related record
  - `quantity_before` (INTEGER)
  - `quantity_change` (INTEGER) - Positive for additions, negative for deductions
  - `quantity_after` (INTEGER)
  - `unit_cost` (DECIMAL)
  - `movement_date` (DATE)
  - `performed_by` (FK to users)
  - `reason` (TEXT)
  - `notes` (TEXT)
  - Audit fields

- [ ] `pharmacy_stock_adjustments` - Manual stock adjustments
  - `id` (UUID, PK)
  - `adjustment_number` (VARCHAR, UNIQUE)
  - `adjustment_date` (DATE)
  - `adjustment_type` (ENUM: increase, decrease, correction)
  - `reason` (VARCHAR) - stock_take, damage, expiry, theft, correction, etc.
  - `approved_by` (FK to users)
  - `performed_by` (FK to users)
  - `status` (ENUM: pending, approved, rejected, processed)
  - `notes` (TEXT)
  - Audit fields

- [ ] `pharmacy_stock_adjustment_items` - Adjustment line items
  - `id` (UUID, PK)
  - `adjustment_id` (FK to pharmacy_stock_adjustments)
  - `inventory_id` (FK to pharmacy_inventory)
  - `quantity_before` (INTEGER)
  - `quantity_adjustment` (INTEGER)
  - `quantity_after` (INTEGER)
  - `unit_cost` (DECIMAL)
  - `notes` (TEXT)
  - Audit fields

#### Pricing & Formulary
- [ ] `pharmacy_pricing_rules` - Pricing rules
  - `id` (UUID, PK)
  - `rule_name` (VARCHAR)
  - `rule_type` (ENUM: markup_percentage, markup_fixed, discount_percentage, discount_fixed, fixed_price)
  - `markup_percentage` (DECIMAL) - e.g., 20% markup
  - `markup_fixed` (DECIMAL) - Fixed amount markup
  - `discount_percentage` (DECIMAL)
  - `discount_fixed` (DECIMAL)
  - `fixed_price` (DECIMAL)
  - `applies_to` (ENUM: all, category, drug, supplier)
  - `category_id` (FK to drug_categories, nullable)
  - `drug_id` (FK to drugs, nullable)
  - `supplier_id` (FK to pharmacy_suppliers, nullable)
  - `priority` (INTEGER) - Rule priority (higher = applied first)
  - `active` (BOOLEAN)
  - `valid_from` (DATE)
  - `valid_to` (DATE, nullable)
  - `notes` (TEXT)
  - Audit fields

- [ ] `pharmacy_formulary` - Insurance formulary checking
  - `id` (UUID, PK)
  - `medical_aid_id` (FK to medical_aids, nullable) - Specific medical aid
  - `medical_aid_name` (VARCHAR) - Or general formulary
  - `drug_id` (FK to drugs)
  - `rxnorm_code` (VARCHAR)
  - `covered` (BOOLEAN) - Is drug covered?
  - `requires_prior_auth` (BOOLEAN) - Requires prior authorization
  - `co_pay_amount` (DECIMAL) - Patient co-pay
  - `co_pay_percentage` (DECIMAL) - Patient co-pay percentage
  - `max_quantity_per_month` (INTEGER, nullable)
  - `max_days_supply` (INTEGER, nullable)
  - `tier` (VARCHAR) - Formulary tier (Tier 1, Tier 2, Tier 3)
  - `effective_date` (DATE)
  - `expiry_date` (DATE, nullable)
  - `notes` (TEXT)
  - Audit fields

#### Alerts & Notifications
- [ ] `pharmacy_alerts` - Stock and expiry alerts
  - `id` (UUID, PK)
  - `alert_type` (ENUM: low_stock, out_of_stock, expiring_soon, expired, reorder_due, price_change)
  - `inventory_id` (FK to pharmacy_inventory, nullable)
  - `severity` (ENUM: low, medium, high, critical)
  - `alert_message` (TEXT)
  - `related_data` (JSONB) - Additional alert data
  - `acknowledged` (BOOLEAN)
  - `acknowledged_by` (FK to users, nullable)
  - `acknowledged_at` (TIMESTAMP, nullable)
  - `resolved` (BOOLEAN)
  - `resolved_at` (TIMESTAMP, nullable)
  - `created_at` (TIMESTAMP)
  - Audit fields

### 1.2 TypeORM Entities

- [ ] `PharmacyInventory` entity
- [ ] `PharmacySupplier` entity
- [ ] `PharmacyPurchaseOrder` entity
- [ ] `PharmacyPurchaseOrderItem` entity
- [ ] `PharmacyReceipt` entity
- [ ] `PharmacyReceiptItem` entity
- [ ] `PharmacyDispensing` entity
- [ ] `PharmacyDispensingItem` entity
- [ ] `PharmacyReturn` entity
- [ ] `PharmacyReturnItem` entity
- [ ] `PharmacyStockMovement` entity
- [ ] `PharmacyStockAdjustment` entity
- [ ] `PharmacyStockAdjustmentItem` entity
- [ ] `PharmacyPricingRule` entity
- [ ] `PharmacyFormulary` entity
- [ ] `PharmacyAlert` entity

### 1.3 DTOs & Validation

- [ ] `CreateInventoryDto`
- [ ] `UpdateInventoryDto`
- [ ] `CreateSupplierDto`
- [ ] `UpdateSupplierDto`
- [ ] `CreatePurchaseOrderDto`
- [ ] `UpdatePurchaseOrderDto`
- [ ] `CreateReceiptDto`
- [ ] `CreateDispensingDto`
- [ ] `CreateReturnDto`
- [ ] `CreateStockAdjustmentDto`
- [ ] `CreatePricingRuleDto`
- [ ] `CreateFormularyDto`

---

## Phase 2: Services & Controllers (Week 2-3)

### 2.1 Pharmacy Service

**File**: `services/ehr-service/src/services/pharmacy.service.ts`

#### Inventory Management
- [ ] `getInventory(tenantDb, filters)` - Get inventory with filters
- [ ] `getInventoryItem(tenantDb, inventoryId)` - Get single item
- [ ] `createInventoryItem(tenantDb, dto, userId)` - Add new inventory
- [ ] `updateInventoryItem(tenantDb, inventoryId, dto, userId)` - Update inventory
- [ ] `deleteInventoryItem(tenantDb, inventoryId, userId)` - Delete inventory
- [ ] `searchInventory(tenantDb, searchTerm)` - Search by drug name/RxNorm
- [ ] `getLowStockItems(tenantDb)` - Get items below reorder level
- [ ] `getExpiringItems(tenantDb, daysAhead)` - Get items expiring soon
- [ ] `getExpiredItems(tenantDb)` - Get expired items
- [ ] `updateStockLevel(tenantDb, inventoryId, quantity, reason)` - Update stock

#### Supplier Management
- [ ] `getSuppliers(tenantDb, filters)` - Get suppliers
- [ ] `getSupplier(tenantDb, supplierId)` - Get single supplier
- [ ] `createSupplier(tenantDb, dto, userId)` - Create supplier
- [ ] `updateSupplier(tenantDb, supplierId, dto, userId)` - Update supplier
- [ ] `deleteSupplier(tenantDb, supplierId, userId)` - Delete supplier

#### Purchase Orders
- [ ] `getPurchaseOrders(tenantDb, filters)` - Get purchase orders
- [ ] `getPurchaseOrder(tenantDb, orderId)` - Get single PO
- [ ] `createPurchaseOrder(tenantDb, dto, userId)` - Create PO
- [ ] `updatePurchaseOrder(tenantDb, orderId, dto, userId)` - Update PO
- [ ] `approvePurchaseOrder(tenantDb, orderId, userId)` - Approve PO
- [ ] `cancelPurchaseOrder(tenantDb, orderId, userId, reason)` - Cancel PO
- [ ] `generatePurchaseOrderNumber(tenantDb)` - Auto-generate PO number

#### Receipts (GRN)
- [ ] `getReceipts(tenantDb, filters)` - Get receipts
- [ ] `getReceipt(tenantDb, receiptId)` - Get single receipt
- [ ] `createReceipt(tenantDb, purchaseOrderId, dto, userId)` - Create GRN
- [ ] `verifyReceipt(tenantDb, receiptId, userId)` - Verify receipt
- [ ] `rejectReceipt(tenantDb, receiptId, userId, reason)` - Reject receipt
- [ ] `processReceipt(tenantDb, receiptId, userId)` - Process receipt and update inventory
- [ ] `generateReceiptNumber(tenantDb)` - Auto-generate GRN number

#### Dispensing
- [ ] `getDispensings(tenantDb, filters)` - Get dispensings
- [ ] `getDispensing(tenantDb, dispensingId)` - Get single dispensing
- [ ] `createDispensing(tenantDb, prescriptionId, dto, userId)` - Create dispensing
- [ ] `dispensePrescription(tenantDb, prescriptionId, userId)` - Dispense prescription
- [ ] `partialDispense(tenantDb, dispensingId, items, userId)` - Partial dispensing
- [ ] `cancelDispensing(tenantDb, dispensingId, userId, reason)` - Cancel dispensing
- [ ] `generateDispensingNumber(tenantDb)` - Auto-generate dispensing number
- [ ] `checkStockAvailability(tenantDb, prescriptionId)` - Check if prescription can be dispensed
- [ ] `calculateDispensingPrice(tenantDb, prescriptionId, medicalAidId)` - Calculate price with formulary

#### Returns
- [ ] `getReturns(tenantDb, filters)` - Get returns
- [ ] `getReturn(tenantDb, returnId)` - Get single return
- [ ] `createReturn(tenantDb, dispensingId, dto, userId)` - Create return
- [ ] `approveReturn(tenantDb, returnId, userId)` - Approve return
- [ ] `rejectReturn(tenantDb, returnId, userId, reason)` - Reject return
- [ ] `processReturn(tenantDb, returnId, userId)` - Process return and restock

#### Stock Adjustments
- [ ] `getStockAdjustments(tenantDb, filters)` - Get adjustments
- [ ] `getStockAdjustment(tenantDb, adjustmentId)` - Get single adjustment
- [ ] `createStockAdjustment(tenantDb, dto, userId)` - Create adjustment
- [ ] `approveStockAdjustment(tenantDb, adjustmentId, userId)` - Approve adjustment
- [ ] `processStockAdjustment(tenantDb, adjustmentId, userId)` - Process adjustment
- [ ] `generateAdjustmentNumber(tenantDb)` - Auto-generate adjustment number

#### Stock Movements
- [ ] `getStockMovements(tenantDb, inventoryId, filters)` - Get stock movements for item
- [ ] `getStockMovementHistory(tenantDb, filters)` - Get all stock movements
- [ ] `recordStockMovement(tenantDb, movement)` - Record stock movement (internal)

#### Pricing
- [ ] `getPricingRules(tenantDb, filters)` - Get pricing rules
- [ ] `createPricingRule(tenantDb, dto, userId)` - Create pricing rule
- [ ] `updatePricingRule(tenantDb, ruleId, dto, userId)` - Update pricing rule
- [ ] `deletePricingRule(tenantDb, ruleId, userId)` - Delete pricing rule
- [ ] `calculatePrice(tenantDb, drugId, quantity, medicalAidId)` - Calculate price using rules
- [ ] `applyPricingRules(tenantDb, drugId, cost, medicalAidId)` - Apply pricing rules

#### Formulary
- [ ] `getFormulary(tenantDb, medicalAidId, drugId)` - Check formulary
- [ ] `checkFormularyCoverage(tenantDb, prescriptionId, medicalAidId)` - Check prescription coverage
- [ ] `createFormularyEntry(tenantDb, dto, userId)` - Create formulary entry
- [ ] `updateFormularyEntry(tenantDb, entryId, dto, userId)` - Update formulary entry
- [ ] `bulkImportFormulary(tenantDb, medicalAidId, entries, userId)` - Bulk import formulary

#### Alerts
- [ ] `getAlerts(tenantDb, filters)` - Get alerts
- [ ] `acknowledgeAlert(tenantDb, alertId, userId)` - Acknowledge alert
- [ ] `resolveAlert(tenantDb, alertId, userId)` - Resolve alert
- [ ] `generateAlerts(tenantDb)` - Generate alerts (low stock, expiry, etc.)

#### Analytics & Reports
- [ ] `getInventorySummary(tenantDb)` - Inventory summary
- [ ] `getSalesReport(tenantDb, dateRange)` - Sales report
- [ ] `getProfitMarginReport(tenantDb, dateRange)` - Profit margin analysis
- [ ] `getTopSellingDrugs(tenantDb, dateRange, limit)` - Top selling drugs
- [ ] `getExpiryReport(tenantDb, daysAhead)` - Expiry report
- [ ] `getStockValuation(tenantDb)` - Total stock valuation
- [ ] `getSupplierPerformance(tenantDb, dateRange)` - Supplier performance

### 2.2 Pharmacy Controller

**File**: `services/ehr-service/src/controllers/pharmacy.controller.ts`

#### Inventory Endpoints
- [ ] `GET /pharmacy/inventory` - Get inventory list
- [ ] `GET /pharmacy/inventory/:id` - Get inventory item
- [ ] `POST /pharmacy/inventory` - Create inventory item
- [ ] `PUT /pharmacy/inventory/:id` - Update inventory item
- [ ] `DELETE /pharmacy/inventory/:id` - Delete inventory item
- [ ] `GET /pharmacy/inventory/search` - Search inventory
- [ ] `GET /pharmacy/inventory/low-stock` - Get low stock items
- [ ] `GET /pharmacy/inventory/expiring` - Get expiring items
- [ ] `GET /pharmacy/inventory/expired` - Get expired items

#### Supplier Endpoints
- [ ] `GET /pharmacy/suppliers` - Get suppliers
- [ ] `GET /pharmacy/suppliers/:id` - Get supplier
- [ ] `POST /pharmacy/suppliers` - Create supplier
- [ ] `PUT /pharmacy/suppliers/:id` - Update supplier
- [ ] `DELETE /pharmacy/suppliers/:id` - Delete supplier

#### Purchase Order Endpoints
- [ ] `GET /pharmacy/purchase-orders` - Get purchase orders
- [ ] `GET /pharmacy/purchase-orders/:id` - Get purchase order
- [ ] `POST /pharmacy/purchase-orders` - Create purchase order
- [ ] `PUT /pharmacy/purchase-orders/:id` - Update purchase order
- [ ] `POST /pharmacy/purchase-orders/:id/approve` - Approve purchase order
- [ ] `POST /pharmacy/purchase-orders/:id/cancel` - Cancel purchase order

#### Receipt Endpoints
- [ ] `GET /pharmacy/receipts` - Get receipts
- [ ] `GET /pharmacy/receipts/:id` - Get receipt
- [ ] `POST /pharmacy/receipts` - Create receipt
- [ ] `POST /pharmacy/receipts/:id/verify` - Verify receipt
- [ ] `POST /pharmacy/receipts/:id/reject` - Reject receipt
- [ ] `POST /pharmacy/receipts/:id/process` - Process receipt

#### Dispensing Endpoints
- [ ] `GET /pharmacy/dispensings` - Get dispensings
- [ ] `GET /pharmacy/dispensings/:id` - Get dispensing
- [ ] `POST /pharmacy/dispensings` - Create dispensing
- [ ] `POST /pharmacy/dispensings/prescription/:prescriptionId` - Dispense prescription
- [ ] `POST /pharmacy/dispensings/:id/partial` - Partial dispense
- [ ] `POST /pharmacy/dispensings/:id/cancel` - Cancel dispensing
- [ ] `GET /pharmacy/dispensings/prescription/:prescriptionId/check-stock` - Check stock availability
- [ ] `GET /pharmacy/dispensings/prescription/:prescriptionId/calculate-price` - Calculate price

#### Return Endpoints
- [ ] `GET /pharmacy/returns` - Get returns
- [ ] `GET /pharmacy/returns/:id` - Get return
- [ ] `POST /pharmacy/returns` - Create return
- [ ] `POST /pharmacy/returns/:id/approve` - Approve return
- [ ] `POST /pharmacy/returns/:id/reject` - Reject return
- [ ] `POST /pharmacy/returns/:id/process` - Process return

#### Stock Adjustment Endpoints
- [ ] `GET /pharmacy/stock-adjustments` - Get adjustments
- [ ] `GET /pharmacy/stock-adjustments/:id` - Get adjustment
- [ ] `POST /pharmacy/stock-adjustments` - Create adjustment
- [ ] `POST /pharmacy/stock-adjustments/:id/approve` - Approve adjustment
- [ ] `POST /pharmacy/stock-adjustments/:id/process` - Process adjustment

#### Pricing Endpoints
- [ ] `GET /pharmacy/pricing-rules` - Get pricing rules
- [ ] `POST /pharmacy/pricing-rules` - Create pricing rule
- [ ] `PUT /pharmacy/pricing-rules/:id` - Update pricing rule
- [ ] `DELETE /pharmacy/pricing-rules/:id` - Delete pricing rule
- [ ] `POST /pharmacy/pricing-rules/calculate` - Calculate price

#### Formulary Endpoints
- [ ] `GET /pharmacy/formulary` - Get formulary entries
- [ ] `GET /pharmacy/formulary/check` - Check formulary coverage
- [ ] `POST /pharmacy/formulary` - Create formulary entry
- [ ] `PUT /pharmacy/formulary/:id` - Update formulary entry
- [ ] `POST /pharmacy/formulary/bulk-import` - Bulk import formulary

#### Alert Endpoints
- [ ] `GET /pharmacy/alerts` - Get alerts
- [ ] `POST /pharmacy/alerts/:id/acknowledge` - Acknowledge alert
- [ ] `POST /pharmacy/alerts/:id/resolve` - Resolve alert

#### Report Endpoints
- [ ] `GET /pharmacy/reports/inventory-summary` - Inventory summary
- [ ] `GET /pharmacy/reports/sales` - Sales report
- [ ] `GET /pharmacy/reports/profit-margin` - Profit margin report
- [ ] `GET /pharmacy/reports/top-selling` - Top selling drugs
- [ ] `GET /pharmacy/reports/expiry` - Expiry report
- [ ] `GET /pharmacy/reports/stock-valuation` - Stock valuation
- [ ] `GET /pharmacy/reports/supplier-performance` - Supplier performance

---

## Phase 3: Frontend Components (Week 3-4)

### 3.1 Pharmacy Dashboard

**File**: `ehr-frontend/src/pages/PharmacyDashboard.tsx`

- [ ] Dashboard layout with sidebar navigation
- [ ] Key metrics cards:
  - Total inventory value
  - Low stock items count
  - Expiring items count
  - Today's dispensings
  - Today's sales
  - Pending purchase orders
- [ ] Recent activity feed
- [ ] Quick actions panel
- [ ] Alerts panel

### 3.2 Inventory Management Interface

**File**: `ehr-frontend/src/components/PharmacyInventory.tsx`

- [ ] Inventory list with filters (drug name, category, supplier, status)
- [ ] Search functionality
- [ ] Add/Edit inventory item modal
- [ ] Batch number and expiry date management
- [ ] Stock level indicators (low stock, out of stock)
- [ ] Expiry date warnings
- [ ] Bulk operations (update prices, reorder levels)
- [ ] Export to CSV/Excel

### 3.3 Purchase Order Interface

**File**: `ehr-frontend/src/components/PharmacyPurchaseOrders.tsx`

- [ ] Purchase order list with filters
- [ ] Create purchase order form
- [ ] Add items to PO (with RxNorm search)
- [ ] PO approval workflow
- [ ] PO status tracking
- [ ] Print PO functionality
- [ ] Email PO to supplier

### 3.4 Receipt (GRN) Interface

**File**: `ehr-frontend/src/components/PharmacyReceipts.tsx`

- [ ] Receipt list
- [ ] Create receipt from PO
- [ ] Verify receipt items
- [ ] Batch number and expiry entry
- [ ] Process receipt (update inventory)
- [ ] Receipt history

### 3.5 Dispensing Interface

**File**: `ehr-frontend/src/components/PharmacyDispensing.tsx`

- [ ] Pending prescriptions list
- [ ] Dispense prescription workflow
- [ ] Stock availability check
- [ ] Formulary coverage check
- [ ] Price calculation with discounts
- [ ] Batch selection (FIFO - First In First Out)
- [ ] Print dispensing label
- [ ] Payment processing integration
- [ ] Dispensing history

### 3.6 Returns Interface

**File**: `ehr-frontend/src/components/PharmacyReturns.tsx`

- [ ] Return request form
- [ ] Return approval workflow
- [ ] Restock decision (restockable vs non-restockable)
- [ ] Refund processing
- [ ] Return history

### 3.7 Stock Adjustment Interface

**File**: `ehr-frontend/src/components/PharmacyStockAdjustments.tsx`

- [ ] Stock adjustment form
- [ ] Adjustment approval workflow
- [ ] Reason selection
- [ ] Adjustment history
- [ ] Stock take integration

### 3.8 Supplier Management Interface

**File**: `ehr-frontend/src/components/PharmacySuppliers.tsx`

- [ ] Supplier list
- [ ] Add/Edit supplier form
- [ ] Supplier contact information
- [ ] Supplier performance metrics
- [ ] Purchase history per supplier

### 3.9 Pricing Rules Interface

**File**: `ehr-frontend/src/components/PharmacyPricingRules.tsx`

- [ ] Pricing rules list
- [ ] Create/Edit pricing rule form
- [ ] Rule priority management
- [ ] Rule testing (preview price calculation)
- [ ] Rule history

### 3.10 Formulary Management Interface

**File**: `ehr-frontend/src/components/PharmacyFormulary.tsx`

- [ ] Formulary entries list (by medical aid)
- [ ] Add/Edit formulary entry
- [ ] Bulk import formulary (CSV upload)
- [ ] Formulary coverage checker
- [ ] Prior authorization requirements

### 3.11 Reports Interface

**File**: `ehr-frontend/src/components/PharmacyReports.tsx`

- [ ] Report selection panel
- [ ] Date range picker
- [ ] Report visualization (charts, tables)
- [ ] Export reports (PDF, Excel, CSV)
- [ ] Scheduled reports

---

## Phase 4: Integration & Testing (Week 4-5)

### 4.1 Integration with Existing Modules

- [ ] **Prescription Integration**
  - Link prescriptions to dispensings
  - Auto-check stock when prescription created
  - Update prescription status when dispensed
  - Handle partial dispensing

- [ ] **Billing Integration**
  - Create billing entry when dispensing
  - Link dispensing to payment
  - Handle medical aid claims for medications
  - Discount application

- [ ] **Patient Integration**
  - Show patient medication history
  - Link dispensings to patient records
  - Medication adherence tracking

- [ ] **RxNorm Integration**
  - Use RxNorm codes for drug identification
  - Search drugs by RxNorm
  - Link to RxNorm API for drug information

### 4.2 Automated Alerts Testing

- [ ] Low stock alert generation
- [ ] Expiry alert generation
- [ ] Reorder alert generation
- [ ] Alert acknowledgment workflow
- [ ] Alert resolution workflow

### 4.3 Workflow Testing

- [ ] Purchase order workflow (create → approve → order → receive)
- [ ] Dispensing workflow (prescription → check stock → dispense → payment)
- [ ] Return workflow (return request → approve → process → restock)
- [ ] Stock adjustment workflow (create → approve → process)

### 4.4 End-to-End Testing

- [ ] Complete inventory cycle (purchase → receipt → dispensing → return)
- [ ] Pricing calculation with multiple rules
- [ ] Formulary checking during dispensing
- [ ] Stock movement tracking
- [ ] Financial reporting accuracy

---

## Phase 5: Documentation & Training (Week 5-6)

### 5.1 API Documentation

- [ ] Swagger/OpenAPI documentation
- [ ] Endpoint descriptions
- [ ] Request/response examples
- [ ] Error handling documentation

### 5.2 User Documentation

- [ ] Pharmacy user guide
- [ ] Inventory management guide
- [ ] Dispensing workflow guide
- [ ] Purchase order guide
- [ ] Reports guide

### 5.3 Training Materials

- [ ] Video tutorials
- [ ] Step-by-step guides
- [ ] FAQ document
- [ ] Best practices guide

---

## Key Features Summary

1. ✅ Complete inventory management with batch tracking
2. ✅ Purchase order and receipt (GRN) management
3. ✅ Prescription-to-dispensing workflow
4. ✅ Stock movement tracking
5. ✅ Returns and refunds management
6. ✅ Pricing rules engine
7. ✅ Insurance formulary checking
8. ✅ Automated alerts (low stock, expiry)
9. ✅ Financial analytics and reporting
10. ✅ Supplier management

---

## Dependencies

- ✅ Existing prescriptions module
- ✅ Existing billing module
- ✅ Existing patients module
- ✅ RxNorm integration (already implemented)
- ✅ SNOMED CT integration (for drug coding)
- ✅ Medical aids module (for formulary)

---

## Success Criteria

- [ ] All inventory operations functional
- [ ] Purchase order workflow complete
- [ ] Dispensing workflow integrated with prescriptions
- [ ] Stock alerts working correctly
- [ ] Pricing rules calculating correctly
- [ ] Formulary checking working
- [ ] Reports generating accurately
- [ ] All integrations tested and working

---

**Last Updated**: Sprint 8 Planning  
**Status**: 🚧 In Planning


