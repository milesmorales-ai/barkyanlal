import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSearch,
  faXmark,
  faTrash,
  faPen,
  faClock,
  faLocationDot,
  faLeaf,
  faExclamationTriangle,
  faBox,
  faCalendar,
  faCircleCheck,
  faCircleXmark,
  faUtensils,
  faSnowflake,
  faHome,
  faStoreAlt,
  faBoxOpen,
  faSort,
  faSortAmountDown,
  faSortAmountUp,
  faSortAlphaDown,
  faSortAlphaUp,
  faPlus,
  faTag,
  faWeightHanging,
  faEye,
  faChevronDown,
  faChevronUp,
  faCheck,
  faTimes,
  faFilter,
  faQuestionCircle,
  faThumbsUp,
  faThumbsDown,
} from '@fortawesome/free-solid-svg-icons';
import { useItems } from '../context/ItemContext';
import { useLanguage } from '../context/LanguageContext';
import { CATEGORIES, getIngredientNameMM, getIngredientNameEN } from '../data/ingredients';
import { 
  getExpiryStatus, 
  getUrgencyColor, 
  needsAttention, 
  needsUrgentAttention, 
  isExpired 
} from '../utils/expiryHelpers';
import './Storage.css';

export default function Storage() {
  const { items, deleteItem, updateItem } = useItems();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const localizeExpiryLabel = (status) => {
    if (language !== 'mm') return status.label;
    if (status.status === 'expired') return 'သက်တမ်းကုန်ပြီး';
    if (status.status === 'today') return 'ယနေ့ သက်တမ်းကုန်မည်';
    if (status.status === 'tomorrow') return 'မနက်ဖြန် သက်တမ်းကုန်မည်';
    if (status.status === 'fresh') return t('fresh');
    if (status.daysLeft !== null && status.daysLeft >= 0) return `${status.daysLeft} ${t('days')}`;
    return 'သက်တမ်းမရှိ';
  };
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSort, setSelectedSort] = useState('useFirst');
  const [showFilters, setShowFilters] = useState(false);
  
  const [editModal, setEditModal] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [detailModal, setDetailModal] = useState(null);
  const [foodCheckModal, setFoodCheckModal] = useState(null);
  const [foodCheckStep, setFoodCheckStep] = useState('check');
  
  const filterPanelRef = useRef(null);
  const filterButtonRef = useRef(null);

  // ─── Filter options ───
  const filters = [
    { id: 'all', label: t('allCategories') },
    { id: 'fresh', label: t('freshHealthy') },
    { id: 'expiring', label: t('expiring') },
    { id: 'expired', label: t('expired') },
  ];

  // ─── Locations ───
  const locations = [
    { id: 'all', label: t('location'), icon: faLocationDot },
    { id: 'fridge', label: t('fridge'), icon: faHome },
    { id: 'freezer', label: t('freezer'), icon: faSnowflake },
    { id: 'cabinet', label: t('cabinet'), icon: faBoxOpen },
    { id: 'pantry', label: t('pantry'), icon: faStoreAlt },
  ];

  // ─── Sort options ───
  const sortOptions = [
    { id: 'recent', label: language === 'mm' ? 'မကြာသေးမီက ထည့်ထားသည်' : 'Recently Added', icon: faSortAmountDown },
    { id: 'oldest', label: language === 'mm' ? 'အဟောင်းဆုံး' : 'Oldest Added', icon: faSortAmountUp },
    { id: 'useFirst', label: language === 'mm' ? 'အရင်သုံးရန်' : 'Use First', icon: faExclamationTriangle },
    { id: 'nameAsc', label: language === 'mm' ? 'အမည် A-Z' : 'Name A-Z', icon: faSortAlphaDown },
    { id: 'nameDesc', label: language === 'mm' ? 'အမည် Z-A' : 'Name Z-A', icon: faSortAlphaUp },
  ];

  // ─── Toggle filters ───
  const toggleFilters = (e) => {
    e.stopPropagation();
    setShowFilters(!showFilters);
  };

  // ─── Click outside filters ───
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        filterPanelRef.current && 
        !filterPanelRef.current.contains(e.target) &&
        filterButtonRef.current &&
        !filterButtonRef.current.contains(e.target)
      ) {
        setShowFilters(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // ─── Filter items ───
  const filteredItems = items.filter(item => {
    const matchesSearch = [item.name, getIngredientNameMM(item.name)].some(name =>
      String(name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (!matchesSearch) return false;

    if (selectedFilter === 'fresh') {
      if (!item.expiryDate) return true;
      const daysLeft = Math.ceil((new Date(item.expiryDate + 'T00:00:00') - new Date()) / 86400000);
      return daysLeft > 7;
    }
    if (selectedFilter === 'expiring') {
      if (!item.expiryDate) return false;
      const daysLeft = Math.ceil((new Date(item.expiryDate + 'T00:00:00') - new Date()) / 86400000);
      return daysLeft >= 0 && daysLeft <= 7;
    }
    if (selectedFilter === 'expired') {
      if (!item.expiryDate) return false;
      const daysLeft = Math.ceil((new Date(item.expiryDate + 'T00:00:00') - new Date()) / 86400000);
      return daysLeft < 0;
    }

    if (selectedLocation !== 'all' && item.location !== selectedLocation) {
      return false;
    }

    if (selectedCategory !== 'all' && item.category !== selectedCategory) {
      return false;
    }

    return true;
  });

  // ─── Sort items ───
  const sortedItems = [...filteredItems].sort((a, b) => {
    switch (selectedSort) {
      case 'recent':
        return new Date(b.createdAt || b.id) - new Date(a.createdAt || a.id);
      case 'oldest':
        return new Date(a.createdAt || a.id) - new Date(b.createdAt || b.id);
      case 'useFirst':
        const aDays = a.expiryDate ? Math.ceil((new Date(a.expiryDate + 'T00:00:00') - new Date()) / 86400000) : 999;
        const bDays = b.expiryDate ? Math.ceil((new Date(b.expiryDate + 'T00:00:00') - new Date()) / 86400000) : 999;
        if (aDays < 0 && bDays >= 0) return -1;
        if (aDays >= 0 && bDays < 0) return 1;
        return aDays - bDays;
      case 'nameAsc':
        return a.name.localeCompare(b.name);
      case 'nameDesc':
        return b.name.localeCompare(a.name);
      default:
        return 0;
    }
  });

  // ─── Counts ───
  const getFilterCounts = () => {
    const total = items.length;
    const fresh = items.filter(item => {
      if (!item.expiryDate) return true;
      const daysLeft = Math.ceil((new Date(item.expiryDate + 'T00:00:00') - new Date()) / 86400000);
      return daysLeft > 7;
    }).length;
    const expiring = items.filter(item => {
      if (!item.expiryDate) return false;
      const daysLeft = Math.ceil((new Date(item.expiryDate + 'T00:00:00') - new Date()) / 86400000);
      return daysLeft >= 0 && daysLeft <= 7;
    }).length;
    const expired = items.filter(item => {
      if (!item.expiryDate) return false;
      const daysLeft = Math.ceil((new Date(item.expiryDate + 'T00:00:00') - new Date()) / 86400000);
      return daysLeft < 0;
    }).length;
    return { total, fresh, expiring, expired };
  };

  const counts = getFilterCounts();

  // ─── Get category label ───
  const getCategoryLabel = (category) => {
    const cat = CATEGORIES.find(c => c.value === category);
    return language === 'mm' ? cat?.labelMM || category || 'အထွေထွေ' : cat?.label || category || 'General';
  };

  const getDisplayName = (name) => language === 'mm' ? getIngredientNameMM(name) : getIngredientNameEN(name);
  const getLocationLabel = (location) => locations.find(item => item.id === location)?.label || location;
  const localizeExpiryOption = (option) => {
    if (language !== 'mm') return option;
    if (option === 'Not recommended') return t('notRecommendedShort');
    return option
      .replace(/days?/g, t('days'))
      .replace(/weeks?/g, 'ပတ်')
      .replace(/months?/g, 'လ')
      .replace(/years?/g, 'နှစ်');
  };

  // ─── Get category icon ───
  const getCategoryIcon = (category) => {
    const iconMap = {
      vegetable: faLeaf,
      fruit: faLeaf,
      meat: faUtensils,
      dairy: faClock,
      bread: faBox,
      packaged: faBox,
    };
    return iconMap[category] || faUtensils;
  };

  // ─── Get location icon ───
  const getLocationIcon = (location) => {
    const iconMap = {
      fridge: faHome,
      freezer: faSnowflake,
      cabinet: faBoxOpen,
      pantry: faStoreAlt,
    };
    return iconMap[location] || faHome;
  };

  // ─── Get expiry suggestions ───
  const getExpirySuggestions = (category, location) => {
    if (!category) return ['1 week', '2 weeks', '1 month'];
    if (category === 'packaged') return ['manual'];
    
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

  // ─── Handle edit ───
  const handleEdit = (item) => {
    setEditModal({ 
      ...item, 
      originalCategory: item.category || 'vegetable',
      showDatePicker: false,
    });
  };

  // ─── Handle view details ───
  const handleViewDetails = (item) => {
    setDetailModal(item);
  };

  // ─── Handle delete ───
  const handleDelete = (item) => {
    setDeleteModal(item);
  };

  // ─── Handle food check ───
  const handleFoodCheck = (item) => {
    setFoodCheckModal(item);
    setFoodCheckStep('check');
  };

  // ─── Confirm delete ───
  const confirmDelete = () => {
    if (deleteModal) {
      deleteItem(deleteModal.id);
      setDeleteModal(null);
    }
  };

  // ─── Handle food check actions ───
  const handleStillGood = () => {
    setFoodCheckStep('extend');
  };

  const handleExtendExpiry = (days) => {
    if (foodCheckModal) {
      const [year, month, day] = foodCheckModal.expiryDate.split('-').map(Number);
      const currentDate = new Date(year, month - 1, day);
      currentDate.setDate(currentDate.getDate() + days);
      const newExpiryDate = [currentDate.getFullYear(), String(currentDate.getMonth() + 1).padStart(2, '0'), String(currentDate.getDate()).padStart(2, '0')].join('-');
      updateItem(foodCheckModal.id, { ...foodCheckModal, expiryDate: newExpiryDate });
      setFoodCheckModal(null);
      setFoodCheckStep('check');
    }
  };

  const handleNoLongerGood = () => {
    if (foodCheckModal) {
      deleteItem(foodCheckModal.id);
      setFoodCheckModal(null);
      setFoodCheckStep('check');
    }
  };

  // ─── Handle expiry selection ───
  const handleExpirySelect = (option) => {
    if (!editModal) return;

    if (option === 'none') {
      updateItem(editModal.id, { ...editModal, expiryDate: null });
      setEditModal(null);
      return;
    }

    if (option === 'manual') {
      setEditModal({ ...editModal, showDatePicker: true });
      return;
    }

    const expiryDate = new Date();
    
    if (option.includes('day')) {
      const match = option.match(/(\d+)-(\d+)/);
      if (match) {
        const maxDays = parseInt(match[2]);
        expiryDate.setDate(expiryDate.getDate() + maxDays);
      } else {
        const numMatch = option.match(/(\d+)/);
        if (numMatch) {
          expiryDate.setDate(expiryDate.getDate() + parseInt(numMatch[1]));
        }
      }
    } else if (option.includes('week')) {
      const match = option.match(/(\d+)/);
      if (match) {
        const weeks = parseInt(match[1]);
        expiryDate.setDate(expiryDate.getDate() + weeks * 7);
      } else {
        expiryDate.setDate(expiryDate.getDate() + 7);
      }
    } else if (option.includes('month')) {
      const match = option.match(/(\d+)/);
      if (match) {
        const months = parseInt(match[1]);
        expiryDate.setMonth(expiryDate.getMonth() + months);
      } else {
        expiryDate.setMonth(expiryDate.getMonth() + 1);
      }
    } else if (option.includes('year')) {
      const match = option.match(/(\d+)/);
      if (match) {
        const years = parseInt(match[1]);
        expiryDate.setFullYear(expiryDate.getFullYear() + years);
      } else {
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      }
    }

    const expiryDateStr = expiryDate.toISOString().split('T')[0];
    updateItem(editModal.id, { ...editModal, expiryDate: expiryDateStr });
    setEditModal(null);
  };

  // ─── Handle date picker save ───
  const handleDateSave = () => {
    if (editModal && editModal.expiryDate) {
      updateItem(editModal.id, editModal);
      setEditModal(null);
    }
  };

  // ─── Close modals ───
  const closeEditModal = () => setEditModal(null);
  const closeDetailModal = () => setDetailModal(null);
  const closeFoodCheckModal = () => {
    setFoodCheckModal(null);
    setFoodCheckStep('check');
  };

  // ─── Active filter count ───
  const activeFilterCount = (selectedFilter !== 'all' ? 1 : 0) + 
                           (selectedLocation !== 'all' ? 1 : 0) + 
                           (selectedCategory !== 'all' ? 1 : 0);

  // ─── Handle card click ───
  const handleCardClick = (item) => {
    // Only open Food Check for items expiring within 3 days (urgent)
    if (needsUrgentAttention(item.expiryDate)) {
      handleFoodCheck(item);
    } else {
      handleViewDetails(item);
    }
  };

  return (
    <div className="storage-page">
      {/* ─── HEADER ─── */}
      <div className="storage-header">
        <h1 className="storage-title">
          <FontAwesomeIcon icon={faBox} style={{ marginRight: '10px', color: 'var(--accent-primary)' }} />
          {t('storage')}
        </h1>
      </div>

      {/* ─── SEARCH + FILTER ─── */}
      <div className="search-row">
        <div className="search-bar">
          <FontAwesomeIcon icon={faSearch} className="search-icon" />
          <input
            type="text"
            placeholder={t('searchItems')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <button 
            ref={filterButtonRef}
            className={`filter-toggle ${showFilters ? 'active' : ''}`}
            onClick={toggleFilters}
          >
            <FontAwesomeIcon icon={faFilter} />
          </button>
          {searchTerm && (
            <button className="search-clear" onClick={() => setSearchTerm('')}>
              <FontAwesomeIcon icon={faXmark} />
            </button>
          )}
        </div>
      </div>

      {/* ─── QUICK FILTERS ─── */}
      <div className="quick-filters">
        {filters.map((filter) => (
          <button
            key={filter.id}
            className={`quick-filter ${selectedFilter === filter.id ? 'active' : ''}`}
            onClick={() => setSelectedFilter(filter.id)}
          >
            {filter.label}
            {filter.id !== 'all' && (
              <span className="count">{counts[filter.id] || 0}</span>
            )}
          </button>
        ))}
      </div>

      {/* ─── FILTERS PANEL ─── */}
      {showFilters && (
        <div className="filters-panel" ref={filterPanelRef}>
          <div className="filter-section">
            <span className="filter-label">{t('location')}</span>
            <div className="filter-options">
              {locations.map((loc) => (
                <button
                  key={loc.id}
                  className={`filter-chip ${selectedLocation === loc.id ? 'active' : ''}`}
                  onClick={() => setSelectedLocation(loc.id)}
                >
                  <FontAwesomeIcon icon={loc.icon} style={{ marginRight: '4px', fontSize: '12px' }} />
                  {loc.label}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-section">
            <span className="filter-label">{t('category')}</span>
            <div className="filter-options">
              <button
                className={`filter-chip ${selectedCategory === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedCategory('all')}
              >
                {t('allCategories')}
              </button>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  className={`filter-chip ${selectedCategory === cat.value ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat.value)}
                >
                  <FontAwesomeIcon icon={getCategoryIcon(cat.value)} style={{ marginRight: '4px', fontSize: '12px' }} />
                  {language === 'mm' ? cat.labelMM : cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-section">
            <span className="filter-label">{language === 'mm' ? 'စီစဉ်ရန်' : 'Sort by'}</span>
            <div className="filter-options">
              {sortOptions.map((sort) => (
                <button
                  key={sort.id}
                  className={`filter-chip ${selectedSort === sort.id ? 'active' : ''}`}
                  onClick={() => setSelectedSort(sort.id)}
                >
                  <FontAwesomeIcon icon={sort.icon} style={{ marginRight: '4px', fontSize: '12px' }} />
                  {sort.label}
                </button>
              ))}
            </div>
          </div>

          {activeFilterCount > 0 && (
            <button 
              className="clear-filters-btn"
              onClick={() => {
                setSelectedFilter('all');
                setSelectedLocation('all');
                setSelectedCategory('all');
              }}
            >
              {language === 'mm' ? 'စစ်ထုတ်မှုအားလုံး ရှင်းရန်' : 'Clear all filters'}
            </button>
          )}
        </div>
      )}

      {/* ─── RESULTS COUNT ─── */}
      <div className="results-count">
        <span>{sortedItems.length} {t('items')}</span>
        {searchTerm && <span> · "{searchTerm}"</span>}
        {selectedFilter !== 'all' && (
          <span> · {filters.find(f => f.id === selectedFilter)?.label}</span>
        )}
      </div>

      {/* ─── ITEMS LIST ─── */}
      {sortedItems.length > 0 ? (
        <div className="items-list">
          {sortedItems.map((item) => {
            const status = getExpiryStatus(item.expiryDate);
            const urgencyColor = getUrgencyColor(item.expiryDate);
            const attentionNeeded = needsAttention(item.expiryDate);
            const urgent = needsUrgentAttention(item.expiryDate);
            const expired = isExpired(item.expiryDate);
            
            return (
              <div 
                className={`item-row ${attentionNeeded ? 'needs-attention' : ''}`}
                key={item.id}
                onClick={() => handleCardClick(item)}
              >
                <div className="item-row-content">
                  {item.image ? (
                    <div className="item-row-image">
                      <img src={item.image} alt={item.name} />
                    </div>
                  ) : (
                    <div className="item-row-image placeholder">
                      <FontAwesomeIcon icon={faUtensils} />
                    </div>
                  )}
                  
                  <div className="item-row-info">
                    <div className="item-row-header">
                      <span className="item-row-name">{getDisplayName(item.name)}</span>
                      {attentionNeeded && (
                        <span className={`attention-badge ${urgent ? 'urgent' : 'warning'}`}>
                          <FontAwesomeIcon icon={faExclamationTriangle} />
                          {expired ? t('expired') : urgent ? t('checkMe') : t('expiring')}
                        </span>
                      )}
                    </div>
                    <div className="item-row-meta">
                      <span className="item-row-location">
                        <FontAwesomeIcon icon={getLocationIcon(item.location)} size="xs" /> 
                        {getLocationLabel(item.location || 'pantry')}
                      </span>
                      <span className="item-row-category">
                        <FontAwesomeIcon icon={getCategoryIcon(item.category)} size="xs" />
                        {getCategoryLabel(item.category)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="item-row-actions">
                    <div 
                      className="item-row-expiry-badge"
                      style={{ backgroundColor: urgencyColor + '20', color: urgencyColor }}
                    >
                        {language === 'mm' ? localizeExpiryLabel(status) : status.shortLabel}
                    </div>
                    <button 
                      className="row-action edit" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(item);
                      }}
                    >
                      <FontAwesomeIcon icon={faPen} />
                    </button>
                    <button 
                      className="row-action delete" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(item);
                      }}
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <FontAwesomeIcon icon={faBox} className="empty-icon" />
          <h3>
            {searchTerm 
              ? `${t('noItemsMatching')} "${searchTerm}"` 
              : selectedFilter !== 'all' 
                ? `No ${filters.find(f => f.id === selectedFilter)?.label.toLowerCase()} items`
                : t('storageEmpty')}
          </h3>
          <p>
            {searchTerm 
              ? t('tryDifferentSearch') 
              : t('startAddingItems')}
          </p>
          <button 
            className="empty-add-btn"
            onClick={() => navigate('/add')}
          >
            <FontAwesomeIcon icon={faPlus} /> {t('addItem')}
          </button>
        </div>
      )}

      {/* ─── EDIT MODAL ─── */}
      {editModal && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <div className="modal-content edit-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeEditModal}>
              <FontAwesomeIcon icon={faXmark} />
            </button>
            
            <h3 className="modal-title">
              <FontAwesomeIcon icon={faPen} style={{ marginRight: '8px', color: 'var(--accent-primary)' }} />
              {t('edit')} {t('item')}
            </h3>

            <div className="edit-item-info">
              <div className="edit-item-icon">
                <FontAwesomeIcon icon={getCategoryIcon(editModal.originalCategory || editModal.category || 'vegetable')} />
              </div>
              <div className="edit-item-details">
                <span className="edit-item-name">{getDisplayName(editModal.name)}</span>
                <span className="edit-item-category">
                  {getCategoryLabel(editModal.originalCategory || editModal.category || 'vegetable')}
                </span>
              </div>
            </div>

            <div className="edit-field">
              <label className="edit-label">
                <FontAwesomeIcon icon={faLocationDot} style={{ marginRight: '6px', color: 'var(--accent-primary)' }} />
                {t('location')}
              </label>
              <div className="location-options-edit">
                {['fridge', 'freezer', 'cabinet', 'pantry'].map((loc) => (
                  <button
                    key={loc}
                    className={`location-option-edit ${editModal.location === loc ? 'active' : ''}`}
                    onClick={() => setEditModal({ ...editModal, location: loc })}
                  >
                    {locations.find(location => location.id === loc)?.label || loc}
                  </button>
                ))}
              </div>
            </div>

            <div className="edit-field">
              <label className="edit-label">
                <FontAwesomeIcon icon={faClock} style={{ marginRight: '6px', color: 'var(--accent-primary)' }} />
                {t('expiryDate')}
              </label>

              {editModal.showDatePicker ? (
                <div className="date-picker-edit">
                  <div className="date-input-wrapper">
                    <FontAwesomeIcon icon={faCalendar} className="date-icon" />
                    <input
                      type="date"
                      className="date-input"
                      value={editModal.expiryDate || ''}
                      onChange={(e) => setEditModal({ ...editModal, expiryDate: e.target.value })}
                    />
                  </div>
                  {editModal.expiryDate && (
                    <div className="selected-date-display">
                      <FontAwesomeIcon icon={faCircleCheck} className="date-check" />
                      <span>
                        {new Date(editModal.expiryDate + 'T00:00:00').toLocaleDateString('en-US', { 
                          weekday: 'short', 
                          month: 'short', 
                          day: 'numeric',
                          year: 'numeric' 
                        })}
                      </span>
                    </div>
                  )}
                  <div className="date-actions">
                    <button className="date-save-btn" onClick={handleDateSave} disabled={!editModal.expiryDate}>
                      <FontAwesomeIcon icon={faCheck} /> {t('saveDate')}
                    </button>
                    <button className="date-back-btn" onClick={() => setEditModal({ ...editModal, showDatePicker: false })}>
                      {t('cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="expiry-options-edit">
                    {(() => {
                      const category = editModal.originalCategory || editModal.category || 'vegetable';
                      const location = editModal.location || 'fridge';
                      const suggestions = getExpirySuggestions(category, location);
                      
                      return suggestions.map((option) => {
                        if (option === 'Not recommended') {
                          return (
                            <div key={option} className="not-recommended-edit">
                              <FontAwesomeIcon icon={faCircleXmark} />
                              {t('notRecommendedShort')}
                            </div>
                          );
                        }
                        return (
                          <button
                            key={option}
                            className="expiry-option-edit"
                            onClick={() => handleExpirySelect(option)}
                          >
                            {localizeExpiryOption(option)}
                          </button>
                        );
                      });
                    })()}
                  </div>
                  <button
                    className="no-expiry-btn"
                    onClick={() => handleExpirySelect('none')}
                  >
                    <FontAwesomeIcon icon={faTimes} /> {t('noExpiryShort')}
                  </button>
                </>
              )}
            </div>

            {editModal.expiryDate && !editModal.showDatePicker && (
              <div className="current-expiry">
                <FontAwesomeIcon icon={faClock} />
                <span>{t('current')}: {new Date(editModal.expiryDate + 'T00:00:00').toLocaleDateString(language === 'mm' ? 'my-MM' : 'en-US', { 
                  month: 'short', 
                  day: 'numeric',
                  year: 'numeric' 
                })}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── DETAIL MODAL ─── */}
      {detailModal && (
        <div className="modal-overlay" onClick={closeDetailModal}>
          <div className="modal-content detail-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeDetailModal}>
              <FontAwesomeIcon icon={faXmark} />
            </button>
            
            <h3 className="modal-title">
              <FontAwesomeIcon icon={faEye} style={{ marginRight: '8px', color: 'var(--accent-primary)' }} />
              {t('itemDetails')}
            </h3>

            <div className="detail-item-info">
              {detailModal.image ? (
                <div className="detail-item-image">
                  <img src={detailModal.image} alt={detailModal.name} />
                </div>
              ) : (
                <div className="detail-item-image placeholder">
                  <FontAwesomeIcon icon={faUtensils} />
                </div>
              )}
              
              <div className="detail-item-details">
                <h2 className="detail-item-name">{getDisplayName(detailModal.name)}</h2>
                <div className="detail-item-meta">
                  <span className="detail-meta-item">
                    <FontAwesomeIcon icon={faTag} />
                    {getCategoryLabel(detailModal.category)}
                  </span>
                  <span className="detail-meta-item">
                    <FontAwesomeIcon icon={faLocationDot} />
                    {getLocationLabel(detailModal.location)}
                  </span>
                  {detailModal.quantity && (
                    <span className="detail-meta-item">
                      <FontAwesomeIcon icon={faWeightHanging} />
                      {detailModal.quantity}
                    </span>
                  )}
                  {detailModal.createdAt && (
                    <span className="detail-meta-item">
                      <FontAwesomeIcon icon={faCalendar} />
                      {t('added')} {new Date(detailModal.createdAt).toLocaleDateString(language === 'mm' ? 'my-MM' : undefined)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="detail-expiry-section">
              <h4>{t('estimatedExpiry')}</h4>
              {detailModal.expiryDate ? (
                <div className="detail-expiry-info">
                  <span className="detail-expiry-date">
                    <FontAwesomeIcon icon={faCalendar} />
                    {new Date(detailModal.expiryDate + 'T00:00:00').toLocaleDateString('en-US', { 
                      month: 'long', 
                      day: 'numeric',
                      year: 'numeric' 
                    })}
                  </span>
                  <span 
                    className="detail-expiry-status"
                    style={{ color: getUrgencyColor(detailModal.expiryDate) }}
                  >
                    {localizeExpiryLabel(getExpiryStatus(detailModal.expiryDate))}
                  </span>
                </div>
              ) : (
                <span className="detail-expiry-none">
                  <FontAwesomeIcon icon={faCircleCheck} />
                  {t('noExpiryDate')}
                </span>
              )}
            </div>

            <div className="detail-actions">
              <button 
                className="detail-edit-btn"
                onClick={() => {
                  closeDetailModal();
                  handleEdit(detailModal);
                }}
              >
                <FontAwesomeIcon icon={faPen} /> {t('edit')}
              </button>
              <button 
                className="detail-delete-btn"
                onClick={() => {
                  closeDetailModal();
                  handleDelete(detailModal);
                }}
              >
                <FontAwesomeIcon icon={faTrash} /> {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── FOOD CHECK MODAL ─── */}
      {foodCheckModal && (
        <div className="modal-overlay" onClick={closeFoodCheckModal}>
          <div className="modal-content food-check-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeFoodCheckModal}>
              <FontAwesomeIcon icon={faXmark} />
            </button>
            
            {foodCheckStep === 'check' ? (
              // ─── STEP 1: Check Status ───
              <>
                <div className="food-check-icon">
                  <FontAwesomeIcon icon={faQuestionCircle} />
                </div>
                
                <h3 className="food-check-title">{t('foodCheckTitle')}</h3>
                
                <div className="food-check-item">
                  <span className="food-check-item-name">{getDisplayName(foodCheckModal.name)}</span>
                  <span className="food-check-item-location">
                    <FontAwesomeIcon icon={getLocationIcon(foodCheckModal.location)} />
                    {getLocationLabel(foodCheckModal.location)}
                  </span>
                </div>

                <div className="food-check-expiry">
                  <span className="food-check-label">{t('estimatedExpiryShort')}</span>
                  <span 
                    className="food-check-status"
                    style={{ color: getUrgencyColor(foodCheckModal.expiryDate) }}
                  >
                    {localizeExpiryLabel(getExpiryStatus(foodCheckModal.expiryDate))}
                  </span>
                  {foodCheckModal.expiryDate && (
                    <span className="food-check-date">
                      {new Date(foodCheckModal.expiryDate + 'T00:00:00').toLocaleDateString('en-US', { 
                        month: 'long', 
                        day: 'numeric',
                        year: 'numeric' 
                      })}
                    </span>
                  )}
                </div>

                <p className="food-check-question">Is it still good?</p>

                <div className="food-check-actions">
                  <button 
                    className="food-check-still-good"
                    onClick={handleStillGood}
                  >
                    <FontAwesomeIcon icon={faThumbsUp} /> {t('stillGood')}
                  </button>
                  <button 
                    className="food-check-no-good"
                    onClick={handleNoLongerGood}
                  >
                    <FontAwesomeIcon icon={faThumbsDown} /> {t('noLongerGood')}
                  </button>
                </div>
              </>
            ) : (
              // ─── STEP 2: Extend Expiry ───
              <>
                <div className="food-check-icon success">
                  <FontAwesomeIcon icon={faCircleCheck} />
                </div>
                
                <h3 className="food-check-title">{t('stillGoodTitle')}</h3>
                
                <p className="food-check-subtitle">
                  {t('extendExpiryQuestion')}
                </p>

                <div className="food-check-extend-options">
                  <button 
                    className="food-check-extend-btn"
                    onClick={() => handleExtendExpiry(2)}
                  >
                    <span className="extend-days">+2</span>
                    <span className="extend-label">{t('days')}</span>
                  </button>
                  <button 
                    className="food-check-extend-btn primary"
                    onClick={() => handleExtendExpiry(3)}
                  >
                    <span className="extend-days">+3</span>
                    <span className="extend-label">{t('days')}</span>
                  </button>
                </div>

                <button 
                  className="food-check-cancel-btn"
                  onClick={closeFoodCheckModal}
                >
                  {t('cancel')}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── DELETE MODAL ─── */}
      {deleteModal && (
        <div className="modal-overlay" onClick={() => setDeleteModal(null)}>
          <div className="modal-content delete-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setDeleteModal(null)}>
              <FontAwesomeIcon icon={faXmark} />
            </button>
            
            <FontAwesomeIcon icon={faTrash} className="delete-icon" />
            <h3 className="modal-title">{t('deleteItem')}</h3>
            <p className="modal-message">
              {t('deleteConfirm')} <strong>"{deleteModal.name}"</strong>? {t('cannotUndo')}
            </p>
            
            <div className="delete-actions">
              <button className="cancel-btn" onClick={() => setDeleteModal(null)}>
                {t('cancel')}
              </button>
              <button className="confirm-delete-btn" onClick={confirmDelete}>
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}