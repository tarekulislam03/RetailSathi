export interface StockMovement {
  id: string;
  type: "IN" | "OUT";
  product_name: string;
  barcode: string;
  batch_no: string;
  quantity: number;
  available_quantity: number;
  reference_no: string;
  party_name: string;
  category: string;
  timestamp: string;
}

export interface LedgerStatsData {
  totalMovements: number;
  totalStockInQty: number;
  totalStockOutQty: number;
  netStockChange: number;
}
