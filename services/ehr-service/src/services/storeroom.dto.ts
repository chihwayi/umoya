export interface CreateLocationDto {
  name: string;
  code: string;
  location_type: 'central_storeroom' | 'ward' | 'pharmacy' | 'lab' | 'clinic' | 'cold_storage';
  parent_id?: string;
  manager_id?: string;
  is_dispensing_point?: boolean;
  notes?: string;
}

export interface UpdateLocationDto {
  name?: string;
  manager_id?: string;
  is_dispensing_point?: boolean;
  is_active?: boolean;
  notes?: string;
}

export interface CreateCatalogItemDto {
  name: string;
  code?: string;
  category: 'medicine' | 'vaccine' | 'consumable' | 'test_kit' | 'blood_product' | 'equipment' | 'other';
  subcategory?: string;
  unit_of_measure: string;
  drug_id?: string;
  atc_code?: string;
  inn_name?: string;
  drug_strength?: string;
  drug_form?: string;
  who_eml?: boolean;
  regulatory_code?: string;
  loinc_code?: string;
  requires_cold_chain?: boolean;
  storage_conditions?: string;
  reorder_lead_days?: number;
  default_reorder_qty?: number;
  is_controlled?: boolean;
}

export interface StockAdjustmentDto {
  location_id: string;
  catalog_id: string;
  batch_number?: string;
  quantity_delta: number;
  reason: string;
  notes?: string;
}

export interface ReceiveStockDto {
  location_id: string;
  catalog_id: string;
  batch_number?: string;
  expiry_date?: string;
  quantity: number;
  unit_cost?: number;
  supplier_id?: string;
  po_reference?: string;
  notes?: string;
}

export interface CreateStockRequestDto {
  requesting_location_id: string;
  fulfilling_location_id: string;
  priority?: 'urgent' | 'routine';
  notes?: string;
  items: Array<{
    catalog_id: string;
    quantity_requested: number;
    notes?: string;
  }>;
}

export interface ApproveRequestDto {
  approved_items: Array<{
    item_id: string;
    quantity_approved: number;
  }>;
}

export interface CreateTransferDto {
  request_id?: string;
  from_location_id: string;
  to_location_id: string;
  notes?: string;
  items: Array<{
    catalog_id: string;
    batch_number?: string;
    expiry_date?: string;
    quantity_transferred: number;
  }>;
}

export interface ReceiveTransferItemDto {
  item_id: string;
  quantity_received: number;
  condition: 'good' | 'damaged' | 'expired' | 'short';
}

export class StockUnavailableException extends Error {
  constructor(itemName: string, requested: number, available: number) {
    super(
      `Stock unavailable: "${itemName}" — requested ${requested}, ` +
      `available ${available}. Submit a stock request to the storeroom.`
    );
    this.name = 'StockUnavailableException';
  }
}
