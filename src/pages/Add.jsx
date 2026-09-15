import { useState, useRef, useEffect } from 'react';
import { useItems } from '../context/ItemContext';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCamera,
  faSearch,
  faXmark,
  faArrowRight,
  faClock,
  faBox,
  faUtensils,
  faDrumstickBite,
  faCarrot,
  faAppleAlt,
  faCheese,
  faBreadSlice,
  faPlus,
  faCheck,
  faChevronLeft,
  faCircleCheck,
  faCircleXmark,
  faTriangleExclamation,
  faCalendar,
  faTimes,
  faLeaf,
  faHome,
  faSnowflake,
  faBoxOpen,
  faStoreAlt,
} from '@fortawesome/free-solid-svg-icons';
import { INGREDIENTS, CATEGORIES, getIngredientNameMM, getIngredientNameEN } from '../data/ingredients';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import './Add.css';

export default function Add() {
  const { addItem } = useItems();
  const { colors, theme } = useTheme();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  
  const [step, setStep] = useState(1);
  const [image, setImage] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [customCategory, setCustomCategory] = useState('vegetable');
  const [formData, setFormData] = useState({
    name: '',
    location: 'fridge',
    category: 'vegetable',
    expiryDate: '',
    expiryType: 'auto',
  });
  const [selectedItem, setSelectedItem] = useState(null);
  const [recentItems, setRecentItems] = useState([]);
  const [browseCategory, setBrowseCategory] = useState(null);
  const [modalData, setModalData] = useState(null);
  const [showCategoryItems, setShowCategoryItems] = useState(false);

  const isDark = theme === 'dark';

  // ─── Load custom items ───
  const [customItems, setCustomItems] = useState(() => {
    const saved = localStorage.getItem('customItems');
    return saved ? JSON.parse(saved) : {};
  });

  // ─── Load recent items ───
  useEffect(() => {
    const saved = localStorage.getItem('recentItems');
    if (saved) {
      setRecentItems(JSON.parse(saved));
    }
  }, []);

  const saveCustomItem = (category, name) => {
    const updated = { ...customItems };
    if (!updated[category]) updated[category] = [];
    if (!updated[category].includes(name)) {
      updated[category].push(name);
      localStorage.setItem('customItems', JSON.stringify(updated));
      setCustomItems(updated);
    }
  };

  const saveRecentItem = (name) => {
    const updated = [name, ...recentItems.filter(item => item !== name)].slice(0, 5);
    setRecentItems(updated);
    localStorage.setItem('recentItems', JSON.stringify(updated));
  };

  // ─── Storage location icons ───
  const locations = [
    { value: 'fridge', icon: faHome, label: t('fridge'), desc: t('everydayStorage') },
    { value: 'freezer', icon: faSnowflake, label: t('freezer'), desc: t('longTermStorage') },
    { value: 'cabinet', icon: faBoxOpen, label: t('cabinet'), desc: t('dryGoods') },
    { value: 'pantry', icon: faStoreAlt, label: t('pantry'), desc: t('roomTemperature') },
  ];

  // ─── Category icon mapping ───
  const getCategoryIcon = (category) => {
    const iconMap = {
      vegetable: faCarrot,
      fruit: faAppleAlt,
      meat: faDrumstickBite,
      dairy: faCheese,
      bread: faBreadSlice,
      packaged: faBox,
    };
    return iconMap[category] || faUtensils;
  };

  const getCategoryLabel = (category) => {
    return t(`category_${category}`);
  };

  // ─── Get all items (default + custom) ───
  const getAllItems = () => {
    const all = { ...INGREDIENTS };
    for (const [category, items] of Object.entries(customItems)) {
      if (!all[category]) all[category] = [];
      all[category] = [...all[category], ...items];
    }
    return all;
  };

  // ─── Search results ───
  const getSearchResults = () => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return [];

    const results = [];
    const all = getAllItems();

    for (const [category, items] of Object.entries(all)) {
      for (const item of items) {
        if ([item, getIngredientNameMM(item)].some(name =>
          String(name || '').toLowerCase().includes(term)
        )) {
          results.push({
            name: item,
            category: category,
            icon: getCategoryIcon(category),
          });
        }
      }
    }

    for (const [category, items] of Object.entries(customItems)) {
      for (const item of items) {
        if ([item, getIngredientNameMM(item)].some(name =>
          String(name || '').toLowerCase().includes(term)
        )) {
          if (!results.some(r => r.name === item && r.category === category)) {
            results.push({
              name: item,
              category: category,
              icon: getCategoryIcon(category),
              isCustom: true,
            });
          }
        }
      }
    }

    return results.slice(0, 10);
  };

  // ─── Category items for browse ───
  const getCategoryItems = (category) => {
    if (!category) return [];
    const all = getAllItems();
    return all[category] || [];
  };

  // ─── Expiry Suggestions ───
  const getExpirySuggestions = () => {
    const { category, location } = formData;

    if (category === 'packaged') {
      return ['manual'];
    }

    if (category === 'dairy' && (formData.name.includes('Eggs') || selectedItem?.name?.includes('Eggs'))) {
      return ['none'];
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

  const localizeExpiryOption = (option) => {
    if (language !== 'mm') return option;
    if (option === 'Not recommended') return t('notRecommendedShort');
    return option
      .replace(/days?/g, t('days'))
      .replace(/weeks?/g, 'ပတ်')
      .replace(/months?/g, 'လ')
      .replace(/years?/g, 'နှစ်');
  };

  const handlePhotoCapture = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result);
        setStep(2);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleItemSelect = (item) => {
    const displayName = language === 'mm' && !item.isCustom ? getIngredientNameMM(item.name) : item.name;
    setSelectedItem(item);
    setFormData({
      ...formData,
      name: displayName,
      category: item.category,
    });
    setSearchTerm('');
    setBrowseCategory(null);
    setShowCategoryItems(false);
    saveRecentItem(item.name);
    setStep(3);
  };

  const handleCategoryBrowse = (category) => {
    setBrowseCategory(category);
    setShowCategoryItems(true);
    setFormData({ ...formData, category: category });
    setSearchTerm('');
  };

  const handleBackToCategories = () => {
    setBrowseCategory(null);
    setShowCategoryItems(false);
    setSearchTerm('');
  };

  const handleCustomAdd = () => {
    if (searchTerm.trim()) {
      const newName = searchTerm.trim();
      let category = customCategory;
      const all = getAllItems();
      for (const [cat, items] of Object.entries(all)) {
        for (const item of items) {
          if (item.toLowerCase() === newName.toLowerCase()) {
            category = cat;
            break;
          }
        }
      }
      
      saveCustomItem(category, newName);
      handleItemSelect({ name: newName, category: category });
    }
  };

  // ─── Handle Expiry Selection ───
  const handleExpirySelect = async (days) => {
    if (days === 'none') {
      await saveTranslatedItem({ 
        ...formData, 
        image: image || null,
        expiryType: 'none',
        expiryDate: null
      });
      navigate('/');
      return;
    }

    if (days === 'manual') {
      setStep(5);
      return;
    }

    const expiryDate = new Date();
    
    if (days.includes('day')) {
      const match = days.match(/(\d+)-(\d+)/);
      if (match) {
        const maxDays = parseInt(match[2]);
        expiryDate.setDate(expiryDate.getDate() + maxDays);
      } else {
        const numMatch = days.match(/(\d+)/);
        if (numMatch) {
          expiryDate.setDate(expiryDate.getDate() + parseInt(numMatch[1]));
        }
      }
    } else if (days.includes('week')) {
      const match = days.match(/(\d+)/);
      if (match) {
        const weeks = parseInt(match[1]);
        expiryDate.setDate(expiryDate.getDate() + weeks * 7);
      } else {
        expiryDate.setDate(expiryDate.getDate() + 7);
      }
    } else if (days.includes('month')) {
      const match = days.match(/(\d+)/);
      if (match) {
        const months = parseInt(match[1]);
        expiryDate.setMonth(expiryDate.getMonth() + months);
      } else {
        expiryDate.setMonth(expiryDate.getMonth() + 1);
      }
    } else if (days.includes('year')) {
      const match = days.match(/(\d+)/);
      if (match) {
        const years = parseInt(match[1]);
        expiryDate.setFullYear(expiryDate.getFullYear() + years);
      } else {
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      }
    } else {
      const numMatch = days.match(/(\d+)/);
      if (numMatch) {
        expiryDate.setDate(expiryDate.getDate() + parseInt(numMatch[1]));
      }
    }

    const expiryDateStr = [
      expiryDate.getFullYear(),
      String(expiryDate.getMonth() + 1).padStart(2, '0'),
      String(expiryDate.getDate()).padStart(2, '0'),
    ].join('-');
    
    await saveTranslatedItem({ 
      ...formData, 
      expiryDate: expiryDateStr,
      image: image || null,
      expiryType: 'auto'
    });
    navigate('/');
  };

  const saveTranslatedItem = async (item) => {
    const canonicalName = getIngredientNameEN(item.name);
    await addItem({
      ...item,
      name: canonicalName,
      normalizedName: canonicalName,
      category: item.category,
    });
  };

  const handleDateSubmit = async (e) => {
    e.preventDefault();
    if (formData.expiryDate) {
      await saveTranslatedItem({ 
        ...formData, 
        image: image || null,
        expiryType: 'manual'
      });
      navigate('/');
    }
  };

  const closeModal = () => {
    setModalData(null);
  };

  // ─── STEP 1: Photo ───
  if (step === 1) {
    return (
      <div className="add-container">
        <div className="add-card photo-card">
          <div className="photo-icon">🍳</div>
          <h2>{t('addToKitchen')}</h2>
          <p>{t('photoOrGallery')}</p>
          <button className="btn-camera" onClick={() => fileInputRef.current.click()}>
            <FontAwesomeIcon icon={faCamera} /> {t('openCamera')}
          </button>
          <button className="btn-skip" onClick={() => setStep(2)}>
            {t('skip')} <FontAwesomeIcon icon={faArrowRight} />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            capture="environment"
            onChange={handlePhotoCapture}
            style={{ display: 'none' }}
          />
        </div>
      </div>
    );
  }

  // ─── STEP 2: Search First ───
  if (step === 2) {
    const searchResults = getSearchResults();
    const categoryItems = browseCategory ? getCategoryItems(browseCategory) : [];
    const showItems = showCategoryItems && browseCategory !== null;

    return (
      <div className="add-container">
        <div className="add-card search-card">
          {image && (
            <div className="image-preview">
              <img src={image} alt="Item" />
            </div>
          )}
          
          <div className="search-header">
            <h3>
              <FontAwesomeIcon icon={faLeaf} style={{ marginRight: '8px', color: 'var(--accent-primary)' }} />
              {t('whatAdding')}
            </h3>
          </div>

          <div className="search-bar-container">
            <div className="search-bar">
              <FontAwesomeIcon icon={faSearch} className="search-icon" />
              <input
                type="text"
                placeholder={showItems ? `${getCategoryLabel(browseCategory)}...` : t('searchIngredient')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')}>
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              )}
            </div>
          </div>

          {showItems && !searchTerm && (
            <div className="browse-header">
              <button 
                className="browse-back"
                onClick={handleBackToCategories}
              >
                <FontAwesomeIcon icon={faChevronLeft} />
                {t('allCategories')}
              </button>
              <span className="browse-title">
                <FontAwesomeIcon icon={getCategoryIcon(browseCategory)} />
                {getCategoryLabel(browseCategory)}
              </span>
            </div>
          )}

          {searchTerm.length > 0 && (
            <div className="search-results">
              {searchResults.length > 0 ? (
                searchResults.map((item, index) => (
                  <button
                    key={index}
                    className="search-result-item"
                    onClick={() => handleItemSelect(item)}
                  >
                    <div className="result-info">
                      <FontAwesomeIcon icon={item.icon} className="result-icon" />
                      <span className="result-name">{language === 'mm' ? getIngredientNameMM(item.name) : item.name}</span>
                      {item.isCustom && (
                        <span className="custom-badge">✨ {t('custom')}</span>
                      )}
                    </div>
                    <FontAwesomeIcon icon={faCheck} className="result-check" />
                  </button>
                ))
              ) : (
                <div className="search-empty">
                  <p>{t('noResults')}</p>
                  <label className="custom-category-field">
                    <span>{t('chooseCategory')}</span>
                    <select
                      value={customCategory}
                      onChange={(event) => setCustomCategory(event.target.value)}
                    >
                      {CATEGORIES.map((category) => (
                        <option key={category.value} value={category.value}>
                          {getCategoryLabel(category.value)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="add-custom-btn" onClick={handleCustomAdd}>
                    <FontAwesomeIcon icon={faPlus} />
                    {t('addCustom')} "{searchTerm}"
                  </button>
                </div>
              )}
            </div>
          )}

          {showItems && !searchTerm && categoryItems.length > 0 && (
            <div className="category-items">
              {categoryItems.map((item, index) => {
                const isCustom = customItems[browseCategory]?.includes(item);
                return (
                  <button
                    key={index}
                    className="category-item"
                    onClick={() => handleItemSelect({ name: item, category: browseCategory })}
                  >
                    <span className="item-name">{language === 'mm' ? getIngredientNameMM(item) : item}</span>
                    {isCustom && <span className="custom-badge">✨</span>}
                  </button>
                );
              })}
            </div>
          )}

          {!searchTerm && !showItems && (
            <>
              <p className="category-label">
                <FontAwesomeIcon icon={faBox} style={{ marginRight: '6px', fontSize: '12px' }} />
                {t('browseCategories')}
              </p>
              <div className="category-grid">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    className="category-btn"
                    onClick={() => handleCategoryBrowse(cat.value)}
                  >
                    <FontAwesomeIcon icon={getCategoryIcon(cat.value)} className="category-icon" />
                    <div className="category-info">
                      <span className="category-name">{getCategoryLabel(cat.value)}</span>
                    </div>
                    <FontAwesomeIcon icon={faArrowRight} className="category-arrow" />
                  </button>
                ))}
              </div>
            </>
          )}

          {!searchTerm && !showItems && recentItems.length > 0 && (
            <div className="recent-section">
              <p className="recent-label">
                <FontAwesomeIcon icon={faClock} style={{ marginRight: '6px', fontSize: '12px' }} />
                {t('recentlyAdded')}
              </p>
              <div className="recent-grid">
                {recentItems.map((item, index) => {
                  let category = 'vegetable';
                  const all = getAllItems();
                  for (const [cat, items] of Object.entries(all)) {
                    if (items.includes(item)) {
                      category = cat;
                      break;
                    }
                  }
                  const icon = getCategoryIcon(category);
                  return (
                    <button
                      key={index}
                      className="recent-item"
                      onClick={() => handleItemSelect({ name: item, category })}
                    >
                      <FontAwesomeIcon icon={icon} />
                      <span>{language === 'mm' ? getIngredientNameMM(item) : item}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {modalData && (
          <div className="modal-overlay" onClick={closeModal}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-icon">
                <FontAwesomeIcon icon={faTriangleExclamation} />
              </div>
              <h3 className="modal-title">{modalData.title}</h3>
              <p className="modal-message">{modalData.message}</p>
              <div className="modal-actions">
                <button className="modal-btn cancel" onClick={closeModal}>
                  {t('cancel')}
                </button>
                <button 
                  className="modal-btn confirm"
                  style={{ 
                    background: isDark ? colors.primary : '#8D6E3F',
                    color: '#ffffff'
                  }}
                  onClick={() => {
                    modalData.onConfirm();
                    closeModal();
                  }}
                >
                  {t('confirm')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── STEP 3: Location ───
  if (step === 3) {
    return (
      <div className="add-container">
        <div className="add-card location-card">
          <div className="selected-item-display">
            <FontAwesomeIcon icon={getCategoryIcon(formData.category)} />
            {formData.name}
            <span className="category-tag">{getCategoryLabel(formData.category)}</span>
          </div>
          
          <h3 className="location-title">{t('keepIt')}</h3>

          <div className="location-grid">
            {locations.map((loc) => (
              <button
                key={loc.value}
                onClick={() => {
                  setFormData({...formData, location: loc.value});
                  setStep(4);
                }}
                className="location-btn"
              >
                <span className="location-icon"><FontAwesomeIcon icon={loc.icon} /></span>
                <div className="location-info">
                  <span className="location-label">{loc.label}</span>
                  <span className="location-desc">{loc.desc}</span>
                </div>
                <FontAwesomeIcon icon={faArrowRight} className="location-arrow" />
              </button>
            ))}
          </div>

          <button
            className="btn-back"
            onClick={() => setStep(2)}
          >
            <FontAwesomeIcon icon={faChevronLeft} /> {t('back')}
          </button>
        </div>
      </div>
    );
  }

  // ─── STEP 4: Expiry ───
  if (step === 4) {
    const suggestions = getExpirySuggestions();
    const locationData = locations.find(l => l.value === formData.location);

    if (suggestions[0] === 'none') {
      return (
        <div className="add-container">
          <div className="add-card expiry-card">
            <div className="selected-item-display">
              <FontAwesomeIcon icon={getCategoryIcon(formData.category)} />
              {formData.name}
            </div>
            <div className="no-expiry-box">
              <FontAwesomeIcon icon={faCircleCheck} className="check-icon" />
              <p>{t('noExpiry')}</p>
              <p className="sub-text">{formData.name} {t('longLasting')}</p>
            </div>
            <button
              className="btn-add active"
              onClick={() => handleExpirySelect('none')}
            >
              <FontAwesomeIcon icon={faCheck} />
              {t('addToKitchen')}
            </button>
            <button
              className="btn-back"
              onClick={() => setStep(3)}
            >
              <FontAwesomeIcon icon={faChevronLeft} /> {t('back')}
            </button>
          </div>
        </div>
      );
    }

    if (suggestions[0] === 'manual') {
      return (
        <div className="add-container">
          <div className="add-card expiry-card">
            <div className="selected-item-display">
              <FontAwesomeIcon icon={getCategoryIcon(formData.category)} />
              {formData.name}
            </div>
            <h3>
              <FontAwesomeIcon icon={faBox} style={{ marginRight: '8px' }} />
              {t('checkPackage')}
            </h3>
            <p>{t('enterExpiryLabel')}</p>

            <div className="custom-date-picker">
              <div className="date-picker-header">
                <label>
                  <FontAwesomeIcon icon={faCalendar} style={{ marginRight: '6px' }} />
                  {t('expiryDate')}
                </label>
                {formData.expiryDate && (
                  <span className="date-badge">
                    <FontAwesomeIcon icon={faCheck} style={{ marginRight: '4px' }} />
                    {t('selected')}
                  </span>
                )}
              </div>

              <div className="date-input-wrapper">
                <FontAwesomeIcon icon={faCalendar} className="date-icon" />
                <input
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({...formData, expiryDate: e.target.value})}
                />
                <button 
                  className={`clear-date ${formData.expiryDate ? 'visible' : ''}`}
                  onClick={() => setFormData({...formData, expiryDate: ''})}
                  type="button"
                >
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              </div>

              {formData.expiryDate && (
                <div className="selected-date-display">
                  <FontAwesomeIcon icon={faCircleCheck} className="date-check" />
                  <span>Selected: {new Date(formData.expiryDate + 'T00:00:00').toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric',
                    year: 'numeric' 
                  })}</span>
                </div>
              )}
            </div>

            <button
              className={`btn-add ${formData.expiryDate ? 'active' : ''}`}
              onClick={handleDateSubmit}
              disabled={!formData.expiryDate}
            >
              {formData.expiryDate ? (
                <><FontAwesomeIcon icon={faCheck} /> {t('addItem')}</>
              ) : (
                <><FontAwesomeIcon icon={faCalendar} /> {t('selectDate')}</>
              )}
            </button>
            
            <button
              className="btn-back"
              onClick={() => setStep(3)}
            >
              <FontAwesomeIcon icon={faChevronLeft} /> {t('back')}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="add-container">
        <div className="add-card expiry-card">
          <div className="selected-item-display">
            <FontAwesomeIcon icon={getCategoryIcon(formData.category)} />
            {formData.name}
            <span className="location-tag">
              <FontAwesomeIcon icon={locationData?.icon} style={{ marginRight: '4px' }} />
              {locationData?.label}
            </span>
          </div>
          
          <h3>
            <FontAwesomeIcon icon={faClock} style={{ marginRight: '8px' }} />
            {t('whenExpire')}
          </h3>
          
          <div className="expiry-options">
            {suggestions.map((option) => {
              if (option === 'Not recommended') {
                return (
                  <div key={option} className="not-recommended">
                    <FontAwesomeIcon icon={faCircleXmark} style={{ marginRight: '8px' }} />
                    {t('notRecommended')} {locationData?.label}
                  </div>
                );
              }
              return (
                <button
                  key={option}
                  className="expiry-option"
                  onClick={() => handleExpirySelect(option)}
                >
                  <span>
                    <FontAwesomeIcon icon={faCalendar} style={{ marginRight: '6px' }} />
                    {localizeExpiryOption(option)}
                  </span>
                  <FontAwesomeIcon icon={faArrowRight} />
                </button>
              );
            })}
          </div>

          <div className="expiry-actions">
            <button
              className="btn-skip-expiry"
              onClick={() => setStep(5)}
            >
              <FontAwesomeIcon icon={faCalendar} style={{ marginRight: '6px' }} />
              {t('exactDate')}
            </button>
            <button
              className="btn-skip-expiry"
              onClick={() => handleExpirySelect('none')}
            >
              <FontAwesomeIcon icon={faTimes} style={{ marginRight: '6px' }} />
              {t('noExpiryShort')}
            </button>
            <button
              className="btn-back"
              onClick={() => setStep(3)}
            >
              <FontAwesomeIcon icon={faChevronLeft} /> {t('back')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── STEP 5: Date Picker ───
  if (step === 5) {
    return (
      <div className="add-container">
        <div className="add-card expiry-card">
          <div className="selected-item-display">
            <FontAwesomeIcon icon={getCategoryIcon(formData.category)} />
            {formData.name}
          </div>
          <h3>
            <FontAwesomeIcon icon={faCalendar} style={{ marginRight: '8px' }} />
            {t('enterExpiry')}
          </h3>
          <p>{t('checkLabel')} {formData.name}</p>

          <div className="custom-date-picker">
            <div className="date-picker-header">
              <label>
                <FontAwesomeIcon icon={faCalendar} style={{ marginRight: '6px' }} />
                {t('expiryDate')}
              </label>
              {formData.expiryDate && (
                <span className="date-badge">
                  <FontAwesomeIcon icon={faCheck} style={{ marginRight: '4px' }} />
                  {t('selected')}
                </span>
              )}
            </div>

            <div className="date-input-wrapper">
              <FontAwesomeIcon icon={faCalendar} className="date-icon" />
              <input
                type="date"
                value={formData.expiryDate}
                onChange={(e) => setFormData({...formData, expiryDate: e.target.value})}
              />
              <button 
                className={`clear-date ${formData.expiryDate ? 'visible' : ''}`}
                onClick={() => setFormData({...formData, expiryDate: ''})}
                type="button"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            {formData.expiryDate && (
              <div className="selected-date-display">
                <FontAwesomeIcon icon={faCircleCheck} className="date-check" />
                <span>Selected: {new Date(formData.expiryDate + 'T00:00:00').toLocaleDateString('en-US', { 
                  weekday: 'short', 
                  month: 'short', 
                  day: 'numeric',
                  year: 'numeric' 
                })}</span>
              </div>
            )}
          </div>

          <button
            className={`btn-add ${formData.expiryDate ? 'active' : ''}`}
            onClick={handleDateSubmit}
            disabled={!formData.expiryDate}
          >
            {formData.expiryDate ? (
              <><FontAwesomeIcon icon={faCheck} /> {t('addItem')}</>
            ) : (
              <><FontAwesomeIcon icon={faCalendar} /> {t('pickDate')}</>
            )}
          </button>
          <button
            className="btn-back"
            onClick={() => setStep(4)}
          >
            <FontAwesomeIcon icon={faChevronLeft} /> {t('backToOptions')}
          </button>
        </div>
      </div>
    );
  }

  return null;
}