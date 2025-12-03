// auth-firebase.js - Version corrigée avec meilleure gestion des erreurs
const AuthApp = (function() {
    'use strict';
    
    // Configuration
    const CONFIG = {
        RATE_LIMIT_ATTEMPTS: 5,
        RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
        SESSION_DURATION: 30 * 24 * 60 * 60 * 1000, // 30 days
        CSRF_TOKEN_KEY: 'makerhub_csrf',
        SKIP_RECAPTCHA: true // DEVELOPMENT MODE - Skip ReCAPTCHA
    };

    // Get config from window
    const Config = window.MAKERHUB_CONFIG || {};
    const API_URL = Config.NODE_API_URL || 'http://localhost:3000';

    // Get Firebase services from centralized config
    let auth, db;
    
    // Initialize Firebase services
    function initializeFirebaseServices() {
        try {
            // Use new centralized Firebase services
            auth = window.firebaseServices ? window.firebaseServices.auth : null;
            db = window.firebaseServices ? window.firebaseServices.db : null;
            
            if (!auth || !db) {
                console.error('Firebase services not available. Waiting for initialization...');
                return false;
            }
            
            console.log('✅ Firebase Auth and Firestore services connected');
            return true;
        } catch (error) {
            console.error('❌ Error getting Firebase services:', error);
            return false;
        }
    }

    // State management
    const state = {
        validationState: {
            email: false,
            profile: false,
            password: false
        },
        currentModal: null,
        isCheckingProfile: false,
        loginAttempts: 0,
        lastLoginAttempt: null,
        csrfToken: null
    };

    // DOM Elements cache
    const elements = {};

    // CSRF Token Management
    function generateCSRFToken() {
        const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        sessionStorage.setItem(CONFIG.CSRF_TOKEN_KEY, token);
        return token;
    }

    function getCSRFToken() {
        let token = sessionStorage.getItem(CONFIG.CSRF_TOKEN_KEY);
        if (!token) {
            token = generateCSRFToken();
        }
        return token;
    }

    // Rate Limiting
    function checkRateLimit() {
        const now = Date.now();
        const attempts = JSON.parse(localStorage.getItem('login_attempts') || '[]');
        
        // Clean old attempts
        const validAttempts = attempts.filter(timestamp => 
            now - timestamp < CONFIG.RATE_LIMIT_WINDOW_MS
        );
        
        if (validAttempts.length >= CONFIG.RATE_LIMIT_ATTEMPTS) {
            const oldestAttempt = Math.min(...validAttempts);
            const timeRemaining = CONFIG.RATE_LIMIT_WINDOW_MS - (now - oldestAttempt);
            const minutesRemaining = Math.ceil(timeRemaining / 60000);
            
            throw new Error(`Too many login attempts. Please try again in ${minutesRemaining} minutes.`);
        }
        
        validAttempts.push(now);
        localStorage.setItem('login_attempts', JSON.stringify(validAttempts));
    }

    // Verify ReCAPTCHA (SKIPPED IN DEVELOPMENT)
    async function verifyRecaptcha(widgetId) {
        // SKIP RECAPTCHA IN DEVELOPMENT
        if (CONFIG.SKIP_RECAPTCHA || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log('🔓 Skipping ReCAPTCHA in development');
            return true;
        }

        // Production code would go here
        return true;
    }

    // Cache DOM elements
    function cacheElements() {
        // Header buttons
        elements.loginBtnHeader = document.getElementById('loginBtn-header');
        elements.signupBtnHeader = document.getElementById('signupBtn-header');
        
        // Mobile menu
        elements.mobileMenuToggle = document.getElementById('mobileMenuToggle');
        elements.navMenu = document.querySelector('.nav-menu');
        
        // Modals
        elements.overlay = document.getElementById('overlay');
        elements.signupModal = document.getElementById('signupModal');
        elements.loginModal = document.getElementById('loginModal');
        elements.forgotModal = document.getElementById('forgotModal');
        
        // Modal close buttons
        elements.closeSignupModal = document.getElementById('closeSignupModal');
        elements.closeLoginModal = document.getElementById('closeLoginModal');
        elements.closeForgotModal = document.getElementById('closeForgotModal');
        
        // Modal switch links
        elements.showLoginFromSignup = document.getElementById('showLoginFromSignup');
        elements.showSignupFromLogin = document.getElementById('showSignupFromLogin');
        elements.showLoginFromForgot = document.getElementById('showLoginFromForgot');
        
        // Form elements
        elements.profileForm = document.getElementById('profileForm');
        elements.profileInput = document.getElementById('profileInput');
        
        // Carousel
        elements.carouselPrev = document.getElementById('carouselPrev');
        elements.carouselNext = document.getElementById('carouselNext');
        elements.carouselTrack = document.getElementById('carouselTrack');
        
        // Signup form
        elements.signupEmail = document.getElementById('signupEmail');
        elements.profileName = document.getElementById('profileName');
        elements.signupPassword = document.getElementById('signupPassword');
        elements.signupBtn = document.getElementById('signupBtn');
        elements.emailValidation = document.getElementById('emailValidation');
        elements.emailMessage = document.getElementById('emailMessage');
        elements.profileValidation = document.getElementById('profileValidation');
        elements.profileMessage = document.getElementById('profileMessage');
        elements.passwordStrength = document.getElementById('passwordStrength');
        elements.signupLoading = document.getElementById('signupLoading');
        elements.signupError = document.getElementById('signupError');
        elements.signupSuccess = document.getElementById('signupSuccess');
        elements.rememberMe = document.getElementById('rememberMe');
        
        // Login form
        elements.email = document.getElementById('email');
        elements.password = document.getElementById('password');
        elements.loginBtn = document.getElementById('loginBtn');
        elements.loginLoading = document.getElementById('loginLoading');
        elements.loginError = document.getElementById('loginError');
        elements.loginSuccess = document.getElementById('loginSuccess');
        elements.rememberLogin = document.getElementById('rememberLogin');
        
        // Forgot password
        elements.forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
        elements.forgotEmail = document.getElementById('forgotEmail');
        elements.forgotBtn = document.getElementById('forgotBtn');
        elements.forgotLoading = document.getElementById('forgotLoading');
        elements.forgotError = document.getElementById('forgotError');
        elements.forgotSuccess = document.getElementById('forgotSuccess');
        
        // Pricing
        elements.monthly = document.getElementById('monthly');
        elements.annual = document.getElementById('annual');
        elements.proPrice = document.getElementById('pro-price');
        elements.businessPrice = document.getElementById('business-price');
        
        // Final CTA
        elements.finalCTA = document.getElementById('finalCTA');
    }

    // Firebase Auth Module
    const firebaseAuth = {
        // Check if user is already logged in
        checkAuthState: function() {
            if (!auth) {
                console.error('Firebase Auth not initialized');
                return;
            }
            
            // IMPORTANT: Ne PAS rediriger automatiquement sur auth.html
            // L'utilisateur doit pouvoir créer un nouveau compte
            if (window.location.pathname.includes('auth.html')) {
                console.log('Sur la page auth.html - pas de redirection automatique');
                
                // Optionnel: Afficher l'état de connexion dans la console
                auth.onAuthStateChanged((user) => {
                    if (user) {
                        console.log('Utilisateur connecté:', user.email);
                        console.log('Pour se déconnecter, utilisez: firebase.auth().signOut()');
                    } else {
                        console.log('Aucun utilisateur connecté');
                    }
                });
                return;
            }
            
            // Don't redirect if already on these pages
            if (window.location.pathname.includes('dashboard.html') || 
                window.location.pathname.includes('createLanding.html') ||
                window.location.pathname.includes('telegramsubscription.html')) {
                return;
            }
            
            auth.onAuthStateChanged(async (user) => {
                if (user) {
                    console.log('User already logged in:', user.email);
                    
                    // Get user profile data
                    try {
                        const userDoc = await db.collection('users').doc(user.uid).get();
                        if (userDoc.exists) {
                            const userData = userDoc.data();
                            const profileName = userData.profileName || userData.profileSlug || '';
                            
                            // Set auth persistence based on remember me
                            const persistence = localStorage.getItem('remember_me') === 'true' 
                                ? firebase.auth.Auth.Persistence.LOCAL 
                                : firebase.auth.Auth.Persistence.SESSION;
                            
                            auth.setPersistence(persistence).then(() => {
                                // Redirect to createLanding with profile name
                                window.location.href = `createLanding.html?profile=${profileName}`;
                            });
                        }
                    } catch (error) {
                        console.error('Error getting user data:', error);
                        window.location.href = 'createLanding.html';
                    }
                }
            });
        },

        // Sign up with Firebase
        signUp: async function(email, password, profileName, rememberMe) {
            try {
                console.log('🔍 Starting signup process...');
                console.log('Email:', email);
                console.log('Profile:', profileName);
                console.log('Firebase Auth:', !!auth);
                console.log('Firebase DB:', !!db);
                
                if (!auth || !db) {
                    throw new Error('Firebase services not initialized. Please refresh the page.');
                }
                
                // Verify ReCAPTCHA (skipped in dev)
                await verifyRecaptcha();
                
                // Set persistence BEFORE creating user
                const persistence = rememberMe 
                    ? firebase.auth.Auth.Persistence.LOCAL 
                    : firebase.auth.Auth.Persistence.SESSION;
                
                await auth.setPersistence(persistence);
                console.log('✅ Persistence set');
                
                // Check if profile is available FIRST
                const profileAvailable = await this.checkProfileAvailability(profileName);
                if (!profileAvailable) {
                    throw new Error('This profile name is already taken');
                }
                
                // Create user with Firebase Auth
                console.log('🔍 Creating user in Firebase Auth...');
                let userCredential;
                try {
                    userCredential = await auth.createUserWithEmailAndPassword(email, password);
                    console.log('✅ User created in Auth:', userCredential.user.uid);
                } catch (authError) {
                    console.error('❌ Firebase Auth Error:', authError);
                    console.error('Error code:', authError.code);
                    console.error('Error message:', authError.message);
                    
                    // Re-throw with proper error message
                    if (authError.code === 'auth/email-already-in-use') {
                        throw new Error('This email is already registered. Please login instead.');
                    }
                    throw authError;
                }
                
                const user = userCredential.user;
                
                // Send verification email (but don't wait for it)
                user.sendEmailVerification().catch(err => {
                    console.warn('Could not send verification email:', err);
                });

                // Create user profile in Firestore
                console.log('🔍 Creating user profile in Firestore...');
                try {
                    await db.collection('users').doc(user.uid).set({
                        email: email,
                        profileName: profileName,
                        profileSlug: profileName.toLowerCase(),
                        role: 'user',
                        subscription: 'free',
                        emailVerified: false,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                        metadata: {
                            userAgent: navigator.userAgent,
                            platform: navigator.platform,
                            language: navigator.language
                        }
                    });
                    console.log('✅ User profile created');
                } catch (dbError) {
                    console.error('❌ Firestore Error:', dbError);
                    // If we can't create the profile, delete the auth user
                    await user.delete();
                    throw new Error('Could not create user profile. Please try again.');
                }

                // Create profile document
                console.log('🔍 Creating profile document...');
                try {
                    await db.collection('profiles').doc(profileName.toLowerCase()).set({
                        userId: user.uid,
                        profileName: profileName,
                        slug: profileName.toLowerCase(),
                        isActive: true,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    console.log('✅ Profile document created');
                } catch (profileError) {
                    console.error('❌ Profile creation error:', profileError);
                    // Clean up if profile creation fails
                    await db.collection('users').doc(user.uid).delete();
                    await user.delete();
                    throw new Error('Could not reserve profile name. Please try again.');
                }

                // Store remember me preference
                if (rememberMe) {
                    localStorage.setItem('remember_me', 'true');
                }
                
                // Store profile name for redirect
                localStorage.setItem('makerhub_profile_name', profileName);
                localStorage.setItem('user_profile', profileName);
                localStorage.setItem('signup_profile', profileName);

                console.log('✅ Signup completed successfully!');
                return { success: true, user, emailSent: true };
                
            } catch (error) {
                console.error('❌ Signup error:', error);
                console.error('Error details:', {
                    code: error.code,
                    message: error.message,
                    stack: error.stack
                });
                
                let errorMessage = 'An error occurred during signup';
                
                // Si c'est déjà notre message d'erreur custom, le garder
                if (error.message && !error.code) {
                    errorMessage = error.message;
                } else {
                    // Sinon, traiter les codes d'erreur Firebase
                    switch (error.code) {
                        case 'auth/email-already-in-use':
                            errorMessage = 'This email is already registered. Please login instead.';
                            break;
                        case 'auth/weak-password':
                            errorMessage = 'Password is too weak (minimum 6 characters)';
                            break;
                        case 'auth/invalid-email':
                            errorMessage = 'Invalid email format';
                            break;
                        case 'auth/network-request-failed':
                            errorMessage = 'Network error - check your connection';
                            break;
                        case 'permission-denied':
                            errorMessage = 'Database permission denied - contact support';
                            break;
                        case 'auth/operation-not-allowed':
                            errorMessage = 'Email/password authentication is not enabled';
                            break;
                        default:
                            if (error.message && error.message.includes('permission')) {
                                errorMessage = 'Database permission error - contact support';
                            } else {
                                errorMessage = error.message || 'Unknown error occurred';
                            }
                    }
                }
                
                return { success: false, error: errorMessage };
            }
        },

        // Sign in with Firebase
        signIn: async function(email, password, rememberMe) {
            try {
                if (!auth || !db) {
                    throw new Error('Firebase not initialized');
                }
                
                // Check rate limit
                checkRateLimit();
                
                // Verify ReCAPTCHA (skipped in dev)
                await verifyRecaptcha();
                
                // Set persistence
                const persistence = rememberMe 
                    ? firebase.auth.Auth.Persistence.LOCAL 
                    : firebase.auth.Auth.Persistence.SESSION;
                
                await auth.setPersistence(persistence);
                
                const userCredential = await auth.signInWithEmailAndPassword(email, password);
                const user = userCredential.user;

                // Update last login
                try {
                    await db.collection('users').doc(user.uid).update({
                        lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                        failedLoginAttempts: 0
                    });
                } catch (updateError) {
                    console.error('Error updating last login:', updateError);
                }

                // Store remember me preference
                if (rememberMe) {
                    localStorage.setItem('remember_me', 'true');
                }

                // Clear rate limit on successful login
                localStorage.removeItem('login_attempts');
                
                // Get user profile name for redirect
                try {
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    if (userDoc.exists) {
                        const userData = userDoc.data();
                        const profileName = userData.profileName || userData.profileSlug || '';
                        
                        // Store profile name
                        localStorage.setItem('makerhub_profile_name', profileName);
                        localStorage.setItem('user_profile', profileName);
                        localStorage.setItem('signup_profile', profileName);
                    }
                } catch (error) {
                    console.error('Error getting profile name:', error);
                }

                return { success: true, user };
            } catch (error) {
                console.error('Login error:', error);
                
                let errorMessage = 'Email or password incorrect';
                
                switch (error.code) {
                    case 'auth/user-not-found':
                    case 'auth/wrong-password':
                        errorMessage = 'Email or password incorrect';
                        break;
                    case 'auth/invalid-email':
                        errorMessage = 'Invalid email format';
                        break;
                    case 'auth/user-disabled':
                        errorMessage = 'This account has been disabled';
                        break;
                    case 'auth/too-many-requests':
                        errorMessage = 'Too many attempts. Please try again later';
                        break;
                    case 'auth/network-request-failed':
                        errorMessage = 'Network error - check your connection';
                        break;
                    default:
                        errorMessage = error.message || 'Login failed';
                }
                
                return { success: false, error: errorMessage };
            }
        },

        // Reset password
        resetPassword: async function(email) {
            try {
                await auth.sendPasswordResetEmail(email, {
                    url: window.location.origin + '/auth.html',
                    handleCodeInApp: false
                });
                
                return { success: true };
            } catch (error) {
                console.error('Password reset error:', error);
                let errorMessage = 'Failed to send reset email';
                
                switch (error.code) {
                    case 'auth/user-not-found':
                        errorMessage = 'No account found with this email';
                        break;
                    case 'auth/invalid-email':
                        errorMessage = 'Invalid email format';
                        break;
                    default:
                        errorMessage = error.message || 'Failed to send reset email';
                }
                
                return { success: false, error: errorMessage };
            }
        },

        // Check if profile name is available
        checkProfileAvailability: async function(profileName) {
            try {
                console.log('🔍 Checking profile availability:', profileName);
                
                if (!db) {
                    console.error('❌ Firestore not initialized');
                    // Ne pas retourner true si la DB n'est pas disponible
                    throw new Error('Database not available');
                }
                
                const profileDoc = await db.collection('profiles').doc(profileName.toLowerCase()).get();
                const isAvailable = !profileDoc.exists;
                
                console.log(`Profile ${profileName} is ${isAvailable ? 'available' : 'taken'}`);
                return isAvailable;
                
            } catch (error) {
                console.error('❌ Error checking profile availability:', error);
                // En cas d'erreur, considérer le profil comme non disponible par sécurité
                throw error;
            }
        }
    };

    // Carousel Module
    const carousel = {
        currentIndex: 0,
        cards: [],
        
        init: function() {
            if (!elements.carouselTrack) return;
            
            this.cards = elements.carouselTrack.querySelectorAll('.template-card');
            if (this.cards.length > 0) {
                const cardWidth = this.cards[0].offsetWidth;
                const gap = 24;
                this.scrollAmount = cardWidth + gap;
                
                // Add keyboard navigation
                elements.carouselTrack.addEventListener('keydown', (e) => {
                    if (e.key === 'ArrowLeft') this.scroll('prev');
                    if (e.key === 'ArrowRight') this.scroll('next');
                });
            }
        },
        
        scroll: function(direction) {
            if (!elements.carouselTrack) return;
            
            const maxScroll = elements.carouselTrack.scrollWidth - elements.carouselTrack.clientWidth;
            const currentScroll = elements.carouselTrack.scrollLeft;
            
            if (direction === 'prev') {
                const newScroll = Math.max(0, currentScroll - this.scrollAmount);
                elements.carouselTrack.scrollTo({
                    left: newScroll,
                    behavior: 'smooth'
                });
                
                // Update button states
                elements.carouselPrev.disabled = newScroll === 0;
                elements.carouselNext.disabled = false;
            } else {
                const newScroll = Math.min(maxScroll, currentScroll + this.scrollAmount);
                elements.carouselTrack.scrollTo({
                    left: newScroll,
                    behavior: 'smooth'
                });
                
                // Update button states
                elements.carouselNext.disabled = newScroll >= maxScroll;
                elements.carouselPrev.disabled = false;
            }
        },
        
        scrollAmount: 300
    };

    // Modal Module
    const modal = {
        show: function(modalType) {
            this.closeAll();
            
            // Reset forms when opening
            this.resetForms();
            
            if (modalType === 'signup') {
                if (elements.overlay) elements.overlay.classList.add('show');
                if (elements.signupModal) elements.signupModal.classList.add('show');
                state.currentModal = 'signup';
                
                // Focus on first input
                setTimeout(() => {
                    if (elements.signupEmail) elements.signupEmail.focus();
                }, 100);
            } else if (modalType === 'login') {
                if (elements.overlay) elements.overlay.classList.add('show');
                if (elements.loginModal) elements.loginModal.classList.add('show');
                state.currentModal = 'login';
                
                // Focus on first input
                setTimeout(() => {
                    if (elements.email) elements.email.focus();
                }, 100);
            } else if (modalType === 'forgot') {
                if (elements.overlay) elements.overlay.classList.add('show');
                if (elements.forgotModal) elements.forgotModal.classList.add('show');
                state.currentModal = 'forgot';
                
                // Focus on email input
                setTimeout(() => {
                    if (elements.forgotEmail) elements.forgotEmail.focus();
                }, 100);
            }
        },
        
        closeAll: function() {
            if (elements.signupModal) elements.signupModal.classList.remove('show');
            if (elements.loginModal) elements.loginModal.classList.remove('show');
            if (elements.forgotModal) elements.forgotModal.classList.remove('show');
            if (elements.overlay) elements.overlay.classList.remove('show');
            state.currentModal = null;
        },
        
        resetForms: function() {
            // Reset signup form
            if (elements.signupEmail) {
                elements.signupEmail.value = '';
                elements.signupEmail.classList.remove('error');
            }
            if (elements.profileName) {
                elements.profileName.value = '';
                elements.profileName.classList.remove('error');
            }
            if (elements.signupPassword) {
                elements.signupPassword.value = '';
                elements.signupPassword.classList.remove('error');
            }
            if (elements.rememberMe) elements.rememberMe.checked = false;
            
            // Reset login form
            if (elements.email) {
                elements.email.value = '';
                elements.email.classList.remove('error');
            }
            if (elements.password) {
                elements.password.value = '';
                elements.password.classList.remove('error');
            }
            if (elements.rememberLogin) elements.rememberLogin.checked = false;
            
            // Reset forgot form
            if (elements.forgotEmail) {
                elements.forgotEmail.value = '';
                elements.forgotEmail.classList.remove('error');
            }
            
            // Reset validation states
            state.validationState = {
                email: false,
                profile: false,
                password: false
            };
            
            // Reset validation messages
            if (elements.emailValidation) elements.emailValidation.innerHTML = '';
            if (elements.emailMessage) elements.emailMessage.textContent = '';
            if (elements.profileValidation) elements.profileValidation.innerHTML = '';
            if (elements.profileMessage) elements.profileMessage.textContent = '';
            if (elements.passwordStrength) {
                elements.passwordStrength.textContent = '';
                elements.passwordStrength.classList.remove('visible', 'weak', 'fair', 'good', 'strong');
            }
            
            // Hide errors/success
            this.hideAllMessages();
            
            // Disable submit button
            if (elements.signupBtn) elements.signupBtn.disabled = true;
        },
        
        hideAllMessages: function() {
            const messages = [
                elements.signupError, elements.signupSuccess, elements.signupLoading,
                elements.loginError, elements.loginSuccess, elements.loginLoading,
                elements.forgotError, elements.forgotSuccess, elements.forgotLoading
            ];
            
            messages.forEach(el => {
                if (el) el.style.display = 'none';
            });
        }
    };

    // Validation Module
    const validation = {
        email: function(email) {
            const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return re.test(email);
        },
        
        profileName: function(name) {
            const re = /^[a-zA-Z0-9_-]{3,20}$/;
            return re.test(name);
        },
        
        passwordStrength: function(password) {
            let score = 0;
            if (password.length >= 8) score++;
            if (/[a-z]/.test(password)) score++;
            if (/[A-Z]/.test(password)) score++;
            if (/\d/.test(password)) score++;
            if (/[@$!%*?&]/.test(password)) score++;
            return score;
        },
        
        updateButtonState: function() {
            const allValid = state.validationState.email && 
                           state.validationState.profile && 
                           state.validationState.password;
            
            if (elements.signupBtn) {
                elements.signupBtn.disabled = !allValid;
                elements.signupBtn.setAttribute('aria-disabled', !allValid);
            }
        }
    };

    // Form Handlers Module
    const formHandlers = {
        handleEmailInput: function() {
            const email = elements.signupEmail.value;
            
            // IMPORTANT: Effacer l'erreur quand l'utilisateur tape
            if (elements.signupError) {
                elements.signupError.style.display = 'none';
            }
            elements.signupEmail.classList.remove('error');
            
            if (email.length === 0) {
                elements.emailValidation.innerHTML = '';
                elements.emailMessage.textContent = '';
                state.validationState.email = false;
            } else if (validation.email(email)) {
                elements.emailValidation.innerHTML = '<i class="fas fa-check validation-success"></i>';
                elements.emailMessage.textContent = 'Valid email';
                elements.emailMessage.className = 'validation-message success';
                state.validationState.email = true;
            } else {
                elements.emailValidation.innerHTML = '<i class="fas fa-times validation-error"></i>';
                elements.emailMessage.textContent = 'Invalid email format';
                elements.emailMessage.className = 'validation-message error';
                state.validationState.email = false;
            }
            
            validation.updateButtonState();
        },
        
        handleProfileInput: async function() {
            const name = elements.profileName.value;
            
            // IMPORTANT: Effacer l'erreur quand l'utilisateur tape
            if (elements.signupError) {
                elements.signupError.style.display = 'none';
            }
            elements.profileName.classList.remove('error');
            
            if (name.length === 0) {
                elements.profileValidation.innerHTML = '';
                elements.profileMessage.textContent = '';
                state.validationState.profile = false;
            } else if (!validation.profileName(name)) {
                elements.profileValidation.innerHTML = '<i class="fas fa-times validation-error"></i>';
                elements.profileMessage.textContent = '3-20 characters, letters, numbers, _ and - only';
                elements.profileMessage.className = 'validation-message error';
                state.validationState.profile = false;
            } else {
                // Check availability in Firebase
                if (!state.isCheckingProfile) {
                    state.isCheckingProfile = true;
                    elements.profileValidation.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                    elements.profileMessage.textContent = 'Checking availability...';
                    elements.profileMessage.className = 'validation-message';
                    
                    try {
                        const isAvailable = await firebaseAuth.checkProfileAvailability(name);
                        
                        if (isAvailable) {
                            elements.profileValidation.innerHTML = '<i class="fas fa-check validation-success"></i>';
                            elements.profileMessage.textContent = 'Profile name available';
                            elements.profileMessage.className = 'validation-message success';
                            state.validationState.profile = true;
                        } else {
                            elements.profileValidation.innerHTML = '<i class="fas fa-times validation-error"></i>';
                            elements.profileMessage.textContent = 'This profile name is already taken';
                            elements.profileMessage.className = 'validation-message error';
                            state.validationState.profile = false;
                        }
                    } catch (error) {
                        console.error('Error checking profile:', error);
                        elements.profileValidation.innerHTML = '<i class="fas fa-exclamation-triangle validation-error"></i>';
                        elements.profileMessage.textContent = 'Error checking availability. Please try again.';
                        elements.profileMessage.className = 'validation-message error';
                        state.validationState.profile = false;
                    }
                    
                    state.isCheckingProfile = false;
                }
            }
            
            validation.updateButtonState();
        },
        
        handlePasswordInput: function() {
            const password = elements.signupPassword.value;
            
            // IMPORTANT: Effacer l'erreur quand l'utilisateur tape
            if (elements.signupError) {
                elements.signupError.style.display = 'none';
            }
            elements.signupPassword.classList.remove('error');
            
            if (password.length === 0) {
                elements.passwordStrength.classList.remove('visible');
                state.validationState.password = false;
            } else {
                const strength = validation.passwordStrength(password);
                elements.passwordStrength.classList.add('visible');
                
                elements.passwordStrength.classList.remove('weak', 'fair', 'good', 'strong');
                
                if (password.length < 6) {
                    elements.passwordStrength.classList.add('weak');
                    elements.passwordStrength.textContent = 'Minimum 6 characters required';
                    state.validationState.password = false;
                } else if (strength <= 2) {
                    elements.passwordStrength.classList.add('weak');
                    elements.passwordStrength.textContent = 'Weak password';
                    state.validationState.password = true;
                } else if (strength === 3) {
                    elements.passwordStrength.classList.add('fair');
                    elements.passwordStrength.textContent = 'Fair password';
                    state.validationState.password = true;
                } else if (strength === 4) {
                    elements.passwordStrength.classList.add('good');
                    elements.passwordStrength.textContent = 'Good password';
                    state.validationState.password = true;
                } else {
                    elements.passwordStrength.classList.add('strong');
                    elements.passwordStrength.textContent = 'Strong password';
                    state.validationState.password = true;
                }
            }
            
            validation.updateButtonState();
        },
        
        handleSignup: async function() {
            const email = elements.signupEmail.value;
            const profile = elements.profileName.value;
            const password = elements.signupPassword.value;
            const rememberMe = elements.rememberMe.checked;
            
            // Show loading
            modal.hideAllMessages();
            if (elements.signupLoading) elements.signupLoading.style.display = 'block';
            if (elements.signupBtn) elements.signupBtn.disabled = true;
            
            // Firebase signup
            const result = await firebaseAuth.signUp(email, password, profile, rememberMe);
            
            if (elements.signupLoading) elements.signupLoading.style.display = 'none';
            
            if (result.success) {
                if (elements.signupSuccess) {
                    const message = result.emailSent 
                        ? 'Account created! Check your email to verify your address. Redirecting...'
                        : 'Account created successfully! Redirecting...';
                    elements.signupSuccess.textContent = message;
                    elements.signupSuccess.style.display = 'block';
                }
                
                // Redirect after success to createLanding
                setTimeout(() => {
                    const profileName = localStorage.getItem('makerhub_profile_name') || result.user.displayName || '';
                    window.location.href = 'createLanding.html';
                }, 2000);
            } else {
                if (elements.signupError) {
                    elements.signupError.textContent = result.error;
                    elements.signupError.style.display = 'block';
                }
                if (elements.signupBtn) elements.signupBtn.disabled = false;
                
                // Marquer les champs comme erreur selon le type d'erreur
                if (result.error.toLowerCase().includes('email')) {
                    elements.signupEmail.classList.add('error');
                }
                if (result.error.toLowerCase().includes('profile')) {
                    elements.profileName.classList.add('error');
                }
                if (result.error.toLowerCase().includes('password')) {
                    elements.signupPassword.classList.add('error');
                }
            }
        },
        
        handleLogin: async function() {
            const email = elements.email.value;
            const password = elements.password.value;
            const rememberMe = elements.rememberLogin.checked;
            
            if (!email || !password) {
                if (elements.loginError) {
                    elements.loginError.textContent = 'Please fill in all fields';
                    elements.loginError.style.display = 'block';
                }
                return;
            }
            
            // Show loading
            modal.hideAllMessages();
            if (elements.loginLoading) elements.loginLoading.style.display = 'block';
            if (elements.loginBtn) elements.loginBtn.disabled = true;
            
            // Firebase login
            const result = await firebaseAuth.signIn(email, password, rememberMe);
            
            if (elements.loginLoading) elements.loginLoading.style.display = 'none';
            
            if (result.success) {
                if (elements.loginSuccess) {
                    elements.loginSuccess.textContent = 'Login successful! Redirecting...';
                    elements.loginSuccess.style.display = 'block';
                }
                
                // Redirect after success to createLanding (for development)
                setTimeout(() => {
                    const profileName = localStorage.getItem('makerhub_profile_name') || '';
                    window.location.href = `createLanding.html?profile=${profileName}`;
                }, 1500);
            } else {
                if (elements.loginError) {
                    elements.loginError.textContent = result.error;
                    elements.loginError.style.display = 'block';
                }
                if (elements.loginBtn) elements.loginBtn.disabled = false;
            }
        },
        
        handleForgotPassword: async function() {
            const email = elements.forgotEmail.value;
            
            if (!email) {
                if (elements.forgotError) {
                    elements.forgotError.textContent = 'Please enter your email';
                    elements.forgotError.style.display = 'block';
                }
                return;
            }
            
            // Show loading
            modal.hideAllMessages();
            if (elements.forgotLoading) elements.forgotLoading.style.display = 'block';
            if (elements.forgotBtn) elements.forgotBtn.disabled = true;
            
            const result = await firebaseAuth.resetPassword(email);
            
            if (elements.forgotLoading) elements.forgotLoading.style.display = 'none';
            
            if (result.success) {
                if (elements.forgotSuccess) {
                    elements.forgotSuccess.textContent = 'Password reset email sent! Check your inbox.';
                    elements.forgotSuccess.style.display = 'block';
                }
                
                // Return to login after 3 seconds
                setTimeout(() => {
                    modal.show('login');
                }, 3000);
            } else {
                if (elements.forgotError) {
                    elements.forgotError.textContent = result.error;
                    elements.forgotError.style.display = 'block';
                }
                if (elements.forgotBtn) elements.forgotBtn.disabled = false;
            }
        },
        
        handleProfileForm: function(e) {
            e.preventDefault();
            
            const profileValue = elements.profileInput.value.trim();
            
            if (!profileValue) {
                alert('Please enter a profile name');
                return;
            }
            
            // Pre-fill the profile name in signup modal
            if (elements.profileName) {
                elements.profileName.value = profileValue;
                // Trigger validation
                formHandlers.handleProfileInput();
            }
            
            modal.show('signup');
        }
    };

    // Pricing Module
    const pricing = {
        toggleBilling: function(type) {
            if (type === 'monthly') {
                if (elements.monthly) {
                    elements.monthly.classList.add('active');
                    elements.monthly.setAttribute('aria-pressed', 'true');
                }
                if (elements.annual) {
                    elements.annual.classList.remove('active');
                    elements.annual.setAttribute('aria-pressed', 'false');
                }
                
                // Update prices to monthly
                if (elements.proPrice) elements.proPrice.textContent = '49';
                if (elements.businessPrice) elements.businessPrice.textContent = '99';
                
                // Hide crossed out annual prices
                document.querySelectorAll('.price-annual').forEach(el => {
                    el.style.display = 'none';
                });
                
                // Hide discount badge
                const discountBadge = document.querySelector('.discount-badge');
                if (discountBadge) discountBadge.style.opacity = '0.5';
                
            } else if (type === 'annual') {
                if (elements.annual) {
                    elements.annual.classList.add('active');
                    elements.annual.setAttribute('aria-pressed', 'true');
                }
                if (elements.monthly) {
                    elements.monthly.classList.remove('active');
                    elements.monthly.setAttribute('aria-pressed', 'false');
                }
                
                // Update prices to annual (30% off)
                if (elements.proPrice) elements.proPrice.textContent = '34';
                if (elements.businessPrice) elements.businessPrice.textContent = '69';
                
                // Show crossed out monthly prices
                document.querySelectorAll('.price-annual').forEach(el => {
                    el.style.display = 'inline';
                    el.style.textDecoration = 'line-through';
                    el.style.opacity = '0.6';
                    el.style.fontSize = '0.9em';
                    el.style.marginRight = '8px';
                });
                
                // Show discount badge
                const discountBadge = document.querySelector('.discount-badge');
                if (discountBadge) discountBadge.style.opacity = '1';
            }
        }
    };

    // Mobile Menu Module
    const mobileMenu = {
        init: function() {
            if (!elements.mobileMenuToggle || !elements.navMenu) return;
            
            elements.mobileMenuToggle.addEventListener('click', () => {
                const isExpanded = elements.mobileMenuToggle.getAttribute('aria-expanded') === 'true';
                elements.mobileMenuToggle.setAttribute('aria-expanded', !isExpanded);
                elements.navMenu.classList.toggle('mobile-open');
                document.body.classList.toggle('menu-open');
            });
            
            // Close menu when clicking outside
            document.addEventListener('click', (e) => {
                if (!elements.navMenu.contains(e.target) && 
                    !elements.mobileMenuToggle.contains(e.target) &&
                    elements.navMenu.classList.contains('mobile-open')) {
                    elements.navMenu.classList.remove('mobile-open');
                    document.body.classList.remove('menu-open');
                    elements.mobileMenuToggle.setAttribute('aria-expanded', 'false');
                }
            });
        }
    };

    // Smooth scroll for navigation links
    function setupSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                e.preventDefault();
                const targetId = this.getAttribute('href');
                if (targetId === '#') return;
                
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    targetElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                    
                    // Close mobile menu if open
                    if (elements.navMenu && elements.navMenu.classList.contains('mobile-open')) {
                        elements.navMenu.classList.remove('mobile-open');
                        document.body.classList.remove('menu-open');
                        elements.mobileMenuToggle.setAttribute('aria-expanded', 'false');
                    }
                }
            });
        });
    }

    // Lazy load images
    function setupLazyLoading() {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src || img.src;
                        img.classList.add('loaded');
                        observer.unobserve(img);
                    }
                });
            });
            
            document.querySelectorAll('img[loading="lazy"]').forEach(img => {
                imageObserver.observe(img);
            });
        }
    }

    // Event Listeners Setup
    function setupEventListeners() {
        // Header buttons
        if (elements.loginBtnHeader) {
            elements.loginBtnHeader.addEventListener('click', () => modal.show('login'));
        }
        
        if (elements.signupBtnHeader) {
            elements.signupBtnHeader.addEventListener('click', () => modal.show('signup'));
        }
        
        // Modal close buttons
        if (elements.closeSignupModal) {
            elements.closeSignupModal.addEventListener('click', () => modal.closeAll());
        }
        
        if (elements.closeLoginModal) {
            elements.closeLoginModal.addEventListener('click', () => modal.closeAll());
        }
        
        if (elements.closeForgotModal) {
            elements.closeForgotModal.addEventListener('click', () => modal.closeAll());
        }
        
        // Forgot password link
        if (elements.forgotPasswordBtn) {
            elements.forgotPasswordBtn.addEventListener('click', () => modal.show('forgot'));
        }
        
        // Back to login from forgot
        if (elements.showLoginFromForgot) {
            elements.showLoginFromForgot.addEventListener('click', () => modal.show('login'));
        }
        
        // Carousel buttons
        if (elements.carouselPrev) {
            elements.carouselPrev.addEventListener('click', () => carousel.scroll('prev'));
        }
        
        if (elements.carouselNext) {
            elements.carouselNext.addEventListener('click', () => carousel.scroll('next'));
        }
        
        // Profile form
        if (elements.profileForm) {
            elements.profileForm.addEventListener('submit', formHandlers.handleProfileForm);
        }
        
        // Service cards
        document.querySelectorAll('.card-cta').forEach(button => {
            button.addEventListener('click', () => modal.show('signup'));
        });
        
        // Template cards
        document.querySelectorAll('.template-btn').forEach(button => {
            button.addEventListener('click', () => modal.show('signup'));
        });
        
        // Pricing cards
        document.querySelectorAll('.plan-cta').forEach(button => {
            button.addEventListener('click', () => modal.show('signup'));
        });
        
        // Final CTA
        if (elements.finalCTA) {
            elements.finalCTA.addEventListener('click', () => modal.show('signup'));
        }
        
        // Overlay click to close
        if (elements.overlay) {
            elements.overlay.addEventListener('click', function(e) {
                if (e.target === elements.overlay) {
                    modal.closeAll();
                }
            });
        }
        
        // Form validation with debounce for profile check
        if (elements.signupEmail) {
            elements.signupEmail.addEventListener('input', formHandlers.handleEmailInput);
            
            // IMPORTANT: Effacer l'erreur au focus
            elements.signupEmail.addEventListener('focus', function() {
                if (elements.signupError) {
                    elements.signupError.style.display = 'none';
                }
                this.classList.remove('error');
            });
        }
        
        if (elements.profileName) {
            let profileTimeout;
            elements.profileName.addEventListener('input', function() {
                clearTimeout(profileTimeout);
                const value = this.value;
                
                // Immediate validation for format
                if (value.length > 0 && !validation.profileName(value)) {
                    elements.profileValidation.innerHTML = '<i class="fas fa-times validation-error"></i>';
                    elements.profileMessage.textContent = '3-20 characters, letters, numbers, _ and - only';
                    elements.profileMessage.className = 'validation-message error';
                    state.validationState.profile = false;
                    validation.updateButtonState();
                } else if (value.length >= 3) {
                    // Debounce the Firebase check
                    profileTimeout = setTimeout(() => {
                        formHandlers.handleProfileInput();
                    }, 500);
                } else {
                    elements.profileValidation.innerHTML = '';
                    elements.profileMessage.textContent = '';
                    state.validationState.profile = false;
                    validation.updateButtonState();
                }
            });
            
            // IMPORTANT: Effacer l'erreur au focus
            elements.profileName.addEventListener('focus', function() {
                if (elements.signupError) {
                    elements.signupError.style.display = 'none';
                }
                this.classList.remove('error');
            });
        }
        
        if (elements.signupPassword) {
            elements.signupPassword.addEventListener('input', formHandlers.handlePasswordInput);
            
            // IMPORTANT: Effacer l'erreur au focus
            elements.signupPassword.addEventListener('focus', function() {
                if (elements.signupError) {
                    elements.signupError.style.display = 'none';
                }
                this.classList.remove('error');
            });
        }
        
        // Form submission on Enter key
        if (elements.signupPassword) {
            elements.signupPassword.addEventListener('keypress', function(e) {
                if (e.key === 'Enter' && !elements.signupBtn.disabled) {
                    formHandlers.handleSignup();
                }
            });
        }
        
        if (elements.password) {
            elements.password.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    formHandlers.handleLogin();
                }
            });
        }
        
        if (elements.forgotEmail) {
            elements.forgotEmail.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    formHandlers.handleForgotPassword();
                }
            });
        }
        
        // Signup button
        if (elements.signupBtn) {
            elements.signupBtn.addEventListener('click', formHandlers.handleSignup);
        }
        
        // Login button
        if (elements.loginBtn) {
            elements.loginBtn.addEventListener('click', formHandlers.handleLogin);
        }
        
        // Forgot password button
        if (elements.forgotBtn) {
            elements.forgotBtn.addEventListener('click', formHandlers.handleForgotPassword);
        }
        
        // Pricing toggle
        if (elements.monthly) {
            elements.monthly.addEventListener('click', () => pricing.toggleBilling('monthly'));
        }
        
        if (elements.annual) {
            elements.annual.addEventListener('click', () => pricing.toggleBilling('annual'));
        }
        
        // ESC key to close modals
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && state.currentModal) {
                modal.closeAll();
            }
        });
    }

    // Initialize Application
    function init() {
        console.log('🚀 Initializing Auth App (Development Mode)');
        
        // Wait for Firebase to be ready
        if (window.firebaseServices && window.firebaseServices.auth && window.firebaseServices.db) {
            initializeApp();
        } else {
            // Listen for Firebase ready event
            window.addEventListener('firebaseReady', initializeApp);
            
            // Fallback: check periodically
            let checkCount = 0;
            const checkInterval = setInterval(() => {
                checkCount++;
                if (window.firebaseServices && window.firebaseServices.auth && window.firebaseServices.db) {
                    clearInterval(checkInterval);
                    initializeApp();
                } else if (checkCount > 30) { // Augmenté à 30 pour donner plus de temps
                    clearInterval(checkInterval);
                    console.error('Firebase initialization timeout');
                    alert('Failed to initialize Firebase. Please refresh the page.');
                }
            }, 250);
        }
    }

    function initializeApp() {
        console.log('🔥 Firebase ready, initializing app...');
        
        // Initialize Firebase services
        if (!initializeFirebaseServices()) {
            console.error('Failed to initialize Firebase services');
            alert('Firebase services could not be initialized. Please refresh the page.');
            return;
        }
        
        // Generate CSRF token
        state.csrfToken = getCSRFToken();
        
        // Cache elements
        cacheElements();
        
        // Setup event listeners
        setupEventListeners();
        
        // Setup features
        setupSmoothScroll();
        setupLazyLoading();
        carousel.init();
        mobileMenu.init();
        
        // Initialize pricing to monthly
        pricing.toggleBilling('monthly');
        
        // Check auth state
        firebaseAuth.checkAuthState();
        
        // Development helpers
        window.authAppDebug = {
            state: state,
            firebaseAuth: firebaseAuth,
            modal: modal,
            auth: auth,
            db: db,
            testLogin: async (email, password) => {
                console.log('Testing login...');
                return await firebaseAuth.signIn(email, password, true);
            },
            testSignup: async (email, password, profile) => {
                console.log('Testing signup...');
                return await firebaseAuth.signUp(email, password, profile, true);
            },
            signOut: async () => {
                if (auth) {
                    await auth.signOut();
                    console.log('Signed out successfully');
                    window.location.reload();
                }
            },
            checkFirebase: () => {
                console.log('Firebase Auth:', !!auth);
                console.log('Firebase DB:', !!db);
                console.log('Firebase Apps:', firebase.apps);
                return { auth: !!auth, db: !!db };
            }
        };
        console.log('🛠️ Debug helpers available at window.authAppDebug');
        console.log('Pour se déconnecter: window.authAppDebug.signOut()');
        console.log('Pour vérifier Firebase: window.authAppDebug.checkFirebase()');
        
        // Make modal functions globally available
        window.authApp = {
            showSignupModal: () => modal.show('signup'),
            showLoginModal: () => modal.show('login'),
            closeAllModals: () => modal.closeAll()
        };
        
        console.log('✅ Auth App initialized successfully');
    }

    // Public API
    return {
        init: init,
        modal: modal,
        firebaseAuth: firebaseAuth
    };
})();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        AuthApp.init();
    });
} else {
    AuthApp.init();
}