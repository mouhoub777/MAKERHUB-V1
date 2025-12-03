// avis.js - Gestion des avis clients avec Firebase - VERSION CORRIGÉE
// MAKERHUB Reviews Manager v2.1
console.log('MAKERHUB Reviews Manager v2.1 initialized');

// Variables globales
let reviews = [];
let currentRating = 5;
let reviewToDelete = null;
let currentPageId = null;
let auth = null;
let db = null;
let storage = null;
let isInitialized = false;
let cachedData = null;
let isDataLoaded = false;

// Cache management
const CACHE_KEY_PREFIX = 'makerhub_reviews_cache_';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// ==================== FONCTIONS UTILITAIRES (exposées globalement) ====================

// Afficher/masquer l'overlay de chargement
function showLoadingOverlay(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        if (show) {
            overlay.classList.add('active');
        } else {
            overlay.classList.remove('active');
        }
    }
}

// Afficher une notification
function showNotification(message, type) {
    type = type || 'info';
    const notification = document.getElementById('notification');
    if (!notification) return;
    
    notification.className = 'notification ' + type;
    notification.textContent = message;
    notification.style.display = 'block';
    
    setTimeout(function() {
        notification.style.display = 'none';
    }, 3000);
}

// Réinitialiser le formulaire
function resetForm() {
    const form = document.getElementById('reviewForm');
    if (form) {
        form.reset();
        setRating(5);
    }
}

// Afficher l'état vide
function showEmptyState() {
    const emptyState = document.getElementById('emptyState');
    const reviewsList = document.getElementById('reviewsList');
    
    if (emptyState) emptyState.style.display = 'flex';
    if (reviewsList) reviewsList.style.display = 'none';
}

// Cacher l'état vide
function hideEmptyState() {
    const emptyState = document.getElementById('emptyState');
    const reviewsList = document.getElementById('reviewsList');
    
    if (emptyState) emptyState.style.display = 'none';
    if (reviewsList) reviewsList.style.display = 'block';
}

// Cacher le skeleton loader
function hideSkeletonLoader() {
    const skeletonLoader = document.getElementById('skeletonLoader');
    const reviewsList = document.getElementById('reviewsList');
    
    if (skeletonLoader) {
        skeletonLoader.classList.remove('active');
        skeletonLoader.style.display = 'none';
    }
    
    if (reviewsList) {
        reviewsList.style.display = 'block';
    }
}

// Calculer la moyenne des notes
function calculateAverageRating() {
    if (reviews.length === 0) return 0;
    const sum = reviews.reduce(function(acc, review) { return acc + review.rating; }, 0);
    return sum / reviews.length;
}

// Générer les étoiles HTML
function generateStars(rating) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        stars += '<span class="star ' + (i <= rating ? 'filled' : '') + '">★</span>';
    }
    return stars;
}

// Formater la date
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
        return "Today";
    } else if (diffDays === 1) {
        return "Yesterday";
    } else if (diffDays < 7) {
        return diffDays + ' days ago';
    } else if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return weeks + ' week' + (weeks > 1 ? 's' : '') + ' ago';
    } else if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return months + ' month' + (months > 1 ? 's' : '') + ' ago';
    } else {
        const years = Math.floor(diffDays / 365);
        return years + ' year' + (years > 1 ? 's' : '') + ' ago';
    }
}

// Échapper le HTML
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, function(m) { return map[m]; });
}

// Sauvegarder dans le cache
function saveToCache(data) {
    const cacheKey = CACHE_KEY_PREFIX + currentPageId;
    const cacheData = {
        data: data,
        timestamp: Date.now()
    };
    
    try {
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        console.log('✅ Data saved to cache');
    } catch (e) {
        console.error('Cache save error:', e);
        cleanOldCache();
        try {
            localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        } catch (e2) {
            console.error('Cache save failed after cleanup:', e2);
        }
    }
}

// Nettoyer le cache ancien
function cleanOldCache() {
    const cachePrefix = CACHE_KEY_PREFIX;
    const maxAge = 24 * 60 * 60 * 1000; // 24 heures
    
    Object.keys(localStorage).forEach(function(key) {
        if (key.startsWith(cachePrefix)) {
            try {
                const cached = JSON.parse(localStorage.getItem(key));
                if (cached && cached.timestamp && (Date.now() - cached.timestamp > maxAge)) {
                    localStorage.removeItem(key);
                    console.log('Removed old cache:', key);
                }
            } catch (e) {
                localStorage.removeItem(key);
            }
        }
    });
}

// ==================== FONCTIONS DE NOTATION ====================

function setRating(rating) {
    currentRating = rating;
    const ratingInput = document.getElementById('rating');
    if (ratingInput) {
        ratingInput.value = rating;
    }
    highlightStars(rating);
}

function highlightStars(rating) {
    const stars = document.querySelectorAll('.star-rating .star');
    stars.forEach(function(star, index) {
        if (index < rating) {
            star.classList.add('active');
        } else {
            star.classList.remove('active');
        }
    });
}

function initializeStarRating() {
    const stars = document.querySelectorAll('.star-rating .star');
    
    stars.forEach(function(star) {
        star.addEventListener('click', function() {
            const rating = parseInt(this.getAttribute('data-rating'));
            setRating(rating);
        });
        
        star.addEventListener('mouseenter', function() {
            const rating = parseInt(this.getAttribute('data-rating'));
            highlightStars(rating);
        });
    });
    
    const starContainer = document.querySelector('.star-rating');
    if (starContainer) {
        starContainer.addEventListener('mouseleave', function() {
            highlightStars(currentRating);
        });
    }
    
    // Définir la note par défaut
    setRating(5);
}

// ==================== AFFICHAGE DES AVIS ====================

function displayReviews() {
    const reviewsList = document.getElementById('reviewsList');
    const emptyState = document.getElementById('emptyState');
    
    if (!reviewsList) {
        console.error('reviewsList element not found');
        return;
    }
    
    console.log('📊 Displaying', reviews.length, 'reviews');
    
    if (reviews.length === 0) {
        showEmptyState();
        return;
    }
    
    hideEmptyState();
    
    // Générer le HTML pour chaque avis
    let html = '';
    reviews.forEach(function(review, index) {
        const stars = generateStars(review.rating);
        const date = formatDate(review.date);
        
        // Générer une couleur de fond aléatoire pour l'avatar
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dfe6e9', '#a29bfe', '#fd79a8'];
        const bgColor = colors[index % colors.length];
        const initials = (review.customerName || 'U').charAt(0).toUpperCase();
        
        html += '<div class="review-card" data-index="' + index + '">' +
            '<div class="review-content">' +
                '<div class="reviewer-avatar" style="background-color: ' + bgColor + ';">' +
                    '<span style="color: white; font-weight: bold;">' + initials + '</span>' +
                '</div>' +
                '<div class="review-body">' +
                    '<div class="review-header">' +
                        '<h4 class="reviewer-name">' + escapeHtml(review.customerName || 'Anonymous') + '</h4>' +
                        '<div class="review-rating">' + stars + '</div>' +
                        '<button class="delete-btn" onclick="deleteReview(' + index + ')" title="Delete review">' +
                            '<i class="fas fa-trash"></i>' +
                        '</button>' +
                    '</div>' +
                    '<span class="review-date">' + date + '</span>' +
                    '<p class="review-comment">' + escapeHtml(review.comment || '') + '</p>' +
                '</div>' +
            '</div>' +
        '</div>';
    });
    
    reviewsList.innerHTML = html;
    console.log('✅ Reviews displayed successfully');
}

function updateRatingSummary() {
    const summaryContainer = document.getElementById('ratingSummary');
    if (!summaryContainer) return;
    
    const avgRating = calculateAverageRating();
    const totalReviews = reviews.length;
    const displayRating = avgRating > 0 ? avgRating.toFixed(1) : '0.0';
    
    let starsHTML = '';
    for (let i = 1; i <= 5; i++) {
        starsHTML += '<span class="star ' + (i <= Math.round(avgRating) ? 'filled' : '') + '">★</span>';
    }
    starsHTML += '<span class="rating-text">' + displayRating + ' (' + totalReviews + ')</span>';
    summaryContainer.innerHTML = starsHTML;
}

// ==================== GESTION DES AVIS ====================

// Gérer la soumission du formulaire
async function handleSubmit(event) {
    event.preventDefault();
    
    if (!auth || !auth.currentUser) {
        showNotification('You must be logged in', 'error');
        return;
    }
    
    const formData = new FormData(event.target);
    const customerName = formData.get('customerName');
    const comment = formData.get('comment');
    const rating = parseInt(formData.get('rating')) || currentRating;
    
    // Validation
    if (!customerName || !customerName.trim()) {
        showNotification('Please enter a customer name', 'error');
        return;
    }
    
    if (!comment || !comment.trim()) {
        showNotification('Please enter a review comment', 'error');
        return;
    }
    
    const review = {
        customerName: customerName.trim(),
        rating: rating,
        comment: comment.trim(),
        date: new Date().toISOString(),
        userId: auth.currentUser.uid
    };
    
    console.log('📝 Adding new review:', review);
    
    try {
        showLoadingOverlay(true);
        
        // Ajouter l'avis au tableau
        reviews.push(review);
        
        // Mettre à jour le cache immédiatement
        saveToCache({
            reviews: reviews,
            globalRating: calculateAverageRating().toFixed(1),
            totalReviews: reviews.length
        });
        
        // Réinitialiser le formulaire
        resetForm();
        
        // Rafraîchir l'affichage IMMÉDIATEMENT
        displayReviews();
        updateRatingSummary();
        
        showNotification('Review added successfully!', 'success');
        console.log('✅ Review added, total:', reviews.length);
        
    } catch (error) {
        console.error('Error adding review:', error);
        // Retirer l'avis en cas d'erreur
        reviews.pop();
        showNotification('Error adding review', 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

// Sauvegarder les avis dans Firebase
async function saveReviews() {
    if (!db || !currentPageId) {
        throw new Error('Firebase or page ID not available');
    }
    
    console.log('💾 Saving', reviews.length, 'reviews to Firebase...');
    
    // Calculer les statistiques
    const avgRating = calculateAverageRating();
    const totalReviews = reviews.length;
    
    // Mettre à jour le document de la page
    await db.collection('landingPages').doc(currentPageId).update({
        reviews: reviews,
        globalRating: avgRating.toFixed(1),
        totalReviews: totalReviews,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Reviews saved to Firebase');
    
    // Mettre à jour le cache
    const reviewsData = {
        reviews: reviews,
        globalRating: avgRating.toFixed(1),
        totalReviews: totalReviews
    };
    
    saveToCache(reviewsData);
    
    // Sauvegarder aussi dans localStorage pour l'affichage sur la landing page
    localStorage.setItem('makerhub_reviews_' + currentPageId, JSON.stringify(reviewsData));
}

// Supprimer un avis
function deleteReview(index) {
    reviewToDelete = index;
    const modal = document.getElementById('deleteModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeDeleteModal() {
    const modal = document.getElementById('deleteModal');
    if (modal) {
        modal.style.display = 'none';
    }
    reviewToDelete = null;
}

async function confirmDelete() {
    if (reviewToDelete === null) return;
    
    try {
        showLoadingOverlay(true);
        
        // Supprimer l'avis du tableau
        reviews.splice(reviewToDelete, 1);
        
        // Mettre à jour le cache
        saveToCache({
            reviews: reviews,
            globalRating: calculateAverageRating().toFixed(1),
            totalReviews: reviews.length
        });
        
        // Rafraîchir l'affichage
        displayReviews();
        updateRatingSummary();
        
        showNotification('Review deleted successfully', 'success');
        
    } catch (error) {
        console.error('Error deleting review:', error);
        showNotification('Error deleting review', 'error');
    } finally {
        closeDeleteModal();
        showLoadingOverlay(false);
    }
}

// Trier les avis
function sortReviews(sortBy) {
    switch(sortBy) {
        case 'recent':
            reviews.sort(function(a, b) { return new Date(b.date) - new Date(a.date); });
            break;
        case 'oldest':
            reviews.sort(function(a, b) { return new Date(a.date) - new Date(b.date); });
            break;
        case 'highest':
            reviews.sort(function(a, b) { return b.rating - a.rating; });
            break;
        case 'lowest':
            reviews.sort(function(a, b) { return a.rating - b.rating; });
            break;
    }
    
    displayReviews();
}

// ==================== CHARGEMENT DES DONNÉES ====================

// Charger les avis depuis Firebase
async function loadReviews() {
    try {
        if (!cachedData) {
            showLoadingOverlay(true);
        }
        
        if (!db || !currentPageId) {
            console.error('Firebase or page ID not available');
            showEmptyState();
            hideSkeletonLoader();
            return;
        }
        
        console.log('📥 Loading reviews for page:', currentPageId);
        
        // Charger les données de la page
        const pageDoc = await db.collection('landingPages').doc(currentPageId).get();
        
        if (!pageDoc.exists) {
            console.error('Page not found');
            showNotification('Page not found', 'error');
            hideSkeletonLoader();
            return;
        }
        
        const pageData = pageDoc.data();
        console.log('✅ Page found:', pageData.brand || pageData.slug);
        
        // Afficher info du canal si existant
        if (pageData.telegram && pageData.telegram.channelLink) {
            console.log('Canal existant:', {
                channelName: pageData.telegram.channelName,
                channelLink: pageData.telegram.channelLink,
                connectedAt: pageData.telegram.connectedAt
            });
        }
        
        // Récupérer les avis depuis le champ reviews du document
        reviews = pageData.reviews || [];
        
        console.log('📊 Loaded reviews:', reviews.length);
        
        // Sauvegarder dans le cache
        saveToCache({
            reviews: reviews,
            globalRating: calculateAverageRating().toFixed(1),
            totalReviews: reviews.length
        });
        
        // Afficher les avis
        displayReviews();
        
        // Mettre à jour le résumé des étoiles
        updateRatingSummary();
        
        // Cacher le skeleton loader
        hideSkeletonLoader();
        
    } catch (error) {
        console.error('Error loading reviews:', error);
        showNotification('Error loading reviews', 'error');
        showEmptyState();
        hideSkeletonLoader();
    } finally {
        showLoadingOverlay(false);
    }
}

// Afficher les données cachées immédiatement
function showCachedDataIfAvailable() {
    if (window.preloadedReviews) {
        console.log('Using preloaded reviews from window');
        reviews = window.preloadedReviews;
        displayReviews();
        updateRatingSummary();
        hideSkeletonLoader();
        cachedData = { reviews: reviews };
        return;
    }
    
    const cacheKey = CACHE_KEY_PREFIX + currentPageId;
    const cached = localStorage.getItem(cacheKey);
    
    if (cached) {
        try {
            const parsedCache = JSON.parse(cached);
            const data = parsedCache.data;
            const timestamp = parsedCache.timestamp;
            const age = Date.now() - timestamp;
            
            if (age < CACHE_DURATION && data) {
                console.log('Loading from cache...');
                cachedData = data;
                reviews = data.reviews || [];
                
                displayReviews();
                updateRatingSummary();
                hideSkeletonLoader();
            }
        } catch (e) {
            console.error('Cache parse error:', e);
        }
    }
}

// ==================== INITIALISATION FIREBASE ====================

async function initializeFirebaseAsync() {
    let attempts = 0;
    const maxAttempts = 50; // 5 secondes max
    
    const checkFirebase = setInterval(function() {
        attempts++;
        
        if (window.firebaseServices || window.firebaseAuth || (typeof firebase !== 'undefined')) {
            clearInterval(checkFirebase);
            initializeFirebaseServices();
        } else if (attempts >= maxAttempts) {
            clearInterval(checkFirebase);
            console.error('Firebase services not available after timeout');
            showNotification('Firebase connection error', 'error');
            hideSkeletonLoader();
        }
    }, 100);
}

function initializeFirebaseServices() {
    console.log('🔥 Initializing Firebase references...');
    
    if (window.firebaseServices) {
        auth = window.firebaseServices.auth;
        db = window.firebaseServices.db;
        storage = window.firebaseServices.storage;
        console.log('Firebase services loaded from window.firebaseServices');
    } else if (window.firebaseAuth && window.firebaseDb) {
        auth = window.firebaseAuth;
        db = window.firebaseDb;
        storage = window.firebaseStorage;
        console.log('Firebase services loaded from window globals');
    } else if (typeof firebase !== 'undefined' && firebase.auth && firebase.firestore) {
        auth = firebase.auth();
        db = firebase.firestore();
        storage = firebase.storage && firebase.storage();
        console.log('Firebase services loaded from firebase global');
    } else {
        console.error('Firebase services not available');
        showNotification('Firebase connection error', 'error');
        hideSkeletonLoader();
        return;
    }
    
    // Vérifier l'authentification
    auth.onAuthStateChanged(function(user) {
        if (user) {
            console.log('👤 User authenticated:', user.email);
            if (!isInitialized) {
                isInitialized = true;
                initializeReviews();
            }
        } else {
            console.log('❌ User not authenticated, redirecting...');
            window.location.href = '/auth.html';
        }
    });
}

// Initialiser le système d'avis
function initializeReviews() {
    console.log('📝 Initializing form + buttons');
    
    // Initialiser les étoiles
    initializeStarRating();
    
    // Charger les données
    if (!isDataLoaded && !cachedData) {
        isDataLoaded = true;
        loadReviews().catch(function(error) {
            console.error('Error loading reviews:', error);
            showNotification('Error loading reviews', 'error');
        });
    }
    
    // Initialiser le formulaire
    const reviewForm = document.getElementById('reviewForm');
    if (reviewForm) {
        reviewForm.addEventListener('submit', handleSubmit);
    }
    
    // Initialiser le filtre de tri
    const sortFilter = document.getElementById('sortFilter');
    if (sortFilter) {
        sortFilter.addEventListener('change', function() {
            sortReviews(this.value);
        });
    }
    
    // Initialiser le bouton reset
    const resetBtn = document.getElementById('resetFormBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetForm);
    }
    
    // Initialiser les boutons du modal de suppression
    const closeModalBtn = document.getElementById('closeModalBtn');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeDeleteModal);
    }
    
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', confirmDelete);
    }
}

// ==================== POINT D'ENTRÉE ====================

document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM loaded, initializing channel manager...');
    
    // Récupérer l'ID de la page depuis l'URL ou le localStorage
    const urlParams = new URLSearchParams(window.location.search);
    currentPageId = urlParams.get('page') || 
                    sessionStorage.getItem('currentLandingPageId') || 
                    localStorage.getItem('currentLandingPageId');
    
    if (!currentPageId) {
        showNotification('No page selected', 'error');
        hideSkeletonLoader();
        setTimeout(function() {
            window.location.href = '/telegramsubscription.html';
        }, 2000);
        return;
    }
    
    console.log('✅ Page ID:', currentPageId);
    
    // Afficher immédiatement les données du cache si disponibles
    showCachedDataIfAvailable();
    
    // Initialisation Firebase asynchrone
    initializeFirebaseAsync();
});

// Nettoyer le cache ancien au démarrage
cleanOldCache();

// ==================== EXPORT DES FONCTIONS POUR LE HTML ====================
// IMPORTANT: Ces exports doivent être APRÈS les définitions des fonctions

window.deleteReview = deleteReview;
window.closeDeleteModal = closeDeleteModal;
window.confirmDelete = confirmDelete;
window.resetForm = resetForm;
window.reviews = reviews;
window.saveReviews = saveReviews;
window.showLoadingOverlay = showLoadingOverlay;
window.showNotification = showNotification;
window.displayReviews = displayReviews;
window.updateRatingSummary = updateRatingSummary;
window.sortReviews = sortReviews;

console.log('✅ avis.js functions exported to window');