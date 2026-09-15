import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronRight,
  faClock,
  faLocationDot,
  faUtensils,
  faFire,
  faExclamationTriangle,
  faLeaf,
  faSearch,
  faXmark,
  faPlus,
  faBox,
  faSmile,
  faListCheck,
  faMicrochip,
  faCheckCircle,
  faTimesCircle,
  faRefresh,
} from '@fortawesome/free-solid-svg-icons';
import { useItems } from '../context/ItemContext';
import { useLanguage } from '../context/LanguageContext';
import { getIngredientNameMM } from '../data/ingredients';
import { generateRecipes } from '../services/recipeService';
import './Home.css';

// ─── PANTRY STAPLES (assumed you always have) ───
const PANTRY_STAPLES = new Set([
  // Salt & Spices
  'salt', 'pepper', 'black pepper', 'white pepper', 'garlic powder', 'onion powder',
  'paprika', 'cumin', 'oregano', 'basil', 'thyme', 'rosemary', 'cilantro',
  'parsley', 'mint', 'chili powder', 'cinnamon', 'nutmeg', 'ginger', 'turmeric',
  'cayenne', 'red pepper flakes', 'bay leaf', 'sage', 'marjoram', 'dill',
  'tarragon', 'fennel', 'cardamom', 'cloves', 'allspice', 'star anise',
  
  // Oils & Vinegars
  'olive oil', 'vegetable oil', 'canola oil', 'coconut oil', 'sesame oil',
  'vinegar', 'white vinegar', 'apple cider vinegar', 'balsamic vinegar',
  'rice vinegar', 'red wine vinegar',
  
  // Sauces & Condiments
  'soy sauce', 'worcestershire sauce', 'hot sauce', 'sriracha',
  'mustard', 'dijon mustard', 'yellow mustard', 'ketchup', 'mayonnaise',
  'relish', 'pickles', 'horseradish', 'tahini',
  
  // Sweeteners
  'sugar', 'brown sugar', 'powdered sugar', 'honey', 'maple syrup',
  'molasses', 'corn syrup', 'agave nectar',
  
  // Baking
  'flour', 'all-purpose flour', 'whole wheat flour', 'baking powder',
  'baking soda', 'yeast', 'cornstarch', 'cocoa powder', 'vanilla extract',
  'almond extract', 'food coloring',
  
  // Grains (dry)
  'rice', 'pasta', 'noodles', 'spaghetti', 'linguine', 'penne', 'macaroni',
  'quinoa', 'couscous', 'oats', 'rolled oats', 'breadcrumbs', 'croutons',
  
  // Canned Goods
  'canned tomatoes', 'crushed tomatoes', 'tomato paste', 'tomato sauce',
  'canned beans', 'canned corn', 'canned tuna', 'canned chicken',
  'broth', 'chicken broth', 'beef broth', 'vegetable broth', 'stock',
  
  // Dairy (long-lasting)
  'butter', 'milk', 'cream', 'half and half', 'sour cream', 'yogurt',
  'cheese', 'cheddar', 'mozzarella', 'parmesan', 'cream cheese',
  
  // Other Staples
  'eggs', 'bread', 'onion', 'garlic', 'lemon', 'lime',
  'water', 'ice', 'coffee', 'tea', 'soda', 'juice',
]);

const RECIPES_CACHE_KEY = 'recipes_cache';
const RECIPES_CACHE_DURATION = 60 * 60 * 1000;

// ─── Check if ingredient is a pantry staple ───
const isPantryStaple = (ingredient) => {
  if (!ingredient) return false;
  const lower = ingredient.toLowerCase().trim();
  for (const staple of PANTRY_STAPLES) {
    if (lower.includes(staple) || staple.includes(lower)) {
      return true;
    }
  }
  return false;
};

export default function Home() {
  const { items } = useItems();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [recommendations, setRecommendations] = useState([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [aiFailed, setAiFailed] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  const viewRecipeDetail = (recipe) => {
    navigate('/recipes', { state: { openRecipe: recipe } });
  };

  const closeRecipeDetail = () => setSelectedRecipe(null);
  
  // ─── Refs to prevent infinite loops ───
  const recipeLoadedRef = useRef(false);
  const currentItemsHashRef = useRef('');
  const isFetchingRef = useRef(false);
  const previousRecommendationsRef = useRef([]);

  useEffect(() => {
    previousRecommendationsRef.current = recommendations;
  }, [recommendations]);

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  const initialLoadDone = useRef(false);

  // ─── Get fresh items only ───
  const getFreshItems = useCallback(() => {
    return items.filter(item => {
      if (!item.expiryDate) return true;
      const daysLeft = Math.ceil((new Date(item.expiryDate) - new Date()) / 86400000);
      return daysLeft >= 0;
    });
  }, [items]);

  const freshItemsList = useMemo(() => getFreshItems(), [getFreshItems]);

  // ─── Filter items by search ───
  const filteredItems = items.filter(item =>
    [item.name, getIngredientNameMM(item.name)].some(name =>
      String(name || '').toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const getDisplayName = (name) => language === 'mm' ? getIngredientNameMM(name) : name;

  // ─── Search results for display ───
  const searchResults = searchTerm ? filteredItems : [];

  // ─── Expiring Items (0-7 days) ───
  const expiringItems = freshItemsList
    .filter(item => {
      if (!item.expiryDate) return false;
      const daysLeft = Math.ceil((new Date(item.expiryDate) - new Date()) / 86400000);
      return daysLeft >= 0 && daysLeft <= 7;
    })
    .sort((a, b) => {
      const aDays = Math.ceil((new Date(a.expiryDate) - new Date()) / 86400000);
      const bDays = Math.ceil((new Date(b.expiryDate) - new Date()) / 86400000);
      return aDays - bDays;
    });

  // ─── Expired Items ───
  const expiredItems = items
    .filter(item => {
      if (!item.expiryDate) return false;
      const daysLeft = Math.ceil((new Date(item.expiryDate) - new Date()) / 86400000);
      return daysLeft < 0;
    })
    .sort((a, b) => {
      const aDays = Math.ceil((new Date(a.expiryDate) - new Date()) / 86400000);
      const bDays = Math.ceil((new Date(b.expiryDate) - new Date()) / 86400000);
      return aDays - bDays;
    });

  // ─── Fresh Items (more than 7 days left or no expiry) ───
  const allFreshItems = freshItemsList
    .filter(item => {
      if (!item.expiryDate) return true;
      const daysLeft = Math.ceil((new Date(item.expiryDate) - new Date()) / 86400000);
      return daysLeft > 7;
    })
    .sort((a, b) => {
      return a.name.localeCompare(b.name);
    });

  const totalItems = items.length;
  const expiringCount = expiringItems.length;
  const expiredCount = expiredItems.length;

  // ─── Check if ingredient is available ───
  const isIngredientAvailable = useCallback((ingredient) => {
    if (!ingredient) return false;
    const lowerIngredient = ingredient.toLowerCase().trim();
    return items.some(item => 
      item.name.toLowerCase().includes(lowerIngredient) ||
      lowerIngredient.includes(item.name.toLowerCase())
    );
  }, [items]);

  // ─── Get missing ingredients (only show real missing items, not pantry staples) ───
  const getMissingIngredients = useCallback((recipe) => {
    if (!recipe.ingredients) return [];
    return recipe.ingredients.filter(ing => {
      const isAvailable = isIngredientAvailable(ing);
      // Only show as missing if it's NOT a pantry staple AND NOT available
      return !isAvailable && !isPantryStaple(ing);
    });
  }, [isIngredientAvailable]);

  // ─── Detect equipment ───
  const detectEquipment = (recipe) => {
    const equipment = [];
    const name = recipe.name?.toLowerCase() || '';
    const ingredients = recipe.ingredients?.join(' ')?.toLowerCase() || '';
    
    if (name.includes('bake') || name.includes('roast') || name.includes('cake') || 
        name.includes('cookie') || name.includes('bread') || name.includes('muffin') ||
        name.includes('brownie') || name.includes('pie') || name.includes('pizza') ||
        name.includes('lasagna') || name.includes('casserole') ||
        ingredients.includes('oven')) {
      equipment.push('🔥 Oven');
    }
    
    if (name.includes('air fry') || name.includes('airfry')) {
      equipment.push('💨 Air Fryer');
    }
    
    if (name.includes('grill') || name.includes('bbq') || name.includes('barbecue')) {
      equipment.push('🔥 Grill');
    }
    
    if (name.includes('slow cook') || name.includes('crockpot') || name.includes('stew')) {
      equipment.push('🫕 Slow Cooker');
    }
    
    if (name.includes('blend') || name.includes('smoothie') || name.includes('shake')) {
      equipment.push('🔄 Blender');
    }
    
    if (name.includes('pressure') || name.includes('instant pot')) {
      equipment.push('💨 Pressure Cooker');
    }
    
    if (name.includes('rice') && !name.includes('fried')) {
      equipment.push('🍚 Rice Cooker');
    }
    
    return equipment;
  };

  // ─── Load recipes ───
  const loadRecipes = useCallback(async (isRetry = false) => {
    if (isFetchingRef.current) return;
    
    if (!freshItemsList.length) {
      localStorage.removeItem(RECIPES_CACHE_KEY);
      setRecommendations((current) => current.length ? current : []);
      setAiFailed(false);
      return;
    }

    if (!isRetry) {
      try {
        const cached = JSON.parse(localStorage.getItem(RECIPES_CACHE_KEY) || 'null');
        if (cached && Date.now() - cached.timestamp < RECIPES_CACHE_DURATION && cached.recipes?.length) {
          const cachedRecipes = cached.recipes.slice(0, 3);
          setRecommendations(cachedRecipes);
          recipeLoadedRef.current = true;
          return;
        }
      } catch {
        localStorage.removeItem(RECIPES_CACHE_KEY);
      }
    }

    const itemsHash = freshItemsList.map(item => item.id).sort().join(',');
    if (!isRetry && currentItemsHashRef.current === itemsHash && recipeLoadedRef.current) return;
    if (isRetry) {
      currentItemsHashRef.current = '';
      recipeLoadedRef.current = false;
    } else {
      currentItemsHashRef.current = itemsHash;
    }

    isFetchingRef.current = true;
    setLoadingRecs(true);
    setAiFailed(false);

    try {
      const recipes = await generateRecipes(freshItemsList);
      
      const processedRecipes = recipes.map(recipe => ({
        ...recipe,
        name: recipe.name || recipe.title || 'Recipe',
        mainIngredient: recipe.mainIngredient || 'Various',
        cookingTime: recipe.cookingTime || '30 min',
        ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
        availableCount: recipe.availableCount || 0,
        totalCount: recipe.totalCount || recipe.ingredients?.length || 0,
        equipment: recipe.equipment || detectEquipment(recipe),
        missingIngredients: getMissingIngredients(recipe),
      }));
      
      setRecommendations(processedRecipes.slice(0, 3));
      localStorage.setItem(RECIPES_CACHE_KEY, JSON.stringify({
        recipes: processedRecipes.slice(0, 3),
        timestamp: Date.now(),
      }));
      recipeLoadedRef.current = true;
      setAiFailed(false);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      const cachedFallback = (() => {
        try {
          const cached = JSON.parse(localStorage.getItem(RECIPES_CACHE_KEY) || 'null');
          return cached?.recipes?.slice(0, 3) || [];
        } catch {
          return [];
        }
      })();

      const nextRecommendations = previousRecommendationsRef.current.length
        ? previousRecommendationsRef.current
        : cachedFallback;

      setRecommendations(nextRecommendations);
      setAiFailed(true);
      recipeLoadedRef.current = true;
    } finally {
      setLoadingRecs(false);
      isFetchingRef.current = false;
      initialLoadDone.current = true;
    }
  }, [freshItemsList, getMissingIngredients, language]);

  // ─── Initial load ───
  useEffect(() => {
    if (!initialLoadDone.current) {
      loadRecipes();
    }
  }, [loadRecipes]);

  // ─── Handle refresh ───
  const handleRefresh = () => {
    if (isFetchingRef.current) return;
    currentItemsHashRef.current = '';
    recipeLoadedRef.current = false;
    setAiFailed(false);
    loadRecipes(true);
  };

  // ─── Expiry Status ───
  const getExpiryStatus = (expiryDate) => {
    if (!expiryDate) return { label: language === 'mm' ? 'သက်တမ်းမရှိ' : 'No expiry', color: '#8a7a6a', days: null };
    const daysLeft = Math.ceil((new Date(expiryDate) - new Date()) / 86400000);
    if (daysLeft < 0) return { label: t('expired'), color: '#c0392b', days: daysLeft };
    if (daysLeft <= 3) return { label: language === 'mm' ? `${daysLeft} ${t('days')}` : `${daysLeft} day${daysLeft > 1 ? 's' : ''}`, color: '#d97706', days: daysLeft };
    if (daysLeft <= 7) return { label: language === 'mm' ? `${daysLeft} ${t('days')}` : `${daysLeft} day${daysLeft > 1 ? 's' : ''}`, color: '#8d6e3f', days: daysLeft };
    return { label: t('fresh'), color: '#2d7d46', days: daysLeft };
  };

  const getUrgencyColor = (expiryDate) => {
    if (!expiryDate) return '#8a7a6a';
    const daysLeft = Math.ceil((new Date(expiryDate) - new Date()) / 86400000);
    if (daysLeft < 0) return '#c0392b';
    if (daysLeft <= 3) return '#d97706';
    if (daysLeft <= 7) return '#8d6e3f';
    return '#2d7d46';
  };

  // ─── Get motivational message ───
  const getMotivationalMessage = () => {
    if (language === 'mm') return t('freshKitchenMessage');
    const messages = [
      'Your kitchen is looking fresh! ✨',
      'Everything is organized! 🏆',
      'No waste, just taste! 👨‍🍳',
      'Perfectly stocked kitchen! 🌟',
      'Ready for cooking! 🍳',
      'Fresh ingredients make the best meals! 🌿',
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  };

  // ─── Get expiry suggestions ───
  const getExpirySuggestions = (category, location) => {
    if (category === 'packaged' || category === 'other') {
      return ['manual'];
    }

    const suggestions = {
      vegetable: {
        fridge: ['3-5 days', '1 week', '2 weeks'],
        freezer: ['3 months', '6 months', '1 year'],
        cabinet: ['1 week', '2 weeks', '1 month'],
        pantry: ['1 week', '2 weeks', '1 month'],
      },
      fruit: {
        fridge: ['3-5 days', '1 week', '2 weeks'],
        freezer: ['3 months', '6 months', '1 year'],
        cabinet: ['2-3 days', '5-7 days', '1 week'],
        pantry: ['2-3 days', '5-7 days', '1 week'],
      },
      meat: {
        fridge: ['1-2 days', '3-4 days', '5-6 days'],
        freezer: ['3 months', '6 months', '1 year'],
        cabinet: ['Not recommended'],
        pantry: ['Not recommended'],
      },
      dairy: {
        fridge: ['3-5 days', '1 week', '2 weeks'],
        freezer: ['1 month', '3 months', '6 months'],
        cabinet: ['Not recommended'],
        pantry: ['Not recommended'],
      },
      bread: {
        fridge: ['3-5 days', '1 week', '10 days'],
        freezer: ['1 month', '3 months', '6 months'],
        cabinet: ['2-3 days', '4-5 days', '1 week'],
        pantry: ['2-3 days', '4-5 days', '1 week'],
      },
    };

    return suggestions[category]?.[location] || ['1 week', '2 weeks', '1 month'];
  };

  return (
    <main className="home-page">
      <div className="home-date-time" aria-label="Current date and time">
        <span>{currentDateTime.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</span>
        <strong>{currentDateTime.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</strong>
      </div>

      {/* ─── SEARCH BAR ─── */}
      <div className="search-container">
        <div className="search-bar">
          <FontAwesomeIcon icon={faSearch} className="search-icon" />
          <input
            type="text"
            placeholder={t('searchYourItems')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          {searchTerm && (
            <button 
              className="search-clear"
              onClick={() => setSearchTerm('')}
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          )}
        </div>
        
        {searchTerm && (
          <div className="search-results">
            <div className="search-results-header">
              <span className="search-results-count">
                {language === 'mm'
                  ? `${searchResults.length} ${t('items')} တွေ့ပါသည်`
                  : `${searchResults.length} ${searchResults.length === 1 ? t('item') : t('items')} found`}
              </span>
              {searchResults.length > 0 && (
                <button className="search-results-clear" onClick={() => setSearchTerm('')}>
                  {t('clearResults')}
                </button>
              )}
            </div>
            {searchResults.length > 0 ? (
              <div className="search-results-list">
                {searchResults.map((item) => (
                  <div className="search-result-item" key={item.id}>
                    <span className="search-result-name">{getDisplayName(item.name)}</span>
                    <span className="search-result-location">
                      <FontAwesomeIcon icon={faLocationDot} size="xs" /> {item.location || 'Pantry'}
                    </span>
                    {item.expiryDate && (
                      <span className="search-result-expiry" style={{ 
                        color: getUrgencyColor(item.expiryDate)
                      }}>
                        {getExpiryStatus(item.expiryDate).label}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="search-results-empty">
                <p>{t('noItemsFound')} "{searchTerm}"</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── STATS ROW ─── */}
      <div className="stats-row">
        <div className="stat-item">
          <span className="stat-number">{totalItems}</span>
                      <span className="stat-label">{t('totalItems')}</span>
        </div>
        <div className="stat-item">
          <span className="stat-number" style={{ color: expiringCount > 0 ? '#d97706' : '#2d7d46' }}>
            {expiringCount}
          </span>
                      <span className="stat-label">{t('expiring')}</span>
        </div>
        <div className="stat-item">
          <span className="stat-number" style={{ color: expiredCount > 0 ? '#c0392b' : '#2d7d46' }}>
            {expiredCount}
          </span>
                      <span className="stat-label">{t('expired')}</span>
        </div>
      </div>

      {/* ─── EXPIRED ITEMS ─── */}
      {expiredItems.length > 0 && (
        <>
          <div className="section-header">
            <div className="section-title-group">
              <FontAwesomeIcon icon={faExclamationTriangle} style={{ color: '#c0392b' }} />
              <h2 style={{ color: '#c0392b' }}>{t('expired')}</h2>
              <span className="badge-count expired-badge">{expiredItems.length}</span>
            </div>
            <button className="text-link" onClick={() => navigate('/storage')}>
              {t('viewAll')} <FontAwesomeIcon icon={faChevronRight} size="xs" />
            </button>
          </div>

          <div className="item-grid">
            {expiredItems.slice(0, 3).map((item) => (
              <div 
                className="item-card expired-card"
                key={item.id}
              >
                <div className="item-info">
                  <span className="item-name">{getDisplayName(item.name)}</span>
                  <span className="item-location">
                    <FontAwesomeIcon icon={faLocationDot} size="xs" /> {item.location}
                  </span>
                </div>
                <span className="item-status expired-status">
                  <FontAwesomeIcon icon={faExclamationTriangle} size="xs" /> {t('expired')}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ─── EXPIRING SOON ─── */}
      <div className="section-header" style={{ marginTop: expiredItems.length > 0 ? '14px' : '0' }}>
        <div className="section-title-group">
          <FontAwesomeIcon icon={faClock} style={{ color: expiringItems.length > 0 ? '#d97706' : '#2d7d46' }} />
          <h2>{expiringItems.length > 0 ? t('expiring') : t('freshHealthy')}</h2>
          {expiringItems.length > 0 && (
            <span className="badge-count">{expiringItems.length}</span>
          )}
        </div>
        {expiringItems.length > 0 && (
          <button className="text-link" onClick={() => navigate('/storage')}>
            {t('viewAll')} <FontAwesomeIcon icon={faChevronRight} size="xs" />
          </button>
        )}
      </div>

      {expiringItems.length > 0 ? (
        <div className="item-grid">
          {expiringItems.slice(0, 3).map((item) => {
            const status = getExpiryStatus(item.expiryDate);
            const urgencyColor = getUrgencyColor(item.expiryDate);
            
            return (
              <div 
                className="item-card"
                key={item.id}
              >
                <div className="item-info">
                  <span className="item-name">{getDisplayName(item.name)}</span>
                  <span className="item-location">
                    <FontAwesomeIcon icon={faLocationDot} size="xs" /> {item.location}
                  </span>
                </div>
                <span className="item-status" style={{ 
                  color: urgencyColor,
                  background: `${urgencyColor}15` 
                }}>
                  <FontAwesomeIcon icon={faClock} size="xs" /> {status.label}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          {allFreshItems.length > 0 && (
            <div className="fresh-message">
              <div className="fresh-message-icon">
                <FontAwesomeIcon icon={faSmile} />
              </div>
              <div className="fresh-message-content">
                <p className="fresh-message-title">{getMotivationalMessage()}</p>
                <p className="fresh-message-sub">
                  {allFreshItems.length} {t('fresh')} {t('items')} {t('readyToUse')}
                  {totalItems > 0 && ` · ${Math.round((allFreshItems.length / totalItems) * 100)}% ${t('kitchenFreshPercent')}`}
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── RECIPE IDEAS ─── */}
      {freshItemsList.length > 0 && (
        <>
          <div className="section-header" style={{ marginTop: '16px' }}>
            <div className="section-title-group">
              <FontAwesomeIcon icon={faFire} style={{ color: '#e07a3a' }} />
              <h2>{t('aiRecipeIdeas')}</h2>
            </div>
            {!loadingRecs && (
              <button 
                className="refresh-btn" 
                onClick={handleRefresh}
                disabled={isFetchingRef.current}
                title="Refresh recipes"
              >
                <FontAwesomeIcon icon={faRefresh} spin={isFetchingRef.current} />
              </button>
            )}
          </div>

          {loadingRecs ? (
            <div className="loading-state">
              <div className="recipe-loading-grid" aria-label="Loading recipe ideas">
                {[0, 1, 2].map((skeleton) => (
                  <div className="recipe-loading-card" key={skeleton}>
                    <div className="recipe-loading-line recipe-loading-title" />
                    <div className="recipe-loading-line recipe-loading-meta" />
                    <div className="recipe-loading-badge" />
                  </div>
                ))}
              </div>
              <div className="loading-spinner"></div>
              <p>{t('aiThinking')}</p>
            </div>
          ) : recommendations.length > 0 && !aiFailed ? (
            <div className="recipe-grid">
              {recommendations.map((recipe, index) => {
                const available = recipe.availableCount || 0;
                const total = recipe.totalCount || recipe.ingredients?.length || 1;
                const ready = available >= total;
                
                return (
                  <button 
                    className="recipe-item" 
                    key={index} 
                    onClick={() => viewRecipeDetail(recipe)}
                  >
                    <div className="recipe-info">
                      <span className="recipe-name">{recipe.name}</span>
                      <span className="recipe-meta">{recipe.mainIngredient} · {recipe.cookingTime}</span>
                    </div>
                    <span className={`recipe-badge ${ready ? 'ready' : 'missing'}`}>
                      {ready ? '✅ Ready' : `${available}/${total}`}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : aiFailed ? (
            <div className="ai-unavailable-state">
              <div className="ai-status-icon">🤖</div>
              <h3>AI Recipe Generator is currently unavailable</h3>
              <p className="ai-status-message">
                {isFetchingRef.current ? (
                  'Loading...'
                ) : (
                  <>
                    All AI services are currently busy or rate limited.
                    <br />
                    <span style={{ fontSize: '12px', color: '#8e8e93' }}>
                      (Free tier limit reached - try again in a few minutes)
                    </span>
                  </>
                )}
              </p>
              <button 
                className="ai-retry-btn"
                onClick={handleRefresh}
                disabled={isFetchingRef.current}
              >
                <FontAwesomeIcon icon={faRefresh} spin={isFetchingRef.current} /> 
                {isFetchingRef.current ? 'Loading...' : 'Try Again'}
              </button>
            </div>
          ) : null}
        </>
      )}

      {/* ─── FRESH ITEMS ─── */}
      {allFreshItems.length > 0 && (
        <div className="fresh-items-grid" style={{ marginTop: '16px' }}>
          <div className="section-header">
            <div className="section-title-group">
              <FontAwesomeIcon icon={faLeaf} style={{ color: '#2d7d46' }} />
              <h2 style={{ color: '#2d7d46' }}>{t('freshItems')}</h2>
              <span className="badge-count" style={{ background: '#2d7d46' }}>{allFreshItems.length}</span>
            </div>
            <button className="text-link" onClick={() => navigate('/storage')}>
              {t('viewAll')} <FontAwesomeIcon icon={faChevronRight} size="xs" />
            </button>
          </div>

          <div className="item-grid">
            {allFreshItems.slice(0, 3).map((item) => (
              <div 
                className="item-card"
                key={item.id}
              >
                <div className="item-info">
                  <span className="item-name">{getDisplayName(item.name)}</span>
                  <span className="item-location">
                    <FontAwesomeIcon icon={faLocationDot} size="xs" /> {item.location}
                  </span>
                </div>
                <span className="item-status" style={{ 
                  color: '#2d7d46',
                  background: '#2d7d4615' 
                }}>
                  <FontAwesomeIcon icon={faLeaf} size="xs" /> {t('fresh')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── EMPTY STATE ─── */}
      {items.length === 0 && (
        <div className="empty-state">
          <FontAwesomeIcon icon={faBox} className="empty-icon" />
          <h3>{t('kitchenEmpty')}</h3>
          <p>{t('startAdding')}</p>
            <button className="empty-state-add-button" onClick={() => navigate('/add')}>
              <FontAwesomeIcon icon={faPlus} />
              {t('addItem')}
            </button>
        </div>
      )}

      {/* ─── RECIPE DETAIL MODAL ─── */}
      {selectedRecipe && (
        <div className="modal-overlay" onClick={closeRecipeDetail}>
          <div className="modal-content recipe-detail-modal">
            <button className="modal-close" onClick={closeRecipeDetail}>
              <FontAwesomeIcon icon={faXmark} />
            </button>
            
            <h2 className="recipe-detail-title">{selectedRecipe.name}</h2>
            
            <div className="recipe-detail-meta">
              <span className="recipe-detail-meta-item">
                <FontAwesomeIcon icon={faUtensils} /> {selectedRecipe.mainIngredient || 'Various'}
              </span>
              <span className="recipe-detail-meta-item">
                <FontAwesomeIcon icon={faClock} /> {selectedRecipe.cookingTime || '30 min'}
              </span>
            </div>

            {selectedRecipe.equipment && selectedRecipe.equipment.length > 0 && (
              <div className="recipe-equipment">
                <span className="equipment-label">
                  <FontAwesomeIcon icon={faMicrochip} /> Equipment:
                </span>
                <div className="equipment-tags">
                  {selectedRecipe.equipment.map((item, i) => (
                    <span key={i} className="equipment-tag">{item}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="recipe-detail-body">
              <div className="detail-section">
                <h4>
                  <FontAwesomeIcon icon={faListCheck} /> 
                  Ingredients
                  {selectedRecipe.missingIngredients && selectedRecipe.missingIngredients.length > 0 && (
                    <span className="missing-badge">
                      {selectedRecipe.missingIngredients.length} missing
                    </span>
                  )}
                </h4>
                <ul className="ingredient-list">
                  {selectedRecipe.ingredients && selectedRecipe.ingredients.map((ing, i) => {
                    const isAvailable = isIngredientAvailable(ing);
                    const isStaple = isPantryStaple(ing);
                    const isMissing = !isAvailable && !isStaple;
                    
                    // Determine the class
                    let itemClass = '';
                    if (isStaple) {
                      itemClass = 'ingredient-staple';
                    } else if (isAvailable) {
                      itemClass = 'ingredient-available';
                    } else {
                      itemClass = 'ingredient-missing';
                    }
                    
                    return (
                      <li key={i} className={itemClass}>
                        <span className="ingredient-status-icon">
                          {isStaple ? (
                            <span className="staple-icon">📦</span>
                          ) : isAvailable ? (
                            <FontAwesomeIcon icon={faCheckCircle} className="check-icon" />
                          ) : (
                            <FontAwesomeIcon icon={faTimesCircle} className="times-icon" />
                          )}
                        </span>
                        {ing}
                        {isStaple && (
                          <span className="staple-label">(Always have)</span>
                        )}
                        {!isAvailable && !isStaple && (
                          <span className="missing-label">(Missing)</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>

            {selectedRecipe.missingIngredients && selectedRecipe.missingIngredients.length === 0 ? (
              <button className="lets-cook-btn ready" onClick={goToRecipes}>
                <FontAwesomeIcon icon={faFire} /> Let's Cook! 🍳
              </button>
            ) : (
              <div className="lets-cook-disabled">
                <FontAwesomeIcon icon={faTimesCircle} /> 
                Add missing ingredients to cook this recipe
                <button className="go-shopping-btn" onClick={() => navigate('/storage')}>
                  Go to Storage
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}