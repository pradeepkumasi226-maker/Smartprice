/**
 * Structured Mock Demand Forecasts & Trajectory Timeline Dataset
 * Covering 7-day, 30-day, and 90-day horizons with confidence intervals and seasonality drivers.
 */

export const mockRevenueTrends = [
  { month: "Jan", actualRevenue: 12208, aiOptimizedRevenue: 13800, demandUnits: 150 },
  { month: "Feb", actualRevenue: 9464, aiOptimizedRevenue: 10700, demandUnits: 120 },
  { month: "Mar", actualRevenue: 10795, aiOptimizedRevenue: 12200, demandUnits: 150 },
  { month: "Apr", actualRevenue: 16804, aiOptimizedRevenue: 19000, demandUnits: 126 },
  { month: "May", actualRevenue: 22711, aiOptimizedRevenue: 25700, demandUnits: 148 },
  { month: "Jun", actualRevenue: 24596, aiOptimizedRevenue: 27800, demandUnits: 276 },
  { month: "Jul", actualRevenue: 31838, aiOptimizedRevenue: 36000, demandUnits: 224 },
  { month: "Aug", actualRevenue: 24595, aiOptimizedRevenue: 27800, demandUnits: 275 },
  { month: "Sep (Proj)", actualRevenue: null, predictedBaseline: 28000, aiOptimizedRevenue: 32000, demandUnits: 310 },
  { month: "Oct (Proj)", actualRevenue: null, predictedBaseline: 31000, aiOptimizedRevenue: 35500, demandUnits: 345 },
  { month: "Nov (Proj)", actualRevenue: null, predictedBaseline: 38000, aiOptimizedRevenue: 44000, demandUnits: 420 },
  { month: "Dec (Proj)", actualRevenue: null, predictedBaseline: 46000, aiOptimizedRevenue: 53500, demandUnits: 510 }
];

export const mockDemandTimeline = {
  "7d": [
    { time: "Mon", baseline: 320, forecastP50: 345, lowerP10: 310, upperP90: 380, promoUplift: 15 },
    { time: "Tue", baseline: 290, forecastP50: 310, lowerP10: 280, upperP90: 340, promoUplift: 10 },
    { time: "Wed", baseline: 350, forecastP50: 375, lowerP10: 340, upperP90: 410, promoUplift: 20 },
    { time: "Thu", baseline: 410, forecastP50: 440, lowerP10: 400, upperP90: 480, promoUplift: 25 },
    { time: "Fri", baseline: 490, forecastP50: 530, lowerP10: 480, upperP90: 580, promoUplift: 40 },
    { time: "Sat", baseline: 620, forecastP50: 680, lowerP10: 620, upperP90: 740, promoUplift: 55 },
    { time: "Sun", baseline: 580, forecastP50: 625, lowerP10: 570, upperP90: 680, promoUplift: 45 }
  ],
  "30d": [
    { time: "Week 1", baseline: 2450, forecastP50: 2680, lowerP10: 2400, upperP90: 2950, promoUplift: 180 },
    { time: "Week 2", baseline: 2620, forecastP50: 2890, lowerP10: 2600, upperP90: 3180, promoUplift: 210 },
    { time: "Week 3", baseline: 2780, forecastP50: 3120, lowerP10: 2800, upperP90: 3440, promoUplift: 260 },
    { time: "Week 4", baseline: 2950, forecastP50: 3350, lowerP10: 3000, upperP90: 3700, promoUplift: 320 }
  ],
  "90d": [
    { time: "Month 1 (Sep)", baseline: 10800, forecastP50: 12040, lowerP10: 10800, upperP90: 13200, promoUplift: 950 },
    { time: "Month 2 (Oct)", baseline: 11500, forecastP50: 12900, lowerP10: 11600, upperP90: 14200, promoUplift: 1200 },
    { time: "Month 3 (Nov)", baseline: 12400, forecastP50: 13850, lowerP10: 12400, upperP90: 15300, promoUplift: 1800 }
  ]
};

export const mockSeasonalityDrivers = [
  { factor: "Holiday Weekend Multiplier", impact: "+18.5%", category: "Calendar", description: "Surge in footfall across regional flagship outlets during federal weekends." },
  { factor: "Summer Weather Index", impact: "+12.2%", category: "Climate", description: "Higher daytime temperatures accelerating beverage and outdoor gear velocity." },
  { factor: "Regional Festival Campaign", impact: "+24.0%", category: "Marketing", description: "Omnichannel loyalty reward points campaign driving bulk basket checkout." },
  { factor: "Month-End Payday Cycle", impact: "+9.8%", category: "Economic", description: "Predictable discretionary spend lift on premium consumer electronics." }
];
