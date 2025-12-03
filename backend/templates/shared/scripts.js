/* ===== BRANDLYNK SHARED SCRIPTS ===== */
/* Scripts partagés pour toutes les pages */

/**
 * Configuration globale
 */
const BRANDLYNK = {
  // Configuration API
  API_BASE: '/api',
  
  // Messages par défaut
  MESSAGES: {
    loading: '⏳ Envoi en cours...',
    success: '✅ Envoyé avec succès !',
    error: '❌ Une erreur est survenue',
    emailInvalid: '❌ Email invalide',
    emailRequired: '❌ Email requis',
    networkError: '❌ Erreur de connexion',
    tryAgain: 'Réessayer'
  },
  
  // Délais
  DELAYS: {
    redirect: 2000,
    resetButton: 3000,
    showMessage: 5000
  }
};

/**
 * ===== VALIDATION D'EMAIL =====
 */
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validateForm(formData) {
  const errors = [];
  
  if (!formData.email) {
    errors.push(BRANDLYNK.MESSAGES.emailRequired);
  } else if (!validateEmail(formData.email)) {
    errors.push(BRANDLYNK.MESSAGES.emailInvalid);
  }
  
  return errors;
}

/**
 * ===== GESTION DES BOUTONS =====
 */
function setButtonLoading(button, isLoading = true) {
  if (!button) return;
  
  if (isLoading) {
    button.dataset.originalText = button.textContent;
    button.textContent = BRANDLYNK.MESSAGES.loading;
    button.disabled = true;
    button.classList.add('loading');
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
    button.classList.remove('loading');
  }
}

function setButtonSuccess(button, message = BRANDLYNK.MESSAGES.success) {
  if (!button) return;
  
  button.textContent = message;
  button.style.background = '#28a745';
  button.style.color = '#ffffff';
  button.disabled = true;
}

function setButtonError(button, message = BRANDLYNK.MESSAGES.error) {
  if (!button) return;
  
  button.textContent = message;
  button.style.background = '#dc3545';
  button.style.color = '#ffffff';
  button.disabled = true;
  
  // Reset après délai
  setTimeout(() => {
    resetButton(button);
  }, BRANDLYNK.DELAYS.resetButton);
}

function resetButton(button) {
  if (!button || !button.dataset.originalText) return;
  
  button.textContent = button.dataset.originalText;
  button.style.background = '';
  button.style.color = '';
  button.disabled = false;
  button.classList.remove('loading');
}

/**
 * ===== GESTION DES MESSAGES =====
 */
function showMessage(type, text, container = null) {
  const messageElement = container || document.createElement('div');
  
  if (!container) {
    messageElement.className = `message message-${type} fade-in`;
    messageElement.innerHTML = text;
    
    // Trouver le container approprié
    const targetContainer = document.querySelector('.container') || document.body;
    targetContainer.appendChild(messageElement);
    
    // Auto-remove après délai
    setTimeout(() => {
      if (messageElement.parentNode) {
        messageElement.remove();
      }
    }, BRANDLYNK.DELAYS.showMessage);
  } else {
    messageElement.className = `message message-${type} show`;
    messageElement.innerHTML = text;
  }
  
  return messageElement;
}

function hideMessage(messageElement) {
  if (messageElement) {
    messageElement.classList.remove('show');
    messageElement.classList.add('hidden');
  }
}

/**
 * ===== SOUMISSION DE FORMULAIRE LEAD CAPTURE =====
 */
async function submitLeadForm(formElement, options = {}) {
  const {
    slug = '',
    captureUrl = '/api/capture',
    onSuccess = null,
    onError = null,
    redirectUrl = null
  } = options;
  
  // Récupérer les données du formulaire
  const formData = new FormData(formElement);
  const email = formData.get('email') || document.getElementById('emailInput')?.value;
  const source = formData.get('source') || 'lead-page';
  
  // Validation
  const errors = validateForm({ email });
  if (errors.length > 0) {
    showMessage('error', errors.join('<br>'));
    return false;
  }
  
  // Préparer les données
  const submitData = {
    email: email.trim(),
    source: source,
    slug: slug,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    referrer: document.referrer
  };
  
  // Bouton de soumission
  const submitButton = formElement.querySelector('button[type="submit"]') || 
                      formElement.querySelector('.btn-submit') ||
                      document.getElementById('submitBtn');
  
  try {
    // Mettre le bouton en loading
    setButtonLoading(submitButton, true);
    
    // Envoyer la requête
    const response = await fetch(captureUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(submitData)
    });
    
    if (response.ok) {
      const result = await response.json();
      
      // Succès
      setButtonSuccess(submitButton);
      showMessage('success', result.message || BRANDLYNK.MESSAGES.success);
      
      // Callback personnalisé
      if (onSuccess) {
        onSuccess(result);
      }
      
      // Redirection
      if (redirectUrl) {
        setTimeout(() => {
          window.location.href = redirectUrl;
        }, BRANDLYNK.DELAYS.redirect);
      }
      
      return true;
      
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
  } catch (error) {
    console.error('❌ Erreur soumission formulaire:', error);
    
    // Erreur
    setButtonError(submitButton);
    
    let errorMessage = BRANDLYNK.MESSAGES.error;
    if (error.message.includes('fetch')) {
      errorMessage = BRANDLYNK.MESSAGES.networkError;
    }
    
    showMessage('error', errorMessage);
    
    // Callback personnalisé
    if (onError) {
      onError(error);
    }
    
    return false;
  }
}

/**
 * ===== SOUMISSION AVEC PAIEMENT =====
 */
async function submitPaymentForm(formElement, options = {}) {
  const {
    slug = '',
    paymentUrl = '/api/payment',
    priceIndex = 0,
    onSuccess = null,
    onError = null
  } = options;
  
  const formData = new FormData(formElement);
  const email = formData.get('email') || document.getElementById('emailInput')?.value;
  
  // Validation
  const errors = validateForm({ email });
  if (errors.length > 0) {
    showMessage('error', errors.join('<br>'));
    return false;
  }
  
  const submitData = {
    email: email.trim(),
    slug: slug,
    priceIndex: priceIndex,
    source: 'payment-form',
    timestamp: new Date().toISOString()
  };
  
  const submitButton = formElement.querySelector('button[type="submit"]');
  
  try {
    setButtonLoading(submitButton, true);
    
    const response = await fetch(paymentUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(submitData)
    });
    
    if (response.ok) {
      const result = await response.json();
      
      if (result.checkoutUrl) {
        // Redirection vers Stripe Checkout
        window.location.href = result.checkoutUrl;
      } else {
        setButtonSuccess(submitButton);
        if (onSuccess) onSuccess(result);
      }
      
      return true;
      
    } else {
      throw new Error(`Payment error: ${response.status}`);
    }
    
  } catch (error) {
    console.error('❌ Erreur paiement:', error);
    setButtonError(submitButton);
    showMessage('error', 'Erreur lors du paiement');
    
    if (onError) onError(error);
    return false;
  }
}

/**
 * ===== GESTION DES FORMULAIRES AUTOMATIQUE =====
 */
function initializeForms() {
  // Formulaires de lead capture
  const leadForms = document.querySelectorAll('.lead-form, #leadForm');
  leadForms.forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const slug = form.dataset.slug || getSlugFromUrl();
      const captureUrl = form.dataset.captureUrl || '/api/capture';
      const redirectUrl = form.dataset.redirectUrl;
      
      await submitLeadForm(form, {
        slug,
        captureUrl,
        redirectUrl
      });
    });
  });
  
  // Formulaires de paiement
  const paymentForms = document.querySelectorAll('.payment-form, #paymentForm');
  paymentForms.forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const slug = form.dataset.slug || getSlugFromUrl();
      const paymentUrl = form.dataset.paymentUrl || '/api/payment';
      const priceIndex = parseInt(form.dataset.priceIndex || 0);
      
      await submitPaymentForm(form, {
        slug,
        paymentUrl,
        priceIndex
      });
    });
  });
}

/**
 * ===== UTILITIES =====
 */
function getSlugFromUrl() {
  const path = window.location.pathname;
  const segments = path.split('/').filter(segment => segment);
  return segments[0] || '';
}

function getPageType() {
  const path = window.location.pathname;
  if (path.includes('/lead')) return 'lead';
  if (path.includes('/live')) return 'live';
  if (path.includes('/vente')) return 'vente';
  return 'profile';
}

function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      showMessage('success', '✅ Copié dans le presse-papier !');
    });
  } else {
    // Fallback pour les navigateurs plus anciens
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    showMessage('success', '✅ Copié dans le presse-papier !');
  }
}

function shareCurrentPage() {
  const title = document.title;
  const url = window.location.href;
  const text = `Découvrez ${title}`;
  
  if (navigator.share) {
    navigator.share({
      title: title,
      text: text,
      url: url
    }).catch(err => console.log('Erreur de partage:', err));
  } else {
    copyToClipboard(url);
  }
}

/**
 * ===== ANALYTICS ET TRACKING =====
 */
function trackEvent(eventName, properties = {}) {
  // Préparer les données d'événement
  const eventData = {
    event: eventName,
    timestamp: new Date().toISOString(),
    page: window.location.pathname,
    slug: getSlugFromUrl(),
    pageType: getPageType(),
    userAgent: navigator.userAgent,
    referrer: document.referrer,
    ...properties
  };
  
  // Envoyer à l'API analytics (optionnel)
  if (typeof gtag !== 'undefined') {
    gtag('event', eventName, properties);
  }
  
  console.log('📊 Event tracked:', eventData);
}

/**
 * ===== GESTION DES OPTIONS DE PRIX =====
 */
function initializePriceOptions() {
  const options = document.querySelectorAll('.option, .price-option');
  const hiddenInput = document.getElementById('selectedPrice');
  
  options.forEach((option, index) => {
    option.addEventListener('click', () => {
      // Désélectionner toutes les options
      options.forEach(opt => opt.classList.remove('selected'));
      
      // Sélectionner l'option cliquée
      option.classList.add('selected');
      
      // Mettre à jour l'input caché
      if (hiddenInput) {
        hiddenInput.value = option.dataset.index || index;
      }
      
      // Tracker l'événement
      trackEvent('price_option_selected', {
        priceIndex: option.dataset.index || index,
        priceValue: option.dataset.price || 'unknown'
      });
    });
  });
  
  // Sélectionner la première option par défaut
  if (options.length > 0 && !document.querySelector('.option.selected')) {
    options[0].classList.add('selected');
    if (hiddenInput) {
      hiddenInput.value = '0';
    }
  }
}

/**
 * ===== INITIALISATION =====
 */
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 BRANDLYNK Scripts initialized');
  
  try {
    // Initialiser les formulaires
    initializeForms();
    
    // Initialiser les options de prix
    initializePriceOptions();
    
    // Tracker le chargement de la page
    trackEvent('page_view', {
      loadTime: Date.now() - performance.timing.navigationStart
    });
    
    // Gérer les liens de partage
    const shareButtons = document.querySelectorAll('.share-btn, [data-action="share"]');
    shareButtons.forEach(btn => {
      btn.addEventListener('click', shareCurrentPage);
    });
    
    // Gérer les boutons de copie
    const copyButtons = document.querySelectorAll('.copy-btn, [data-action="copy"]');
    copyButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const textToCopy = btn.dataset.text || window.location.href;
        copyToClipboard(textToCopy);
      });
    });
    
    console.log('✅ All BRANDLYNK features initialized successfully');
    
  } catch (error) {
    console.error('❌ Error initializing BRANDLYNK scripts:', error);
  }
});

/**
 * ===== EXPORT POUR UTILISATION EXTERNE =====
 */
window.BRANDLYNK = {
  ...BRANDLYNK,
  validateEmail,
  validateForm,
  submitLeadForm,
  submitPaymentForm,
  showMessage,
  hideMessage,
  setButtonLoading,
  setButtonSuccess,
  setButtonError,
  resetButton,
  trackEvent,
  getSlugFromUrl,
  getPageType,
  copyToClipboard,
  shareCurrentPage
};