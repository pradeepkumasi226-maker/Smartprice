/**
 * Structured Mock Inventory Dataset linked by product_id with historical
 * stock transactions, reorders, audit logs, and status summaries.
 */

export const mockInventorySummary = {
  totalItems: 12,
  totalStockUnits: 986,
  lowStockItemsCount: 1,
  criticalItemsCount: 1,
  overstockedItemsCount: 1,
  healthyStockPercentage: 83.3,
  warehouseValuation: "₹82,450.00"
};

export const mockInventory = [
  {
    id: "inv-tx-101",
    product_id: "prod-006",
    sku: "HOM-7193",
    date: "2026-08-19 11:20",
    transaction_type: "SALE",
    quantity: -5,
    remaining_stock: 8,
    unit_cost: 195.00,
    user: "Downtown POS Terminal #3",
    notes: "Customer transaction #99401"
  },
  {
    id: "inv-tx-102",
    product_id: "prod-001",
    sku: "ELC-4921",
    date: "2026-08-18 16:45",
    transaction_type: "RESTOCK",
    quantity: 50,
    remaining_stock: 45,
    unit_cost: 95.00,
    user: "Retail Operations Manager",
    notes: "Expedited PO #8821 Received from Global Audio"
  },
  {
    id: "inv-tx-103",
    product_id: "prod-002",
    sku: "ELC-8812",
    date: "2026-08-18 14:15",
    transaction_type: "SALE",
    quantity: -3,
    remaining_stock: 14,
    unit_cost: 540.00,
    user: "Westside POS Terminal #1",
    notes: "Customer transaction #99388"
  },
  {
    id: "inv-tx-104",
    product_id: "prod-011",
    sku: "GRO-9011",
    date: "2026-08-17 10:30",
    transaction_type: "RESTOCK",
    quantity: 200,
    remaining_stock: 420,
    unit_cost: 9.20,
    user: "Inventory Logistics Team",
    notes: "Standard monthly harvest shipment"
  },
  {
    id: "inv-tx-105",
    product_id: "prod-005",
    sku: "HOM-5520",
    date: "2026-08-16 15:00",
    transaction_type: "RESTOCK",
    quantity: 20,
    remaining_stock: 28,
    unit_cost: 120.00,
    user: "Inventory Logistics Team",
    notes: "Replenishment from Munich factory"
  },
  {
    id: "inv-tx-106",
    product_id: "prod-003",
    sku: "APP-1029",
    date: "2026-08-15 09:45",
    transaction_type: "SALE",
    quantity: -12,
    remaining_stock: 62,
    unit_cost: 38.00,
    user: "E-Commerce Dispatch Hub",
    notes: "Web orders batch fulfillment"
  },
  {
    id: "inv-tx-107",
    product_id: "prod-009",
    sku: "BEA-6601",
    date: "2026-08-14 13:20",
    transaction_type: "RESTOCK",
    quantity: 60,
    remaining_stock: 95,
    unit_cost: 11.50,
    user: "Retail Operations Manager",
    notes: "Weekly lab delivery PO #5502"
  }
];
