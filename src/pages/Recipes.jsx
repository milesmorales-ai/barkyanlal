import { useItems } from '../context/ItemContext';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../hooks/useSettings';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../services/supabaseClient';
import PageSkeleton from '../components/PageSkeleton';
import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  generateRecipes,
  generateRecommendations,
  translateGeneratedRecipe,
  askCookingAssistant,
} from '../services/recipeService';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faClock,
  faUtensils,
  faFire,
  faRobot,
  faLightbulb,
  faArrowRight,
  faBowlFood,
  faBurger,
  faMugSaucer,
  faCake,
  faGlobe,
  faLeaf,
  faPepperHot,
  faSmile,
  faWandMagicSparkles,
  faCircleCheck,
  faCircleXmark,
  faListCheck,
  faBookOpen,
  faCircle,
  faX,
  faDrumstickBite,
  faFish,
  faBreadSlice,
  faCarrot,
  faAppleAlt,
  faCheese,
  faRefresh,
  faHeart,
  faTrash,
  faSave,
  faShare,
  faExclamationTriangle,
} from '@fortawesome/free-solid-svg-icons';

import './Recipes.css';
import { withConnectionHint } from '../utils/userFacingErrors';

let activeRecipeGeneration = null;
let activeRecipeGenerationKey = '';


// ============================================================
// CACHE
// ============================================================

const CACHE_KEY = 'recipes_cache';
const SAVED_KEY = 'saved_recipes';
const CACHE_DURATION = 60 * 60 * 1000;


// ============================================================
// COMPONENT
// ============================================================

export default function Recipes() {

  const { items, loading: itemsLoading, deleteItem } = useItems();
  const { user } = useAuth();
  const { settings } = useSettings(user);
  const { colors } = useTheme();
    const { t, language } = useLanguage();
  const location = useLocation();

  const [recipes, setRecipes] = useState([]);
  const [oldRecipes, setOldRecipes] = useState([]);
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [savingRecipeId, setSavingRecipeId] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [isCooking, setIsCooking] = useState(false);
  const [cookingStep, setCookingStep] = useState(0);
  const [usedIngredientIds, setUsedIngredientIds] = useState([]);
  const [cookingFinished, setCookingFinished] = useState(false);
  const [ingredientsRemoved, setIngredientsRemoved] = useState(false);
  const [cookingQuestion, setCookingQuestion] = useState('');
  const [cookingChat, setCookingChat] = useState([]);
  const [cookingChatLoading, setCookingChatLoading] = useState(false);

  const [showQuiz, setShowQuiz] = useState(false);
  const [quizStep, setQuizStep] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState({});

  const [recommendedRecipes, setRecommendedRecipes] = useState([]);
  const [quizLoading, setQuizLoading] = useState(false);

  const [aiFailed, setAiFailed] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const [activeTab, setActiveTab] = useState('recipes');
  const [rateLimited, setRateLimited] = useState(false);
  const [sharingRecipeId, setSharingRecipeId] = useState(null);
  const [shareMessage, setShareMessage] = useState('');
  const claimedShareRef = useRef('');

  const isFetchingRef = useRef(false);

  const translateRecipesIfNeeded = async (recipeList) => {
    if (language !== 'mm') return recipeList;
    return Promise.all(recipeList.map(translateGeneratedRecipe));
  };

  useEffect(() => {
    const recipe = location.state?.openRecipe;
    if (!recipe) return;
    setSelectedRecipe(recipe);
    window.history.replaceState({}, document.title, window.location.pathname);
  }, [location.state]);


  // ============================================================
  // SAVED RECIPES
  // ============================================================

  const loadSavedRecipes = () => {
    try {
      const saved = localStorage.getItem(SAVED_KEY);

      if (saved) {
        return JSON.parse(saved);
      }

    } catch (e) {
      console.warn('Failed to load saved recipes:', e);
    }

    return [];
  };

  useEffect(() => {
    let active = true;
    const localSavedRecipes = loadSavedRecipes();
    if (localSavedRecipes.length > 0) setSavedRecipes(localSavedRecipes);

    const loadCloudSavedRecipes = async () => {
      if (!user || user.isLocal) {
        setSavedRecipes(localSavedRecipes);
        return;
      }
      if (!supabase) {
        setSavedRecipes(localSavedRecipes);
        return;
      }
      const { data } = await supabase.from('user_preferences').select('settings').eq('user_id', user.id).maybeSingle();
      if (active) {
        const cloudSavedRecipes = data?.settings?.savedRecipes || [];
        setSavedRecipes(cloudSavedRecipes.length > 0
          ? await translateRecipesIfNeeded(cloudSavedRecipes)
          : localSavedRecipes);
      }
    };
    loadCloudSavedRecipes();
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    const shareToken = new URLSearchParams(location.search).get('share');
    if (!shareToken || claimedShareRef.current === shareToken) return;
    if (!user || user.isLocal || !supabase) {
      setShareMessage(language === 'mm'
        ? 'မျှဝေထားသော ချက်ပြုတ်နည်းကို သိမ်းရန် အကောင့်ဝင်ပါ။'
        : 'Sign in to save this shared recipe to your account.');
      return;
    }

    claimedShareRef.current = shareToken;
    supabase.rpc('claim_recipe_share', { share_token: shareToken })
      .then(async ({ data, error }) => {
        if (error) throw error;
        const translated = language === 'mm' ? await translateGeneratedRecipe(data) : data;
        setSavedRecipes((current) => current.some((recipe) => recipe.id === translated.id)
          ? current
          : [...current, translated]);
        setActiveTab('saved');
        setShareMessage(language === 'mm' ? 'ချက်ပြုတ်နည်းကို သင့်အကောင့်တွင် သိမ်းပြီးပါပြီ။' : 'Recipe saved to your account.');
        window.history.replaceState({}, document.title, window.location.pathname);
      })
      .catch((error) => {
        claimedShareRef.current = '';
        setShareMessage(error.message || (language === 'mm' ? 'မျှဝေထားသော ချက်ပြုတ်နည်းကို သိမ်း၍မရပါ။' : 'Could not save the shared recipe.'));
      });
  }, [location.search, user?.id, language]);

  const persistSavedRecipes = async (nextRecipes) => {
    if (!user || user.isLocal) {
      localStorage.setItem(SAVED_KEY, JSON.stringify(nextRecipes));
      return;
    }
    if (!supabase) throw new Error('Cloud saving is unavailable for this account.');
    const { data } = await supabase.from('user_preferences').select('settings').eq('user_id', user.id).maybeSingle();
    const { error } = await supabase.from('user_preferences').upsert({
      user_id: user.id,
      settings: { ...(data?.settings || {}), savedRecipes: nextRecipes },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (error) throw error;
  };


  const saveRecipe = async (recipe) => {

    if (savingRecipeId === recipe.id) return;

    const saved = savedRecipes;

    if (saved.some(r => r.id === recipe.id)) {
      alert('Recipe already saved!');
      return;
    }

    const updated = [
      ...saved,
      {
        ...recipe,
        savedAt: Date.now()
      }
    ];

    setSavingRecipeId(recipe.id);
    try {
      await persistSavedRecipes(updated);
      setSavedRecipes(updated);
      alert('Recipe saved!');
    } catch (error) {
      console.error('Could not save recipe to cloud:', error);
      alert('Could not save this recipe to the cloud. Please try again.');
    } finally {
      setSavingRecipeId(null);
    }
  };


  const removeSavedRecipe = async (recipeId) => {

    const updated = savedRecipes.filter(
      recipe => recipe.id !== recipeId
    );

    try {
      await persistSavedRecipes(updated);
      setSavedRecipes(updated);
    } catch (error) {
      console.error('Could not remove saved recipe from cloud:', error);
    }
  };

  const shareSavedRecipe = async (recipe) => {
    if (!user || user.isLocal || !supabase) {
      setShareMessage(language === 'mm' ? 'ချက်ပြုတ်နည်းမျှဝေရန် အကောင့်ဝင်ပါ။' : 'Sign in to share recipes from your account.');
      return;
    }
    setSharingRecipeId(recipe.id);
    setShareMessage('');
    try {
      const { data, error } = await supabase
        .from('recipe_shares')
        .insert({ owner_id: user.id, recipe })
        .select('token')
        .single();
      if (error) throw error;
      const shareUrl = `${window.location.origin}/recipes?share=${data.token}`;
      if (navigator.share) {
        await navigator.share({ title: recipe.name || 'Recipe', url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
      }
      setShareMessage(language === 'mm' ? 'မျှဝေမည့်လင့်ခ်ကို ကူးယူပြီးပါပြီ။' : 'Share link copied.');
    } catch (error) {
      if (error?.name !== 'AbortError') setShareMessage(error.message || (language === 'mm' ? 'မျှဝေမရပါ။' : 'Could not create a share link.'));
    } finally {
      setSharingRecipeId(null);
    }
  };


  // ============================================================
  // CACHE
  // ============================================================

  const loadCachedRecipes = () => {

    try {

      const cached = localStorage.getItem(CACHE_KEY);

      if (!cached) {
        return null;
      }

      const data = JSON.parse(cached);

      if (
        Date.now() - data.timestamp >
        CACHE_DURATION
      ) {
        localStorage.removeItem(CACHE_KEY);
        return null;
      }

      return data.recipes;

    } catch (e) {

      localStorage.removeItem(CACHE_KEY);

      return null;
    }
  };


  const saveToCache = (recipesData) => {

    try {

      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          recipes: recipesData,
          timestamp: Date.now()
        })
      );

    } catch (e) {

      console.warn(
        'Failed to cache recipes:',
        e
      );
    }
  };


  // ============================================================
  // INGREDIENT HELPERS
  // ============================================================

  /*
   * Supports both:
   *
   * "Egg"
   *
   * and the new format:
   *
   * {
   *   name: "Egg",
   *   quantity: "2",
   *   available: true
   * }
   */

  const getIngredientName = (ingredient) => {

    if (!ingredient) {
      return '';
    }

    if (typeof ingredient === 'string') {
      return ingredient;
    }

    if (typeof ingredient === 'object') {
      return ingredient.name || '';
    }

    return '';
  };


  const getIngredientQuantity = (ingredient) => {

    if (!ingredient) {
      return '';
    }

    if (typeof ingredient === 'object') {
      return ingredient.quantity || '';
    }

    return '';
  };


  const normalizePantryName = (item) => {
    const name = item.normalizedName?.toLowerCase().trim() || item.name?.toLowerCase().trim() || '';
    const aliases = {
      'ကြက်သား': 'chicken',
      'kyat thar': 'chicken',
      'ဝက်သား': 'pork',
      'အမဲသား': 'beef',
    };
    return aliases[name] || name;
  };

  const isIngredientAvailable = (ingredient) => {

    const name = getIngredientName(ingredient).toLowerCase().trim();
    const matchingName = String(ingredient?.originalName || name).toLowerCase().trim();

    if (!name) {
      return false;
    }

    const existsInInventory = items.some(item => {

      const itemName = normalizePantryName(item);

      return (
        itemName.includes(matchingName) ||
        matchingName.includes(itemName)
      );
    });

    if (existsInInventory) return true;

    return false;
  };

  const pantryStaples = [
    'salt', 'pepper', 'water', 'oil', 'olive oil', 'vegetable oil',
    'sugar', 'flour', 'butter', 'garlic', 'onion', 'spices', 'seasoning',
    'vinegar', 'soy sauce', 'stock', 'broth', 'baking soda', 'baking powder'
  ];

  const isPantryStaple = (name) => {
    const normalizedName = name.toLowerCase().trim();
    return pantryStaples.some((staple) => normalizedName === staple || normalizedName.includes(`${staple} `));
  };

  const getUsedInventoryItems = (recipe) => (recipe?.ingredients || [])
    .map((ingredient) => {
      const name = getIngredientName(ingredient).toLowerCase().trim();
      if (!name || isPantryStaple(name)) return null;
      return items.find((item) => {
        const itemName = normalizePantryName(item);
        return itemName.includes(name) || name.includes(itemName);
      }) || null;
    })
    .filter((item, index, allItems) => item && allItems.findIndex((candidate) => candidate.id === item.id) === index);

  const startCooking = () => {
    setIsCooking(true);
    setCookingStep(0);
    setUsedIngredientIds([]);
    setCookingFinished(false);
    setIngredientsRemoved(false);
    setCookingQuestion('');
    setCookingChat([]);
  };

  const finishCooking = async () => {
    const usedItems = getUsedInventoryItems(selectedRecipe);
    const removedItems = usedItems.filter((item) => usedIngredientIds.includes(item.id));
    for (const item of removedItems) {
      await deleteItem(item.id);
    }

    const removedNames = new Set(removedItems.map((item) => normalizePantryName(item)));
    const updatedIngredients = selectedRecipe.ingredients?.map((ingredient) => {
      const ingredientName = getIngredientName(ingredient).toLowerCase().trim();
      const wasRemoved = [...removedNames].some((itemName) => itemName.includes(ingredientName) || ingredientName.includes(itemName));
      return wasRemoved && typeof ingredient === 'object'
        ? { ...ingredient, available: false }
        : ingredient;
    });

    setSelectedRecipe((recipe) => recipe ? {
      ...recipe,
      ingredients: updatedIngredients,
      availableCount: updatedIngredients?.filter((ingredient) => isIngredientAvailable(ingredient)).length || 0,
    } : recipe);
    setIngredientsRemoved(true);
  };

  const askCookingQuestion = async (event) => {
    event.preventDefault();
    const question = cookingQuestion.trim();
    if (!question || cookingChatLoading || !selectedRecipe) return;

    setCookingQuestion('');
    setCookingChat((messages) => [...messages, { role: 'user', text: question }]);
    setCookingChatLoading(true);
    let answer;
    try {
      answer = await askCookingAssistant(question, selectedRecipe, items);
    } catch {
      answer = 'The local cooking assistant is unavailable. Start Ollama or LM Studio to ask this question.';
    }
    setCookingChat((messages) => [...messages, { role: 'assistant', text: answer }]);
    setCookingChatLoading(false);
  };


  const isMainIngredientAvailable = (recipe) => {

    if (!recipe.mainIngredient) {
      return true;
    }

    const main =
      recipe.mainIngredient
        .toLowerCase()
        .trim();

    return items.some(item => {

      const itemName =
        normalizePantryName(item);

      return (
        itemName.includes(main) ||
        main.includes(itemName)
      );
    });
  };


  // ============================================================
  // RECIPE STATUS
  // ============================================================

  const getRecipeStatus = (recipe) => {

    const ingredients =
      recipe.ingredients || [];

    const total =
      recipe.totalCount ??
      ingredients.length;

    const available = ingredients.filter(
      ingredient => isIngredientAvailable(ingredient)
    ).length;

    const hasMain =
      isMainIngredientAvailable(recipe);

    if (
      total > 0 &&
      available >= total
    ) {
      return {
        status: 'ready',
        label: t('ready'),
        available,
        total,
      };
    }

    if (hasMain) {
      return {
        status: 'partial',
        label: language === 'mm' ? 'အချို့ မရှိပါ' : 'Missing some',
        available,
        total,
      };
    }

    return {
      status: 'missing',
      label: language === 'mm' ? 'အဓိကပစ္စည်း မရှိပါ' : 'Missing main',
      available,
      total,
    };
  };


  // ============================================================
  // SAVED CHECK
  // ============================================================

  const isRecipeSaved = (recipe) => {

    return savedRecipes.some(
      saved => saved.id === recipe.id
    );
  };


  // ============================================================
  // FETCH MAIN RECIPES
  // ============================================================

  const fetchRecipes = async (
    forceRefresh = false
  ) => {

    if (itemsLoading) return;

    if (forceRefresh) {
      activeRecipeGeneration = null;
      activeRecipeGenerationKey = '';
    }

    if (isFetchingRef.current) {
      return;
    }

    if (
      !items ||
      items.length === 0
    ) {

      localStorage.removeItem(CACHE_KEY);
      setRecipes([]);
      setOldRecipes([]);
      setAiFailed(false);
      setRateLimited(false);

      return;
    }


    // ----------------------------------------------------------
    // CACHE
    // ----------------------------------------------------------

    if (!forceRefresh) {

      const cached =
        loadCachedRecipes();

      if (
        cached &&
        cached.length > 0
      ) {

        console.log(
          'Using cached recipes'
        );

        setRecipes(await translateRecipesIfNeeded(cached.slice(0, 3)));

        setOldRecipes([]);

        setAiFailed(false);
        setRateLimited(false);

        return;
      }
    }


    // ----------------------------------------------------------
    // START LOADING
    // ----------------------------------------------------------

    isFetchingRef.current = true;

    setLoading(true);
    setError(null);

    setAiFailed(false);
    setRateLimited(false);


    if (recipes.length > 0 && !forceRefresh) {
      setOldRecipes(recipes);
    } else {
      setOldRecipes([]);
    }

    if (!recipes.length) {
      setRecipes([]);
    }

    let generationKey = '';

    try {

      /*
       * IMPORTANT:
       *
       * Do NOT only send { name }.
       *
       * Send the complete inventory so the AI can see:
       * quantity
       * unit
       * expiry
       * location
       */

      generationKey = JSON.stringify(items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        expiryDate: item.expiryDate,
      })));

      if (forceRefresh || !activeRecipeGeneration || activeRecipeGenerationKey !== generationKey) {
        activeRecipeGenerationKey = generationKey;
        activeRecipeGeneration = generateRecipes(items);
      }

      const result = await activeRecipeGeneration;


      /*
       * ALWAYS keep exactly 3.
       *
       * The service should already request 3,
       * but this protects the UI from showing
       * more than 3.
       */

      const threeRecipes =
        Array.isArray(result)
          ? result.slice(0, 3)
          : [];


      if (threeRecipes.length === 0) {
        throw new Error(
          'No recipes were generated'
        );
      }


      const timestamp =
        Date.now();

      const batchId =
        `batch-${timestamp}`;


      const recipesWithTime =
        threeRecipes.map(
          (recipe, index) => ({

            ...recipe,

            id:
              recipe.id ||
              `recipe-${timestamp}-${index}`,

            generatedAt:
              timestamp,

            batchId:
              batchId

          })
        );


      setRecipes(
        recipesWithTime
      );

      setOldRecipes([]);

      saveToCache(
        recipesWithTime
      );

      setAiFailed(false);
      setRateLimited(false);


    } catch (err) {

      console.error(
        'Recipe generation error:',
        err
      );

      const cachedFallback = loadCachedRecipes();
      if (cachedFallback && cachedFallback.length > 0) {
        setRecipes(await translateRecipesIfNeeded(cachedFallback.slice(0, 3)));
        setOldRecipes([]);
        setAiFailed(false);
        setRateLimited(false);
        setError(null);
      }

      const isRateLimit =
        err.message?.includes(
          'Rate limited'
        ) ||
        err.message?.includes(
          '429'
        );


      if (isRateLimit) {

        setRateLimited(true);

        setError(
          'The AI is currently rate limited. Please wait a moment and try again.'
        );

      } else if (!cachedFallback || cachedFallback.length === 0) {

        setError(
          withConnectionHint('We could not reach the recipe service right now', 'try generating recipes again')
        );
      }


      setAiFailed(!cachedFallback || cachedFallback.length === 0);


    } finally {

      if (activeRecipeGenerationKey === generationKey) {
        activeRecipeGeneration = null;
        activeRecipeGenerationKey = '';
      }

      setLoading(false);

      isFetchingRef.current = false;
    }
  };


  // ============================================================
  // INITIAL LOAD
  // ============================================================

  useEffect(() => {
    if (itemsLoading || initialLoadDone) return;

    let active = true;
    const loadInitialRecipes = async () => {
      const cached = loadCachedRecipes();
      if (cached && cached.length > 0) {
        const translated = await translateRecipesIfNeeded(cached.slice(0, 3));
        if (active) {
          setRecipes(translated);
          setAiFailed(false);
          setInitialLoadDone(true);
        }
        return;
      }

      if (items.length > 0) await fetchRecipes(false);
      if (active) setInitialLoadDone(true);
    };

    loadInitialRecipes();
    return () => { active = false; };

  }, [items, itemsLoading, initialLoadDone]);


  // ============================================================
  // QUIZ
  // ============================================================

  const quizQuestions = [

    {
      id: 'mealType',

      question:
        'What type of meal do you want?',

      options: [
        'Breakfast',
        'Lunch',
        'Dinner',
        'Snack',
        'Dessert'
      ],

      icons: [
        faMugSaucer,
        faBurger,
        faUtensils,
        faBowlFood,
        faCake
      ]
    },

    {
      id: 'cuisine',

      question:
        'What cuisine do you prefer?',

      options: [
        'Italian',
        'Asian',
        'Mexican',
        'Mediterranean',
        'American',
        'Indian',
        'Japanese',
        'Thai'
      ],

      icons: Array(8).fill(
        faGlobe
      )
    },

    {
      id: 'dietary',

      question:
        'Any dietary preferences?',

      options: [
        'No preference',
        'Vegetarian',
        'Non-Vegetarian',
        'Seafood',
        'Gluten-Free',
        'Dairy-Free'
      ],

      icons: [
        faCircle,
        faLeaf,
        faUtensils,
        faFish,
        faCircleXmark,
        faCircleXmark
      ]
    },

    {
      id: 'cookingTime',

      question:
        'How much time do you have?',

      options: [
        'Quick (<15 min)',
        'Medium (15-30 min)',
        'Long (30-60 min)',
        'Very Long (>60 min)'
      ],

      icons: [
        faClock,
        faClock,
        faClock,
        faClock
      ]
    },

    {
      id: 'spice',

      question:
        'How spicy do you like it?',

      options: [
        'Mild',
        'Medium',
        'Spicy',
        'Very Spicy',
        'No spice'
      ],

      icons: [
        faPepperHot,
        faPepperHot,
        faPepperHot,
        faPepperHot,
        faCircleXmark
      ]
    },

    {
      id: 'mood',

      question:
        'What are you in the mood for?',

      options: [
        'Comfort Food',
        'Healthy',
        'Soup',
        'Curry',
        'Grilled',
        'Salad',
        'Pasta',
        'Rice Dish'
      ],

      icons: [
        faSmile,
        faLeaf,
        faBowlFood,
        faFire,
        faFire,
        faLeaf,
        faUtensils,
        faBowlFood
      ]
    }
  ];


  const startQuiz = () => {
    setShowQuiz(true);
    setQuizStep(0);
    setQuizAnswers({});
    setRecommendedRecipes([]);
    setAiFailed(false);
  };


  const handleQuizAnswer = (
    questionId,
    answer
  ) => {

    const updatedAnswers = {
      ...quizAnswers,
      [questionId]: answer
    };

    setQuizAnswers(
      updatedAnswers
    );


    if (
      quizStep <
      quizQuestions.length - 1
    ) {

      setQuizStep(
        quizStep + 1
      );

    } else {

      generateRecommendationsFromQuiz(
        updatedAnswers
      );
    }
  };


  // ============================================================
  // QUIZ RECOMMENDATIONS
  // ============================================================

  const generateRecommendationsFromQuiz =
    async (answers = quizAnswers) => {

      setQuizLoading(true);
      setAiFailed(false);


      try {

        const result =
          await generateRecommendations(
            {
              dietaryPreference: settings.dietaryPreference,
              cuisine: settings.cuisine,
              spiceLevel: settings.spiceLevel,
              cookingTime: settings.cookingTime,
              servingSize: settings.servingSize,
              ...answers,
            }
          );


        /*
         * Always show 3 max.
         */
        const threeRecipes =
          Array.isArray(result)
            ? result.slice(0, 3)
            : [];


        if (
          threeRecipes.length > 0
        ) {

          const timestamp = Date.now();
          const recipesWithIds = threeRecipes.map((recipe, index) => ({
            ...recipe,
            id: recipe.id || `find-dish-${timestamp}-${index}`,
            generatedAt: timestamp,
          }));

          setRecommendedRecipes(recipesWithIds);

          setAiFailed(false);

        } else {

          setRecommendedRecipes([]);

          setAiFailed(true);
        }


      } catch (error) {

        console.error(
          'Recommendation error:',
          error
        );

        setAiFailed(true);
        setRecommendedRecipes([]);

      } finally {

        setQuizLoading(false);

        setQuizStep(
          quizQuestions.length
        );
      }
    };


  // ============================================================
  // RESET QUIZ
  // ============================================================

  const resetQuiz = () => {

    setShowQuiz(false);
    setQuizStep(0);
    setQuizAnswers({});
    setRecommendedRecipes([]);
    setAiFailed(false);
  };


  // ============================================================
  // DETAIL POPUP
  // ============================================================

  const openRecipeDetail = (recipe) => {

    setSelectedRecipe(recipe);
    setIsCooking(false);
    setCookingStep(0);
    setUsedIngredientIds([]);
    setCookingFinished(false);
    setIngredientsRemoved(false);
    setCookingQuestion('');
    setCookingChat([]);

    document.body.style.overflow =
      'hidden';
  };


  const closeRecipeDetail = () => {

    setSelectedRecipe(null);
    setIsCooking(false);
    setCookingStep(0);
    setUsedIngredientIds([]);
    setCookingFinished(false);
    setIngredientsRemoved(false);

    document.body.style.overflow =
      'auto';
  };


  // ============================================================
  // FORMAT INSTRUCTIONS
  // ============================================================

  const formatInstructions = (
    instructions
  ) => {

    if (!instructions) {
      return [
        'No instructions available.'
      ];
    }


    /*
     * New format could potentially
     * already be an array.
     */

    if (Array.isArray(instructions)) {

      return instructions
        .map(step => {

          if (
            typeof step === 'object'
          ) {
            return (
              step.instruction ||
              step.text ||
              ''
            );
          }

          return step;
        })
        .filter(Boolean);
    }


    let steps =
      instructions
        .split('\n')
        .map(step => step.trim())
        .filter(Boolean);


    /*
     * If everything came as one paragraph,
     * split it into sentences.
     */

    if (steps.length <= 1) {

      const numbered =
        instructions.match(
          /\d+\.\s*[^0-9]+/g
        );


      if (numbered) {

        steps =
          numbered.map(
            step => step.trim()
          );

      } else {

        steps =
          instructions
            .split('.')
            .map(step => step.trim())
            .filter(Boolean)
            .map(step => `${step}.`);
      }
    }


    return steps.map(step => {

      return step
        .replace(/\\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    });
  };


  // ============================================================
  // FOOD ICON
  // ============================================================

  const getFoodIcon = (
    ingredient
  ) => {

    const lower =
      ingredient
        ?.toLowerCase() || '';


    if (
      lower.includes('chicken') ||
      lower.includes('beef') ||
      lower.includes('pork') ||
      lower.includes('meat')
    ) {
      return faDrumstickBite;
    }


    if (
      lower.includes('fish') ||
      lower.includes('salmon') ||
      lower.includes('tuna')
    ) {
      return faFish;
    }


    if (
      lower.includes('bread') ||
      lower.includes('toast') ||
      lower.includes('bun')
    ) {
      return faBreadSlice;
    }


    if (
      lower.includes('carrot') ||
      lower.includes('potato') ||
      lower.includes('vegetable')
    ) {
      return faCarrot;
    }


    if (
      lower.includes('apple') ||
      lower.includes('banana') ||
      lower.includes('fruit')
    ) {
      return faAppleAlt;
    }


    if (
      lower.includes('cheese') ||
      lower.includes('milk') ||
      lower.includes('yogurt')
    ) {
      return faCheese;
    }


    return faUtensils;
  };


  // ============================================================
  // DISPLAY RECIPES
  // ============================================================

  const displayRecipes =
    activeTab === 'saved'
      ? savedRecipes
      : recipes;


  // ============================================================
  // RENDER
  // ============================================================

  return (

    <div className="recipes-page" translate="yes" lang="my">


      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="recipes-header">

        <div>

          <h2 className="recipes-title">

            <FontAwesomeIcon
              icon={faUtensils}
              className="recipes-title-icon"
            />

            {language === 'mm' ? 'AI ချက်ပြုတ်နည်းများ' : 'AI Recipes'}

          </h2>


          <p className="recipes-subtitle">

            {items.length} {language === 'mm' ? t('items') : 'items'} in kitchen
            {' · '}
            {displayRecipes.length} {language === 'mm' ? t('noRecipes') : 'recipes'}

          </p>

        </div>


        <div className="recipes-actions">

          <button
            className="recipes-refresh-btn"
            onClick={() =>
              fetchRecipes(true)
            }
            disabled={loading}
          >

            {loading ? (

              <>
                <FontAwesomeIcon
                  icon={faClock}
                  spin
                />

                Loading...
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faRefresh} />
                {t('refresh')}
              </>
            )}
          </button>

          <button
            className="recipes-quiz-btn"
            onClick={startQuiz}
            disabled={
              loading
            }
          >

            <FontAwesomeIcon
              icon={faWandMagicSparkles}
            />

            {t('findMyDish')}

          </button>

        </div>

      </div>

      {language === 'mm' && (
        <div className="recipes-translation-notice" translate="no" role="note">
          ကျွန်ုပ်တို့အက်ပ်အတွင်းရှိ AI သည် အင်္ဂလိပ်အခြေပြုမော်ဒယ်ဖြစ်သောကြောင့် ချက်ပြုတ်နည်းအမည်များနှင့် ချက်ပြုတ်ညွှန်ကြားချက်များကို မြန်မာဘာသာသို့ တိုက်ရိုက်မပြန်နိုင်သေးပါ။ Chrome ဆက်တင်မှ Google Translate ကို အသုံးပြုနိုင်ပါသည်။ Recipes စာမျက်နှာမှ ထွက်သည့်အခါ မလိုအပ်သော အင်္ဂလိပ်စာများကို မပြန်စေရန် Google Translate ကို ပိတ်ပါ။
        </div>
      )}

      {shareMessage && (
        <div className="recipes-share-message" role="status">
          {shareMessage}
        </div>
      )}


      {/* ======================================================
          TABS
      ====================================================== */}

      <div className="recipes-tabs">

        <button
          className={`recipes-tab ${
            activeTab === 'recipes'
              ? 'active'
              : ''
          }`}
          onClick={() =>
            setActiveTab('recipes')
          }
          disabled={loading && activeTab === 'recipes'}
        >

          <FontAwesomeIcon
            icon={faFire}
          />

            {t('recipes')}

          {recipes.length > 0 && (

            <span className="tab-badge">
              {recipes.length}
            </span>

          )}

        </button>


        <button
          className={`recipes-tab ${
            activeTab === 'saved'
              ? 'active'
              : ''
          }`}
          onClick={() =>
            setActiveTab('saved')
          }
          disabled={loading && activeTab === 'recipes'}
        >

          <FontAwesomeIcon
            icon={faHeart}
          />

          {t('saved')}

          {savedRecipes.length > 0 && (

            <span className="tab-badge saved">
              {savedRecipes.length}
            </span>

          )}

        </button>


      </div>


      {/* ======================================================
          AI BADGE
      ====================================================== */}

      <div className="recipes-ai-badge">

        <FontAwesomeIcon
          icon={faRobot}
        />

        <div>

          <div className="recipes-ai-badge-title">

            {activeTab === 'saved'
              ? (language === 'mm' ? 'သိမ်းထားသော ချက်ပြုတ်နည်းများ' : 'Saved Recipes')
              : (language === 'mm' ? 'AI ချက်ပြုတ်နည်းများ' : 'AI-Powered Recipes')}

          </div>


          <div className="recipes-ai-badge-sub">

            {activeTab === 'saved'
              ? `${savedRecipes.length} ${language === 'mm' ? t('noRecipes') : 'recipes'} ${language === 'mm' ? 'သိမ်းထားသည်' : 'saved'}`
              : displayRecipes.length > 0
                ? `${displayRecipes.length} ${language === 'mm' ? t('noRecipes') : 'recipes'} ${language === 'mm' ? 'တင်ထားသည်' : 'loaded'}`
                : (language === 'mm' ? 'သင့်ပစ္စည်းများအပေါ် အခြေခံထားသော အကြံပြုချက်များ' : 'Personalized suggestions based on your items')
            }

          </div>

        </div>

      </div>


      {/* ======================================================
          QUIZ
      ====================================================== */}

      {showQuiz && (

        <div className="recipes-quiz-container">


          <div className="recipes-quiz-header">

            <h3>

              <FontAwesomeIcon
                icon={faWandMagicSparkles}
                className="recipes-quiz-icon"
              />

              {language === 'mm' ? 'သင့်အတွက် အကောင်းဆုံးဟင်းလျာ ရှာရန်' : 'Find Your Perfect Dish'}

            </h3>


            <button
              className="recipes-quiz-close"
              onClick={resetQuiz}
            >

              <FontAwesomeIcon
                icon={faX}
              />

            </button>

          </div>


          <div className="recipes-quiz-progress">

            <div
              className="recipes-quiz-progress-fill"
              style={{
                width:
                  `${(
                    quizStep /
                    quizQuestions.length
                  ) * 100}%`
              }}
            />

          </div>


          {/* --------------------------------------------------
              QUIZ RESULTS
          -------------------------------------------------- */}

          {quizStep ===
            quizQuestions.length &&
            !quizLoading ? (

            <div>

              {aiFailed ? (

                <div className="recipes-ai-unavailable">

                  <div className="recipes-ai-status-icon">
                    🤖
                  </div>

                  <h3>
                    {language === 'mm' ? 'AI လက်ရှိ အသုံးမပြုနိုင်သေးပါ' : 'AI is currently unavailable'}
                  </h3>

                  <p className="recipes-ai-status-message">

                    {language === 'mm' ? 'AI ဝန်ဆောင်မှု အသုံးပြုသူများပြားနေပါသည်။' : 'The AI is experiencing high demand right now.'}

                    <br />

                    <span
                      style={{
                        fontSize: '13px',
                        color: '#8a7a6a'
                      }}
                    >
                      {language === 'mm' ? 'ခဏအကြာတွင် ထပ်မံကြိုးစားပါ' : 'Free tier limitation - try again in a few minutes'}
                    </span>

                  </p>


                  <button
                    className="recipes-ai-retry-btn"
                    onClick={() =>
                      generateRecommendationsFromQuiz()
                    }
                    disabled={quizLoading}
                  >

                    <FontAwesomeIcon
                      icon={faRefresh}
                      spin={quizLoading}
                    />

                    {quizLoading
                      ? (language === 'mm' ? 'ဖွင့်နေသည်...' : 'Loading...')
                      : (language === 'mm' ? 'ထပ်ကြိုးစားရန်' : 'Try Again')}

                  </button>

                </div>

              ) : recommendedRecipes.length > 0 ? (

                <>

                  <div className="recipes-quiz-result-banner">

                    <span>
                      🎉
                    </span>

                    <p>
                      {language === 'mm' ? 'သင့်အတွက် သင့်တော်သော ဟင်းလျာ ၃ မျိုး' : 'Here are 3 dishes perfect for you!'}
                    </p>

                  </div>


                  <div className="recipes-quiz-results">

                    {recommendedRecipes
                      .slice(0, 3)
                      .map(
                        (recipe, index) => {

                          const status =
                            getRecipeStatus(
                              recipe
                            );

                          const hasAll =
                            status.status ===
                            'ready';

                          const hasMain =
                            status.status !==
                            'missing';


                          return (

                            <div
                              key={
                                recipe.id ||
                                index
                              }
                              className={`recipes-card ${status.status}`}
                              onClick={() =>
                                openRecipeDetail(
                                  recipe
                                )
                              }
                            >

                              <div className="recipes-card-header">

                                <span
                                  className="recipes-card-type"
                                  style={{
                                    background: hasAll
                                      ? 'var(--success)'
                                      : 'var(--accent-primary)',
                                    color: '#fff'
                                  }}
                                >

                                  <FontAwesomeIcon
                                    icon={
                                      hasAll
                                        ? faCircleCheck
                                        : hasMain
                                          ? faClock
                                          : faCircleXmark
                                    }
                                  />

                                  {hasAll
                                    ? t('ready')
                                    : hasMain
                                      ? t('partial')
                                      : t('missing')}

                                </span>


                                <h3>
                                  {recipe.name}
                                </h3>

                              </div>


                              <div className="recipes-card-meta">

                                <FontAwesomeIcon
                                  icon={getFoodIcon(
                                    recipe.mainIngredient
                                  )}
                                />

                                {recipe.mainIngredient ||
                                  'Various'}


                                <FontAwesomeIcon
                                  icon={faClock}
                                  className="recipes-quiz-result-clock"
                                />

                                {recipe.cookingTime ||
                                  '15 min'}

                              </div>


                              {recipe.whyRecommend && (

                                <div className="recipes-quiz-result-reason">

                                  <FontAwesomeIcon
                                    icon={faLightbulb}
                                  />

                                  {recipe.whyRecommend}

                                </div>

                              )}


                              <div className="recipes-card-footer">

                                <span
                                  className={
                                    hasAll
                                      ? 'ready'
                                      : 'missing'
                                  }
                                >

                                  {hasAll ? (

                                    <>
                                      <FontAwesomeIcon
                                        icon={faCircleCheck}
                                      />

                                      {t('ready')}!
                                    </>

                                  ) : (

                                    `${status.available}/${status.total} ${t('ingredients')}`

                                  )}

                                </span>


                                <span className="recipes-card-tap">

                                  {language === 'mm' ? 'အပြည့်အစုံကြည့်ရန်' : 'Tap for full recipe'}

                                </span>

                                <button
                                  className={`recipes-save-btn ${isRecipeSaved(recipe) ? 'saved' : ''}`}
                                  disabled={savingRecipeId === recipe.id}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    if (isRecipeSaved(recipe)) {
                                      removeSavedRecipe(recipe.id);
                                    } else {
                                      saveRecipe(recipe);
                                    }
                                  }}
                                >
                                  <FontAwesomeIcon
                                    icon={isRecipeSaved(recipe) ? faHeart : faSave}
                                    spin={savingRecipeId === recipe.id}
                                  />
                                  {savingRecipeId === recipe.id ? t('saving') : isRecipeSaved(recipe) ? t('saved') : t('save')}
                                </button>

                              </div>

                            </div>

                          );

                        }
                      )}

                  </div>

                </>

              ) : (

                <div className="recipes-quiz-no-results">

                  <p>
                    No recipes found. Try different preferences!
                  </p>

                </div>

              )}


              <button
                className="recipes-quiz-reset-btn"
                onClick={resetQuiz}
              >

                <FontAwesomeIcon
                  icon={faArrowRight}
                />

                Start New Search

              </button>

            </div>


          ) : quizLoading ? (

            <div className="recipes-quiz-loading">

              <FontAwesomeIcon
                icon={faRobot}
                className="recipes-quiz-loading-icon"
              />

              <p>
                Finding the perfect dishes for you...
              </p>

              <div className="recipes-quiz-loading-bar">

                <div className="recipes-quiz-loading-bar-fill" />

              </div>

            </div>


          ) : (

            <div>

              <p className="recipes-quiz-question">

                {quizQuestions[quizStep].question}

              </p>


              <div className="recipes-quiz-options">

                {quizQuestions[
                  quizStep
                ].options.map(
                  (option, index) => (

                    <button
                      key={option}
                      className="recipes-quiz-option"
                      onClick={() =>
                        handleQuizAnswer(
                          quizQuestions[
                            quizStep
                          ].id,
                          option
                        )
                      }
                    >

                      <FontAwesomeIcon
                        icon={
                          quizQuestions[
                            quizStep
                          ].icons?.[index] ||
                          faCircle
                        }
                        className="recipes-quiz-option-icon"
                      />

                      {option}

                    </button>

                  )
                )}

              </div>


              <div className="recipes-quiz-step">

                Question {quizStep + 1}
                {' '}of{' '}
                {quizQuestions.length}

              </div>

            </div>

          )}

        </div>

      )}


      {/* ======================================================
          NORMAL RECIPE LIST
      ====================================================== */}

      {!showQuiz && (

        <>

          {loading && activeTab === 'recipes' && <PageSkeleton colors={colors} showHeading={false} />}


          {/* RATE LIMITED */}

          {!loading &&
            rateLimited && (

              <div className="recipes-rate-limited">

                <FontAwesomeIcon
                  icon={faExclamationTriangle}
                  className="rate-limited-icon"
                />

                <h3>
                  AI is currently rate limited
                </h3>

                <p className="rate-limited-message">

                  The AI has reached its free tier limit.
                  Please wait a moment and try again.

                </p>


                <button
                  className="rate-limited-retry-btn"
                  onClick={() =>
                    fetchRecipes(true)
                  }
                  disabled={loading}
                >

                  <FontAwesomeIcon
                    icon={faRefresh}
                    spin={loading}
                  />

                  Try Again

                </button>

              </div>

            )}


          {/* ERROR */}

          {error &&
            !rateLimited && (

              <div className="recipes-error">

                <FontAwesomeIcon
                  icon={faCircleXmark}
                />
                <div className="recipes-error-content">
                  <h3>Recipe ideas are taking a break</h3>
                  <p>We could not reach the recipe service right now. Your inventory is still safe.</p>
                  <button
                    type="button"
                    className="recipes-error-retry"
                    onClick={() => fetchRecipes(true)}
                    disabled={loading}
                  >
                    <FontAwesomeIcon icon={faRefresh} spin={loading} />
                    Try again
                  </button>
                </div>

              </div>

            )}


          {/* EMPTY */}

          {items.length === 0 &&
            displayRecipes.length === 0 && (

              <div className="recipes-empty">

                <FontAwesomeIcon
                  icon={faUtensils}
                  className="recipes-empty-icon"
                />

                  <p className="recipes-empty-title">{t('emptyRecipeTitle')}</p>

                <p className="recipes-empty-sub">{t('emptyRecipeSubtitle')}</p>

              </div>

            )}


          {/* ==================================================
              RECIPE CARDS
          ================================================== */}

          {displayRecipes.length > 0 &&
            (activeTab === 'saved' || !loading) && (

              <div className="recipes-list">

                {displayRecipes
                  .slice(0, activeTab === 'recipes' ? 3 : undefined)
                  .map(
                    (recipe, index) => {

                      const status =
                        getRecipeStatus(
                          recipe
                        );

                      const hasAll =
                        status.status ===
                        'ready';

                      const hasMain =
                        status.status !==
                        'missing';


                      let borderColor =
                        '#e8ddd0';

                      let statusIcon =
                        null;


                      if (hasAll) {

                        borderColor =
                          '#2d7d46';

                        statusIcon =
                          faCircleCheck;

                      } else if (hasMain) {

                        borderColor =
                          '#d97706';

                        statusIcon =
                          faClock;

                      } else {

                        borderColor =
                          '#c0392b';

                        statusIcon =
                          faCircleXmark;
                      }


                      return (

                        <div
                          key={
                            recipe.id ||
                            index
                          }
                          className="recipes-card"
                          onClick={() =>
                            openRecipeDetail(
                              recipe
                            )
                          }
                          style={{
                            borderLeftColor:
                              borderColor,

                            borderLeftWidth:
                              '4px'
                          }}
                        >


                          <div className="recipes-card-header">

                            <span
                              className="recipes-card-status"
                              style={{
                                background:
                                  borderColor,

                                color:
                                  '#fff',

                                fontSize:
                                  '9px',

                                padding:
                                  '2px 10px',

                                borderRadius:
                                  '10px',

                                fontWeight:
                                  600,

                                textTransform:
                                  'uppercase',

                                letterSpacing:
                                  '0.04em'
                              }}
                            >

                              <FontAwesomeIcon
                                icon={
                                  statusIcon
                                }
                                style={{
                                  marginRight:
                                    '4px',

                                  fontSize:
                                    '8px'
                                }}
                              />

                              {status.label}

                            </span>


                            <h3>
                              {recipe.name}
                            </h3>

                          </div>


                          <div className="recipes-card-meta">

                            <FontAwesomeIcon
                              icon={getFoodIcon(
                                recipe.mainIngredient ||
                                ''
                              )}
                            />

                            {recipe.mainIngredient ||
                              'Various'}


                            <FontAwesomeIcon
                              icon={faClock}
                              className="recipes-card-clock"
                            />

                            {recipe.cookingTime ||
                              '15 min'}

                          </div>


                          <div className="recipes-card-footer">

                            <span
                              className={
                                hasAll
                                  ? 'ready'
                                  : 'missing'
                              }
                            >

                              {hasAll ? (

                                <>
                                  <FontAwesomeIcon
                                    icon={
                                      faCircleCheck
                                    }
                                  />

                                  {language === 'mm' ? 'ပါဝင်ပစ္စည်းအားလုံး အဆင်သင့်' : 'All ingredients ready!'}

                                </>

                              ) : (

                                `${status.available}/${status.total} ${t('ingredients')}`

                              )}

                            </span>


                            {activeTab === 'recipes' ? (

                              <button
                                className={`recipes-save-btn ${
                                  isRecipeSaved(recipe)
                                    ? 'saved'
                                    : ''
                                }`}
                                  disabled={savingRecipeId === recipe.id}
                                onClick={(e) => {

                                  e.stopPropagation();

                                  if (
                                    isRecipeSaved(
                                      recipe
                                    )
                                  ) {

                                    removeSavedRecipe(
                                      recipe.id
                                    );

                                  } else {

                                    saveRecipe(
                                      recipe
                                    );

                                  }

                                }}
                              >

                                <FontAwesomeIcon
                                  icon={
                                    isRecipeSaved(recipe)
                                      ? faHeart
                                      : faSave
                                  }
                                  spin={savingRecipeId === recipe.id}
                                />

                                {savingRecipeId === recipe.id
                                  ? t('saving')
                                  : isRecipeSaved(recipe)
                                  ? t('saved')
                                  : t('save')}

                              </button>

                            ) : (
                              <>
                                <button
                                  className="recipes-share-btn"
                                  disabled={sharingRecipeId === recipe.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    shareSavedRecipe(recipe);
                                  }}
                                >
                                  <FontAwesomeIcon icon={faShare} />
                                  {sharingRecipeId === recipe.id
                                    ? (language === 'mm' ? 'မျှဝေနေသည်...' : 'Sharing...')
                                    : (language === 'mm' ? 'မျှဝေရန်' : 'Share')}
                                </button>
                                <button
                                  className="recipes-remove-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeSavedRecipe(recipe.id);
                                  }}
                                >
                                  <FontAwesomeIcon icon={faTrash} />
                                  {language === 'mm' ? 'ဖျက်ရန်' : 'Remove'}
                                </button>
                              </>

                            )}

                          </div>

                        </div>

                      );

                    }
                  )}

              </div>

            )}

        </>

      )}


      {/* ======================================================
          RECIPE DETAIL
      ====================================================== */}

      {selectedRecipe && (

        <div
          className="recipes-detail-overlay"
          onClick={closeRecipeDetail}
        >

          <div
            translate="yes"
            lang="my"
            className="recipes-detail-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >


            {/* CLOSE */}

            <button
              className="recipes-detail-close"
              onClick={closeRecipeDetail}
            >

              <FontAwesomeIcon
                icon={faX}
              />

            </button>


            {/* TITLE */}

            <h2 className="recipes-detail-title">

              {selectedRecipe.name}

            </h2>


            {/* META */}

            <div className="recipes-detail-meta">

              <span>

                <FontAwesomeIcon
                  icon={getFoodIcon(
                    selectedRecipe.mainIngredient ||
                    ''
                  )}
                />

                {selectedRecipe.mainIngredient ||
                  'Various'}

              </span>


              <span>

                <FontAwesomeIcon
                  icon={faClock}
                />

                {selectedRecipe.cookingTime ||
                  '15 min'}

              </span>


              {selectedRecipe.ingredients && (

                <span
                  className={
                    getRecipeStatus(
                      selectedRecipe
                    ).status === 'ready'
                      ? 'ready'
                      : 'missing'
                  }
                >

                  {getRecipeStatus(
                    selectedRecipe
                  ).status === 'ready' ? (

                    <>
                      <FontAwesomeIcon
                        icon={faCircleCheck}
                      />

                      {t('allIngredientsReady')}
                    </>

                  ) : (

                    `${getRecipeStatus(selectedRecipe).available}/${getRecipeStatus(selectedRecipe).total} ${t('ingredientsAvailable')}`

                  )}

                </span>

              )}

            </div>

            {isCooking && (
              <div className="recipes-cooking-panel">
                {!cookingFinished && !ingredientsRemoved ? (
                  <>
                    <div className="recipes-cooking-progress">
                      {t('step')} {cookingStep + 1} / {formatInstructions(selectedRecipe.instructions || '').length}
                    </div>
                    <div className="recipes-cooking-step-card">
                      <span className="recipes-detail-step-number">{cookingStep + 1}</span>
                      <p>{formatInstructions(selectedRecipe.instructions || '')[cookingStep]?.replace(/^\d+\.\s*/, '')}</p>
                    </div>
                    <div className="recipes-cooking-actions">
                      {cookingStep > 0 && (
                        <button type="button" className="recipes-cooking-secondary" onClick={() => setCookingStep((step) => step - 1)}>
                          {t('back')}
                        </button>
                      )}
                      {cookingStep < formatInstructions(selectedRecipe.instructions || '').length - 1 ? (
                        <button type="button" className="recipes-detail-cook-btn" onClick={() => setCookingStep((step) => step + 1)}>
                          {t('nextStep')} <FontAwesomeIcon icon={faArrowRight} />
                        </button>
                      ) : (
                        <button type="button" className="recipes-detail-cook-btn" onClick={() => setCookingFinished(true)}>
                          {t('doneCooking')} <FontAwesomeIcon icon={faCircleCheck} />
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="recipes-used-items-panel">
                    <FontAwesomeIcon icon={faCircleCheck} className="recipes-used-items-icon" />
                    {ingredientsRemoved ? (
                      <>
                        <h3>{t('inventoryUpdated')}</h3>
                        <p>{t('selectedIngredientsRemoved')}</p>
                        <button type="button" className="recipes-cooking-secondary" onClick={closeRecipeDetail}>{t('close')}</button>
                      </>
                    ) : (
                      <>
                        <h3>{t('whichIngredientsUsed')}</h3>
                        <p>{t('onlyCheckedRemoved')}</p>
                        {getUsedInventoryItems(selectedRecipe).length > 0 ? (
                          <div className="recipes-used-items-list">
                            {getUsedInventoryItems(selectedRecipe).map((item) => (
                              <label key={item.id} className="recipes-used-item">
                                <input
                                  type="checkbox"
                                  checked={usedIngredientIds.includes(item.id)}
                                  onChange={() => setUsedIngredientIds((ids) => ids.includes(item.id) ? ids.filter((id) => id !== item.id) : [...ids, item.id])}
                                />
                                <span>{item.name}</span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <p>{t('noMatchingItems')}</p>
                        )}
                        <button type="button" className="recipes-detail-cook-btn" onClick={finishCooking} disabled={usedIngredientIds.length === 0}>
                          {t('removeSelected')} <FontAwesomeIcon icon={faTrash} />
                        </button>
                        <button type="button" className="recipes-cooking-secondary" onClick={closeRecipeDetail}>{t('keepInventory')}</button>
                      </>
                    )}
                  </div>
                )}

                <div className="recipes-cooking-chat">
                  <div className="recipes-cooking-chat-title">
                    <FontAwesomeIcon icon={faRobot} />
                    <span>{t('cookingHelper')}</span>
                  </div>
                  {cookingChat.length > 0 && (
                    <div className="recipes-cooking-chat-messages">
                      {cookingChat.map((message, index) => (
                        <div key={`${message.role}-${index}`} className={`recipes-cooking-chat-message ${message.role}`}>
                          {message.text}
                        </div>
                      ))}
                    </div>
                  )}
                  <form className="recipes-cooking-chat-form" onSubmit={askCookingQuestion}>
                    <input
                      value={cookingQuestion}
                      onChange={(event) => setCookingQuestion(event.target.value)}
                      placeholder={t('missingIngredientAsk')}
                      aria-label={t('cookingHelper')}
                      disabled={cookingChatLoading}
                    />
                    <button type="submit" disabled={!cookingQuestion.trim() || cookingChatLoading}>
                      {cookingChatLoading ? '...' : t('ask')}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {!isCooking && (
              <>

            {/* WHY */}

            {selectedRecipe.whyRecommend && (

              <div className="recipes-detail-reason">

                <FontAwesomeIcon
                  icon={faLightbulb}
                />

                {selectedRecipe.whyRecommend}

              </div>

            )}


            {/* =================================================
                INGREDIENTS
            ================================================= */}

            <div className="recipes-detail-section">

              <h4>

                <FontAwesomeIcon
                  icon={faListCheck}
                />

                {t('ingredientsTitle')}

              </h4>


              <div className="recipes-detail-ingredients">

                {selectedRecipe.ingredients?.map(
                  (ingredient, index) => {

                    const name =
                      getIngredientName(
                        ingredient
                      );

                    const quantity =
                      getIngredientQuantity(
                        ingredient
                      );

                    const available =
                      isIngredientAvailable(
                        ingredient
                      );


                    return (

                      <span
                        key={index}
                        className={
                          available
                            ? 'has-item'
                            : 'missing-item'
                        }
                      >

                        <FontAwesomeIcon
                          icon={
                            available
                              ? faCircleCheck
                              : faCircleXmark
                          }
                        />


                        <span>

                          {quantity
                            ? `${quantity} ${name}`
                            : name}

                        </span>

                      </span>

                    );

                  }
                )}

              </div>

            </div>


            {/* =================================================
                MISSING INGREDIENTS
            ================================================= */}

            {selectedRecipe.ingredients && selectedRecipe.ingredients.some(
              ingredient => !isIngredientAvailable(ingredient)
            ) && (

              <div className="recipes-detail-missing">

                <>

                    <div className="recipes-detail-missing-title">

                      <FontAwesomeIcon
                        icon={faCircleXmark}
                      />

                      {t('missingIngredients')}

                    </div>


                    <div className="recipes-detail-missing-list">

                      {selectedRecipe.ingredients
                        .filter(
                          ingredient =>
                            !isIngredientAvailable(
                              ingredient
                            )
                        )
                        .map(
                          (ingredient, index) => {

                            const name =
                              getIngredientName(
                                ingredient
                              );

                            const quantity =
                              getIngredientQuantity(
                                ingredient
                              );


                            return (

                              <span
                                key={index}
                                className="recipes-detail-missing-item"
                              >

                                +

                                {' '}

                                {quantity
                                  ? `${quantity} ${name}`
                                  : name}

                              </span>

                            );

                          }
                        )}

                    </div>

                </>

              </div>

            )}


            {/* =================================================
                COOKING STEPS
            ================================================= */}

            {selectedRecipe.instructions && (

              <div className="recipes-detail-section">

                <h4>

                  <FontAwesomeIcon
                    icon={faBookOpen}
                  />

                  {t('cookingSteps')}

                </h4>


                <div className="recipes-detail-instructions">

                  {formatInstructions(
                    selectedRecipe.instructions
                  ).map(
                    (step, index) => (

                      <div
                        key={index}
                        className="recipes-detail-step"
                      >

                        <span className="recipes-detail-step-number">

                          {index + 1}

                        </span>


                        <span className="recipes-detail-step-text">

                          {step.replace(
                            /^\d+\.\s*/,
                            ''
                          )}

                        </span>

                      </div>

                    )
                  )}

                </div>

              </div>

            )}


            {/* =================================================
                LET'S COOK
            ================================================= */}

            <button
              className="recipes-detail-cook-btn"
              onClick={startCooking}
            >

              <FontAwesomeIcon
                icon={faUtensils}
              />

              {t('letsCook')}!

            </button>

              </>
            )}


          </div>

        </div>

      )}

    </div>
  );
}