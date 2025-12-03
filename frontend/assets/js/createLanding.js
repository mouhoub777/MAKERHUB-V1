// createLanding.js - MAKERHUB.PRO Landing Page Creator JavaScript
// VERSION SANS DESIGN TEMPLATES - Template blanc par défaut
'use strict';

// ✅ FONCTION DE COMPRESSION D'IMAGE
function compressImage(file, maxWidth, maxHeight, quality) {
    return new Promise(function(resolve, reject) {
        // Si c'est une vidéo, ne pas compresser
        if (file.type.startsWith('video/')) {
            resolve(file);
            return;
        }
        
        // Si ce n'est pas une image, retourner tel quel
        if (!file.type.startsWith('image/')) {
            resolve(file);
            return;
        }
        
        var reader = new FileReader();
        reader.onload = function(e) {
            var img = new Image();
            img.onload = function() {
                var canvas = document.createElement('canvas');
                var ctx = canvas.getContext('2d');
                
                var width = img.width;
                var height = img.height;
                
                // Calculer les nouvelles dimensions
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                if (height > maxHeight) {
                    width = Math.round((width * maxHeight) / height);
                    height = maxHeight;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // Dessiner l'image redimensionnée
                ctx.drawImage(img, 0, 0, width, height);
                
                // Convertir en blob
                canvas.toBlob(function(blob) {
                    if (blob) {
                        // Créer un nouveau fichier avec le blob compressé
                        var compressedFile = new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        });
                        console.log('🗜️ Image compressée: ' + (file.size / 1024).toFixed(0) + 'KB → ' + (compressedFile.size / 1024).toFixed(0) + 'KB');
                        resolve(compressedFile);
                    } else {
                        resolve(file);
                    }
                }, 'image/jpeg', quality);
            };
            img.onerror = function() {
                resolve(file);
            };
            img.src = e.target.result;
        };
        reader.onerror = function() {
            resolve(file);
        };
        reader.readAsDataURL(file);
    });
}

// Template par défaut: white-minimal (fond blanc)
let selectedTemplate = 'white-minimal';
let selectedBorderColor = '#000000';
let selectedFont = 'inter';
let descriptionBackgroundEnabled = false;
let backgroundOpacity = 30;
let logoShape = 'circle';
let logoFile = null;
let mediaItems = [];
let textFormatting = {
    brand: { bold: false, italic: false },
    slogan: { bold: false, italic: false },
    description: { bold: false, italic: false }
};

let logoHandlersBound = false;
let isFileDialogOpen = false;

// Couleurs du template par défaut (blanc)
const defaultTemplateColors = {
    bg: '#ffffff',
    text: '#1a1a1a',
    accent: '#000000'
};

const fontFamilies = {
    'inter': "'Inter', sans-serif",
    'poppins': "'Poppins', sans-serif",
    'montserrat': "'Montserrat', sans-serif",
    'playfair': "'Playfair Display', serif",
    'work-sans': "'Work Sans', sans-serif",
    'merriweather': "'Merriweather', serif",
    'nunito': "'Nunito', sans-serif",
    'dm-sans': "'DM Sans', sans-serif"
};

// ✅ 13 LANGUES SUPPORTÉES PAR DEEPL (supprimé: NO, HI, NL, SV, DA, FI)
const SUPPORTED_LANGUAGES = ['en', 'fr', 'es', 'de', 'pt', 'it', 'pl', 'ru', 'ja', 'zh', 'ko', 'ar', 'tr'];

const createLandingApp = {
    init: function() {
        if (typeof firebase === 'undefined') {
            setTimeout(() => this.init(), 500);
            return;
        }
        
        if (!window.firebaseAuth || !window.firebaseDb || !window.firebaseStorage) {
            setTimeout(() => this.init(), 500);
            return;
        }
        
        window.firebaseAuth.onAuthStateChanged(user => {
            if (!user) window.location.href = '/auth.html';
        });
        
        const reviewsSection = document.getElementById('previewReviewsSection');
        if (reviewsSection) reviewsSection.style.display = 'none';
        
        const logoContainer = document.querySelector('.logo-container');
        if (logoContainer) logoContainer.style.display = 'none';
        
        this.attachEventListeners();
        this.attachInputListeners();
        
        const urlParams = new URLSearchParams(window.location.search);
        const isEditMode = urlParams.get('edit') === 'true';
        const pageSlug = urlParams.get('page');
        
        // Appliquer le template par défaut (blanc)
        if (!isEditMode) {
            selectedBorderColor = '#000000';
            selectedTemplate = 'white-minimal';
            this.applyDefaultTemplate();
            this.forceBlackColor();
            this.loadReviews();
        }
        
        // Charger les données existantes si on est en mode edit
        if (isEditMode && pageSlug) {
            this.loadExistingPage(pageSlug);
        } else {
            this.checkIfReturningFromPrices();
            this.updatePreview();
        }
    },
    
    // Appliquer le template blanc par défaut
    applyDefaultTemplate: function() {
        var previewContent = document.getElementById('previewContent');
        if (previewContent) {
            previewContent.style.background = defaultTemplateColors.bg;
            previewContent.style.color = defaultTemplateColors.text;
            var banner = document.getElementById('prevBanner');
            if (banner) banner.style.background = 'transparent';
        }
    },
    
    forceBlackColor: function() {
        selectedBorderColor = '#000000';
        const preview = document.getElementById('colorPreview');
        const nameElement = document.getElementById('colorName');
        const valueElement = document.getElementById('colorValue');
        
        if (preview) preview.style.background = '#000000';
        if (nameElement) nameElement.textContent = 'Black';
        if (valueElement) valueElement.textContent = '#000000';
        
        document.querySelectorAll('.mini-color-circle').forEach(circle => circle.classList.remove('selected'));
        
        const blackCircle = document.querySelector('.mini-color-circle[data-color="#000000"]');
        if (blackCircle) blackCircle.classList.add('selected');
        
        const paymentBtn = document.getElementById('previewPaymentBtn');
        if (paymentBtn) {
            paymentBtn.style.background = 'transparent';
            paymentBtn.style.border = '2px solid #000000';
            paymentBtn.style.color = '#000000';
            paymentBtn.style.boxShadow = 'none';
            paymentBtn.style.outline = 'none';
        }
        
        const lockIcon = document.querySelector('.access-panel .fa-lock');
        if (lockIcon) lockIcon.style.color = '#000000';
        
        const accessPanel = document.querySelector('.access-panel');
        if (accessPanel) accessPanel.style.borderColor = '#000000';
    },
    
    // ✅ CHARGER UNE PAGE EXISTANTE EN MODE EDIT
    loadExistingPage: async function(pageSlug) {
        try {
            console.log('📝 Chargement de la page:', pageSlug);
            
            var self = this;
            var pageDoc = await window.firebaseDb.collection('landingPages').doc(pageSlug).get();
            
            if (!pageDoc.exists) {
                this.showError('Page non trouvée: ' + pageSlug);
                return;
            }
            
            var data = pageDoc.data();
            console.log('✅ Données chargées:', data);
            console.log('🎨 Couleur dans Firebase:', data.borderColor);
            
            // Remplir le formulaire
            if (data.channelName) document.getElementById('channelName').value = data.channelName;
            if (data.brand) document.getElementById('brand').value = data.brand;
            if (data.banner) document.getElementById('banner').value = data.banner;
            if (data.slogan) document.getElementById('slogan').value = data.slogan;
            if (data.description) document.getElementById('description').value = data.description;
            if (data.buttonText) document.getElementById('buttonText').value = data.buttonText;
            if (data.buttonEmoji) document.getElementById('buttonEmoji').value = data.buttonEmoji;
            if (data.accessEmoji) document.getElementById('accessEmoji').value = data.accessEmoji;
            
            // Appliquer le template par défaut
            selectedTemplate = 'white-minimal';
            this.applyDefaultTemplate();
            
            // Couleur de bordure
            var colorToUse = data.borderColor || data.color || '#000000';
            console.log('🎨 Couleur à appliquer:', colorToUse);
            
            // FORCER la couleur globale
            selectedBorderColor = colorToUse;
            window.selectedBorderColor = colorToUse; // Backup global
            
            // Mettre à jour l'aperçu du sélecteur de couleur
            var preview = document.getElementById('colorPreview');
            var nameElement = document.getElementById('colorName');
            var valueElement = document.getElementById('colorValue');
            if (preview) {
                preview.style.backgroundColor = colorToUse;
                console.log('🎨 Preview sélecteur mis à jour');
            }
            if (nameElement) nameElement.textContent = 'Custom';
            if (valueElement) valueElement.textContent = colorToUse.toUpperCase();
            
            // APPLIQUER IMMÉDIATEMENT sur les éléments de preview
            var paymentBtn = document.getElementById('previewPaymentBtn');
            var accessPanel = document.querySelector('.access-panel');
            var lockIcon = document.querySelector('.access-panel .fa-lock');
            
            if (paymentBtn) {
                paymentBtn.style.backgroundColor = colorToUse;
                paymentBtn.style.background = colorToUse;
                console.log('🎨 Bouton coloré:', colorToUse);
            }
            if (accessPanel) {
                accessPanel.style.borderColor = colorToUse;
                console.log('🎨 Panel bordure colorée');
            }
            if (lockIcon) {
                lockIcon.style.color = colorToUse;
            }
            
            // Font
            if (data.font) {
                selectedFont = data.font;
                var fontSelector = document.getElementById('fontSelector');
                if (fontSelector) fontSelector.value = data.font;
            }
            
            // Logo shape
            if (data.logoShape) {
                logoShape = data.logoShape;
                this.selectLogoShape(data.logoShape);
            }
            
            // Logo URL (afficher dans la preview)
            if (data.logoUrl) {
                var logoContainer = document.querySelector('.logo-container');
                var logoImg = document.getElementById('logoImg');
                if (logoContainer && logoImg) {
                    logoContainer.style.display = 'block';
                    logoImg.src = data.logoUrl;
                    logoImg.style.display = 'block';
                    if (data.logoShape === 'square') logoImg.classList.add('square');
                }
            }
            
            // Description background
            if (data.descriptionBackgroundEnabled) {
                descriptionBackgroundEnabled = true;
                var toggle = document.getElementById('descBackgroundToggle');
                var opacityControl = document.getElementById('backgroundOpacityControl');
                if (toggle) toggle.classList.add('active');
                if (opacityControl) opacityControl.style.display = 'block';
            }
            
            // Background opacity
            if (data.backgroundOpacity) {
                backgroundOpacity = data.backgroundOpacity;
                var opacitySlider = document.getElementById('opacitySlider');
                var opacityValue = document.getElementById('opacityValue');
                if (opacitySlider) opacitySlider.value = data.backgroundOpacity;
                if (opacityValue) opacityValue.textContent = data.backgroundOpacity + '%';
            }
            
            // Text formatting
            if (data.textFormatting) {
                textFormatting = data.textFormatting;
                Object.keys(textFormatting).forEach(function(field) {
                    Object.keys(textFormatting[field]).forEach(function(format) {
                        if (textFormatting[field][format]) {
                            var btnId = field + format.charAt(0).toUpperCase() + format.slice(1) + 'Btn';
                            var btn = document.getElementById(btnId);
                            if (btn) btn.classList.add('active');
                        }
                    });
                });
            }
            
            // Media gallery (afficher les images existantes)
            if (data.media && data.media.length > 0) {
                var gallery = document.getElementById('mediaGallery');
                if (gallery) {
                    gallery.style.display = 'flex';
                    gallery.style.flexDirection = 'column';
                    gallery.style.alignItems = 'center';
                    gallery.style.gap = '15px';
                    gallery.innerHTML = data.media.map(function(item) {
                        if (item.type === 'video') {
                            return '<video src="' + item.url + '" controls style="width: 90%; max-width: 90%; border-radius: 8px;"></video>';
                        } else {
                            return '<img src="' + item.url + '" alt="' + (item.name || 'Media') + '" style="width: 90%; max-width: 90%; border-radius: 8px;">';
                        }
                    }).join('');
                }
            }
            
            // Changer le texte du bouton
            var createBtn = document.getElementById('createPageBtn');
            if (createBtn) {
                createBtn.innerHTML = '<i class="fas fa-save"></i> Update Page';
            }
            
            // Stocker la couleur avant updatePreview
            var colorBeforeUpdate = selectedBorderColor;
            console.log('🎨 Couleur AVANT updatePreview:', colorBeforeUpdate);
            
            // Mettre à jour la preview
            this.updatePreview();
            
            console.log('🎨 Couleur APRÈS updatePreview:', selectedBorderColor);
            
            // Forcer l'application de la couleur sur le bouton (plusieurs fois pour être sûr)
            var self = this;
            var applyColor = function() {
                var colorToApply = colorBeforeUpdate; // Utiliser la couleur sauvegardée
                console.log('🎨 Application forcée de la couleur:', colorToApply);
                
                var paymentBtn = document.getElementById('previewPaymentBtn');
                var accessPanel = document.querySelector('.access-panel');
                var lockIcon = document.querySelector('.access-panel .fa-lock');
                
                if (paymentBtn) {
                    paymentBtn.style.setProperty('background', colorToApply, 'important');
                    paymentBtn.style.setProperty('background-color', colorToApply, 'important');
                    paymentBtn.style.boxShadow = 'none';
                    console.log('✅ Bouton mis à jour avec:', colorToApply);
                    // Ajuster la couleur du texte selon la luminosité
                    var rgb = self.hexToRgb(colorToApply);
                    if (rgb) {
                        var luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
                        paymentBtn.style.color = luminance > 0.5 ? '#000000' : '#ffffff';
                    }
                } else {
                    console.log('❌ Bouton non trouvé!');
                }
                if (accessPanel) accessPanel.style.borderColor = colorToApply;
                if (lockIcon) lockIcon.style.color = colorToApply;
                
                // Restaurer la variable globale
                selectedBorderColor = colorToApply;
            };
            
            // Appliquer immédiatement et après délais
            applyColor();
            setTimeout(applyColor, 100);
            setTimeout(applyColor, 300);
            setTimeout(applyColor, 500);
            
            console.log('✅ Page chargée avec succès!');
            
        } catch (error) {
            console.error('❌ Erreur chargement page:', error);
            this.showError('Erreur: ' + error.message);
        }
    },
    
    checkIfReturningFromPrices: function() {
        const urlParams = new URLSearchParams(window.location.search);
        const fromPrices = urlParams.get('fromPrices');
        const pageSlug = urlParams.get('page');
        
        if (fromPrices === 'true' && pageSlug) {
            const tempData = sessionStorage.getItem('makerhub_temp_landing_data');
            if (tempData) {
                try {
                    const data = JSON.parse(tempData);
                    if (data.channelName) document.getElementById('channelName').value = data.channelName;
                    if (data.brand) document.getElementById('brand').value = data.brand;
                    if (data.banner) document.getElementById('banner').value = data.banner;
                    if (data.slogan) document.getElementById('slogan').value = data.slogan;
                    if (data.description) document.getElementById('description').value = data.description;
                    if (data.accessEmoji) document.getElementById('accessEmoji').value = data.accessEmoji;
                    if (data.buttonText) document.getElementById('buttonText').value = data.buttonText;
                    if (data.buttonEmoji) document.getElementById('buttonEmoji').value = data.buttonEmoji;
                    if (data.borderColor) {
                        selectedBorderColor = data.borderColor;
                        this.selectColor(data.borderColor, 'Custom');
                    }
                    if (data.font) {
                        selectedFont = data.font;
                        document.getElementById('fontSelector').value = data.font;
                        this.updateFont();
                    }
                    if (data.logoShape) {
                        logoShape = data.logoShape;
                        this.selectLogoShape(data.logoShape);
                    }
                    if (data.descriptionBackgroundEnabled !== undefined) {
                        descriptionBackgroundEnabled = data.descriptionBackgroundEnabled;
                        if (descriptionBackgroundEnabled) {
                            document.getElementById('descBackgroundToggle')?.classList.add('active');
                            document.getElementById('backgroundOpacityControl').style.display = 'block';
                        }
                    }
                    if (data.backgroundOpacity) {
                        backgroundOpacity = data.backgroundOpacity;
                        document.getElementById('opacitySlider').value = data.backgroundOpacity;
                        document.getElementById('opacityValue').textContent = data.backgroundOpacity + '%';
                    }
                    if (data.textFormatting) {
                        textFormatting = data.textFormatting;
                        Object.keys(textFormatting).forEach(field => {
                            Object.keys(textFormatting[field]).forEach(format => {
                                if (textFormatting[field][format]) {
                                    const btn = document.getElementById(field + format.charAt(0).toUpperCase() + format.slice(1) + 'Btn');
                                    if (btn) btn.classList.add('active');
                                }
                            });
                        });
                    }
                    sessionStorage.removeItem('makerhub_temp_landing_data');
                    this.showSuccess('Prix configures avec succes');
                    this.updatePreview();
                } catch (error) {
                    console.error('Erreur restauration:', error);
                }
            }
        }
    },
    
    attachInputListeners: function() {
        const self = this;
        const channelName = document.getElementById('channelName');
        if (channelName) {
            channelName.addEventListener('input', function() {
                self.updatePreview();
                self.updateUrlPreview();
            });
        }
        const banner = document.getElementById('banner');
        if (banner) banner.addEventListener('input', function() { self.updatePreview(); });
        const brand = document.getElementById('brand');
        if (brand) brand.addEventListener('input', function() { self.updatePreview(); });
        const fontSelector = document.getElementById('fontSelector');
        if (fontSelector) fontSelector.addEventListener('change', function() { self.updateFont(); });
        const slogan = document.getElementById('slogan');
        if (slogan) slogan.addEventListener('input', function() { self.updatePreview(); });
        const descFormat = document.getElementById('descriptionFormat');
        if (descFormat) descFormat.addEventListener('change', function() { self.updateDescriptionFormat(); });
        const description = document.getElementById('description');
        if (description) description.addEventListener('input', function() { self.updatePreview(); });
        const accessEmoji = document.getElementById('accessEmoji');
        if (accessEmoji) accessEmoji.addEventListener('change', function() { self.updateAccessEmoji(); });
        const buttonText = document.getElementById('buttonText');
        if (buttonText) buttonText.addEventListener('input', function() { self.updateButtonEmoji(); });
        const buttonEmoji = document.getElementById('buttonEmoji');
        if (buttonEmoji) buttonEmoji.addEventListener('change', function() { self.updateButtonEmoji(); });
        const opacitySlider = document.getElementById('opacitySlider');
        if (opacitySlider) opacitySlider.addEventListener('input', function(e) { self.updateOpacity(e.target.value); });
        this.updatePreview();
    },
    
    attachEventListeners: function() {
        const self = this;
        const logoUploadBtn = document.getElementById('logoUploadBtn');
        const logoInput = document.getElementById('logo');
        if (logoUploadBtn && logoInput && !logoHandlersBound) {
            var openPicker = function(e) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                isFileDialogOpen = true;
                setTimeout(function() { isFileDialogOpen = false; }, 1500);
                logoInput.click();
            };
            logoUploadBtn.addEventListener('click', openPicker, { passive: false });
            logoInput.addEventListener('change', function(e) {
                if (e.target.files && e.target.files[0]) {
                    var fileName = e.target.files[0].name;
                    var fileNameElement = document.getElementById('logoFileName');
                    if (fileNameElement) fileNameElement.textContent = fileName;
                    self.handleLogoChange(e.target);
                }
            });
            logoHandlersBound = true;
        }
        var createPageBtn = document.getElementById('createPageBtn');
        if (createPageBtn) {
            createPageBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                self.createLandingPage();
            });
        }
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.color-picker-button') && !e.target.closest('.mini-color-palette')) {
                document.querySelectorAll('.mini-color-palette').forEach(function(palette) { palette.classList.remove('active'); });
            }
        });
        document.addEventListener('click', function(e) {
            if (isFileDialogOpen) return;
            if (e.target.closest('.shape-option')) {
                var shape = e.target.closest('.shape-option').getAttribute('data-shape');
                if (shape) self.selectLogoShape(shape);
            }
            if (e.target.closest('#colorPickerBtn')) self.toggleColorPicker();
            if (e.target.closest('.mini-color-circle')) {
                var circle = e.target.closest('.mini-color-circle');
                var color = circle.getAttribute('data-color');
                var name = circle.getAttribute('data-name');
                if (color && name) self.selectColor(color, name);
            }
            if (e.target.closest('#descBackgroundToggle')) self.toggleDescriptionBackground();
            if (e.target.closest('.format-btn')) {
                var btn = e.target.closest('.format-btn');
                var field = btn.getAttribute('data-field');
                var format = btn.getAttribute('data-format');
                if (field && format) {
                    self.toggleFormat(field, format);
                } else {
                    if (btn.id === 'bulletListBtn') self.formatAsList('bullet');
                    else if (btn.id === 'arrowListBtn') self.formatAsList('arrow');
                    else if (btn.id === 'numberedListBtn') self.formatAsList('numbered');
                }
            }
            if (e.target.closest('.btn-add-media')) self.addMediaInput();
            if (e.target.closest('#paymentHandle') || e.target.closest('#previewPaymentBtn')) self.togglePaymentSheet();
            if (e.target.closest('.payment-option-row')) self.selectPaymentPlan(e.target.closest('.payment-option-row'), e);
            if (e.target.closest('.access-panel')) self.redirectToCheckout();
        });
    },
    
    loadReviews: function() {
        var urlParams = new URLSearchParams(window.location.search);
        var isEditMode = urlParams.get('edit') === 'true';
        if (isEditMode) {
            this.displayNoReviews();
            return;
        }
        var pageId = urlParams.get('page') || 'default';
        var reviewsData = localStorage.getItem('makerhub_reviews_' + pageId);
        if (reviewsData) {
            try {
                var data = JSON.parse(reviewsData);
                this.displayReviews(data);
            } catch (e) {
                this.displayNoReviews();
            }
        } else {
            this.displayNoReviews();
        }
    },
    
    displayReviews: function(data) {
        var self = this;
        var reviewsList = document.getElementById('previewReviewsList');
        var globalRating = document.getElementById('previewGlobalRating');
        var globalRatingText = document.getElementById('globalRatingText');
        var reviewsSection = document.getElementById('previewReviewsSection');
        if (!reviewsList) return;
        if (data.reviews && data.reviews.length > 0) {
            if (reviewsSection) reviewsSection.style.display = 'block';
            if (globalRating && data.globalRating) {
                globalRating.style.display = 'flex';
                var avgRating = this.calculateAverageRating(data.reviews);
                if (globalRatingText) globalRatingText.textContent = avgRating + ' (' + data.reviews.length + ')';
            }
            var reviewsHTML = data.reviews.map(function(review, index) {
                var rating = review.rating || 5;
                var stars = self.generateStars(rating);
                var avatarColors = ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#dda0dd', '#98d8c8'];
                var avatarColor = avatarColors[index % avatarColors.length];
                return '<div class="review-card"><div class="review-header"><div class="user-avatar" style="background: ' + avatarColor + ';"><svg width="24" height="24" viewBox="0 0 24 24" fill="#333"><circle cx="12" cy="8" r="4"/><path d="M12 14c-5 0-8 2.5-8 6v2h16v-2c0-3.5-3-6-8-6z"/></svg></div><div class="review-info"><div class="reviewer-name">' + self.escapeHtml(review.customerName || 'Anonymous') + '</div><div class="review-meta"><div class="review-stars">' + stars + '</div><span class="review-date">' + self.formatDate(review.date) + '</span></div></div></div><p class="review-comment">' + self.escapeHtml(review.comment || '') + '</p></div>';
            }).join('');
            reviewsList.innerHTML = reviewsHTML;
            reviewsList.style.display = 'block';
        } else {
            this.displayNoReviews();
        }
    },
    
    displayNoReviews: function() {
        var reviewsList = document.getElementById('previewReviewsList');
        var globalRating = document.getElementById('previewGlobalRating');
        var reviewsSection = document.getElementById('previewReviewsSection');
        if (globalRating) globalRating.style.display = 'none';
        if (reviewsList) reviewsList.innerHTML = '';
        if (reviewsSection) reviewsSection.style.display = 'none';
    },
    
    calculateAverageRating: function(reviews) {
        if (!reviews || reviews.length === 0) return '0.0';
        var sum = 0;
        for (var i = 0; i < reviews.length; i++) {
            sum += reviews[i].rating || 5;
        }
        return (sum / reviews.length).toFixed(1);
    },
    
    generateStars: function(rating) {
        var fullStars = Math.floor(rating);
        var emptyStars = 5 - fullStars;
        var stars = '';
        for (var i = 0; i < fullStars; i++) stars += '<span class="star">&#9733;</span>';
        for (var i = 0; i < emptyStars; i++) stars += '<span class="star" style="color: #ddd;">&#9733;</span>';
        return stars;
    },
    
    formatDate: function(dateString) {
        if (!dateString) return '';
        var date = new Date(dateString);
        var now = new Date();
        var diffTime = Math.abs(now - date);
        var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return "Aujourd'hui";
        if (diffDays === 1) return "Hier";
        if (diffDays < 7) return 'Il y a ' + diffDays + ' jours';
        if (diffDays < 30) {
            var weeks = Math.floor(diffDays / 7);
            return 'Il y a ' + weeks + ' semaine' + (weeks > 1 ? 's' : '');
        }
        var months = Math.floor(diffDays / 30);
        return 'Il y a ' + months + ' mois';
    },
    
    escapeHtml: function(text) {
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    toggleColorPicker: function() {
        var palette = document.getElementById('colorPalette');
        if (palette) palette.classList.toggle('active');
    },
    
    selectColor: function(color, name) {
        selectedBorderColor = color;
        var preview = document.getElementById('colorPreview');
        var nameElement = document.getElementById('colorName');
        var valueElement = document.getElementById('colorValue');
        if (preview) preview.style.background = color;
        if (nameElement) nameElement.textContent = name;
        if (valueElement) valueElement.textContent = color.toUpperCase();
        document.querySelectorAll('.mini-color-circle').forEach(function(circle) { circle.classList.remove('selected'); });
        var circles = document.querySelectorAll('.mini-color-circle');
        circles.forEach(function(circle) {
            if (circle.getAttribute('data-color') === color) circle.classList.add('selected');
        });
        var palette = document.getElementById('colorPalette');
        if (palette) palette.classList.remove('active');
        var paymentBtn = document.getElementById('previewPaymentBtn');
        if (paymentBtn) {
            paymentBtn.style.background = 'transparent';
            paymentBtn.style.border = '2px solid ' + color;
            paymentBtn.style.color = color;
            paymentBtn.style.boxShadow = 'none';
            paymentBtn.style.outline = 'none';
        }
        var lockIcon = document.querySelector('.access-panel .fa-lock');
        if (lockIcon) lockIcon.style.color = color;
        this.updatePreview();
    },
    
    hexToRgb: function(hex) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
    },
    
    updateFont: function() {
        var fontSelector = document.getElementById('fontSelector');
        if (fontSelector) {
            selectedFont = fontSelector.value;
            this.updatePreview();
        }
    },
    
    selectLogoShape: function(shape) {
        logoShape = shape;
        document.querySelectorAll('.shape-option').forEach(function(opt) { opt.classList.remove('active'); });
        var selectedOption = document.querySelector('[data-shape="' + shape + '"]');
        if (selectedOption) selectedOption.classList.add('active');
        var logoImg = document.getElementById('logoImg');
        var logoVideo = document.getElementById('logoVideo');
        if (logoImg) {
            if (shape === 'circle') logoImg.classList.remove('square');
            else logoImg.classList.add('square');
        }
        if (logoVideo) {
            if (shape === 'circle') logoVideo.classList.remove('square');
            else logoVideo.classList.add('square');
        }
    },
    
    handleLogoChange: function(input) {
        var logoContainer = document.querySelector('.logo-container');
        if (input.files && input.files[0]) {
            var file = input.files[0];
            logoFile = file;
            if (logoContainer) logoContainer.style.display = 'block';
            var reader = new FileReader();
            reader.onload = function(e) {
                var logoImg = document.getElementById('logoImg');
                var logoVideo = document.getElementById('logoVideo');
                if (file.type.startsWith('video/')) {
                    if (logoImg) logoImg.style.display = 'none';
                    if (logoVideo) {
                        logoVideo.src = e.target.result;
                        logoVideo.style.display = 'block';
                        if (logoShape === 'square') logoVideo.classList.add('square');
                        else logoVideo.classList.remove('square');
                    }
                } else {
                    if (logoVideo) logoVideo.style.display = 'none';
                    if (logoImg) {
                        logoImg.src = e.target.result;
                        logoImg.style.display = 'block';
                        if (logoShape === 'square') logoImg.classList.add('square');
                        else logoImg.classList.remove('square');
                    }
                }
            };
            reader.readAsDataURL(file);
        } else {
            if (logoContainer) logoContainer.style.display = 'none';
            var logoImg = document.getElementById('logoImg');
            var logoVideo = document.getElementById('logoVideo');
            if (logoImg) logoImg.style.display = 'none';
            if (logoVideo) logoVideo.style.display = 'none';
            logoFile = null;
        }
    },
    
    toggleDescriptionBackground: function() {
        descriptionBackgroundEnabled = !descriptionBackgroundEnabled;
        var toggle = document.getElementById('descBackgroundToggle');
        var opacityControl = document.getElementById('backgroundOpacityControl');
        if (toggle) {
            if (descriptionBackgroundEnabled) {
                toggle.classList.add('active');
                if (opacityControl) opacityControl.style.display = 'block';
            } else {
                toggle.classList.remove('active');
                if (opacityControl) opacityControl.style.display = 'none';
            }
        }
        this.updatePreview();
    },
    
    updateOpacity: function(value) {
        backgroundOpacity = value;
        var valueDisplay = document.getElementById('opacityValue');
        if (valueDisplay) valueDisplay.textContent = value + '%';
        this.updatePreview();
    },
    
    addMediaInput: function() {
        var mediaId = Date.now();
        var container = document.getElementById('mediaContainer');
        var self = this;
        if (container) {
            var mediaItem = document.createElement('div');
            mediaItem.className = 'media-item';
            mediaItem.innerHTML = '<input type="file" accept="image/*,video/*" data-media-id="' + mediaId + '"><button class="btn-remove" type="button" data-media-id="' + mediaId + '"><i class="fas fa-trash"></i></button>';
            var fileInput = mediaItem.querySelector('input[type="file"]');
            if (fileInput) fileInput.addEventListener('change', function(e) { self.handleMediaUpload(mediaId, e.target); });
            var removeBtn = mediaItem.querySelector('.btn-remove');
            if (removeBtn) {
                removeBtn.addEventListener('click', function() {
                    self.removeMedia(mediaId, this);
                });
            }
            container.appendChild(mediaItem);
        }
    },
    
    handleMediaUpload: function(id, input) {
        if (input.files && input.files[0]) {
            var file = input.files[0];
            var maxVideoSize = 20 * 1024 * 1024; // 20 MB max pour les vidéos
            var maxImageSize = 10 * 1024 * 1024; // 10 MB max pour les images
            
            // ✅ Vérifier la taille des vidéos
            if (file.type.startsWith('video/') && file.size > maxVideoSize) {
                this.showError('Video trop lourde! Maximum 20 MB (environ 1 minute). Taille actuelle: ' + (file.size / 1024 / 1024).toFixed(1) + ' MB');
                input.value = '';
                return;
            }
            
            // ✅ Vérifier la taille des images (avant compression)
            if (file.type.startsWith('image/') && file.size > maxImageSize) {
                this.showError('Image trop lourde! Maximum 10 MB. Taille actuelle: ' + (file.size / 1024 / 1024).toFixed(1) + ' MB');
                input.value = '';
                return;
            }
            
            var reader = new FileReader();
            reader.onload = function(e) {
                mediaItems.push({ id: id, type: file.type.startsWith('video/') ? 'video' : 'image', src: e.target.result, name: file.name, file: file });
                createLandingApp.updateMediaGallery();
            };
            reader.readAsDataURL(file);
        }
    },
    
    removeMedia: function(id, el) {
        mediaItems = mediaItems.filter(function(item) { return item.id !== id; });
        var mediaItem = el && el.closest ? el.closest('.media-item') : null;
        if (mediaItem) mediaItem.remove();
        this.updateMediaGallery();
    },
    
    updateMediaGallery: function() {
        var gallery = document.getElementById('mediaGallery');
        if (gallery) {
            if (mediaItems.length > 0) {
                gallery.style.display = 'flex';
                gallery.style.flexDirection = 'column';
                gallery.style.alignItems = 'center';
                gallery.style.justifyContent = 'center';
                gallery.style.gap = '15px';
                gallery.style.width = '100%';
                gallery.style.maxWidth = '100%';
                gallery.style.margin = '0 auto';
                gallery.style.padding = '0';
                gallery.style.boxSizing = 'border-box';
                gallery.innerHTML = mediaItems.map(function(item) {
                    if (item.type === 'video') {
                        return '<video src="' + item.src + '" controls style="width: 90%; max-width: 90%; border-radius: 8px; display: block; margin: 0 auto;"></video>';
                    } else {
                        return '<img src="' + item.src + '" alt="' + item.name + '" style="width: 90%; max-width: 90%; border-radius: 8px; display: block; margin: 0 auto;">';
                    }
                }).join('');
            } else {
                gallery.style.display = 'none';
                gallery.innerHTML = '';
            }
        }
    },
    
    updateAccessEmoji: function() {
        var emojiSelect = document.getElementById('accessEmoji');
        var emojiPreview = document.getElementById('previewAccessEmoji');
        if (emojiSelect && emojiPreview) emojiPreview.textContent = emojiSelect.value;
        this.updatePreview();
    },
    
    updateDescriptionFormat: function() {
        var format = document.getElementById('descriptionFormat').value;
        var descriptionTextarea = document.getElementById('description');
        if (!descriptionTextarea || !format) return;
        var cursorPos = descriptionTextarea.selectionStart;
        var text = descriptionTextarea.value;
        var newText = text.slice(0, cursorPos) + format + ' ' + text.slice(cursorPos);
        descriptionTextarea.value = newText;
        var newCursorPos = cursorPos + format.length + 1;
        descriptionTextarea.focus();
        descriptionTextarea.setSelectionRange(newCursorPos, newCursorPos);
        document.getElementById('descriptionFormat').selectedIndex = 0;
        this.updatePreview();
    },

    formatAsList: function(type) {
        var descriptionTextarea = document.getElementById('description');
        if (descriptionTextarea) {
            var bulletBtn = document.getElementById('bulletListBtn');
            var arrowBtn = document.getElementById('arrowListBtn');
            var numberedBtn = document.getElementById('numberedListBtn');
            if (bulletBtn) bulletBtn.classList.remove('active');
            if (arrowBtn) arrowBtn.classList.remove('active');
            if (numberedBtn) numberedBtn.classList.remove('active');
            var currentText = descriptionTextarea.value;
            var lines = currentText.split('\n');
            var cleanLines = lines.map(function(line) { 
                return line.replace(/^[\d\.\s\-\•\➤\⚡\🔥\⭐\💎\🚀\🎯\💡\🏆\🎖️\🌟\📱\📲\💻\🌐\🔔\👑\🎉\✨\💰\💼\🧠]+\s*/, '').trim(); 
            });
            var formattedText = '';
            var number;
            switch(type) {
                case 'bullet':
                    formattedText = cleanLines.map(function(line) { return line ? '• ' + line : line; }).join('\n');
                    if (bulletBtn) bulletBtn.classList.add('active');
                    descriptionTextarea.dataset.listType = 'bullet';
                    break;
                case 'arrow':
                    formattedText = cleanLines.map(function(line) { return line ? '➤ ' + line : line; }).join('\n');
                    if (arrowBtn) arrowBtn.classList.add('active');
                    descriptionTextarea.dataset.listType = 'arrow';
                    break;
                case 'numbered':
                    number = 1;
                    formattedText = cleanLines.map(function(line) { if (line) return (number++) + '. ' + line; return line; }).join('\n');
                    if (numberedBtn) numberedBtn.classList.add('active');
                    descriptionTextarea.dataset.listType = 'numbered';
                    break;
            }
            descriptionTextarea.value = formattedText;
            descriptionTextarea.focus();
            descriptionTextarea.setSelectionRange(descriptionTextarea.value.length, descriptionTextarea.value.length);
            this.updatePreview();
        }
    },

    updateButtonEmoji: function() {
        var buttonTextInput = document.getElementById('buttonText');
        var buttonEmojiSelect = document.getElementById('buttonEmoji');
        var paymentButton = document.getElementById('previewPaymentBtn');
        if (buttonTextInput && buttonEmojiSelect && paymentButton) {
            var text = buttonTextInput.value || 'Join Now';
            var emoji = buttonEmojiSelect.value;
            if (emoji) paymentButton.textContent = emoji + ' ' + text;
            else paymentButton.textContent = text;
        }
    },
    
    togglePaymentSheet: function() {
        var sheetContent = document.getElementById('paymentSheetContent');
        if (sheetContent) sheetContent.classList.toggle('active');
    },
    
    selectPaymentPlan: function(element, event) {
        if (event) event.stopPropagation();
        document.querySelectorAll('.payment-option-row').forEach(function(row) { row.classList.remove('selected'); });
        element.classList.add('selected');
        var mainBtn = document.getElementById('previewPaymentBtn');
        var planText = element.getAttribute('data-text');
        if (mainBtn && planText) mainBtn.textContent = planText;
        setTimeout(function() {
            var sheetContent = document.getElementById('paymentSheetContent');
            if (sheetContent) sheetContent.classList.remove('active');
        }, 300);
    },
    
    toggleFormat: function(field, format) {
        if (!textFormatting[field]) textFormatting[field] = { bold: false, italic: false };
        textFormatting[field][format] = !textFormatting[field][format];
        var btnId = field + format.charAt(0).toUpperCase() + format.slice(1) + 'Btn';
        var btn = document.getElementById(btnId);
        if (btn) {
            if (textFormatting[field][format]) btn.classList.add('active');
            else btn.classList.remove('active');
        }
        this.updatePreview();
    },
    
    updateUrlPreview: function() {
        var channelNameInput = document.getElementById('channelName');
        var channelNameSlug = document.getElementById('channelNameSlug');
        if (channelNameInput && channelNameSlug) {
            var slug = channelNameInput.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
            channelNameSlug.textContent = slug || 'channelname';
        }
    },
    
    redirectToCheckout: function() {
        console.log('Redirection checkout...');
    },

    updatePreview: function() {
        var channelNameInput = document.getElementById('channelName');
        var bannerInput = document.getElementById('banner');
        var brandInput = document.getElementById('brand');
        var sloganInput = document.getElementById('slogan');
        var descriptionInput = document.getElementById('description');
        var titleElement = document.getElementById('prevBrand');
        var subtitleElement = document.getElementById('prevSlogan');
        var descriptionElement = document.getElementById('prevDesc');
        var bannerDiv = document.getElementById('prevBanner');
        var bannerText = document.getElementById('bannerText');
        var accessTitleElement = document.getElementById('previewAccessProductTitle');
        
        if (bannerInput && bannerDiv && bannerText) {
            if (bannerInput.value && bannerInput.value.trim() !== '') {
                bannerDiv.style.display = 'block';
                bannerText.textContent = bannerInput.value;
            } else {
                bannerDiv.style.display = 'none';
            }
        }
        
        var logoContainer = document.querySelector('.logo-container');
        if (logoContainer) {
            if (logoFile) logoContainer.style.display = 'block';
            else logoContainer.style.display = 'none';
        }
        
        if (titleElement && brandInput) {
            titleElement.textContent = brandInput.value || 'Your Amazing Brand';
            if (textFormatting.brand && textFormatting.brand.bold) titleElement.classList.add('bold');
            else titleElement.classList.remove('bold');
            if (textFormatting.brand && textFormatting.brand.italic) titleElement.classList.add('italic');
            else titleElement.classList.remove('italic');
        }
        
        if (accessTitleElement && brandInput) accessTitleElement.textContent = brandInput.value || 'Your Amazing Brand';
        
        if (subtitleElement && sloganInput) {
            subtitleElement.textContent = sloganInput.value || 'Your subtitle here';
            if (textFormatting.slogan && textFormatting.slogan.bold) subtitleElement.classList.add('bold');
            else subtitleElement.classList.remove('bold');
            if (textFormatting.slogan && textFormatting.slogan.italic) subtitleElement.classList.add('italic');
            else subtitleElement.classList.remove('italic');
        }
        
        if (descriptionElement && descriptionInput) {
            var text = descriptionInput.value || 'Description will appear here...';
            var lines = text.split('\n').filter(function(line) { return line.trim() !== ''; });
            var htmlContent = text;
            var isBulletList = lines.length > 0 && lines.every(function(line) { return line.startsWith('• '); });
            var isNumberedList = lines.length > 0 && lines.every(function(line) { return /^\d+\.\s/.test(line); });
            var isArrowList = lines.length > 0 && lines.every(function(line) { return line.startsWith('➤ '); });
            if (isBulletList) {
                var items = lines.map(function(line) { var content = line.substring(2).trim(); return '<li>' + content + '</li>'; }).join('');
                htmlContent = '<ul style="margin: 0; padding-left: 20px;">' + items + '</ul>';
            } else if (isNumberedList) {
                var items = lines.map(function(line) { var content = line.replace(/^\d+\.\s/, '').trim(); return '<li>' + content + '</li>'; }).join('');
                htmlContent = '<ol style="margin: 0; padding-left: 20px;">' + items + '</ol>';
            } else if (isArrowList) {
                var items = lines.map(function(line) { var content = line.substring(2).trim(); return '<div style="margin-bottom: 8px;">➤ ' + content + '</div>'; }).join('');
                htmlContent = items;
            } else {
                htmlContent = text.replace(/\n/g, '<br>');
            }
            descriptionElement.innerHTML = htmlContent;
            if (textFormatting.description && textFormatting.description.bold) descriptionElement.classList.add('bold');
            else descriptionElement.classList.remove('bold');
            if (textFormatting.description && textFormatting.description.italic) descriptionElement.classList.add('italic');
            else descriptionElement.classList.remove('italic');
            if (descriptionBackgroundEnabled) {
                var opacity = backgroundOpacity / 100;
                var color = selectedBorderColor;
                var hex = color;
                var r = parseInt(hex.slice(1, 3), 16);
                var g = parseInt(hex.slice(3, 5), 16);
                var b = parseInt(hex.slice(5, 7), 16);
                descriptionElement.style.backgroundColor = 'rgba(' + r + ', ' + g + ', ' + b + ', ' + opacity + ')';
                descriptionElement.style.borderRadius = '8px';
                descriptionElement.style.padding = '15px';
                descriptionElement.style.marginBottom = '20px';
            } else {
                descriptionElement.style.backgroundColor = 'transparent';
                descriptionElement.style.borderRadius = '0';
                descriptionElement.style.padding = '0';
                descriptionElement.style.marginBottom = '0';
            }
        }
        
        var previewContent = document.getElementById('previewContent');
        if (previewContent && fontFamilies[selectedFont]) previewContent.style.fontFamily = fontFamilies[selectedFont];
        
        // Appliquer le template blanc par défaut
        if (previewContent) {
            previewContent.style.background = defaultTemplateColors.bg;
            previewContent.style.color = defaultTemplateColors.text;
            if (titleElement) titleElement.style.color = defaultTemplateColors.text;
            if (subtitleElement) subtitleElement.style.color = defaultTemplateColors.text;
            if (descriptionElement && !descriptionBackgroundEnabled) descriptionElement.style.color = defaultTemplateColors.text;
        }
        
        var accessPanel = document.querySelector('.access-panel');
        if (accessPanel) accessPanel.style.borderColor = selectedBorderColor;
        
        var paymentBtn = document.getElementById('previewPaymentBtn');
        if (paymentBtn) {
            paymentBtn.style.background = selectedBorderColor;
            paymentBtn.style.boxShadow = 'none';
            paymentBtn.style.outline = 'none';
            var rgb = this.hexToRgb(selectedBorderColor);
            if (rgb) {
                var luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
                paymentBtn.style.color = luminance > 0.5 ? '#000000' : '#ffffff';
            }
        }
        
        var lockIcon = document.querySelector('.access-panel .fa-lock');
        if (lockIcon) lockIcon.style.color = selectedBorderColor;
    },
    
    // ✅ CRÉATION DE PAGE SANS TRADUCTION AUTOMATIQUE
    createLandingPage: async function() {
        var self = this;
        
        // ✅ Détecter si on est en mode edit
        var urlParams = new URLSearchParams(window.location.search);
        var isEditMode = urlParams.get('edit') === 'true';
        var existingSlug = urlParams.get('page');
        
        if (!window.firebaseAuth || !window.firebaseAuth.currentUser) {
            this.showError('Connectez-vous');
            setTimeout(function() { window.location.href = '/auth.html'; }, 2000);
            return;
        }
        
        var currentUser = window.firebaseAuth.currentUser;
        var channelName = document.getElementById('channelName').value.trim();
        var brand = document.getElementById('brand').value.trim();
        var banner = document.getElementById('banner').value.trim() || '85% SUCCESS';
        var slogan = document.getElementById('slogan').value.trim();
        var description = document.getElementById('description').value.trim();
        var buttonText = document.getElementById('buttonText').value.trim() || 'Join Now';
        var buttonEmoji = document.getElementById('buttonEmoji').value || '';
        var accessEmoji = document.getElementById('accessEmoji').value || '🔒';
        
        if (!channelName) { this.showError('Nom de canal requis'); return; }
        if (!brand) { this.showError('Nom de marque requis'); return; }
        
        // ✅ Utiliser le slug existant en mode edit
        var simpleSlug = isEditMode && existingSlug ? existingSlug : channelName.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 50);
        
        var channelSlug = channelName.toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        
        try {
            var createBtn = document.getElementById('createPageBtn');
            if (createBtn) {
                createBtn.disabled = true;
                createBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creation...';
            }
            
            var profileName = currentUser.email.split('@')[0];
            var urlParams = new URLSearchParams(window.location.search);
            var profileFromUrl = urlParams.get('profile');
            if (profileFromUrl) profileName = profileFromUrl;
            
            // Récupérer la langue et devise depuis l'URL
            var selectedLanguage = urlParams.get('lang') || 'en';
            var selectedCurrency = urlParams.get('curr') || 'USD';
            
            try {
                var userDoc = await window.firebaseDb.collection('users').doc(currentUser.uid).get();
                if (userDoc.exists) {
                    var userData = userDoc.data();
                    if (userData.profileName) profileName = userData.profileName;
                    else if (userData.username) profileName = userData.username;
                }
            } catch (error) { 
                console.log('Profile email utilise'); 
            }
            
            var logoUrl = '';
            if (logoFile && window.firebaseStorage) {
                try {
                    // ✅ Compresser le logo (max 800x800, qualité 80%)
                    var compressedLogo = await compressImage(logoFile, 800, 800, 0.8);
                    
                    var timestamp = Date.now();
                    var safeFileName = logoFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
                    var fileName = 'logo_' + timestamp + '_' + safeFileName;
                    var storagePath = 'landingPages/' + simpleSlug + '/logo/' + fileName;
                    var storageRef = window.firebaseStorage.ref(storagePath);
                    var metadata = { 
                        contentType: compressedLogo.type, 
                        customMetadata: { 
                            'uploadedBy': currentUser.uid, 
                            'pageSlug': simpleSlug 
                        } 
                    };
                    var uploadTask = await storageRef.put(compressedLogo, metadata);
                    logoUrl = await uploadTask.ref.getDownloadURL();
                } catch (uploadError) { 
                    console.error('Erreur logo:', uploadError); 
                }
            }
            
            var uploadedMediaUrls = [];
            if (mediaItems && mediaItems.length > 0) {
                // ✅ Upload en PARALLÈLE pour aller plus vite
                var uploadPromises = mediaItems.map(async function(media, index) {
                    try {
                        if (media.file) {
                            // Compresser les images (max 1200x1200, qualité 75%)
                            var fileToUpload = await compressImage(media.file, 1200, 1200, 0.75);
                            
                            var timestamp = Date.now() + index;
                            var safeFileName = media.name.replace(/[^a-zA-Z0-9.-]/g, '_');
                            var fileName = 'media_' + timestamp + '_' + safeFileName;
                            var storagePath = 'landingPages/' + simpleSlug + '/media/' + fileName;
                            var storageRef = window.firebaseStorage.ref(storagePath);
                            var uploadTask = await storageRef.put(fileToUpload);
                            var downloadURL = await uploadTask.ref.getDownloadURL();
                            return { 
                                url: downloadURL, 
                                type: media.type, 
                                name: media.name 
                            };
                        }
                        return null;
                    } catch (error) { 
                        console.error('Erreur media:', error); 
                        return null;
                    }
                });
                
                var results = await Promise.all(uploadPromises);
                uploadedMediaUrls = results.filter(function(r) { return r !== null; });
            }
            
            var descriptionBackgroundColor = '';
            if (descriptionBackgroundEnabled) {
                var r = parseInt(selectedBorderColor.slice(1,3), 16);
                var g = parseInt(selectedBorderColor.slice(3,5), 16);
                var b = parseInt(selectedBorderColor.slice(5,7), 16);
                descriptionBackgroundColor = 'rgba(' + r + ', ' + g + ', ' + b + ', ' + (backgroundOpacity/100) + ')';
            }
            
            var calculateContrastColor = function(hexColor) {
                var color = hexColor.replace('#', '');
                var r = parseInt(color.substr(0, 2), 16);
                var g = parseInt(color.substr(2, 2), 16);
                var b = parseInt(color.substr(4, 2), 16);
                var luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                return luminance > 0.5 ? '#000000' : '#ffffff';
            };
            
            var pricesData = localStorage.getItem('makerhub_prices_' + simpleSlug);
            var pricesDataStored = { 
                prices: [{ 
                    price: "67", 
                    period: "mois", 
                    currency: selectedCurrency, 
                    buttonText: "S'abonner", 
                    isPopular: true 
                }], 
                currency: selectedCurrency, 
                showPrices: true 
            };
            if (pricesData) {
                try { 
                    pricesDataStored = JSON.parse(pricesData); 
                } catch (e) { 
                    console.log('Prix defaut'); 
                }
            }
            
            var fullButtonText = (buttonEmoji + ' ' + buttonText).trim();
            
            // ✅ Initialiser les traductions avec seulement la langue source
            var translations = {};
            translations[selectedLanguage] = { 
                brand: brand, 
                title: brand, 
                banner: banner, 
                slogan: slogan, 
                description: description, 
                buttonText: buttonText, 
                buttonEmoji: buttonEmoji, 
                accessEmoji: accessEmoji, 
                fullButtonText: fullButtonText 
            };
            
            var landingData = {
                slug: simpleSlug,
                channelSlug: channelSlug,
                channelName: channelName,
                profileName: profileName,
                creatorId: currentUser.uid,
                creatorEmail: currentUser.email,
                brand: brand,
                title: brand,
                banner: banner,
                slogan: slogan,
                description: description,
                translations: translations,
                sourceLanguage: selectedLanguage,
                language: selectedLanguage,
                currency: selectedCurrency,
                availableLanguages: SUPPORTED_LANGUAGES,
                needsTranslation: false,
                translationStatus: 'none',
                template: selectedTemplate,
                selectedTemplate: selectedTemplate,
                backgroundColor: defaultTemplateColors.bg,
                borderColor: selectedBorderColor,
                textColor: defaultTemplateColors.text,
                font: selectedFont,
                fontFamily: fontFamilies[selectedFont] || 'Inter, sans-serif',
                logoUrl: logoUrl || '',
                logoShape: logoShape,
                media: uploadedMediaUrls,
                descriptionBackground: descriptionBackgroundEnabled,
                descriptionBackgroundEnabled: descriptionBackgroundEnabled,
                backgroundOpacity: backgroundOpacity,
                descriptionBackgroundColor: descriptionBackgroundColor,
                accessEmoji: accessEmoji,
                buttonText: buttonText,
                buttonEmoji: buttonEmoji,
                btnAccessText: fullButtonText,
                btnTextColor: calculateContrastColor(selectedBorderColor),
                textFormatting: textFormatting,
                prices: pricesDataStored.prices || [{ 
                    price: "67", 
                    period: "mois", 
                    currency: selectedCurrency, 
                    buttonText: "S'abonner", 
                    isPopular: true 
                }],
                showPrices: pricesDataStored.showPrices !== false,
                reviews: [],
                globalRating: "0",
                totalReviews: 0,
                url: '/' + profileName + '/' + simpleSlug,
                fullUrl: window.location.origin + '/' + profileName + '/' + simpleSlug,
                telegramLink: 'https://t.me/' + channelSlug,
                checkoutUrl: '/checkout/' + simpleSlug,
                isActive: false,
                isPublished: false,
                viewCount: 0,
                subscriptionCount: 0,
                revenue: 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            console.log('📝 Creation landing page:', {
                slug: simpleSlug,
                channelSlug: channelSlug,
                profileName: profileName,
                language: selectedLanguage,
                currency: selectedCurrency,
                url: landingData.url
            });
            
            // Sauvegarder ou mettre a jour la page dans Firestore
            if (isEditMode) {
                // Mode EDIT: mise a jour
                landingData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
                delete landingData.createdAt;
                await window.firebaseDb.collection('landingPages').doc(simpleSlug).update(landingData);
                this.showSuccess('Page mise a jour avec succes!');
            } else {
                // Mode CREATE: nouvelle page
                await window.firebaseDb.collection('landingPages').doc(simpleSlug).set(landingData);
                this.showSuccess('Page creee avec succes!');
            }
            
            localStorage.removeItem('makerhub_prices_' + simpleSlug);
            
            // Redirection
            setTimeout(function() { 
                window.location.href = '/telegramsubscription.html?page=' + simpleSlug + (isEditMode ? '&updated=true' : '&new=true'); 
            }, 1000);
            
        } catch (error) {
            console.error('Erreur:', error);
            this.showError('Erreur: ' + error.message);
            var createBtn = document.getElementById('createPageBtn');
            if (createBtn) {
                createBtn.disabled = false;
                createBtn.innerHTML = isEditMode ? '<i class="fas fa-save"></i> Update Page' : '<i class="fas fa-rocket"></i> Create Page';
            }
        }
    },
    
    showError: function(message) {
        console.error(message);
        var errorElement = document.getElementById('error');
        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.id = 'error';
            errorElement.className = 'message error';
            errorElement.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #f44336; color: white; padding: 15px 20px; border-radius: 5px; z-index: 9999; box-shadow: 0 4px 6px rgba(0,0,0,0.1);';
            document.body.appendChild(errorElement);
        }
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        setTimeout(function() { errorElement.style.display = 'none'; }, 5000);
    },
    
    showSuccess: function(message) {
        console.log(message);
        var successElement = document.getElementById('success');
        if (!successElement) {
            successElement = document.createElement('div');
            successElement.id = 'success';
            successElement.className = 'message success';
            successElement.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #4caf50; color: white; padding: 15px 20px; border-radius: 5px; z-index: 9999; box-shadow: 0 4px 6px rgba(0,0,0,0.1);';
            document.body.appendChild(successElement);
        }
        successElement.textContent = message;
        successElement.style.display = 'block';
        setTimeout(function() { successElement.style.display = 'none'; }, 5000);
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(function() { createLandingApp.init(); }, 1000);
    });
} else {
    setTimeout(function() { createLandingApp.init(); }, 1000);
}

window.createLandingApp = createLandingApp;

var essentialStyles = '<style>.bold { font-weight: bold !important; }.italic { font-style: italic !important; }.active { background-color: #007bff !important; color: white !important; }.shape-option { cursor: pointer; padding: 10px; border: 2px solid #ddd; display: inline-block; margin: 5px; }.shape-option.active { border-color: #007bff; background-color: #f0f8ff; }.mini-color-palette { display: none; position: absolute; background: white; border: 1px solid #ddd; padding: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }.mini-color-palette.active { display: block; }.mini-color-circle { width: 30px; height: 30px; border-radius: 50%; cursor: pointer; display: inline-block; margin: 5px; border: 2px solid transparent; }.mini-color-circle.selected { border-color: #000; }.preview-content { padding: 20px; min-height: 500px; }.logo-preview { max-width: 150px; max-height: 150px; display: block; margin: 0 auto 20px; }.logo-preview.square { border-radius: 0 !important; }.message { padding: 15px 20px; border-radius: 5px; margin: 10px 0; }.message.error { background-color: #f44336; color: white; }.message.success { background-color: #4caf50; color: white; }.review-card { background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 15px; }.review-header { display: flex; align-items: center; margin-bottom: 10px; }.user-avatar { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 10px; }.review-stars { color: #ffd700; }.star { font-size: 16px; }.logo-container { display: none; }</style>';

if (!document.querySelector('link[href*="createLanding.css"]')) {
    document.head.insertAdjacentHTML('beforeend', essentialStyles);
}