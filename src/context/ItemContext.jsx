import { createContext, useContext, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from './AuthContext';
import { useFamily } from './FamilyContext';
import { supabase } from '../services/supabaseClient';
import { withConnectionHint } from '../utils/userFacingErrors';

const ItemContext = createContext();

// ─── Local storage key ───
const STORAGE_KEY = 'kitchen_items_local';

// ─── Data transformers ───
const toAppItem = (item) => ({
  id: item.id,
  name: item.name,
  normalizedName: item.normalized_name || item.name,
  category: item.category,
  location: item.location,
  expiryDate: item.expiry_date,
  image: item.image,
  quantity: item.quantity,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});

const toDatabaseItem = (item, userId, familyId = null) => ({
  id: item.id,
  user_id: userId,
  family_id: familyId,
  name: item.name,
  normalized_name: item.normalizedName || item.name,
  category: item.category,
  location: item.location,
  expiry_date: item.expiryDate,
  image: item.image,
  quantity: item.quantity,
  created_at: item.createdAt,
  updated_at: item.updatedAt,
});

// ─── Helper to load items from localStorage ───
const loadItemsFromStorage = () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Error loading items from localStorage:', e);
      return [];
    }
  }
  return [];
};

// ─── Helper to save items to localStorage ───
const saveItemsToStorage = (items) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

export function ItemProvider({ children }) {
  const { user, loading: authLoading, isLocalMode } = useAuth();
  const { family, loading: familyLoading } = useFamily();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isUsingLocalStorage, setIsUsingLocalStorage] = useState(true);
  const [isAccountStorage, setIsAccountStorage] = useState(false);

  const scopeItems = (query) => family
    ? query.eq('family_id', family.id)
    : query.eq('user_id', user?.id);

  // ─── Load items ───
  useEffect(() => {
    let active = true;

    const loadItems = async () => {
      if (authLoading || familyLoading) return;

      // ─── If in local mode or no user, use localStorage ───
      if (isLocalMode || !user || user.isLocal) {
        const localItems = loadItemsFromStorage();
        if (active) {
          setItems(localItems);
          setIsUsingLocalStorage(true);
          setIsAccountStorage(false);
          setLoading(false);
        }
        return;
      }

      // ─── User is logged in → try Supabase ───
      if (user && supabase && !user.isLocal) {
        try {
          const itemRequest = scopeItems(
            supabase.from('kitchen_items').select('*')
          ).order('created_at', { ascending: false });
          const itemTimeout = new Promise((resolve) => {
            window.setTimeout(() => resolve({ data: null, error: new Error('Inventory lookup timed out') }), 8000);
          });
          const { data, error: selectError } = await Promise.race([itemRequest, itemTimeout]);

          if (!active) return;

          if (selectError) {
            console.error('Error loading items from Supabase:', selectError);
            // Keep the current view during a transient network failure.
            setLoading(false);
          } else if (data && data.length > 0) {
            const dbItems = data.map(toAppItem);
            setItems(dbItems);
            setIsUsingLocalStorage(false);
            setIsAccountStorage(true);
            
            // Sync local items to Supabase if any exist
            const localItems = loadItemsFromStorage();
            if (localItems.length > 0) {
              await syncLocalItemsToSupabase(dbItems);
            }
          } else {
            // No items in Supabase, check localStorage
            const localItems = loadItemsFromStorage();
            if (localItems.length > 0) {
              setItems(localItems);
              setIsUsingLocalStorage(true);
              setIsAccountStorage(false);
              // Prompt user to sync
              console.log('📦 Local items found. Consider syncing to cloud.');
            } else {
              setItems([]);
              setIsUsingLocalStorage(true);
              setIsAccountStorage(false);
            }
          }
        } catch (err) {
          console.error('Error loading items:', err);
          setLoading(false);
        }
        setLoading(false);
        return;
      }

      // ─── Fallback: localStorage ───
      const localItems = loadItemsFromStorage();
      setItems(localItems);
      setIsUsingLocalStorage(true);
      setIsAccountStorage(false);
      setLoading(false);
    };

    loadItems();

    let channel;
    let refreshTimer;
    if (family && supabase) {
        const refreshFamilyItems = async () => {
          try {
            const { data, error } = await supabase
              .from('kitchen_items')
              .select('*')
              .eq('family_id', family.id)
              .order('created_at', { ascending: false });
            if (!error && active && data) {
              setItems(data.map(toAppItem));
              setIsUsingLocalStorage(false);
              setIsAccountStorage(true);
            }
          } catch (error) {
            console.error('Could not refresh family pantry:', error);
          }
        };

        channel = supabase
          .channel(`family-pantry-${family.id}`)
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'kitchen_items',
            filter: `family_id=eq.${family.id}`,
          }, refreshFamilyItems)
          .subscribe();
        refreshTimer = window.setInterval(refreshFamilyItems, 10000);
    }

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
      if (refreshTimer) window.clearInterval(refreshTimer);
    };
  }, [authLoading, familyLoading, user?.id, user?.isLocal, isLocalMode, family?.id]);

  // ─── Sync local items to Supabase ───
  const syncLocalItemsToSupabase = async (existingItems = null) => {
    if (!user || !supabase || user.isLocal || isLocalMode) {
      console.log('⏭️ Skipping sync: not logged in or in local mode');
      return;
    }

    const localItems = loadItemsFromStorage();
    if (localItems.length === 0) return;

    // Get existing items if not provided
    let existing = existingItems;
    if (!existing) {
      const { data } = await scopeItems(
        supabase.from('kitchen_items').select('id, name')
      );
      existing = data || [];
    }

    const existingNames = existing.map(item => item.name.toLowerCase());
    const itemsToSync = localItems.filter(item => 
      !existingNames.includes(item.name.toLowerCase())
    );

    if (itemsToSync.length === 0) {
      // All items already synced, clear local storage
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    let synced = 0;
    for (const item of itemsToSync) {
      const { error } = await supabase
        .from('kitchen_items')
        .insert(toDatabaseItem(item, user.id, family?.id));

      if (!error) synced++;
    }

    if (synced > 0) {
      // Clear local storage after successful sync
      localStorage.removeItem(STORAGE_KEY);
      // Reload items from Supabase
      const { data, error } = await scopeItems(
        supabase.from('kitchen_items').select('*')
      ).order('created_at', { ascending: false });

      if (!error && data) {
        setItems(data.map(toAppItem));
        setIsUsingLocalStorage(false);
        setIsAccountStorage(true);
      }
      console.log(`✅ Synced ${synced} items to cloud`);
    }
  };

  // ─── Save to localStorage ───
  const saveToLocalStorage = (itemsData) => {
    saveItemsToStorage(itemsData);
    setIsUsingLocalStorage(true);
    setIsAccountStorage(false);
  };

  // ─── Admin debug helper to generate random test inventory items ───
  const addDebugSampleItem = async (forcedCategory = null, forcedLocation = null, forcedMode = null, forcedName = null) => {
    const itemNames = [
      'Milk', 'Tomatoes', 'Bread', 'Chicken', 'Bananas', 'Yogurt',
      'Eggs', 'Spinach', 'Rice', 'Cheese', 'Apples', 'Salmon',
    ];
    const categories = ['vegetable', 'fruit', 'meat', 'dairy', 'bread', 'packaged'];
    const locations = ['fridge', 'freezer', 'pantry', 'cabinet'];
    const modes = ['fresh', 'warning', 'expired'];
    const today = new Date();
    const formatLocalDate = (date) => [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
    const randomName = forcedName || itemNames[Math.floor(Math.random() * itemNames.length)];
    const randomCategory = forcedCategory || categories[Math.floor(Math.random() * categories.length)];
    const randomLocation = forcedLocation || locations[Math.floor(Math.random() * locations.length)];
    const mode = forcedMode || modes[Math.floor(Math.random() * modes.length)];

    let expiryDate = null;
    if (mode === 'fresh') {
      const futureDays = 4 + Math.floor(Math.random() * 10);
      const date = new Date(today);
      date.setDate(today.getDate() + futureDays);
      expiryDate = formatLocalDate(date);
    } else if (mode === 'warning') {
      const nearDays = 1 + Math.floor(Math.random() * 3);
      const date = new Date(today);
      date.setDate(today.getDate() + nearDays);
      expiryDate = formatLocalDate(date);
    } else {
      const pastDays = 1 + Math.floor(Math.random() * 4);
      const date = new Date(today);
      date.setDate(today.getDate() - pastDays);
      expiryDate = formatLocalDate(date);
    }

    const debugItem = {
      name: randomName,
      category: randomCategory,
      location: randomLocation,
      expiryDate,
      quantity: 1 + Math.floor(Math.random() * 3),
    };

    await addItem(debugItem);
  };

  const addDebugSampleItems = async (count = 12) => {
    const itemNames = [
      'Milk', 'Tomatoes', 'Bread', 'Chicken', 'Bananas', 'Yogurt',
      'Eggs', 'Spinach', 'Rice', 'Cheese', 'Apples', 'Salmon',
    ];
    const categories = ['vegetable', 'fruit', 'meat', 'dairy', 'bread', 'packaged'];
    const locations = ['fridge', 'freezer', 'cabinet', 'pantry'];
    const modes = ['expired', 'warning', 'fresh'];

    for (let index = 0; index < count; index += 1) {
      await addDebugSampleItem(
        categories[index % categories.length],
        locations[index % locations.length],
        modes[index % modes.length],
        itemNames[index % itemNames.length],
      );
    }
  };

  // ─── Add item ───
  const addItem = async (item, allowDuplicate = false) => {
    const newItem = {
      id: uuidv4(),
      name: item.name || 'Unnamed Item',
      normalizedName: item.normalizedName || item.name || 'Unnamed Item',
      category: item.category || 'other',
      location: item.location || 'fridge',
      expiryDate: item.expiryDate || null,
      image: item.image || null,
      quantity: item.quantity || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Check for duplicates
    const exists = items.some(existingItem =>
      existingItem.name?.toLowerCase() === newItem.name?.toLowerCase()
    );

    if (exists && !allowDuplicate) {
      alert(`⚠️ "${newItem.name}" is already in your kitchen!`);
      return;
    }

    // ─── If in local mode or no user → localStorage ───
    if (isLocalMode || !user || user.isLocal) {
      setItems((currentItems) => {
        const updatedItems = [newItem, ...currentItems];
        saveItemsToStorage(updatedItems);
        return updatedItems;
      });
      setIsUsingLocalStorage(true);
      setIsAccountStorage(false);
      return;
    }

    // ─── User logged in → Supabase ───
    if (user && supabase && !user.isLocal) {
      try {
        const { error } = await supabase
          .from('kitchen_items')
          .insert(toDatabaseItem(newItem, user.id, family?.id));

        if (error) {
          console.error('Error saving to Supabase:', error);
          // Fallback to localStorage
          const updatedItems = [newItem, ...items];
          setItems(updatedItems);
          saveToLocalStorage(updatedItems);
          alert(withConnectionHint('Could not save to the cloud. Your item was saved locally instead', 'try saving again'));
          return;
        }

        setItems(prev => [newItem, ...prev]);
        setIsUsingLocalStorage(false);
        setIsAccountStorage(true);
      } catch (err) {
        console.error('Error adding item:', err);
        const updatedItems = [newItem, ...items];
        setItems(updatedItems);
        saveToLocalStorage(updatedItems);
      }
      return;
    }

    // ─── Ultimate fallback: localStorage ───
    const updatedItems = [newItem, ...items];
    setItems(updatedItems);
    saveToLocalStorage(updatedItems);
  };

  // ─── Delete item ───
  const deleteItem = async (id) => {
    // ─── Local mode or no user → localStorage ───
    if (isLocalMode || !user || user.isLocal) {
      setItems((currentItems) => {
        const updatedItems = currentItems.filter(item => item.id !== id);
        saveItemsToStorage(updatedItems);
        return updatedItems;
      });
      setIsUsingLocalStorage(true);
      setIsAccountStorage(false);
      return;
    }

    // ─── User logged in → Supabase ───
    if (user && supabase && !user.isLocal) {
      try {
        const { error } = await scopeItems(
          supabase.from('kitchen_items').delete().eq('id', id)
        );

        if (error) {
          console.error('Error deleting from Supabase:', error);
          setItems((currentItems) => {
            const updatedItems = currentItems.filter(item => item.id !== id);
            saveItemsToStorage(updatedItems);
            return updatedItems;
          });
          setIsUsingLocalStorage(true);
          setIsAccountStorage(false);
          return;
        }
      } catch (err) {
        console.error('Error deleting item:', err);
        setItems((currentItems) => {
          const updatedItems = currentItems.filter(item => item.id !== id);
          saveItemsToStorage(updatedItems);
          return updatedItems;
        });
        setIsUsingLocalStorage(true);
        setIsAccountStorage(false);
        return;
      }
    }

    setItems(prev => prev.filter(item => item.id !== id));
  };

  // ─── Update item ───
  const updateItem = async (id, updatedData) => {
    const updatedItem = {
      ...updatedData,
      updatedAt: new Date().toISOString(),
    };

    // ─── Local mode or no user → localStorage ───
    if (isLocalMode || !user || user.isLocal) {
      const updatedItems = items.map(item =>
        item.id === id ? { ...item, ...updatedItem } : item
      );
      setItems(updatedItems);
      saveToLocalStorage(updatedItems);
      return;
    }

    // ─── User logged in → Supabase ───
    if (user && supabase && !user.isLocal) {
      try {
        const { error } = await scopeItems(
          supabase.from('kitchen_items').update({
            name: updatedItem.name,
            category: updatedItem.category,
            location: updatedItem.location,
            expiry_date: updatedItem.expiryDate,
            image: updatedItem.image,
            quantity: updatedItem.quantity,
            updated_at: updatedItem.updatedAt,
          }).eq('id', id)
        );

        if (error) {
          console.error('Error updating in Supabase:', error);
          // Fallback to localStorage
          const updatedItems = items.map(item =>
            item.id === id ? { ...item, ...updatedItem } : item
          );
          setItems(updatedItems);
          saveToLocalStorage(updatedItems);
          return;
        }
      } catch (err) {
        console.error('Error updating item:', err);
        const updatedItems = items.map(item =>
          item.id === id ? { ...item, ...updatedItem } : item
        );
        setItems(updatedItems);
        saveToLocalStorage(updatedItems);
        return;
      }
    }

    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, ...updatedItem } : item
    ));
  };

  // ─── Clear all items ───
  const clearAllItems = async () => {
    if (!window.confirm('Delete all items?')) return;

    // ─── Local mode or no user → localStorage ───
    if (isLocalMode || !user || user.isLocal) {
      setItems([]);
      saveToLocalStorage([]);
      return;
    }

    // ─── User logged in → Supabase ───
    if (user && supabase && !user.isLocal) {
      try {
        const { error } = await scopeItems(
          supabase.from('kitchen_items').delete()
        );

        if (error) {
          console.error('Error clearing from Supabase:', error);
          setItems([]);
          saveToLocalStorage([]);
          return;
        }
      } catch (err) {
        console.error('Error clearing items:', err);
        setItems([]);
        saveToLocalStorage([]);
        return;
      }
    }

    setItems([]);
  };

  // ─── Sync local items to cloud (manual) ───
  const syncToCloud = async () => {
    if (!user || !supabase || user.isLocal || isLocalMode) {
      alert('Please log in to sync items to the cloud.');
      return;
    }

    const localItems = loadItemsFromStorage();
    if (localItems.length === 0) {
      alert('No local items to sync.');
      return;
    }

    // Check for duplicates
    const { data: existing } = await scopeItems(
      supabase.from('kitchen_items').select('name')
    );

    const existingNames = (existing || []).map(item => item.name.toLowerCase());
    const itemsToSync = localItems.filter(item => 
      !existingNames.includes(item.name.toLowerCase())
    );

    if (itemsToSync.length === 0) {
      alert('All local items are already synced.');
      return;
    }

    let synced = 0;
    for (const item of itemsToSync) {
      const { error } = await supabase
        .from('kitchen_items')
        .insert(toDatabaseItem(item, user.id, family?.id));

      if (!error) synced++;
    }

    if (synced > 0) {
      localStorage.removeItem(STORAGE_KEY);
      // Reload items
      const { data, error } = await scopeItems(
        supabase.from('kitchen_items').select('*')
      ).order('created_at', { ascending: false });

      if (!error && data) {
        setItems(data.map(toAppItem));
        setIsUsingLocalStorage(false);
        setIsAccountStorage(true);
      }
      alert(`✅ Synced ${synced} items to cloud!`);
    } else {
      alert('No items were synced. Please try again.');
    }
  };

  // ─── Auto-delete expired items after the selected grace period ───
  useEffect(() => {
    if (!items.length || authLoading) return;

    const storageKey = user?.id ? `appSettings:${user.id}` : 'appSettings';
    const savedSettings = localStorage.getItem(storageKey);
    let parsedSettings = {};

    try {
      parsedSettings = savedSettings ? JSON.parse(savedSettings) : {};
    } catch (error) {
      console.error('Error reading auto-delete settings:', error);
      return;
    }

    if (!parsedSettings.autoDeleteExpired) return;

    const graceDays = Math.min(3, Math.max(1, Number(parsedSettings.autoDeleteAfterDays || '1')));
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - graceDays);

    const idsToRemove = items
      .filter(item => item.expiryDate && new Date(item.expiryDate + 'T00:00:00') < cutoff)
      .map(item => item.id);

    if (idsToRemove.length === 0) return;

    const remainingItems = items.filter(item => !idsToRemove.includes(item.id));

    if (user && !user.isLocal && supabase) {
      Promise.all(
        idsToRemove.map(id =>
          scopeItems(
            supabase.from('kitchen_items').delete().eq('id', id)
          )
        )
      ).catch((error) => {
        console.error('Error auto-deleting expired items from Supabase:', error);
      });
    }

    setItems(remainingItems);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(remainingItems));
  }, [items, user?.id, authLoading, isLocalMode, user?.isLocal]);

  // ─── Query functions ───
  const getItem = (id) => items.find(item => item.id === id);
  
  const getItemsByCategory = (category) => 
    items.filter(item => item.category === category);
  
  const getItemsByLocation = (location) => 
    items.filter(item => item.location === location);
  
  const getExpiringItems = (days = 7) => {
    const now = new Date();
    return items.filter(item => {
      if (!item.expiryDate) return false;
      const expiry = new Date(item.expiryDate + 'T00:00:00');
      const daysLeft = Math.ceil((expiry - now) / 86400000);
      return daysLeft >= 0 && daysLeft <= days;
    });
  };
  
  const getExpiredItems = () => {
    const now = new Date();
    return items.filter(item => {
      if (!item.expiryDate) return false;
      const expiry = new Date(item.expiryDate + 'T00:00:00');
      return expiry < now;
    });
  };
  
  const getFreshItems = () => {
    const now = new Date();
    return items.filter(item => {
      if (!item.expiryDate) return true;
      const expiry = new Date(item.expiryDate + 'T00:00:00');
      const daysLeft = Math.ceil((expiry - now) / 86400000);
      return daysLeft > 7;
    });
  };
  
  const getRecentItems = (limit = 10) => {
    return [...items]
      .sort((a, b) => new Date(b.createdAt || b.id) - new Date(a.createdAt || a.id))
      .slice(0, limit);
  };
  
  const searchItems = (query) => {
    if (!query) return items;
    const lowerQuery = query.toLowerCase().trim();
    return items.filter(item =>
      item.name.toLowerCase().includes(lowerQuery)
    );
  };
  
  const getTotalCount = () => items.length;
  
  const getCategoryCounts = () => {
    const counts = {};
    items.forEach(item => {
      const cat = item.category || 'other';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  };
  
  const getLocationCounts = () => {
    const counts = {};
    items.forEach(item => {
      const loc = item.location || 'fridge';
      counts[loc] = (counts[loc] || 0) + 1;
    });
    return counts;
  };

  const value = {
    // State
    items,
    loading,
    isUsingLocalStorage,
    isAccountStorage,
    
    // CRUD operations
    addItem,
    addDebugSampleItem,
    addDebugSampleItems,
    deleteItem,
    updateItem,
    clearAllItems,
    syncToCloud,
    
    // Query functions
    getItem,
    getItemsByCategory,
    getItemsByLocation,
    getExpiringItems,
    getExpiredItems,
    getFreshItems,
    getRecentItems,
    searchItems,
    
    // Stats
    getTotalCount,
    getCategoryCounts,
    getLocationCounts,
  };

  return (
    <ItemContext.Provider value={value}>
      {children}
    </ItemContext.Provider>
  );
}

// ─── Custom hook ───
export function useItems() {
  const context = useContext(ItemContext);
  if (!context) {
    throw new Error('useItems must be used within an ItemProvider');
  }
  return context;
}