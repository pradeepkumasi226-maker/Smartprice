export const mockReportsData = {
  summary: {
    totalOptimizedRevenue: "₹1,482,500",
    totalBaselineRevenue: "₹1,310,200",
    revenueLiftGross: "+₹172,300 (+13.1%)",
    grossMarginDelta: "+3.8%",
    pricingDecisionsExecuted: 428,
    accuracyRate: "96.4%"
  },
  monthlyPerformance: [
    { month: "Jan", revenue: 145000, margin: 44.2, priceIndex: 101.2 },
    { month: "Feb", revenue: 152000, margin: 45.1, priceIndex: 102.5 },
    { month: "Mar", revenue: 168000, margin: 46.8, priceIndex: 103.8 },
    { month: "Apr", revenue: 174000, margin: 46.2, priceIndex: 104.1 },
    { month: "May", revenue: 189000, margin: 48.0, priceIndex: 105.4 },
    { month: "Jun", revenue: 204000, margin: 49.5, priceIndex: 106.9 },
    { month: "Jul", revenue: 218000, margin: 50.2, priceIndex: 107.8 },
    { month: "Aug", revenue: 235000, margin: 51.4, priceIndex: 108.6 }
  ],
  categoryBreakdown: [
    { category: "Electronics", revenue: 580000, lift: "+15.2%", margin: "42.5%", items: 120 },
    { category: "Apparel", revenue: 390000, lift: "+11.8%", margin: "58.2%", items: 210 },
    { category: "Home & Kitchen", revenue: 295000, lift: "+14.1%", margin: "48.9%", items: 95 },
    { category: "Groceries", revenue: 135000, lift: "+8.4%", margin: "32.1%", items: 340 },
    { category: "Health & Beauty", revenue: 82500, lift: "+16.3%", margin: "64.0%", items: 78 }
  ]
};
