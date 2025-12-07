// telegramsubscription.js - Telegram Pages Management with Firebase
// COMPLETE VERSION WITH CURRENCY BUTTON - v2.5 WITH PLAN & STRIPE CHECK
// NO INLINE EVENT HANDLERS (onclick, onload, onerror) - ALL addEventListener
console.log('MAKERHUB Telegram Pages Manager initialized');

// ============== PAGE LOADER ==============
function hidePageLoader() {
    const loader = document.getElementById('pageLoader');
    if (loader && !loader.classList.contains('hidden')) {
        loader.classList.add('hidden');
    }
}
// =========================================

// Global variables
let selectedLanguage = 'en';
let selectedCurrency = 'USD';
let pageToDelete = null;
let currentPages = [];
let isLoading = false;
let auth = null;
let db = null;
let currentPageIdForLanguageUpdate = null;
let selectedUpdateLanguage = null;
let currentPageIdForCurrencyUpdate = null;
let selectedUpdateCurrency = null;
let userSetupData = null; // Store user setup info globally

// Security Helper
const SecurityHelper = {
    async verifyPageOwnership(pageId) {
        if (!auth.currentUser) return false;
        
        try {
            const doc = await db.collection('landingPages').doc(pageId).get();
            if (!doc.exists) return false;
            
            const data = doc.data();
            return data.creatorId === auth.currentUser.uid;
        } catch (error) {
            console.error('Error verifying ownership:', error);
            return false;
        }
    },
    
    sanitizePageData(data) {
        return {
            brand: (data.brand || '').replace(/[<>]/g, ''),
            description: (data.description || '').replace(/[<>]/g, ''),
            channelName: (data.channelName || '').replace(/[<>]/g, ''),
            slug: (data.slug || '').replace(/[^a-zA-Z0-9-_]/g, ''),
            logoUrl: data.logoUrl || '',
            isActive: data.isActive === true,
            viewCount: parseInt(data.viewCount) || 0,
            subscriptionCount: parseInt(data.subscriptionCount) || 0,
            revenue: parseFloat(data.revenue) || 0,
            profileName: (data.profileName || '').replace(/[^a-zA-Z0-9-_]/g, ''),
            channelSlug: (data.channelSlug || '').replace(/[^a-zA-Z0-9-_]/g, ''),
            language: data.language || 'en',
            currency: data.currency || 'USD'
        };
    }
};

// Rate limiter to prevent abuse
const RateLimiter = {
    attempts: new Map(),
    maxAttempts: 5,
    windowMs: 60000,
    
    check(action) {
        if (!auth.currentUser) return false;
        
        const now = Date.now();
        const key = `${auth.currentUser.uid}_${action}`;
        const attempts = this.attempts.get(key) || [];
        
        const validAttempts = attempts.filter(time => now - time < this.windowMs);
        
        if (validAttempts.length >= this.maxAttempts) {
            return false;
        }
        
        validAttempts.push(now);
        this.attempts.set(key, validAttempts);
        return true;
    }
};

// Language data - 13 supported languages
const languages = [
    { code: 'en', name: 'English', native: 'English', flag: '🇬🇧' },
    { code: 'fr', name: 'French', native: 'Français', flag: '🇫🇷' },
    { code: 'es', name: 'Spanish', native: 'Español', flag: '🇪🇸' },
    { code: 'de', name: 'German', native: 'Deutsch', flag: '🇩🇪' },
    { code: 'it', name: 'Italian', native: 'Italiano', flag: '🇮🇹' },
    { code: 'pt', name: 'Portuguese', native: 'Português', flag: '🇵🇹' },
    { code: 'ru', name: 'Russian', native: 'Русский', flag: '🇷🇺' },
    { code: 'zh', name: 'Chinese', native: '中文', flag: '🇨🇳' },
    { code: 'ja', name: 'Japanese', native: '日本語', flag: '🇯🇵' },
    { code: 'ko', name: 'Korean', native: '한국어', flag: '🇰🇷' },
    { code: 'tr', name: 'Turkish', native: 'Türkçe', flag: '🇹🇷' },
    { code: 'ar', name: 'Arabic', native: 'العربية', flag: '🇸🇦' },
    { code: 'pl', name: 'Polish', native: 'Polski', flag: '🇵🇱' }
];

// Currency data - 19 supported currencies
const currencies = [
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'GBP', name: 'British Pound', symbol: '£' },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
    { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
    { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
    { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
    { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr' },
    { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
    { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
    { code: 'DKK', name: 'Danish Krone', symbol: 'kr' },
    { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
    { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
    { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
    { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
    { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
    { code: 'RUB', name: 'Russian Ruble', symbol: '₽' },
    { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
    { code: 'ZAR', name: 'South African Rand', symbol: 'R' }
];

// ============== USER SETUP VERIFICATION ==============
async function checkUserSetup() {
    if (!auth || !auth.currentUser) return { hasStripe: false, plan: null };
    
    const user = auth.currentUser;
    
    try {
        // 1. Vérifier/Créer le plan utilisateur
        const userDoc = await db.collection('users').doc(user.uid).get();
        let userData = userDoc.exists ? userDoc.data() : {};
        
        // Si pas de plan, définir Freemium par défaut (10% commission)
        if (!userData.plan) {
            console.log('📋 No plan found, setting Freemium (10% commission)');
            await db.collection('users').doc(user.uid).set({
                plan: 'freemium',
                commissionRate: 10,
                planUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            userData.plan = 'freemium';
            userData.commissionRate = 10;
        }
        
        // 2. Vérifier Stripe Connect
        let hasStripe = false;
        try {
            const token = await user.getIdToken();
            const response = await fetch('/api/stripe-connect/stripe-status', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                const stripeData = await response.json();
                hasStripe = stripeData.status === 'connected' || 
                           (stripeData.payments_enabled && stripeData.payouts_enabled);
            }
        } catch (stripeError) {
            console.error('Error checking Stripe status:', stripeError);
        }
        
        const setupData = {
            hasStripe: hasStripe,
            plan: userData.plan || 'freemium',
            commissionRate: userData.commissionRate || 10
        };
        
        // Store globally
        userSetupData = setupData;
        
        return setupData;
        
    } catch (error) {
        console.error('Error in checkUserSetup:', error);
        return { hasStripe: false, plan: 'freemium', commissionRate: 10 };
    }
}

// Afficher l'alerte Stripe Connect
function showStripeConnectAlert() {
    // Vérifier si l'alerte existe déjà
    if (document.getElementById('stripeConnectAlert')) return;
    
    const alertDiv = document.createElement('div');
    alertDiv.id = 'stripeConnectAlert';
    alertDiv.className = 'stripe-connect-alert';
    alertDiv.innerHTML = `
        <div class="alert-content">
            <div class="alert-icon">
                <i class="fab fa-stripe-s"></i>
            </div>
            <div class="alert-text">
                <h3>Connect Your Stripe Account</h3>
                <p>To receive payments from your subscribers, you need to connect your Stripe account first.</p>
            </div>
            <button class="btn btn-stripe-connect" id="goToStripeConnect">
                <i class="fas fa-link"></i>
                Connect Stripe
            </button>
        </div>
    `;
    
    // Ajouter les styles
    if (!document.getElementById('stripeAlertStyles')) {
        const style = document.createElement('style');
        style.id = 'stripeAlertStyles';
        style.textContent = `
            .stripe-connect-alert {
                background: linear-gradient(135deg, #635BFF 0%, #7B73FF 100%);
                border-radius: 12px;
                padding: 20px 24px;
                margin-bottom: 24px;
                color: white;
                animation: slideDown 0.3s ease;
            }
            @keyframes slideDown {
                from { opacity: 0; transform: translateY(-10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .stripe-connect-alert .alert-content {
                display: flex;
                align-items: center;
                gap: 16px;
                flex-wrap: wrap;
            }
            .stripe-connect-alert .alert-icon {
                width: 48px;
                height: 48px;
                background: rgba(255,255,255,0.2);
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
            }
            .stripe-connect-alert .alert-text {
                flex: 1;
                min-width: 200px;
            }
            .stripe-connect-alert .alert-text h3 {
                margin: 0 0 4px 0;
                font-size: 16px;
                font-weight: 600;
            }
            .stripe-connect-alert .alert-text p {
                margin: 0;
                font-size: 14px;
                opacity: 0.9;
            }
            .btn-stripe-connect {
                background: white;
                color: #635BFF;
                border: none;
                padding: 12px 24px;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;
                transition: all 0.2s;
            }
            .btn-stripe-connect:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            }
            @media (max-width: 600px) {
                .stripe-connect-alert .alert-content {
                    flex-direction: column;
                    text-align: center;
                }
                .btn-stripe-connect {
                    width: 100%;
                    justify-content: center;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Insérer avant la section des pages
    const pagesSection = document.querySelector('.pages-section');
    if (pagesSection) {
        pagesSection.insertBefore(alertDiv, pagesSection.firstChild);
    }
    
    // Event listener pour le bouton
    document.getElementById('goToStripeConnect')?.addEventListener('click', function() {
        window.location.href = '/payments.html';
    });
}

// Cacher l'alerte Stripe si elle existe
function hideStripeConnectAlert() {
    const alert = document.getElementById('stripeConnectAlert');
    if (alert) {
        alert.remove();
    }
}
// =====================================================

// Initialize all event listeners
function initializeEventListeners() {
    console.log('Initializing event listeners...');
    
    const menuToggleBtn = document.getElementById('menuToggle');
    if (menuToggleBtn) {
        menuToggleBtn.addEventListener('click', toggleSidebar);
    }
    
    const sidebarOverlay = document.querySelector('.sidebar-overlay');
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeSidebar);
    }
    
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshPages);
    }
    
    const createPageBtn = document.getElementById('createPageBtn');
    if (createPageBtn) {
        createPageBtn.addEventListener('click', startCreatePage);
    }
    
    const searchInput = document.getElementById('pageSearch');
    if (searchInput) {
        searchInput.addEventListener('keyup', function(e) {
            searchPages(e.target.value);
        });
    }
    
    const sortFilter = document.getElementById('sortFilter');
    if (sortFilter) {
        sortFilter.addEventListener('change', function(e) {
            applySortFilter(e.target.value);
        });
    }
    
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', function(e) {
            applyStatusFilter(e.target.value);
        });
    }
    
    const createCard = document.querySelector('.create-page-card');
    if (createCard) {
        createCard.addEventListener('click', startCreatePage);
    }
    
    const emptyStateBtn = document.getElementById('emptyStateBtn');
    if (emptyStateBtn) {
        emptyStateBtn.addEventListener('click', startCreatePage);
    }
    
    initializeModalListeners();
}

function initializeModalListeners() {
    // Language Modal (Create Page)
    const langModalOverlay = document.getElementById('languageModalOverlay');
    if (langModalOverlay) {
        langModalOverlay.addEventListener('click', closeLanguageModal);
    }
    
    const langModalClose = document.getElementById('languageModalClose');
    if (langModalClose) {
        langModalClose.addEventListener('click', closeLanguageModal);
    }
    
    const langSearchInput = document.getElementById('languageSearch');
    if (langSearchInput) {
        langSearchInput.addEventListener('input', function(e) {
            SearchAndFilter.filterLanguages(e.target.value);
        });
    }
    
    const langSearchClear = document.getElementById('languageSearchClear');
    if (langSearchClear) {
        langSearchClear.addEventListener('click', clearLanguageSearch);
    }
    
    const confirmLangBtn = document.getElementById('confirmLanguageBtn');
    if (confirmLangBtn) {
        confirmLangBtn.addEventListener('click', proceedToCurrencySelection);
    }
    
    // Currency Modal (Create Page)
    const currModalOverlay = document.getElementById('currencyModalOverlay');
    if (currModalOverlay) {
        currModalOverlay.addEventListener('click', closeCurrencyModal);
    }
    
    const currModalClose = document.getElementById('currencyModalClose');
    if (currModalClose) {
        currModalClose.addEventListener('click', closeCurrencyModal);
    }
    
    const currSearchInput = document.getElementById('currencySearch');
    if (currSearchInput) {
        currSearchInput.addEventListener('input', function(e) {
            SearchAndFilter.filterCurrencies(e.target.value);
        });
    }
    
    const currSearchClear = document.getElementById('currencySearchClear');
    if (currSearchClear) {
        currSearchClear.addEventListener('click', clearCurrencySearch);
    }
    
    const backBtn = document.getElementById('currencyBackBtn');
    if (backBtn) {
        backBtn.addEventListener('click', backToLanguageSelection);
    }
    
    const confirmCurrBtn = document.getElementById('confirmCurrencyBtn');
    if (confirmCurrBtn) {
        confirmCurrBtn.addEventListener('click', redirectToCreateLanding);
    }
    
    // Page Language Update Modal
    const langUpdateModalOverlay = document.getElementById('pageLanguageModalOverlay');
    if (langUpdateModalOverlay) {
        langUpdateModalOverlay.addEventListener('click', closeLanguageUpdateModal);
    }
    
    const langUpdateModalClose = document.getElementById('pageLanguageModalClose');
    if (langUpdateModalClose) {
        langUpdateModalClose.addEventListener('click', closeLanguageUpdateModal);
    }
    
    const langUpdateSearchInput = document.getElementById('pageLanguageSearch');
    if (langUpdateSearchInput) {
        langUpdateSearchInput.addEventListener('input', function(e) {
            SearchAndFilter.filterUpdateLanguages(e.target.value);
        });
    }
    
    const langUpdateSearchClear = document.getElementById('pageLanguageSearchClear');
    if (langUpdateSearchClear) {
        langUpdateSearchClear.addEventListener('click', clearLanguageUpdateSearch);
    }
    
    const langUpdateCancelBtn = document.getElementById('pageLanguageCancelBtn');
    if (langUpdateCancelBtn) {
        langUpdateCancelBtn.addEventListener('click', closeLanguageUpdateModal);
    }
    
    const confirmLangUpdateBtn = document.getElementById('confirmPageLanguageBtn');
    if (confirmLangUpdateBtn) {
        confirmLangUpdateBtn.addEventListener('click', applyLanguageUpdate);
    }
    
    // Page Currency Update Modal
    const currUpdateModalOverlay = document.getElementById('pageCurrencyModalOverlay');
    if (currUpdateModalOverlay) {
        currUpdateModalOverlay.addEventListener('click', closeCurrencyUpdateModal);
    }
    
    const currUpdateModalClose = document.getElementById('pageCurrencyModalClose');
    if (currUpdateModalClose) {
        currUpdateModalClose.addEventListener('click', closeCurrencyUpdateModal);
    }
    
    const currUpdateSearchInput = document.getElementById('pageCurrencySearch');
    if (currUpdateSearchInput) {
        currUpdateSearchInput.addEventListener('input', function(e) {
            SearchAndFilter.filterUpdateCurrencies(e.target.value);
        });
    }
    
    const currUpdateSearchClear = document.getElementById('pageCurrencySearchClear');
    if (currUpdateSearchClear) {
        currUpdateSearchClear.addEventListener('click', clearCurrencyUpdateSearch);
    }
    
    const currUpdateCancelBtn = document.getElementById('pageCurrencyCancelBtn');
    if (currUpdateCancelBtn) {
        currUpdateCancelBtn.addEventListener('click', closeCurrencyUpdateModal);
    }
    
    const confirmCurrUpdateBtn = document.getElementById('confirmPageCurrencyBtn');
    if (confirmCurrUpdateBtn) {
        confirmCurrUpdateBtn.addEventListener('click', applyCurrencyUpdate);
    }
    
    // Delete Modal
    const deleteModalOverlay = document.getElementById('deleteModalOverlay');
    if (deleteModalOverlay) {
        deleteModalOverlay.addEventListener('click', closeDeleteModal);
    }
    
    const deleteModalClose = document.getElementById('deleteModalClose');
    if (deleteModalClose) {
        deleteModalClose.addEventListener('click', closeDeleteModal);
    }
    
    const cancelDeleteBtn = document.getElementById('deleteCancelBtn');
    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', closeDeleteModal);
    }
    
    const confirmDeleteBtn = document.getElementById('deleteConfirmBtn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', confirmDelete);
    }
}

function checkConnectionStatus() {
    const urlParams = new URLSearchParams(window.location.search);
    const connected = urlParams.get('connected');
    const activated = urlParams.get('activated');
    const pageId = urlParams.get('page');
    
    let shouldCleanUrl = false;
    
    if (connected === 'true') {
        if (activated === 'true') {
            showToast('Telegram channel connected and page ACTIVATED successfully!', 'success');
        } else {
            showToast('Telegram channel connected successfully!', 'success');
        }
        shouldCleanUrl = true;
    }
    
    const newPage = urlParams.get('new');
    if (newPage === 'true') {
        showToast('Page created successfully! (Please connect your Telegram channel)', 'info');
        shouldCleanUrl = true;
    }
    
    if (shouldCleanUrl) {
        if (window.history.replaceState) {
            const newUrlParams = new URLSearchParams();
            if (pageId && pageId !== 'new' && pageId !== 'undefined' && pageId !== 'null') {
                newUrlParams.set('page', pageId);
            }
            
            let newUrl = window.location.pathname;
            if (newUrlParams.toString()) {
                newUrl += '?' + newUrlParams.toString();
            }
            window.history.replaceState({}, document.title, newUrl);
            console.log('URL parameters cleaned after success.');
        }
    }
    
    if (pageId === 'new' || pageId === 'undefined' || pageId === 'null') {
        window.history.replaceState({}, document.title, '/telegramsubscription.html');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing Telegram Pages Manager...');
    
    const requiredElements = {
        pagesGrid: document.getElementById('pagesGrid'),
        pageCount: document.getElementById('pageCount'),
        loadingCard: document.getElementById('loadingCard')
    };
    
    let missingElements = [];
    for (let name in requiredElements) {
        if (!requiredElements[name]) {
            missingElements.push(name);
        }
    }
    
    if (missingElements.length > 0) {
        console.error('Missing required elements:', missingElements);
    }
    
    initializeEventListeners();
    checkConnectionStatus();
    
    const initApp = function() {
        console.log('Checking for Firebase services...');
        
        if (window.firebaseServices && window.firebaseServices.auth && window.firebaseServices.db) {
            console.log('Firebase services found!');
            auth = window.firebaseServices.auth;
            db = window.firebaseServices.db;
            
            auth.onAuthStateChanged(function(user) {
                if (user) {
                    console.log('User authenticated:', user.uid);
                    loadPages();
                } else {
                    console.log('User not authenticated, redirecting to login...');
                    hidePageLoader(); // Hide loader before redirect
                    window.location.href = '/auth.html';
                }
            });
            
            initializeFilters();
            initializeModals();
        } else {
            console.log('Firebase not ready, retrying in 100ms...');
            setTimeout(initApp, 100);
        }
    };
    
    initApp();
    
    // Fallback: hide loader after 3s max
    setTimeout(hidePageLoader, 3000);
});

async function loadPages() {
    console.log('loadPages called, isLoading:', isLoading);
    
    if (isLoading) {
        console.log('Already loading, skipping...');
        return;
    }
    
    try {
        isLoading = true;
        console.log('Starting to load pages...');
        showLoadingState();
        
        if (!auth || !db) {
            console.error('Firebase services not available');
            showEmptyState();
            hidePageLoader(); // HIDE LOADER
            return;
        }
        
        const user = auth.currentUser;
        if (!user) {
            console.log('User not connected');
            showEmptyState();
            hidePageLoader(); // HIDE LOADER
            return;
        }
        
        // ✅ VÉRIFIER LE SETUP UTILISATEUR (Plan + Stripe)
        const userSetup = await checkUserSetup();
        console.log('👤 User setup:', userSetup);
        
        // Afficher l'alerte Stripe si pas connecté
        if (!userSetup.hasStripe) {
            showStripeConnectAlert();
        } else {
            hideStripeConnectAlert();
        }
        
        let profileName = 'default';
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            
            if (userDoc.exists) {
                profileName = userDoc.data().profileName || 'default';
            } else {
                profileName = user.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                await db.collection('users').doc(user.uid).set({
                    profileName: profileName,
                    email: user.email,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }, { merge: true });
            }
        } catch (error) {
            console.error('Error getting user profile:', error);
        }
        
        try {
            const snapshot = await db
                .collection('landingPages')
                .where('creatorId', '==', user.uid)
                .orderBy('createdAt', 'desc')
                .get();
            
            console.log('Query complete, found', snapshot.size, 'pages');
            
            if (!snapshot.empty) {
                currentPages = [];
                
                snapshot.docs.forEach(function(doc) {
                    try {
                        const rawData = doc.data();
                        const data = SecurityHelper.sanitizePageData(rawData);
                        const pageProfileName = data.profileName || profileName || 'default';
                        
                        const hasChannel = rawData.telegram && rawData.telegram.channelLink;
                        const isReallyActive = hasChannel && data.isActive === true;
                        
                        const pageData = {
                            id: doc.id,
                            slug: data.slug || doc.id,
                            channelSlug: data.channelSlug || data.slug,
                            profileName: pageProfileName,
                            url: '/' + pageProfileName + '/' + (data.slug || doc.id),
                            brand: data.brand || 'Untitled',
                            channelName: data.channelName,
                            description: data.description || 'No description available',
                            logoUrl: data.logoUrl,
                            viewCount: data.viewCount,
                            subscriptionCount: data.subscriptionCount,
                            isActive: isReallyActive,
                            isDraft: !hasChannel,
                            createdAt: rawData.createdAt ? rawData.createdAt.toDate() : new Date(),
                            revenue: data.revenue,
                            telegram: rawData.telegram,
                            language: data.language,
                            currency: rawData.currency || data.currency || 'USD'
                        };
                        
                        currentPages.push(pageData);
                    } catch (docError) {
                        console.error('Error processing document:', doc.id, docError);
                    }
                });
                
                console.log('Pages processed:', currentPages.length);
                displayPages(currentPages);
                updatePageCount(currentPages.length);
                
                if (currentPages.length === 0) {
                    showEmptyState();
                } else {
                    hideEmptyState();
                }
            } else {
                console.log('No pages found, showing empty state');
                currentPages = [];
                displayPages([]);
                showEmptyState();
            }
        } catch (queryError) {
            console.error('Error querying pages:', queryError);
            
            const snapshot = await db
                .collection('landingPages')
                .where('creatorId', '==', user.uid)
                .get();
            
            if (!snapshot.empty) {
                currentPages = [];
                const docs = snapshot.docs.sort(function(a, b) {
                    const aDate = a.data().createdAt ? a.data().createdAt.toDate() : new Date(0);
                    const bDate = b.data().createdAt ? b.data().createdAt.toDate() : new Date(0);
                    return bDate - aDate;
                });
                
                docs.forEach(function(doc) {
                    try {
                        const rawData = doc.data();
                        const data = SecurityHelper.sanitizePageData(rawData);
                        const pageProfileName = data.profileName || profileName || 'default';
                        
                        const hasChannel = rawData.telegram && rawData.telegram.channelLink;
                        const isReallyActive = hasChannel && data.isActive === true;
                        
                        currentPages.push({
                            id: doc.id,
                            slug: data.slug || doc.id,
                            channelSlug: data.channelSlug || data.slug,
                            profileName: pageProfileName,
                            url: '/' + pageProfileName + '/' + (data.slug || doc.id),
                            brand: data.brand || 'Untitled',
                            channelName: data.channelName,
                            description: data.description || 'No description available',
                            logoUrl: data.logoUrl,
                            viewCount: data.viewCount,
                            subscriptionCount: data.subscriptionCount,
                            isActive: isReallyActive,
                            isDraft: !hasChannel,
                            createdAt: rawData.createdAt ? rawData.createdAt.toDate() : new Date(),
                            revenue: data.revenue,
                            telegram: rawData.telegram,
                            language: data.language,
                            currency: rawData.currency || data.currency || 'USD'
                        });
                    } catch (docError) {
                        console.error('Error processing document (fallback):', doc.id, docError);
                    }
                });
                
                displayPages(currentPages);
                updatePageCount(currentPages.length);
                hideEmptyState();
            } else {
                currentPages = [];
                displayPages([]);
                showEmptyState();
            }
        }
        
    } catch (error) {
        console.error('Error loading pages:', error);
        showEmptyState();
        showToast('Error loading pages: ' + error.message, 'error');
    } finally {
        isLoading = false;
        console.log('Loading complete');
        hideLoadingState();
        hidePageLoader(); // HIDE LOADER - data loaded!
    }
}

function displayPages(pages) {
    console.log('Displaying pages:', pages.length);
    
    const grid = document.getElementById('pagesGrid');
    if (!grid) {
        console.error('Pages grid not found!');
        return;
    }
    
    // Create the "Create New Page" card using DOM methods (CSP safe)
    grid.innerHTML = '';
    
    const createCard = document.createElement('div');
    createCard.className = 'create-page-card';
    
    const createIcon = document.createElement('div');
    createIcon.className = 'create-icon';
    const iconEl = document.createElement('i');
    iconEl.className = 'fas fa-plus';
    createIcon.appendChild(iconEl);
    
    const createTitle = document.createElement('h3');
    createTitle.textContent = 'Create New Page';
    
    const createDesc = document.createElement('p');
    createDesc.textContent = 'Create a professional Telegram subscription page';
    
    createCard.appendChild(createIcon);
    createCard.appendChild(createTitle);
    createCard.appendChild(createDesc);
    
    // CSP SAFE: Use addEventListener instead of onclick
    createCard.addEventListener('click', startCreatePage);
    
    grid.appendChild(createCard);
    
    hideLoadingState();
    
    if (pages.length === 0) {
        updatePageCount(0);
        return;
    }
    
    hideEmptyState();
    
    pages.forEach(function(page, index) {
        try {
            const card = createTelegramCard(page);
            grid.appendChild(card);
        } catch (cardError) {
            console.error('Error creating card for page:', page.id, cardError);
        }
    });
    
    updatePageCount(pages.length);
}

// CSP SAFE: Create card using DOM methods, no inline event handlers
function createTelegramCard(page) {
    const card = document.createElement('div');
    card.className = 'telegram-card';
    if (page.isDraft) {
        card.classList.add('draft');
    }
    card.dataset.pageId = page.id;
    
    const pageUrl = page.url || '/' + (page.profileName || 'default') + '/' + (page.slug || page.id);
    const fullUrl = window.location.origin + pageUrl;
    
    const safePageName = (page.brand || page.channelName || 'Untitled Page').replace(/['"]/g, '');
    
    const hasChannel = page.telegram && page.telegram.channelLink;
    
    let statusClass = '';
    let statusText = '';
    
    if (page.isDraft) {
        statusClass = 'inactive';
        statusText = 'Inactive';
    } else if (page.isActive) {
        statusClass = 'active';
        statusText = 'Active';
    } else {
        statusClass = 'inactive';
        statusText = 'Inactive';
    }
    
    // Language info
    const pageLanguage = page.language || 'en';
    let languageInfo = languages.find(function(l) { return l.code === pageLanguage; });
    if (!languageInfo) languageInfo = languages[0];
    
    // Currency info
    const pageCurrency = page.currency || 'USD';
    let currencyInfo = currencies.find(function(c) { return c.code === pageCurrency; });
    if (!currencyInfo) currencyInfo = currencies[0];
    
    // Build card header
    const cardHeader = document.createElement('div');
    cardHeader.className = 'telegram-card-header';
    
    // Logo (CSP SAFE: use addEventListener for load/error)
    if (page.logoUrl) {
        const logoDiv = document.createElement('div');
        logoDiv.className = 'channel-logo';
        
        const logoImg = document.createElement('img');
        logoImg.src = page.logoUrl;
        logoImg.alt = safePageName;
        logoImg.style.display = 'none';
        
        // CSP SAFE: addEventListener instead of onload/onerror
        logoImg.addEventListener('load', function() {
            this.style.display = 'block';
        });
        logoImg.addEventListener('error', function() {
            this.parentElement.style.display = 'none';
        });
        
        logoDiv.appendChild(logoImg);
        cardHeader.appendChild(logoDiv);
    }
    
    // Channel info
    const channelInfo = document.createElement('div');
    channelInfo.className = 'channel-info';
    
    const channelName = document.createElement('h3');
    channelName.className = 'channel-name';
    channelName.textContent = safePageName;
    channelInfo.appendChild(channelName);
    
    cardHeader.appendChild(channelInfo);
    
    // Status badge
    const statusBadge = document.createElement('span');
    statusBadge.className = 'status-badge ' + statusClass;
    statusBadge.textContent = statusText;
    cardHeader.appendChild(statusBadge);
    
    card.appendChild(cardHeader);
    
    // Card body
    const cardBody = document.createElement('div');
    cardBody.className = 'telegram-card-body';
    
    // Actions grid
    const actionsGrid = document.createElement('div');
    actionsGrid.className = 'card-actions-grid';
    
    // Define action buttons
    const actions = [
        { action: 'edit', icon: 'fa-edit', label: 'Edit', btnClass: '', disabled: false },
        { action: 'pricing', icon: 'fa-tag', label: 'Price', btnClass: 'btn-price', disabled: page.isDraft },
        { action: 'reviews', icon: 'fa-star', label: 'Reviews', btnClass: 'btn-reviews', disabled: page.isDraft },
        { action: 'share', icon: 'fa-share-alt', label: 'Share', btnClass: 'btn-share', disabled: page.isDraft, extraData: { pageSlug: page.slug, profileName: page.profileName } },
        { action: 'telegram', icon: null, label: 'Channel', btnClass: hasChannel ? 'btn-connected' : '', disabled: false, isTelegram: true },
        { action: 'language', icon: 'fa-language', label: languageInfo.flag + ' Language', btnClass: 'btn-language', disabled: false, extraData: { currentLang: pageLanguage } },
        { action: 'currency', icon: 'fa-coins', label: currencyInfo.symbol + ' Currency', btnClass: 'btn-currency', disabled: false, extraData: { currentCurrency: pageCurrency } },
        { action: 'delete', icon: 'fa-trash', label: 'Delete', btnClass: 'btn-delete', disabled: false, extraData: { pageName: safePageName } }
    ];
    
    actions.forEach(function(actionDef) {
        const btn = document.createElement('button');
        btn.className = 'card-action-btn ' + actionDef.btnClass;
        if (actionDef.disabled) {
            btn.classList.add('disabled');
        }
        btn.dataset.action = actionDef.action;
        btn.dataset.pageId = page.id;
        
        // Add extra data attributes
        if (actionDef.extraData) {
            for (const key in actionDef.extraData) {
                btn.dataset[key] = actionDef.extraData[key];
            }
        }
        
        // Icon
        if (actionDef.isTelegram) {
            // Telegram SVG icon
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('class', 'telegram-icon');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.style.width = '16px';
            svg.style.height = '16px';
            
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', 'M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161l-1.908 9.004c-.142.633-.514.788-1.041.49l-2.906-2.142-1.402 1.349c-.155.155-.285.285-.585.285l.209-2.968 5.395-4.875c.235-.209-.051-.325-.365-.116l-6.671 4.199-2.877-.899c-.626-.196-.638-.626.13-.928l11.232-4.327c.521-.19.978.125.808.919z');
            path.setAttribute('fill', 'currentColor');
            
            svg.appendChild(path);
            btn.appendChild(svg);
        } else if (actionDef.icon) {
            const icon = document.createElement('i');
            icon.className = 'fas ' + actionDef.icon;
            btn.appendChild(icon);
        }
        
        // Label
        const labelSpan = document.createElement('span');
        labelSpan.textContent = actionDef.label;
        btn.appendChild(labelSpan);
        
        // CSP SAFE: Use addEventListener
        btn.addEventListener('click', handleCardAction);
        
        actionsGrid.appendChild(btn);
    });
    
    cardBody.appendChild(actionsGrid);
    
    // Channel connected info or draft info
    if (hasChannel) {
        const connectedInfo = document.createElement('div');
        connectedInfo.className = 'channel-connected-info';
        
        const checkIcon = document.createElement('i');
        checkIcon.className = 'fas fa-check-circle';
        connectedInfo.appendChild(checkIcon);
        
        const infoSpan = document.createElement('span');
        infoSpan.textContent = 'Channel connected: ' + (page.telegram.channelName || 'Connected');
        connectedInfo.appendChild(infoSpan);
        
        cardBody.appendChild(connectedInfo);
    } else if (page.isDraft) {
        const draftInfo = document.createElement('div');
        draftInfo.className = 'draft-info';
        
        const infoIcon = document.createElement('i');
        infoIcon.className = 'fas fa-info-circle';
        draftInfo.appendChild(infoIcon);
        
        const infoSpan = document.createElement('span');
        infoSpan.textContent = 'Connect a Telegram channel to activate this page';
        draftInfo.appendChild(infoSpan);
        
        cardBody.appendChild(draftInfo);
    }
    
    card.appendChild(cardBody);
    
    return card;
}

function handleCardAction(event) {
    event.stopPropagation();
    const btn = event.currentTarget;
    const action = btn.dataset.action;
    const pageId = btn.dataset.pageId;
    
    console.log('Card action:', action, 'for page:', pageId);
    
    if (btn.classList.contains('disabled')) {
        if (action === 'pricing' || action === 'reviews' || action === 'share') {
            showToast('Connect a Telegram channel first', 'warning');
        }
        return;
    }
    
    if (!auth || !auth.currentUser) {
        showToast('Session expired, please log in again', 'error');
        setTimeout(function() {
            window.location.href = '/auth.html';
        }, 1500);
        return;
    }
    
    if (!RateLimiter.check(action)) {
        showToast('Too many attempts, please wait', 'warning');
        return;
    }
    
    // ✅ Vérifier Stripe Connect pour les actions qui nécessitent des paiements
    if ((action === 'pricing') && userSetupData && !userSetupData.hasStripe) {
        showToast('Please connect your Stripe account first to set pricing', 'warning');
        setTimeout(function() {
            window.location.href = '/payments.html';
        }, 1500);
        return;
    }
    
    switch(action) {
        case 'edit':
            editPage(pageId);
            break;
        case 'pricing':
            managePricing(pageId);
            break;
        case 'reviews':
            viewReviews(pageId);
            break;
        case 'telegram':
            connectTelegram(pageId);
            break;
        case 'language':
            openLanguageUpdateModal(pageId);
            break;
        case 'currency':
            openCurrencyUpdateModal(pageId);
            break;
        case 'share':
            var slug = btn.dataset.pageSlug;
            var profileName = btn.dataset.profileName;
            sharePageLink(pageId, slug, profileName);
            break;
        case 'delete':
            var pageName = btn.dataset.pageName;
            deletePage(pageId, pageName);
            break;
    }
}

async function triggerTranslationIfNeeded(pageId, targetLangs) {
    if (!targetLangs) targetLangs = [];
    
    try {
        if (!targetLangs.length) return;
        
        const snap = await db.collection('landingPages').doc(pageId).get();
        if (!snap.exists) return;
        
        const page = snap.data();
        
        if (!page.translations) {
            await db.collection('landingPages').doc(pageId).update({
                translations: {}
            });
        }
        
        const srcLang = page.sourceLanguage || 'fr';
        const baseContent = {
            brand: page.brand || '',
            slogan: page.slogan || '',
            description: page.description || '',
            banner: page.banner || '',
            buttonText: page.buttonText || 'Join'
        };
        
        const missing = targetLangs.filter(function(lang) {
            return !page.translations || !page.translations[lang];
        });
        
        if (!missing.length) return;
        
        const idToken = await auth.currentUser.getIdToken();
        const created = {};
        
        for (let i = 0; i < missing.length; i++) {
            const lang = missing[i];
            try {
                const resp = await fetch('/api/language/translate-landing', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + idToken
                    },
                    body: JSON.stringify({
                        content: baseContent,
                        targetLanguage: lang
                    })
                });
                
                if (resp.ok) {
                    const body = await resp.json();
                    created[lang] = body.translated || body.translations;
                }
            } catch (fetchError) {
                console.error('Error translating ' + lang + ':', fetchError);
            }
        }
        
        if (Object.keys(created).length) {
            for (const lang in created) {
                const updateObj = {};
                updateObj['translations.' + lang] = created[lang];
                await db.collection('landingPages').doc(pageId).update(updateObj);
            }
            
            await db.collection('landingPages').doc(pageId).update({
                translationsUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                translationStatus: 'completed',
                needsTranslation: false
            });
        }
    } catch (e) {
        console.error('Error triggerTranslationIfNeeded:', e);
    }
}

async function editPage(pageId) {
    await triggerTranslationIfNeeded(pageId);
    showToast('Redirecting to Page Editor...', 'info');
    setTimeout(function() {
        window.location.href = '/createLanding.html?page=' + pageId + '&edit=true';
    }, 500);
}

function managePricing(pageId) {
    showToast('Redirecting to Pricing Management...', 'info');
    setTimeout(function() {
        window.location.href = '/prix.html?page=' + pageId;
    }, 500);
}

function viewReviews(pageId) {
    showToast('Redirecting to Reviews Dashboard...', 'info');
    setTimeout(function() {
        window.location.href = '/avis.html?page=' + pageId;
    }, 500);
}

function connectTelegram(pageId) {
    const page = currentPages.find(function(p) { return p.id === pageId; });
    const hasChannel = page && page.telegram && page.telegram.channelLink;
    
    if (hasChannel) {
        showToast('Redirecting to Channel Management...', 'info');
    } else {
        showToast('Redirecting to Telegram Channel Setup...', 'info');
    }
    
    setTimeout(function() {
        window.location.href = '/ajoutcanal.html?page=' + pageId;
    }, 500);
}

function startCreatePage() {
    // ✅ Vérifier Stripe Connect avant de créer une page
    if (userSetupData && !userSetupData.hasStripe) {
        showToast('Please connect your Stripe account first to receive payments', 'warning');
        setTimeout(function() {
            window.location.href = '/payments.html';
        }, 1500);
        return;
    }
    
    openLanguageModal();
}

function redirectToCreateLanding() {
    closeCurrencyModal();
    showToast('Redirecting to Create Page...', 'info');
    setTimeout(function() {
        window.location.href = '/createLanding.html?lang=' + selectedLanguage + '&curr=' + selectedCurrency + '&new=true';
    }, 500);
}

async function sharePageLink(pageId, slug, profileName) {
    try {
        const pageDoc = await db.collection('landingPages').doc(pageId).get();
        
        if (!pageDoc.exists) {
            showToast('Page not found', 'error');
            return;
        }
        
        const pageData = pageDoc.data();
        const currentLanguage = pageData.language || 'en';
        const sourceLanguage = pageData.sourceLanguage || 'fr';
        
        const basePageUrl = window.location.origin + '/' + profileName + '/' + slug;
        
        let shareUrl = basePageUrl;
        if (currentLanguage !== sourceLanguage) {
            shareUrl = basePageUrl + '?lang=' + currentLanguage;
        }
        
        if (navigator.clipboard) {
            await navigator.clipboard.writeText(shareUrl);
            
            let langInfo = languages.find(function(l) { return l.code === currentLanguage; });
            const langName = langInfo ? langInfo.native : currentLanguage.toUpperCase();
            
            if (currentLanguage === sourceLanguage) {
                showToast('Link copied! (Original ' + langName + ' version)', 'success');
            } else {
                showToast('Link copied! (' + langName + ' translation)', 'success');
            }
        } else {
            const tempInput = document.createElement('input');
            document.body.appendChild(tempInput);
            tempInput.value = shareUrl;
            tempInput.select();
            document.execCommand('copy');
            document.body.removeChild(tempInput);
            showToast('Link copied!', 'success');
        }
        
    } catch (error) {
        console.error('Error sharing page link:', error);
        showToast('Error copying link', 'error');
    }
}

// Language Modal Functions (Create Page)
function openLanguageModal() {
    const modal = document.getElementById('languageModal');
    if (modal) {
        modal.classList.add('show');
        modal.setAttribute('aria-hidden', 'false');
        populateLanguages();
    }
}

function closeLanguageModal() {
    const modal = document.getElementById('languageModal');
    if (modal) {
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
    }
}

function populateLanguages() {
    const grid = document.getElementById('languagesGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    languages.forEach(function(lang) {
        const option = document.createElement('div');
        option.className = 'option-card language-option';
        option.dataset.language = lang.code;
        option.setAttribute('role', 'listitem');
        
        const flag = document.createElement('div');
        flag.className = 'option-flag';
        flag.textContent = lang.flag;
        
        const info = document.createElement('div');
        info.className = 'option-info';
        
        const name = document.createElement('div');
        name.className = 'option-name';
        name.textContent = lang.name;
        
        const native = document.createElement('div');
        native.className = 'option-native';
        native.textContent = lang.native;
        
        info.appendChild(name);
        info.appendChild(native);
        
        const check = document.createElement('div');
        check.className = 'option-check';
        const checkIcon = document.createElement('i');
        checkIcon.className = 'fas fa-check';
        check.appendChild(checkIcon);
        
        option.appendChild(flag);
        option.appendChild(info);
        option.appendChild(check);
        
        // CSP SAFE: addEventListener
        option.addEventListener('click', function() {
            selectLanguage(lang.code);
        });
        
        grid.appendChild(option);
    });
}

function selectLanguage(code) {
    selectedLanguage = code;
    const options = document.querySelectorAll('.language-option');
    options.forEach(function(opt) {
        opt.classList.remove('selected');
    });
    const selectedOpt = document.querySelector('[data-language="' + code + '"]');
    if (selectedOpt) selectedOpt.classList.add('selected');
    
    const confirmBtn = document.getElementById('confirmLanguageBtn');
    if (confirmBtn) confirmBtn.disabled = false;
}

function clearLanguageSearch() {
    const searchInput = document.getElementById('languageSearch');
    if (searchInput) {
        searchInput.value = '';
        populateLanguages();
    }
}

function proceedToCurrencySelection() {
    if (!selectedLanguage) {
        showToast('Please select a language first', 'warning');
        return;
    }
    closeLanguageModal();
    openCurrencyModal();
}

// Currency Modal Functions (Create Page)
function openCurrencyModal() {
    const modal = document.getElementById('currencyModal');
    if (modal) {
        modal.classList.add('show');
        modal.setAttribute('aria-hidden', 'false');
        populateCurrencies();
    }
}

function closeCurrencyModal() {
    const modal = document.getElementById('currencyModal');
    if (modal) {
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
    }
}

function backToLanguageSelection() {
    closeCurrencyModal();
    openLanguageModal();
}

function populateCurrencies() {
    const grid = document.getElementById('currenciesGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    currencies.forEach(function(curr) {
        const option = document.createElement('div');
        option.className = 'option-card currency-option';
        option.dataset.currency = curr.code;
        option.setAttribute('role', 'listitem');
        
        const symbol = document.createElement('div');
        symbol.className = 'option-symbol';
        symbol.textContent = curr.symbol;
        
        const info = document.createElement('div');
        info.className = 'option-info';
        
        const name = document.createElement('div');
        name.className = 'option-name';
        name.textContent = curr.name;
        
        const code = document.createElement('div');
        code.className = 'option-code';
        code.textContent = curr.code;
        
        info.appendChild(name);
        info.appendChild(code);
        
        const check = document.createElement('div');
        check.className = 'option-check';
        const checkIcon = document.createElement('i');
        checkIcon.className = 'fas fa-check';
        check.appendChild(checkIcon);
        
        option.appendChild(symbol);
        option.appendChild(info);
        option.appendChild(check);
        
        // CSP SAFE: addEventListener
        option.addEventListener('click', function() {
            selectCurrency(curr.code);
        });
        
        grid.appendChild(option);
    });
}

function selectCurrency(code) {
    selectedCurrency = code;
    const options = document.querySelectorAll('.currency-option');
    options.forEach(function(opt) {
        opt.classList.remove('selected');
    });
    const selectedOpt = document.querySelector('[data-currency="' + code + '"]');
    if (selectedOpt) selectedOpt.classList.add('selected');
    
    const confirmBtn = document.getElementById('confirmCurrencyBtn');
    if (confirmBtn) confirmBtn.disabled = false;
}

function clearCurrencySearch() {
    const searchInput = document.getElementById('currencySearch');
    if (searchInput) {
        searchInput.value = '';
        populateCurrencies();
    }
}

// Language Update Modal (Existing Page)
function openLanguageUpdateModal(pageId) {
    if (!pageId) {
        console.error('Page ID missing');
        showToast('Error: Missing page ID', 'error');
        return;
    }
    
    currentPageIdForLanguageUpdate = pageId;
    const page = currentPages.find(function(p) { return p.id === pageId; });
    selectedUpdateLanguage = page ? page.language : 'en';
    if (!selectedUpdateLanguage) selectedUpdateLanguage = 'en';
    
    const modal = document.getElementById('pageLanguageModal');
    if (modal) {
        modal.classList.add('show');
        modal.setAttribute('aria-hidden', 'false');
        populateUpdateLanguages();
        
        const currentLangOpt = document.querySelector('[data-update-language="' + selectedUpdateLanguage + '"]');
        if (currentLangOpt) {
            currentLangOpt.classList.add('selected');
        }
    }
}

function closeLanguageUpdateModal() {
    const modal = document.getElementById('pageLanguageModal');
    if (modal) {
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
    }
    currentPageIdForLanguageUpdate = null;
    selectedUpdateLanguage = null;
}

function populateUpdateLanguages() {
    const grid = document.getElementById('pageLanguagesGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    languages.forEach(function(lang) {
        const isSelected = lang.code === selectedUpdateLanguage;
        
        const option = document.createElement('div');
        option.className = 'option-card language-update-option' + (isSelected ? ' selected' : '');
        option.dataset.updateLanguage = lang.code;
        option.setAttribute('role', 'listitem');
        
        const flag = document.createElement('div');
        flag.className = 'option-flag';
        flag.textContent = lang.flag;
        
        const info = document.createElement('div');
        info.className = 'option-info';
        
        const name = document.createElement('div');
        name.className = 'option-name';
        name.textContent = lang.name;
        
        const native = document.createElement('div');
        native.className = 'option-native';
        native.textContent = lang.native;
        
        info.appendChild(name);
        info.appendChild(native);
        
        const check = document.createElement('div');
        check.className = 'option-check';
        const checkIcon = document.createElement('i');
        checkIcon.className = 'fas fa-check';
        check.appendChild(checkIcon);
        
        option.appendChild(flag);
        option.appendChild(info);
        option.appendChild(check);
        
        // CSP SAFE: addEventListener
        option.addEventListener('click', function() {
            selectUpdateLanguage(lang.code);
        });
        
        grid.appendChild(option);
    });
}

function selectUpdateLanguage(code) {
    selectedUpdateLanguage = code;
    const options = document.querySelectorAll('.language-update-option');
    options.forEach(function(opt) {
        opt.classList.remove('selected');
    });
    const selectedOpt = document.querySelector('[data-update-language="' + code + '"]');
    if (selectedOpt) selectedOpt.classList.add('selected');
    
    const confirmBtn = document.getElementById('confirmPageLanguageBtn');
    if (confirmBtn) confirmBtn.disabled = false;
}

async function applyLanguageUpdate() {
    if (!currentPageIdForLanguageUpdate || !selectedUpdateLanguage) {
        showToast('Error: Missing data', 'error');
        return;
    }
    
    try {
        showToast('Generating translation if needed...', 'info');
        
        if (db && auth.currentUser) {
            const isOwner = await SecurityHelper.verifyPageOwnership(currentPageIdForLanguageUpdate);
            if (!isOwner) {
                showToast('Permission denied to update this page.', 'error');
                return;
            }
            
            const pageDoc = await db.collection('landingPages').doc(currentPageIdForLanguageUpdate).get();
            if (pageDoc.exists) {
                const pageData = pageDoc.data();
                const hasTranslation = pageData.translations && pageData.translations[selectedUpdateLanguage];
                
                if (!hasTranslation) {
                    showToast('Creating ' + selectedUpdateLanguage + ' translation...', 'info');
                    await triggerTranslationIfNeeded(currentPageIdForLanguageUpdate, [selectedUpdateLanguage]);
                    showToast('Translation created for ' + selectedUpdateLanguage + '!', 'success');
                }
            }
            
            await db.collection('landingPages').doc(currentPageIdForLanguageUpdate).update({
                language: selectedUpdateLanguage,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
        const langInfo = languages.find(function(l) { return l.code === selectedUpdateLanguage; });
        showToast('Language updated: ' + (langInfo ? langInfo.native : selectedUpdateLanguage), 'success');
        
        closeLanguageUpdateModal();
        await loadPages();
        
    } catch (error) {
        console.error('Error updating language:', error);
        showToast('Error updating language: ' + error.message, 'error');
    }
}

function clearLanguageUpdateSearch() {
    const searchInput = document.getElementById('pageLanguageSearch');
    if (searchInput) {
        searchInput.value = '';
        populateUpdateLanguages();
    }
}

// Currency Update Modal (Existing Page)
function openCurrencyUpdateModal(pageId) {
    if (!pageId) {
        console.error('Page ID missing');
        showToast('Error: Missing page ID', 'error');
        return;
    }
    
    currentPageIdForCurrencyUpdate = pageId;
    const page = currentPages.find(function(p) { return p.id === pageId; });
    selectedUpdateCurrency = page ? page.currency : 'USD';
    if (!selectedUpdateCurrency) selectedUpdateCurrency = 'USD';
    
    const modal = document.getElementById('pageCurrencyModal');
    if (modal) {
        modal.classList.add('show');
        modal.setAttribute('aria-hidden', 'false');
        populateUpdateCurrencies();
    }
}

function closeCurrencyUpdateModal() {
    const modal = document.getElementById('pageCurrencyModal');
    if (modal) {
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
    }
    currentPageIdForCurrencyUpdate = null;
    selectedUpdateCurrency = null;
}

function populateUpdateCurrencies() {
    const grid = document.getElementById('pageCurrenciesGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    currencies.forEach(function(curr) {
        const isSelected = curr.code === selectedUpdateCurrency;
        
        const option = document.createElement('div');
        option.className = 'option-card currency-update-option' + (isSelected ? ' selected' : '');
        option.dataset.updateCurrency = curr.code;
        option.setAttribute('role', 'listitem');
        
        const symbol = document.createElement('div');
        symbol.className = 'option-symbol';
        symbol.textContent = curr.symbol;
        
        const info = document.createElement('div');
        info.className = 'option-info';
        
        const name = document.createElement('div');
        name.className = 'option-name';
        name.textContent = curr.name;
        
        const code = document.createElement('div');
        code.className = 'option-code';
        code.textContent = curr.code;
        
        info.appendChild(name);
        info.appendChild(code);
        
        const check = document.createElement('div');
        check.className = 'option-check';
        const checkIcon = document.createElement('i');
        checkIcon.className = 'fas fa-check';
        check.appendChild(checkIcon);
        
        option.appendChild(symbol);
        option.appendChild(info);
        option.appendChild(check);
        
        // CSP SAFE: addEventListener
        option.addEventListener('click', function() {
            selectUpdateCurrency(curr.code);
        });
        
        grid.appendChild(option);
    });
}

function selectUpdateCurrency(code) {
    selectedUpdateCurrency = code;
    const options = document.querySelectorAll('.currency-update-option');
    options.forEach(function(opt) {
        opt.classList.remove('selected');
    });
    const selectedOpt = document.querySelector('[data-update-currency="' + code + '"]');
    if (selectedOpt) selectedOpt.classList.add('selected');
    
    const confirmBtn = document.getElementById('confirmPageCurrencyBtn');
    if (confirmBtn) confirmBtn.disabled = false;
}

async function applyCurrencyUpdate() {
    if (!currentPageIdForCurrencyUpdate || !selectedUpdateCurrency) {
        showToast('Error: Missing data', 'error');
        return;
    }
    
    try {
        showToast('Updating currency...', 'info');
        
        if (db && auth.currentUser) {
            const isOwner = await SecurityHelper.verifyPageOwnership(currentPageIdForCurrencyUpdate);
            if (!isOwner) {
                showToast('Permission denied to update this page.', 'error');
                return;
            }
            
            await db.collection('landingPages').doc(currentPageIdForCurrencyUpdate).update({
                currency: selectedUpdateCurrency,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
        const currInfo = currencies.find(function(c) { return c.code === selectedUpdateCurrency; });
        showToast('Currency updated: ' + (currInfo ? currInfo.symbol + ' ' + currInfo.name : selectedUpdateCurrency), 'success');
        
        closeCurrencyUpdateModal();
        await loadPages();
        
    } catch (error) {
        console.error('Error updating currency:', error);
        showToast('Error updating currency: ' + error.message, 'error');
    }
}

function clearCurrencyUpdateSearch() {
    const searchInput = document.getElementById('pageCurrencySearch');
    if (searchInput) {
        searchInput.value = '';
        populateUpdateCurrencies();
    }
}

// Delete Modal Functions
function deletePage(pageId, pageName) {
    pageToDelete = pageId;
    const modal = document.getElementById('deleteModal');
    const nameDisplay = document.getElementById('pageNameToDelete');
    
    if (nameDisplay) {
        nameDisplay.textContent = pageName;
    }
    
    if (modal) {
        modal.classList.add('show');
        modal.setAttribute('aria-hidden', 'false');
    }
}

function closeDeleteModal() {
    const modal = document.getElementById('deleteModal');
    if (modal) {
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
    }
    pageToDelete = null;
}

async function confirmDelete() {
    if (!pageToDelete) return;
    
    showLoading(true, 'Deleting page...');
    
    try {
        if (!db || !auth.currentUser) {
            showToast('Session expired', 'error');
            return;
        }
        
        const isOwner = await SecurityHelper.verifyPageOwnership(pageToDelete);
        if (!isOwner) {
            showToast('Permission denied to delete this page.', 'error');
            return;
        }
        
        await db.collection('landingPages').doc(pageToDelete).delete();
        
        showToast('Page deleted successfully!', 'success');
        closeDeleteModal();
        loadPages();
        
    } catch (error) {
        console.error('Error deleting page:', error);
        showToast('Error deleting page: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// UI State Functions
function showLoadingState() {
    const loadingCard = document.getElementById('loadingCard');
    const pagesGrid = document.getElementById('pagesGrid');
    if (loadingCard) loadingCard.style.display = 'block';
    if (pagesGrid) pagesGrid.style.display = 'none';
}

function hideLoadingState() {
    const loadingCard = document.getElementById('loadingCard');
    const pagesGrid = document.getElementById('pagesGrid');
    if (loadingCard) loadingCard.style.display = 'none';
    if (pagesGrid) pagesGrid.style.display = 'grid';
}

function showEmptyState() {
    const emptyState = document.getElementById('emptyState');
    const pagesGrid = document.getElementById('pagesGrid');
    if (emptyState) emptyState.style.display = 'flex';
    if (pagesGrid) pagesGrid.style.display = 'none';
    updatePageCount(0);
}

function hideEmptyState() {
    const emptyState = document.getElementById('emptyState');
    const pagesGrid = document.getElementById('pagesGrid');
    if (emptyState) emptyState.style.display = 'none';
    if (pagesGrid) pagesGrid.style.display = 'grid';
}

function updatePageCount(count) {
    const countElement = document.getElementById('pageCount');
    if (countElement) {
        countElement.textContent = count + ' Page' + (count !== 1 ? 's' : '');
    }
}

function refreshPages() {
    console.log('Refreshing pages...');
    loadPages();
}

function showLoading(show, message) {
    if (!message) message = 'Loading...';
    const overlay = document.getElementById('fullScreenLoading');
    const text = document.getElementById('loadingText');
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
    }
    if (text) {
        text.textContent = message;
    }
}

function handleCopyLink(event) {
    event.stopPropagation();
    const btn = event.currentTarget;
    const url = btn.dataset.url;
    const pageName = btn.dataset.name;
    
    if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function() {
            showToast('Link copied for ' + pageName, 'success');
        }).catch(function(err) {
            console.error('Failed to copy text: ', err);
            showToast('Failed to copy link. Please try manually.', 'error');
        });
    } else {
        const tempInput = document.createElement('input');
        document.body.appendChild(tempInput);
        tempInput.value = url;
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
        showToast('Link copied for ' + pageName, 'success');
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar && overlay) {
        const isVisible = sidebar.classList.toggle('open');
        overlay.style.display = isVisible ? 'block' : 'none';
    }
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar && overlay) {
        sidebar.classList.remove('open');
        overlay.style.display = 'none';
    }
}

// Search and Filter
const SearchAndFilter = {
    currentSearch: '',
    currentSort: 'createdAtDesc',
    currentStatus: 'all',
    
    applyFilters: function() {
        if (!currentPages || currentPages.length === 0) return;

        let filtered = currentPages.slice();

        const searchTerm = this.currentSearch.toLowerCase();
        if (searchTerm) {
            filtered = filtered.filter(function(page) {
                return (page.brand && page.brand.toLowerCase().indexOf(searchTerm) !== -1) ||
                    (page.description && page.description.toLowerCase().indexOf(searchTerm) !== -1) ||
                    (page.slug && page.slug.toLowerCase().indexOf(searchTerm) !== -1);
            });
        }

        if (this.currentStatus === 'active') {
            filtered = filtered.filter(function(page) { return page.isActive; });
        } else if (this.currentStatus === 'inactive') {
            filtered = filtered.filter(function(page) { return !page.isActive && !page.isDraft; });
        } else if (this.currentStatus === 'draft') {
            filtered = filtered.filter(function(page) { return page.isDraft; });
        }

        switch (this.currentSort) {
            case 'createdAtDesc':
                filtered.sort(function(a, b) { return b.createdAt.getTime() - a.createdAt.getTime(); });
                break;
            case 'createdAtAsc':
                filtered.sort(function(a, b) { return a.createdAt.getTime() - b.createdAt.getTime(); });
                break;
            case 'viewsDesc':
                filtered.sort(function(a, b) { return (b.viewCount || 0) - (a.viewCount || 0); });
                break;
            case 'subsDesc':
                filtered.sort(function(a, b) { return (b.subscriptionCount || 0) - (a.subscriptionCount || 0); });
                break;
            case 'revenueDesc':
                filtered.sort(function(a, b) { return (b.revenue || 0) - (a.revenue || 0); });
                break;
            case 'nameAsc':
                filtered.sort(function(a, b) { return (a.brand || '').localeCompare(b.brand || ''); });
                break;
        }

        displayPages(filtered);
    },

    searchPages: function(term) {
        this.currentSearch = term;
        this.applyFilters();
    },

    applySortFilter: function(value) {
        this.currentSort = value;
        this.applyFilters();
    },

    applyStatusFilter: function(value) {
        this.currentStatus = value;
        this.applyFilters();
    },
    
    filterLanguages: function(term) {
        const lowerTerm = term.toLowerCase();
        const options = document.querySelectorAll('.language-option');
        options.forEach(function(option) {
            const name = option.querySelector('.option-name').textContent.toLowerCase();
            const native = option.querySelector('.option-native').textContent.toLowerCase();
            option.style.display = (name.indexOf(lowerTerm) !== -1 || native.indexOf(lowerTerm) !== -1) ? 'flex' : 'none';
        });
    },
    
    filterCurrencies: function(term) {
        const lowerTerm = term.toLowerCase();
        const options = document.querySelectorAll('.currency-option');
        options.forEach(function(option) {
            const name = option.querySelector('.option-name').textContent.toLowerCase();
            const code = option.querySelector('.option-code').textContent.toLowerCase();
            option.style.display = (name.indexOf(lowerTerm) !== -1 || code.indexOf(lowerTerm) !== -1) ? 'flex' : 'none';
        });
    },
    
    filterUpdateLanguages: function(term) {
        const lowerTerm = term.toLowerCase();
        const options = document.querySelectorAll('.language-update-option');
        options.forEach(function(option) {
            const name = option.querySelector('.option-name').textContent.toLowerCase();
            const native = option.querySelector('.option-native').textContent.toLowerCase();
            option.style.display = (name.indexOf(lowerTerm) !== -1 || native.indexOf(lowerTerm) !== -1) ? 'flex' : 'none';
        });
    },
    
    filterUpdateCurrencies: function(term) {
        const lowerTerm = term.toLowerCase();
        const options = document.querySelectorAll('.currency-update-option');
        options.forEach(function(option) {
            const name = option.querySelector('.option-name').textContent.toLowerCase();
            const code = option.querySelector('.option-code').textContent.toLowerCase();
            option.style.display = (name.indexOf(lowerTerm) !== -1 || code.indexOf(lowerTerm) !== -1) ? 'flex' : 'none';
        });
    }
};

function searchPages(term) {
    SearchAndFilter.searchPages(term);
}

function applySortFilter(value) {
    SearchAndFilter.applySortFilter(value);
}

function applyStatusFilter(value) {
    SearchAndFilter.applyStatusFilter(value);
}

// Toast Notifications
function showToast(message, type) {
    if (!type) type = 'info';
    
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const existingToasts = container.querySelectorAll('.toast');
    if (existingToasts.length >= 3) {
        existingToasts[0].remove();
    }
    
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    const icon = document.createElement('i');
    icon.className = 'fas ' + (icons[type] || icons.info);
    toast.appendChild(icon);
    
    const content = document.createElement('span');
    content.className = 'toast-content';
    content.textContent = message;
    toast.appendChild(content);
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    const closeIcon = document.createElement('i');
    closeIcon.className = 'fas fa-times';
    closeBtn.appendChild(closeIcon);
    
    // CSP SAFE: addEventListener
    closeBtn.addEventListener('click', function() {
        toast.remove();
    });
    
    toast.appendChild(closeBtn);
    container.appendChild(toast);
    
    setTimeout(function() {
        toast.classList.add('show');
    }, 10);
    
    setTimeout(function() {
        if (toast.parentNode) {
            toast.classList.remove('show');
            setTimeout(function() {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 300);
        }
    }, 5000);
}

// Initialization
function initializeFilters() {
    SearchAndFilter.applyFilters();
}

function initializeModals() {
    if (document.getElementById('languageModal')) {
        populateLanguages();
    }
    if (document.getElementById('currencyModal')) {
        populateCurrencies();
    }
}