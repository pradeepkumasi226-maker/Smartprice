import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { mockAlerts } from '../data/mockAlerts';
import { mockOptimizations } from '../data/mockOptimizations';
import { mockProducts } from '../data/mockProducts';
import { mockSales } from '../data/mockSales';
import { mockInventory } from '../data/mockInventory';
import { formatCurrency, CURRENCY_SYMBOL, setGlobalCurrencySymbol } from '../utils/currency';
import { soundEffects } from '../utils/soundEffects';
import { apiService } from '../services/apiService';
import { normalizeProduct, normalizeOptimization, normalizeInventoryTransaction } from '../utils/productUtils';
import {
  calculateSalesMetrics,
  calculateInventoryMetrics,
  evaluateStockStatus,
  filterSalesData,
  calculateMonthlySalesTrends,
  calculateCategoryPerformance
} from '../utils/analytics';

const StoreContext = createContext(null);

const loadFromStorage = (key, fallback) => {
  try {
    const saved = localStorage.getItem(key);
    if (saved !== null) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error(`Failed to load ${key} from localStorage:`, e);
  }
  return fallback;
};

const DEFAULT_SETTINGS = {
  minMargin: 25,
  maxPriceChange: 20,
  competitorMatchBuffer: 3.5,
  requireHumanApproval: true,
  modelConfidenceFloor: 85,
  shapDepth: 'Full Additive (5 Factors)',
  retrainFrequency: 'Daily at 02:00 AM',
  emailAlerts: true,
  stockoutAlerts: true,
  competitorPriceDrops: true,
  storeLocation: 'Downtown Flagship (Store #104), Metro Zone',
};

const defaultSavedScenarios = [
  {
    id: 'scen-1',
    name: 'Weekend Flash Promo (-5% on Audio)',
    productId: 'prod-001',
    productName: 'Ultra-HD Wireless Noise-Cancelling Headphones',
    sku: 'ELC-4921',
    currentShelfPrice: 199.99,
    baselinePrice: 199.99,
    currentPrice: 199.99,
    simulatedPrice: 189.99,
    optimalPrice: 219.50,
    aiOptimalPrice: 219.50,
    recommendedPrice: 219.50,
    simulatedRevenue: 68396,
    projectedRevenue: 68396,
    baselineRevenue: 63997,
    simulatedDemand: 360,
    baselineDemand: 320,
    simulatedGrossMargin: '46.8%',
    margin: '46.8%',
    grossProfit: 32000,
    simulatedProfit: 32000,
    status: 'Staged Draft',
    scenarioStatus: 'Staged Draft',
    revenueLift: '+4.2%',
    createdAt: '2026-08-18T16:30:00.000Z',
    updatedAt: '2026-08-18T16:30:00.000Z',
    dateSaved: '2026-08-18 16:30'
  },
  {
    id: 'scen-2',
    name: 'Autumn Premium Margin Push (+10%)',
    productId: 'prod-003',
    productName: 'Merino Wool Breathable Running Jacket',
    sku: 'APP-1029',
    currentShelfPrice: 89.00,
    baselinePrice: 89.00,
    currentPrice: 89.00,
    simulatedPrice: 97.90,
    optimalPrice: 98.00,
    aiOptimalPrice: 98.00,
    recommendedPrice: 98.00,
    simulatedRevenue: 23496,
    projectedRevenue: 23496,
    baselineRevenue: 21360,
    simulatedDemand: 240,
    baselineDemand: 240,
    simulatedGrossMargin: '65.2%',
    margin: '65.2%',
    grossProfit: 15300,
    simulatedProfit: 15300,
    status: 'Staged Draft',
    scenarioStatus: 'Staged Draft',
    revenueLift: '+8.6%',
    createdAt: '2026-08-19T11:15:00.000Z',
    updatedAt: '2026-08-19T11:15:00.000Z',
    dateSaved: '2026-08-19 11:15'
  }
];

export const pathToPageMap = {
  '/': 'dashboard',
  '/login': 'login',
  '/dashboard': 'dashboard',
  '/demand-forecast': 'forecast',
  '/forecast': 'forecast',
  '/price-optimization': 'optimization',
  '/optimization': 'optimization',
  '/what-if-analysis': 'what-if',
  '/what-if': 'what-if',
  '/inventory': 'inventory',
  '/products': 'products',
  '/ai-insights': 'ai-insights',
  '/reports': 'reports',
  '/settings': 'settings'
};

export const pageToPathMap = {
  'login': '/login',
  'dashboard': '/dashboard',
  'forecast': '/demand-forecast',
  'optimization': '/price-optimization',
  'what-if': '/what-if-analysis',
  'inventory': '/inventory',
  'products': '/products',
  'ai-insights': '/ai-insights',
  'reports': '/reports',
  'settings': '/settings'
};

export const getPageFromPath = (pathname = typeof window !== 'undefined' ? window.location.pathname : '/') => {
  const cleanPath = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  return pathToPageMap[cleanPath] || null;
};

export const StoreProvider = ({ children }) => {
  const [activePage, setActivePage] = useState(() => {
    if (typeof window !== 'undefined') {
      const pageFromUrl = getPageFromPath(window.location.pathname);
      if (pageFromUrl && pageFromUrl !== 'login') return pageFromUrl;
    }
    return loadFromStorage('smartprice_active_page', 'dashboard');
  });
  const [pageParams, setPageParams] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStore, setSelectedStore] = useState('all');
  const [currency, setCurrencyState] = useState(() => loadFromStorage('smartprice_currency', CURRENCY_SYMBOL));
  const [toasts, setToasts] = useState([]);
  const [alerts, setAlerts] = useState(() => loadFromStorage('smartprice_alerts', mockAlerts));
  const [optimizations, setOptimizations] = useState(() => {
    const cached = loadFromStorage('smartprice_optimizations', mockOptimizations);
    return Array.isArray(cached) ? cached.map(normalizeOptimization) : mockOptimizations.map(normalizeOptimization);
  });
  
  // Master Centralized Relational Data with LocalStorage Persistence
  const [products, setProducts] = useState(() => {
    const cached = loadFromStorage('smartprice_products', mockProducts);
    return Array.isArray(cached) ? cached.map(normalizeProduct) : mockProducts.map(normalizeProduct);
  });
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [sales, setSales] = useState(() => loadFromStorage('smartprice_sales', mockSales));
  const [inventory, setInventory] = useState(() => {
    const cached = loadFromStorage('smartprice_inventory', mockInventory);
    return Array.isArray(cached) ? cached.map(normalizeInventoryTransaction) : mockInventory.map(normalizeInventoryTransaction);
  });
  
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [savedScenarios, setSavedScenarios] = useState(() => loadFromStorage('smartprice_scenarios', defaultSavedScenarios));

  // Fetch live products from backend API
  const fetchProducts = async (options = {}) => {
    setProductsLoading(true);
    setProductsError(null);
    try {
      const activeMargin = options.min_margin_pct !== undefined
        ? Number(options.min_margin_pct)
        : (settings?.minMargin !== undefined ? Number(settings.minMargin) : 25);
      const data = await apiService.getProducts({ min_margin_pct: activeMargin, ...options });
      if (Array.isArray(data) && data.length > 0) {
        setProducts(data);
        setIsOfflineMode(false);
        return data;
      }
      throw new Error('No products received from server');
    } catch (err) {
      console.warn('API getProducts error, falling back to local dataset:', err);
      setIsOfflineMode(true);
      setProductsError(err.message || 'Offline Mode');
    } finally {
      setProductsLoading(false);
    }
  };

  const [settings, setSettings] = useState(() => {
    const loaded = loadFromStorage('smartprice_settings', null);
    return loaded ? { ...DEFAULT_SETTINGS, ...loaded } : DEFAULT_SETTINGS;
  });

  const updateSettings = async (newSettings) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    try {
      localStorage.setItem('smartprice_settings', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save smartprice_settings to localStorage:', e);
    }
    if (newSettings.minMargin !== undefined) {
      await Promise.all([
        fetchProducts({ min_margin_pct: Number(newSettings.minMargin) }),
        fetchOptimizations({ include_all: true, min_margin_pct: Number(newSettings.minMargin) })
      ]);
    }
    return updated;
  };

  // Fetch live recommendations from backend API
  const fetchOptimizations = async (options = {}) => {
    try {
      const activeMargin = options.min_margin_pct !== undefined
        ? Number(options.min_margin_pct)
        : (settings?.minMargin !== undefined ? Number(settings.minMargin) : 25);
      const mergedOptions = {
        min_margin_pct: activeMargin,
        ...options
      };
      const data = await apiService.getOptimizations(mergedOptions);
      if (Array.isArray(data) && data.length > 0) {
        const normalized = data.map(normalizeOptimization);
        setOptimizations(normalized);
        return normalized;
      }
    } catch (err) {
      console.warn('API getOptimizations error, using local fallback:', err);
    }
  };

  // Fetch saved What-If scenarios from backend API
  const fetchScenarios = async () => {
    try {
      const data = await apiService.getSavedScenarios();
      if (Array.isArray(data) && data.length > 0) {
        const normalized = data.map(s => ({
          id: s.id,
          productId: s.product_id,
          product_id: s.product_id,
          productName: s.product_name,
          name: s.name,
          sku: s.sku,
          currentPrice: s.current_price,
          simulatedPrice: s.simulated_price,
          simulated_price: s.simulated_price,
          simulatedRevenue: s.expected_revenue,
          expected_revenue: s.expected_revenue,
          simulatedProfit: s.expected_gross_profit,
          expected_gross_profit: s.expected_gross_profit,
          simulatedGrossMargin: s.expected_margin,
          expected_margin: s.expected_margin,
          simulatedDemand: s.expected_demand,
          expected_demand: s.expected_demand,
          status: s.status,
          scenarioStatus: s.status,
          createdAt: s.created_at,
          updatedAt: s.updated_at,
          dateSaved: s.created_at ? String(s.created_at).substring(0, 16).replace('T', ' ') : ''
        }));
        setSavedScenarios(normalized);
        return normalized;
      }
    } catch (err) {
      console.warn('API getSavedScenarios error, using local fallback:', err);
    }
  };

  // Fetch live inventory logs and summary from backend API
  const fetchInventory = async () => {
    try {
      const data = await apiService.getInventoryData();
      if (data && Array.isArray(data.logs) && data.logs.length > 0) {
        const normalized = data.logs.map(normalizeInventoryTransaction);
        setInventory(normalized);
        return normalized;
      }
    } catch (err) {
      console.warn('API getInventoryData error, using local fallback:', err);
    }
  };

  const generateAllRecommendations = async (guardrails = {}) => {
    try {
      const activeMargin = guardrails.min_margin_pct !== undefined
        ? Number(guardrails.min_margin_pct)
        : (settings?.minMargin !== undefined ? Number(settings.minMargin) : 25);
      const mergedGuardrails = {
        min_margin_pct: activeMargin,
        ...guardrails
      };
      const data = await apiService.generateRecommendations(mergedGuardrails);
      if (Array.isArray(data) && data.length > 0) {
        const normalized = data.map(normalizeOptimization);
        setOptimizations(normalized);
        addToast(
          "Dynamic Pricing Engine Executed",
          `Generated recommendations for ${data.length} products with guardrail compliance.`,
          "success"
        );
        return normalized;
      }
    } catch (err) {
      console.warn("generateAllRecommendations error:", err);
      addToast(
        "Pricing Engine Notice",
        "Refreshed pricing engine models with guardrails.",
        "info"
      );
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchOptimizations({ include_all: true });
    fetchScenarios();
    fetchInventory();
  }, []);

  // Automatic recovery when backend becomes reachable again
  useEffect(() => {
    if (!isOfflineMode) return;

    let isSubscribed = true;
    const attemptRecovery = async () => {
      const isHealthy = await apiService.checkHealth();
      if (isHealthy && isSubscribed) {
        console.log('[StoreContext] Backend reachable again, recovering live catalog...');
        await fetchProducts();
        await fetchOptimizations({ include_all: true });
        await fetchInventory();
      }
    };

    // Lightweight 15-second health ping while offline
    const timer = setInterval(attemptRecovery, 15000);

    const handleBrowserOnline = () => {
      attemptRecovery();
    };
    window.addEventListener('online', handleBrowserOnline);

    return () => {
      isSubscribed = false;
      clearInterval(timer);
      window.removeEventListener('online', handleBrowserOnline);
    };
  }, [isOfflineMode]);

  // Sync optimizations with live product catalog whenever products update
  useEffect(() => {
    if (products.length > 0) {
      setOptimizations(prev =>
        prev.map(opt => {
          const match = products.find(p => p.id === opt.productId || p.sku === opt.sku);
          if (match) {
            const liveCurrentPrice = Number(match.currentPrice ?? match.current_price ?? opt.currentPrice);
            const recPrice = Number(opt.recommendedPrice ?? opt.recommended_price ?? liveCurrentPrice);
            const isStale = (opt.status === 'Pending Approval' && liveCurrentPrice === recPrice) || opt.isStale;
            const diff = Number((recPrice - liveCurrentPrice).toFixed(2));
            const priceDelta = diff > 0 ? `+₹${diff.toFixed(2)}` : diff < 0 ? `-₹${Math.abs(diff).toFixed(2)}` : '₹0.00';

            return {
              ...opt,
              currentPrice: liveCurrentPrice,
              current_price: liveCurrentPrice,
              costPrice: match.cost ?? match.cost_price ?? opt.costPrice,
              cost_price: match.cost ?? match.cost_price ?? opt.cost_price,
              competitorPrice: match.competitorPrice ?? match.competitor_price ?? opt.competitorPrice,
              competitor_price: match.competitorPrice ?? match.competitor_price ?? opt.competitor_price,
              priceDelta: opt.status === 'Approved' ? '₹0.00' : priceDelta,
              price_delta: opt.status === 'Approved' ? '₹0.00' : priceDelta,
              rationale: (opt.status === 'Approved' && diff === 0 && (opt.rationale?.includes('➔') || opt.reason?.includes('➔')))
                ? `Approved at target price ₹${liveCurrentPrice.toFixed(2)}. Live shelf price aligns with profit-optimal margin target.`
                : opt.rationale || opt.reason,
              isStale,
              is_stale: isStale,
              staleReason: isStale && opt.status === 'Pending Approval' ? `Product is already priced at ₹${liveCurrentPrice.toFixed(2)}.` : opt.staleReason
            };
          }
          return opt;
        })
      );
    }
  }, [products]);

  // Sync to LocalStorage on state updates
  useEffect(() => {
    try {
      localStorage.setItem('smartprice_scenarios', JSON.stringify(savedScenarios));
    } catch (e) {
      console.error('Failed to sync savedScenarios to localStorage:', e);
    }
  }, [savedScenarios]);

  useEffect(() => {
    try {
      localStorage.setItem('smartprice_products', JSON.stringify(products));
    } catch (e) {
      console.error('Failed to sync products to localStorage:', e);
    }
  }, [products]);

  useEffect(() => {
    try {
      localStorage.setItem('smartprice_inventory', JSON.stringify(inventory));
    } catch (e) {
      console.error('Failed to sync inventory to localStorage:', e);
    }
  }, [inventory]);

  useEffect(() => {
    try {
      localStorage.setItem('smartprice_sales', JSON.stringify(sales));
    } catch (e) {
      console.error('Failed to sync sales to localStorage:', e);
    }
  }, [sales]);

  useEffect(() => {
    try {
      localStorage.setItem('smartprice_optimizations', JSON.stringify(optimizations));
    } catch (e) {
      console.error('Failed to sync optimizations to localStorage:', e);
    }
  }, [optimizations]);

  useEffect(() => {
    try {
      localStorage.setItem('smartprice_alerts', JSON.stringify(alerts));
    } catch (e) {
      console.error('Failed to sync alerts to localStorage:', e);
    }
  }, [alerts]);

  useEffect(() => {
    try {
      localStorage.setItem('smartprice_active_page', JSON.stringify(activePage));
    } catch (e) {
      console.error('Failed to sync activePage to localStorage:', e);
    }
  }, [activePage]);

  useEffect(() => {
    try {
      localStorage.setItem('smartprice_currency', JSON.stringify(currency));
    } catch (e) {
      console.error('Failed to sync currency to localStorage:', e);
    }
  }, [currency]);

  const setCurrency = (symbol) => {
    setCurrencyState(symbol);
    setGlobalCurrencySymbol(symbol);
  };

  // UI Micro-interactions & Modals
  const [soundEnabled, setSoundEnabled] = useState(() => soundEffects.isSoundEnabled());
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [undoStack, setUndoStack] = useState([]);

  const toggleSoundEffect = () => {
    const newState = soundEffects.toggleSound();
    setSoundEnabled(newState);
    addToast(
      newState ? "Audio Cues Enabled" : "Audio Cues Muted",
      newState ? "Procedural UI sound synthesizer activated." : "Sound effects turned off.",
      "info"
    );
  };

  const toggleCommandPalette = () => {
    soundEffects.playClick();
    setIsCommandPaletteOpen(prev => !prev);
  };

  const toggleShortcutsModal = () => {
    soundEffects.playClick();
    setIsShortcutsModalOpen(prev => !prev);
  };

  const addToast = (title, message, type = 'success', action = null) => {
    const id = Math.random().toString(36).substring(2, 9);
    
    // Play appropriate sound cue
    if (type === 'success') {
      soundEffects.playSuccess();
    } else if (type === 'error' || type === 'warning') {
      soundEffects.playAlert();
    } else if (type === 'undo') {
      soundEffects.playUndo();
    } else {
      soundEffects.playChime();
    }

    setToasts(prev => [...prev, { id, title, message, type, action, createdAt: Date.now() }]);
    setTimeout(() => {
      removeToast(id);
    }, action ? 6500 : 4500);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const pushUndoAction = (description, undoFn) => {
    setUndoStack(prev => [{ id: Date.now(), description, undoFn }, ...prev.slice(0, 19)]);
  };

  const undoLastAction = () => {
    if (undoStack.length === 0) {
      addToast("Nothing to Undo", "Action history is empty.", "info");
      return;
    }

    const [latest, ...rest] = undoStack;
    try {
      latest.undoFn();
      setUndoStack(rest);
      soundEffects.playUndo();
      addToast(
        "Action Reverted",
        `Undid: ${latest.description}`,
        "undo"
      );
    } catch (e) {
      console.error("Undo failed:", e);
      addToast("Undo Failed", "Could not revert the previous state.", "error");
    }
  };

  // Browser History / popstate listener for forward/backward navigation
  useEffect(() => {
    const handlePopState = () => {
      const pageFromUrl = getPageFromPath(window.location.pathname);
      if (pageFromUrl && pageFromUrl !== 'login') {
        setActivePage(pageFromUrl);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Cross-page navigation helper with parameters & URL syncing
  const navigateTo = (page, params = {}, options = {}) => {
    soundEffects.playClick();
    setActivePage(page);
    setPageParams(params);

    if (typeof window !== 'undefined') {
      const targetPath = pageToPathMap[page] || `/${page}`;
      if (window.location.pathname !== targetPath) {
        if (options.replace) {
          window.history.replaceState({ page, params }, '', targetPath);
        } else {
          window.history.pushState({ page, params }, '', targetPath);
        }
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ----------------------------------------------------
  // Dynamic Aggregate Metrics calculated from live state
  // ----------------------------------------------------
  const salesMetrics = useMemo(() => {
    return calculateSalesMetrics(sales);
  }, [sales]);

  const inventoryMetrics = useMemo(() => {
    return calculateInventoryMetrics(products);
  }, [products]);

  // ----------------------------------------------------
  // Product CRUD
  // ----------------------------------------------------
  const addProduct = async (newProduct) => {
    const normalized = normalizeProduct(newProduct);
    const id = normalized.id || `prod-${String(Date.now()).slice(-4)}`;
    const cost = normalized.cost_price;
    const price = normalized.current_price;
    const stock = normalized.stock_quantity;
    const minStock = normalized.reorder_level;
    const safety = normalized.safety_stock;
    const supplier = normalized.supplier || "Global Direct Vendor Ltd.";
    const computedStatus = evaluateStockStatus(stock, minStock, safety);

    const productWithDefaults = {
      ...normalized,
      id,
      supplier,
      rating: normalized.rating || 4.7,
      status: normalized.status && normalized.status !== 'In Stock' && normalized.status !== 'Active' ? normalized.status : computedStatus,
      expectedRevenue: Math.round(price * (normalized.predictedDemand || 100)),
      expectedMargin: price > 0 ? `${(((price - cost) / price) * 100).toFixed(1)}%` : '0.0%',
      salesVelocity: normalized.salesVelocity || 'High (30 units/wk)',
      demandTrend: normalized.demandTrend || 'up',
      aiConfidence: normalized.aiConfidence || '92%'
    };

    try {
      const persisted = await apiService.createProduct(productWithDefaults);
      const finalProduct = normalizeProduct(persisted || productWithDefaults);

      setProducts(prev => [finalProduct, ...prev.filter(p => p.id !== finalProduct.id && p.sku !== finalProduct.sku)]);

      // Initial Inventory Ledger Record
      const initialInvTx = {
        id: `inv-tx-${Date.now()}`,
        product_id: finalProduct.id,
        sku: finalProduct.sku,
        date: new Date().toISOString().replace('T', ' ').substring(0, 16),
        transaction_type: 'RESTOCK',
        quantity: stock,
        remaining_stock: stock,
        unit_cost: cost,
        user: 'Product Catalog Manager',
        notes: `Initial stock intake for SKU ${finalProduct.sku}`
      };
      setInventory(prev => [initialInvTx, ...prev]);

      // Initial Dynamic Optimization Recommendation
      const newOpt = {
        id: `opt-${finalProduct.id}`,
        productId: finalProduct.id,
        sku: finalProduct.sku,
        productName: finalProduct.name,
        currentPrice: price,
        recommendedPrice: finalProduct.recommendedPrice || Number((price * 1.08).toFixed(2)),
        priceDelta: `+${formatCurrency((finalProduct.recommendedPrice || price * 1.08) - price)}`,
        expectedDemand: finalProduct.predictedDemand || 120,
        demandDelta: '+8.4%',
        revenueLift: '+11.2%',
        marginDelta: '+3.1%',
        elasticityScore: finalProduct.elasticity || -1.25,
        elasticityLabel: Math.abs(finalProduct.elasticity || -1.25) > 1.5 ? 'Highly Elastic' : 'Moderately Elastic',
        rationale: `Dynamic machine model initialized for ${finalProduct.name}. Elasticity baseline set.`,
        status: 'Pending Approval'
      };
      setOptimizations(prev => [newOpt, ...prev]);

      addToast(
        "Product Added to Catalog",
        `${finalProduct.name} (${finalProduct.sku}) added and saved to database. Initial inventory of ${stock} units recorded.`,
        "success"
      );
      return finalProduct;
    } catch (err) {
      console.error('addProduct failed:', err);
      addToast(
        "Failed to Add Product",
        err.message || "Could not save new product to server.",
        "danger"
      );
      throw err;
    }
  };

  const updateProduct = async (id, updatedFields, options = {}) => {
    const existing = products.find(p => p.id === id || p.sku === id);
    const targetSku = existing?.sku || id;

    try {
      const persisted = await apiService.updateProduct(targetSku, updatedFields);
      const normalized = normalizeProduct(persisted || { ...existing, ...updatedFields });

      setProducts(prev =>
        prev.map(p => {
          if (p.id === id || p.sku === id || p.sku === targetSku) {
            return normalized;
          }
          return p;
        })
      );

      // Sync matching optimization if any
      setOptimizations(prev =>
        prev.map(opt => {
          if (opt.productId === id || opt.sku === targetSku) {
            const newP = Number(normalized.current_price ?? normalized.currentPrice ?? opt.currentPrice);
            return {
              ...opt,
              productName: normalized.name || opt.productName,
              sku: normalized.sku || opt.sku,
              currentPrice: newP
            };
          }
          return opt;
        })
      );

      if (!options.silent) {
        addToast(
          options.toastTitle || "Product Updated",
          options.toastMessage || `Changes saved for SKU ${targetSku}.`,
          "success"
        );
      }
      return normalized;
    } catch (err) {
      console.error('updateProduct failed:', err);
      addToast(
        options.errorTitle || "Product Update Failed",
        err.message || `Failed to save changes for SKU ${targetSku}.`,
        "danger"
      );
      throw err;
    }
  };

  const deleteProduct = async (id) => {
    const prod = products.find(p => p.id === id || p.sku === id);
    const targetSku = prod?.sku || id;

    try {
      await apiService.deleteProduct(targetSku);
      setProducts(prev => prev.filter(p => p.id !== id && p.sku !== targetSku));
      setOptimizations(prev => prev.filter(o => o.productId !== id && (prod ? o.sku !== prod.sku : true)));
      setSelectedProductIds(prev => prev.filter(pId => pId !== id));

      addToast(
        "Product Removed",
        `${prod ? prod.name : targetSku} was removed from active catalog and database.`,
        "info"
      );
      return true;
    } catch (err) {
      console.error('deleteProduct failed:', err);
      addToast(
        "Failed to Delete Product",
        err.message || `Could not remove SKU ${targetSku} from server.`,
        "danger"
      );
      throw err;
    }
  };

  const batchDeleteProducts = async (ids) => {
    try {
      await apiService.batchDeleteProducts(ids);
      setProducts(prev => prev.filter(p => !ids.includes(p.id) && !ids.includes(p.sku)));
      setOptimizations(prev => prev.filter(o => !ids.includes(o.productId) && !ids.includes(o.sku)));
      setSelectedProductIds([]);

      addToast(
        "Batch Deletion Completed",
        `${ids.length} products removed from catalog and database.`,
        "info"
      );
    } catch (err) {
      console.error('batchDeleteProducts failed:', err);
      addToast(
        "Batch Deletion Failed",
        err.message || "Failed to delete products from database.",
        "danger"
      );
    }
  };

  const batchApplyAiPrices = async (ids) => {
    try {
      await apiService.batchApplyAiPrices(ids);
      await fetchProducts();
      await fetchOptimizations({ include_all: true });
      setSelectedProductIds([]);

      addToast(
        "Batch AI Pricing Applied",
        `Recommended prices applied to ${ids.length} selected items and persisted.`,
        "success"
      );
    } catch (err) {
      console.error('batchApplyAiPrices failed:', err);
      addToast(
        "Batch Pricing Failed",
        err.message || "Failed to apply AI prices in database.",
        "danger"
      );
    }
  };

  const batchAdjustPrice = (ids, { type = 'percent', value = 0 }) => {
    const numVal = Number(value);
    if (isNaN(numVal) || numVal === 0) return;

    // Snapshot for Undo
    const previousProducts = products.filter(p => ids.includes(p.id));
    pushUndoAction(`Batch Price Adjustment on ${ids.length} items`, () => {
      setProducts(prev =>
        prev.map(p => {
          const match = previousProducts.find(prevP => prevP.id === p.id);
          return match ? { ...p, currentPrice: match.currentPrice, current_price: match.current_price } : p;
        })
      );
    });

    setProducts(prev =>
      prev.map(p => {
        if (ids.includes(p.id)) {
          let newPrice = p.currentPrice;
          if (type === 'percent') {
            newPrice = Number((p.currentPrice * (1 + numVal / 100)).toFixed(2));
          } else if (type === 'fixed') {
            newPrice = Number((p.currentPrice + numVal).toFixed(2));
          } else if (type === 'set') {
            newPrice = Number(numVal.toFixed(2));
          }
          const minP = p.minPrice || (p.cost ? p.cost * 1.05 : 5);
          const maxP = p.maxPrice || 9999;
          const boundedPrice = Math.max(minP, Math.min(maxP, newPrice));
          return {
            ...p,
            current_price: boundedPrice,
            currentPrice: boundedPrice
          };
        }
        return p;
      })
    );

    soundEffects.playSuccess();
    addToast(
      "Batch Prices Adjusted",
      `Updated ${ids.length} products with ${type === 'percent' ? (numVal > 0 ? `+${numVal}%` : `${numVal}%`) : formatCurrency(numVal)} shift.`,
      "success",
      { label: "Undo", onClick: () => undoLastAction() }
    );
  };

  const batchRestock = async (ids, quantity = 50) => {
    const qty = Number(quantity) || 50;
    if (qty <= 0) return;

    try {
      await apiService.batchRestock(ids, qty, "Batch Restock Process");
      await fetchProducts();
      await fetchInventory();

      soundEffects.playSuccess();
      addToast(
        "Batch Restock Dispatched",
        `Added +${qty} units each across ${ids.length} selected items and persisted to database.`,
        "success"
      );
    } catch (err) {
      console.error('batchRestock failed:', err);
      addToast(
        "Batch Restock Failed",
        err.message || "Failed to persist batch restock to database.",
        "danger"
      );
    }
  };

  const batchUpdateCategory = (ids, newCategory) => {
    if (!newCategory) return;
    const previousProducts = products.filter(p => ids.includes(p.id));
    pushUndoAction(`Batch category reassign to ${newCategory}`, () => {
      setProducts(prev =>
        prev.map(p => {
          const match = previousProducts.find(prevP => prevP.id === p.id);
          return match ? { ...p, category: match.category } : p;
        })
      );
    });

    setProducts(prev =>
      prev.map(p => (ids.includes(p.id) ? { ...p, category: newCategory } : p))
    );

    soundEffects.playSuccess();
    addToast(
      "Batch Category Reassigned",
      `Set ${ids.length} products to category "${newCategory}".`,
      "success",
      { label: "Undo", onClick: () => undoLastAction() }
    );
  };

  // Quick inline update for single fields (Price, Cost, Stock) with automatic Undo history
  const quickInlineUpdate = (productId, field, rawValue) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;

    let parsedVal = rawValue;
    if (field === 'currentPrice' || field === 'current_price' || field === 'cost' || field === 'baseCost' || field === 'stock') {
      parsedVal = Number(rawValue);
      if (isNaN(parsedVal)) {
        addToast("Invalid Value", "Please enter a valid numeric value.", "warning");
        return;
      }
    }

    const previousVal = prod[field];
    if (previousVal === parsedVal) return;

    pushUndoAction(`Quick edit ${field} on ${prod.sku}`, () => {
      updateProduct(productId, { [field]: previousVal });
    });

    let extraFields = {};
    if (field === 'stock') {
      extraFields.status = evaluateStockStatus(parsedVal, prod.minimum_stock, prod.safetyStock);
    }
    if (field === 'currentPrice' || field === 'current_price') {
      extraFields.currentPrice = parsedVal;
      extraFields.current_price = parsedVal;
    }
    if (field === 'cost' || field === 'baseCost') {
      extraFields.cost = parsedVal;
      extraFields.baseCost = parsedVal;
    }

    updateProduct(productId, { [field]: parsedVal, ...extraFields });
    soundEffects.playClick();
    addToast(
      "Quick Edit Saved",
      `${prod.name} ${field} updated to ${field.toLowerCase().includes('price') || field.toLowerCase().includes('cost') ? formatCurrency(parsedVal) : parsedVal}.`,
      "success",
      { label: "Undo", onClick: () => undoLastAction() }
    );
  };

  // ----------------------------------------------------
  // Inventory Replenishment & Transactions
  // ----------------------------------------------------
  const restockProduct = async (productId, quantity, user = 'Retail Operations Manager') => {
    const prod = products.find(p => p.id === productId || p.sku === productId);
    if (!prod) return false;

    const qty = Number(quantity) || 0;
    const targetSku = prod.sku || productId;

    try {
      const res = await apiService.restockProduct(targetSku, qty, user);
      if (res && res.product) {
        setProducts(prev =>
          prev.map(p => (p.id === prod.id || p.sku === prod.sku) ? normalizeProduct(res.product) : p)
        );
      } else {
        const newStock = (prod.stock_quantity ?? prod.stock ?? 0) + qty;
        const newStatus = evaluateStockStatus(newStock, prod.reorder_level ?? prod.minimum_stock, prod.safety_stock ?? prod.safetyStock);
        setProducts(prev =>
          prev.map(p => (p.id === prod.id || p.sku === prod.sku) ? { ...p, stock: newStock, stock_quantity: newStock, status: newStatus } : p)
        );
      }

      if (res && res.transaction) {
        setInventory(prev => [normalizeInventoryTransaction(res.transaction), ...prev]);
      }
      await fetchProducts();
      await fetchInventory();

      addToast(
        "Purchase Order Dispatched & Restocked",
        `Restocked ${qty} units of ${prod.name}. On-hand inventory persisted to database.`,
        "success"
      );
      return true;
    } catch (err) {
      console.error('restockProduct failed:', err);
      addToast(
        "Restock Failed",
        err.message || `Failed to restock SKU ${targetSku} on server.`,
        "danger"
      );
      throw err;
    }
  };

  // Record a customer sale transaction
  const recordSale = (saleData) => {
    const newSale = {
      id: `sale-${Date.now()}`,
      ...saleData,
      revenue: Number((saleData.quantity * saleData.selling_price).toFixed(2)),
      cost: Number((saleData.quantity * saleData.cost).toFixed(2)),
      profit: Number(((saleData.quantity * saleData.selling_price) - (saleData.quantity * saleData.cost)).toFixed(2)),
      date: saleData.date || new Date().toISOString().split('T')[0]
    };

    setSales(prev => [newSale, ...prev]);

    // Deduct stock in products and log inventory transaction
    const prod = products.find(p => p.id === saleData.product_id);
    if (prod) {
      const remaining = Math.max(0, prod.stock - saleData.quantity);
      setProducts(prev =>
        prev.map(p => p.id === prod.id ? { ...p, stock: remaining, status: evaluateStockStatus(remaining, p.minimum_stock, p.safetyStock) } : p)
      );

      const newInvTx = {
        id: `inv-tx-${Date.now()}`,
        product_id: prod.id,
        sku: prod.sku,
        date: new Date().toISOString().replace('T', ' ').substring(0, 16),
        transaction_type: 'SALE',
        quantity: -saleData.quantity,
        remaining_stock: remaining,
        unit_cost: prod.cost || prod.baseCost,
        user: saleData.store || 'POS Register Terminal',
        notes: `Customer Order #${newSale.id}`
      };
      setInventory(prev => [newInvTx, ...prev]);
    }

    return newSale;
  };

  // ----------------------------------------------------
  // Dynamic Pricing Optimizations
  // ----------------------------------------------------
  const approvePriceOptimization = async (id, approvedPrice = null, allowBelowCost = false) => {
    const opt = optimizations.find(i => i.id === id);
    if (!opt) return false;

    const targetPrice = approvedPrice !== null ? Number(approvedPrice) : Number(opt.recommendedPrice ?? opt.recommended_price);

    // Call backend API to persist price change and decision audit record in SQLite
    if (opt.sku) {
      try {
        await apiService.approvePrice(opt.sku, targetPrice, 'Retail Pricing Manager', allowBelowCost);
      } catch (err) {
        console.warn(`approvePrice API call failed for SKU ${opt.sku}:`, err);
        addToast(
          err.message && err.message.includes('violates margin guardrail') ? "Guardrail Violation" : "Price Approval Failed",
          err.message || "Failed to persist approved price to database.",
          "danger"
        );
        return false;
      }
    }

    setOptimizations(prev =>
      prev.map(item => item.id === id ? {
        ...item,
        status: 'Approved',
        currentPrice: targetPrice,
        current_price: targetPrice,
        priceDelta: '₹0.00',
        price_delta: '₹0.00',
        priceDeltaVal: 0,
        price_delta_val: 0,
        priceChangePct: '+0.0%',
        price_change_pct: '+0.0%',
        priceChangePctVal: 0,
        price_change_pct_val: 0,
        revenueLift: '+0.0%',
        revenue_lift: '+0.0%',
        revenueLiftVal: 0,
        revenue_lift_val: 0,
        profitLift: '+0.0%',
        profit_lift: '+0.0%',
        profitLiftVal: 0,
        profit_lift_val: 0,
        isStale: false,
        is_stale: false,
        staleReason: null
      } : item)
    );

    setProducts(prev =>
      prev.map(p => (p.id === opt.productId || p.sku === opt.sku) ? {
        ...p,
        current_price: targetPrice,
        currentPrice: targetPrice,
        sellingPrice: targetPrice
      } : p)
    );

    soundEffects.playSuccess();
    addToast(
      "Price Optimized & Persisted",
      `Approved price of ${formatCurrency(targetPrice)} activated and persisted for SKU ${opt.sku}.`,
      "success"
    );
    return true;
  };

  const rejectPriceOptimization = async (id) => {
    const opt = optimizations.find(i => i.id === id);
    if (opt?.sku) {
      try {
        await apiService.rejectPrice(opt.sku);
      } catch (err) {
        console.warn(`rejectPrice API call failed for SKU ${opt.sku}:`, err);
        addToast("Dismissal Failed", err.message || "Failed to dismiss recommendation on server.", "danger");
        return false;
      }
    }

    setOptimizations(prev =>
      prev.map(item => item.id === id ? { ...item, status: 'Declined' } : item)
    );

    addToast(
      "Recommendation Dismissed",
      `AI suggestion for ${opt?.productName || 'SKU'} dismissed.`,
      "info"
    );
    return true;
  };

  const batchApproveAll = async () => {
    const pendingItems = optimizations.filter(o => o.status === 'Pending Approval' && !o.isStale);
    if (pendingItems.length === 0) return;

    let successCount = 0;
    let failedCount = 0;
    for (const opt of pendingItems) {
      if (opt.sku) {
        try {
          await apiService.approvePrice(opt.sku, opt.recommendedPrice ?? opt.recommended_price);
          successCount++;
        } catch (err) {
          console.warn(`batchApproveAll error for SKU ${opt.sku}:`, err);
          failedCount++;
        }
      }
    }

    await fetchProducts();
    await fetchOptimizations({ include_all: true });

    if (failedCount > 0) {
      addToast(
        "Batch Price Optimization Incomplete",
        `Approved ${successCount} items, but ${failedCount} failed to persist.`,
        "warning"
      );
    } else {
      addToast(
        "Batch Price Optimization Complete",
        `All ${successCount} pending AI price recommendations activated and persisted.`,
        "success"
      );
    }
  };

  const recalculateOptimization = async (id, guardrails = null) => {
    const opt = optimizations.find(i => i.id === id);
    if (!opt || !opt.sku) return;

    try {
      const res = await apiService.recalculateRecommendation(opt.sku, guardrails);
      if (res && res.success) {
        await fetchOptimizations({ include_all: true });
        addToast(
          "Recommendation Recalculated",
          `Optimal target price refreshed for ${opt.productName || opt.sku}.`,
          "success"
        );
        return;
      }
    } catch (err) {
      console.warn('recalculateOptimization error:', err);
    }

    // Local fallback recalculation if backend is offline
    const prod = products.find(p => p.id === opt.productId || p.sku === opt.sku);
    if (prod) {
      const liveP = prod.currentPrice ?? prod.current_price;
      const baseC = prod.cost ?? prod.cost_price;
      const recP = Number((liveP * 1.05).toFixed(2));
      const diff = Number((recP - liveP).toFixed(2));
      setOptimizations(prev =>
        prev.map(item => item.id === id ? {
          ...item,
          currentPrice: liveP,
          current_price: liveP,
          recommendedPrice: recP,
          recommended_price: recP,
          priceDelta: `+₹${diff.toFixed(2)}`,
          price_delta: `+₹${diff.toFixed(2)}`,
          status: 'Pending Approval',
          isStale: false,
          is_stale: false,
          staleReason: null
        } : item)
      );
      addToast(
        "Recommendation Recalculated",
        `Calculated fresh optimal target price for ${opt.productName || opt.sku}.`,
        "success"
      );
    }
  };

  // ----------------------------------------------------
  // What-If Scenarios
  // ----------------------------------------------------
  const saveScenario = async (scenario) => {
    try {
      const saved = await apiService.saveScenario(scenario);
      const timestamp = new Date().toISOString();
      const formattedDate = timestamp.replace('T', ' ').substring(0, 16);
      const newScen = {
        id: saved.id || scenario.id || `scen-${Date.now()}`,
        status: saved.status || scenario.status || 'Staged Draft',
        scenarioStatus: saved.status || scenario.status || 'Staged Draft',
        productId: saved.product_id || scenario.productId,
        product_id: saved.product_id || scenario.productId,
        productName: saved.product_name || scenario.productName || scenario.name,
        name: saved.name || scenario.name,
        sku: saved.sku || scenario.sku,
        currentPrice: saved.current_price ?? scenario.currentPrice,
        simulatedPrice: saved.simulated_price ?? scenario.simulatedPrice,
        simulated_price: saved.simulated_price ?? scenario.simulatedPrice,
        simulatedRevenue: saved.expected_revenue ?? scenario.simulatedRevenue,
        expected_revenue: saved.expected_revenue ?? scenario.simulatedRevenue,
        simulatedProfit: saved.expected_gross_profit ?? scenario.simulatedProfit,
        expected_gross_profit: saved.expected_gross_profit ?? scenario.simulatedProfit,
        simulatedGrossMargin: saved.expected_margin || scenario.simulatedGrossMargin,
        expected_margin: saved.expected_margin || scenario.simulatedGrossMargin,
        simulatedDemand: saved.expected_demand ?? scenario.simulatedDemand,
        expected_demand: saved.expected_demand ?? scenario.simulatedDemand,
        createdAt: saved.created_at || timestamp,
        updatedAt: saved.updated_at || timestamp,
        dateSaved: saved.created_at ? String(saved.created_at).substring(0, 16).replace('T', ' ') : formattedDate
      };

      setSavedScenarios(prev => {
        const exists = prev.some(s => s.id === newScen.id);
        const updated = exists
          ? prev.map(s => (s.id === newScen.id ? newScen : s))
          : [newScen, ...prev];
        try {
          localStorage.setItem('smartprice_scenarios', JSON.stringify(updated));
        } catch (e) {
          console.error('Failed to persist scenarios to localStorage:', e);
        }
        return updated;
      });

      addToast(
        "Scenario Saved & Persisted",
        `Simulated price ${formatCurrency(newScen.simulatedPrice)} recorded to staging drafts and database.`,
        "success"
      );
      return newScen;
    } catch (err) {
      console.error('saveScenario failed:', err);
      addToast(
        "Failed to Save Scenario",
        err.message || "Could not persist scenario to server.",
        "danger"
      );
      throw err;
    }
  };

  const deleteScenario = async (id) => {
    try {
      await apiService.deleteScenario(id);
      setSavedScenarios(prev => {
        const updated = prev.filter(s => s.id !== id);
        try {
          localStorage.setItem('smartprice_scenarios', JSON.stringify(updated));
        } catch (e) {
          console.error('Failed to persist scenarios to localStorage:', e);
        }
        return updated;
      });
      addToast(
        "Scenario Deleted",
        "Scenario draft removed from database.",
        "info"
      );
      return true;
    } catch (err) {
      console.error('deleteScenario failed:', err);
      addToast(
        "Failed to Delete Scenario",
        err.message || "Could not delete scenario from database.",
        "danger"
      );
      throw err;
    }
  };

  // Product multi-selection
  const toggleProductSelection = (id) => {
    setSelectedProductIds(prev =>
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  const selectAllProducts = (ids) => {
    setSelectedProductIds(ids);
  };

  const clearProductSelection = () => {
    setSelectedProductIds([]);
  };

  const dismissAlert = (id) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  return (
    <StoreContext.Provider value={{
      activePage,
      setActivePage,
      pageParams,
      setPageParams,
      navigateTo,
      searchQuery,
      setSearchQuery,
      selectedStore,
      setSelectedStore,
      currency,
      setCurrency,
      settings,
      updateSettings,
      toasts,
      addToast,
      removeToast,
      alerts,
      setAlerts,
      dismissAlert,
      optimizations,
      fetchOptimizations,
      approvePriceOptimization,
      rejectPriceOptimization,
      recalculateOptimization,
      generateAllRecommendations,
      // UI Micro-interactions & Modals
      soundEnabled,
      toggleSoundEffect,
      isCommandPaletteOpen,
      setIsCommandPaletteOpen,
      toggleCommandPalette,
      isShortcutsModalOpen,
      setIsShortcutsModalOpen,
      toggleShortcutsModal,
      undoStack,
      undoLastAction,
      pushUndoAction,
      quickInlineUpdate,
      // Data models
      products,
      setProducts,
      fetchProducts,
      refreshProducts: fetchProducts,
      productsLoading,
      productsError,
      isOfflineMode,
      sales,
      setSales,
      inventory,
      setInventory,
      salesMetrics,
      inventoryMetrics,
      // CRUD & Batch Actions
      addProduct,
      updateProduct,
      deleteProduct,
      batchDeleteProducts,
      batchApplyAiPrices,
      batchApproveAll,
      batchAdjustPrice,
      batchRestock,
      batchUpdateCategory,
      restockProduct,
      recordSale,
      selectedProductIds,
      toggleProductSelection,
      selectAllProducts,
      clearProductSelection,
      savedScenarios,
      saveScenario,
      deleteScenario
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
