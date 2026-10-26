export const mockGlobalFeatureImportance = [
  { feature: "Competitor Price Gap", importance: 0.38, category: "Market", description: "Difference between store price and nearest competitor price" },
  { feature: "Historical Price Elasticity", importance: 0.24, category: "Behavioral", description: "Consumer responsiveness to past discounts and price increases" },
  { feature: "Inventory Stock Level / Scarcity", importance: 0.16, category: "Supply", description: "Remaining warehouse buffer vs reorder lead time" },
  { feature: "Seasonality & Day-of-Week", importance: 0.11, category: "Temporal", description: "Weekend spikes, holiday surge, and seasonal purchasing cycles" },
  { feature: "Promotion & Discount Depth", importance: 0.07, category: "Marketing", description: "Active coupon codes, bundle incentives, and promotional flags" },
  { feature: "Product Rating & Reviews", importance: 0.04, category: "Perception", description: "Social proof index and star rating threshold" }
];

export const mockProductShapDecomposition = {
  "prod-001": {
    productName: "Ultra-HD Wireless Noise-Cancelling Headphones",
    basePrice: 195.00,
    finalPrice: 219.50,
    features: [
      { name: "Base Model Baseline", impact: 195.00, type: "base", delta: 0 },
      { name: "Competitor Price Premium (₹215.00)", impact: 14.80, type: "positive", delta: +14.80, reason: "Nearest tier competitor increased MSRP to ₹215" },
      { name: "High Inelasticity Index (-1.35)", impact: 8.50, type: "positive", delta: +8.50, reason: "Consistent high-volume demand despite recent +5% shifts" },
      { name: "High Star Rating (4.8 Stars)", impact: 3.20, type: "positive", delta: +3.20, reason: "Over 1,200 5-star ratings create pricing leverage" },
      { name: "Warehouse Overstock Protection", impact: -2.00, type: "negative", delta: -2.00, reason: "Buffer stock maintained above safety thresholds" }
    ],
    naturalLanguageExplanation: "The AI pricing model raised the price by +₹19.51 primarily because competitor prices increased to ₹215.00 (+14.80 contribution) and consumer demand demonstrates strong price tolerance given this product's 4.8-star review momentum."
  },
  "prod-002": {
    productName: "4K Quantum-Dot OLED Smart TV 55-inch",
    basePrice: 780.00,
    finalPrice: 749.00,
    features: [
      { name: "Base Model Baseline", impact: 780.00, type: "base", delta: 0 },
      { name: "Competitor Price Undercut (₹739.99)", impact: -38.00, type: "negative", delta: -38.00, reason: "Key rival offering promotional discount" },
      { name: "High Price Elasticity (-2.10)", impact: -18.00, type: "negative", delta: -18.00, reason: "Shoppers highly sensitive to ₹50 increments in this category" },
      { name: "Supply Scarcity (18 units in stock)", impact: +25.00, type: "positive", delta: +25.00, reason: "Prevents excessive margin compression during low supply" }
    ],
    naturalLanguageExplanation: "The model recommended a -₹50.00 price decrease because consumers in the premium TV category are highly elastic (-2.10) and competitive pressures require closer parity with rival pricing (₹739.99)."
  },
  "prod-003": {
    productName: "Merino Wool Breathable Running Jacket",
    basePrice: 85.00,
    finalPrice: 98.00,
    features: [
      { name: "Base Model Baseline", impact: 85.00, type: "base", delta: 0 },
      { name: "Seasonal Cold Weather Influx", impact: 9.20, type: "positive", delta: +9.20, reason: "Upcoming weather forecast predicts sustained cold temperatures" },
      { name: "High Inelasticity Factor (-0.85)", impact: 5.60, type: "positive", delta: +5.60, reason: "Performance athletic apparel demonstrates low price sensitivity" },
      { name: "Competitor High Average (₹95.00)", impact: 3.20, type: "positive", delta: +3.20, reason: "Direct equivalents priced at or above ₹95" },
      { name: "Stock Abundance (310 units)", impact: -5.00, type: "negative", delta: -5.00, reason: "Slight downward pressure to prevent inventory aging" }
    ],
    naturalLanguageExplanation: "The model recommends optimizing upwards to ₹98.00 due to upcoming seasonal cold weather demand spikes (+9.20) and exceptionally low consumer elasticity (-0.85)."
  }
};
