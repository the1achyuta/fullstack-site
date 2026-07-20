document.addEventListener('DOMContentLoaded', async () => {
    // --- State Management ---
    let cart = JSON.parse(localStorage.getItem('chettinad_cart')) || [];
    let wishlist = JSON.parse(localStorage.getItem('chettinad_wishlist')) || [];
    
    // Fix legacy cart items (Phase 7 Fix & Emergency Cart Image Fix)
    let cartModified = false;
    cart.forEach(item => {
        if (typeof item.img === 'undefined' || item.img === 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=') {
            item.img = 'placeholder_vintage.jpg'; // fallback image instead of invisible gif
            cartModified = true;
        }
    });
    if (cartModified) localStorage.setItem('chettinad_cart', JSON.stringify(cart));

    let currentUser = null;
    let globalCsrfToken = '';
    
    // Session Timeout Logic
    const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
    const storedUserData = JSON.parse(localStorage.getItem('chettinad_user'));
    
    if (storedUserData) {
        if (Date.now() - storedUserData.timestamp > SESSION_TIMEOUT_MS) {
            localStorage.removeItem('chettinad_user');
            // don't show toast on boot
        } else {
            currentUser = storedUserData.user;
            storedUserData.timestamp = Date.now();
            localStorage.setItem('chettinad_user', JSON.stringify(storedUserData));
        }
    }

    let authMode = 'login'; // 'login' or 'register'
    let currentCategory = '';
    let currentSearch = '';
    let currentPage = 1;
    let currentMinPrice = 0;
    let currentMaxPrice = 0;
    let currentSortBy = 'newest';

    // --- Scroll Events & Animations ---
    const heroSection = document.getElementById('hero');
    const header = document.querySelector('.main-header');
    
    window.addEventListener('scroll', () => {
        const scrollPos = window.scrollY;
        
        // Header Glassmorphism Toggle
        if (header) {
            if (scrollPos > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        }

        // Cinematic Hero Animation
        if (heroSection) {
            const opacity = Math.max(0, 1 - (scrollPos / 600));
            heroSection.style.opacity = opacity;
            heroSection.style.transform = `translateY(${scrollPos * 0.4}px)`;
        }
    });

    // Scroll Reveal Observer
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                revealObserver.unobserve(entry.target); // Reveal only once
            }
        });
    }, { threshold: 0.1 });

    // Function to apply observer to new dynamic elements
    window.observeReveals = function() {
        document.querySelectorAll('.card:not(.reveal-on-scroll), .product-card:not(.reveal-on-scroll), .order-card:not(.reveal-on-scroll)').forEach(el => {
            el.classList.add('reveal-on-scroll');
            revealObserver.observe(el);
        });
    };
    
    // Automatically observe newly added elements
    const dynamicObserver = new MutationObserver(() => {
        window.observeReveals();
    });
    dynamicObserver.observe(document.body, { childList: true, subtree: true });
    
    window.observeReveals();

    // --- DOM Elements ---
    const productListElement = document.getElementById('product-list');
    const paginationControls = document.getElementById('pagination-controls');
    const cartCountElement = document.getElementById('cart-count');
    const toastElement = document.getElementById('toast');
    
    // Cart Modal Elements
    const cartBtn = document.querySelector('.cart-btn');
    const cartModal = document.getElementById('cart-modal');
    const closeCartBtn = document.getElementById('close-modal-btn');
    
    // Fetch Products initialization moved back to the end of the script to prevent ReferenceErrors
    const cartItemsContainer = document.getElementById('cart-items-container');
    const cartTotalPrice = document.getElementById('cart-total-price');
    const checkoutBtn = document.getElementById('checkout-btn');

    // Search Modal Elements
    const searchBtn = document.querySelector('.search-btn');
    const searchModal = document.getElementById('search-modal');
    const closeSearchBtn = document.getElementById('close-search-btn');
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    


    // Auth Modal Elements
    const authBtn = document.querySelector('.auth-btn');
    const authModal = document.getElementById('auth-modal');
    const closeAuthBtn = document.getElementById('close-auth-btn');
    const authTitle = document.getElementById('auth-title');
    
    // New Views
    const authOptionsView = document.getElementById('auth-options-view');
    const authRegisterForm = document.getElementById('auth-register-form');
    const authLoginForm = document.getElementById('auth-login-form');
    const otpForm = document.getElementById('otp-form');
    const authOtp = document.getElementById('auth-otp');
    const authLoggedInView = document.getElementById('auth-logged-in-view');
    
    // Buttons
    const btnShowEmailSignup = document.getElementById('btn-show-email-signup');
    const btnShowLogin = document.getElementById('btn-show-login');
    const backToOptionsBtns = document.querySelectorAll('.btn-back-options');
    const btnGoDashboard = document.getElementById('btn-go-dashboard');
    const btnLogout = document.getElementById('btn-logout');
    
    // Form Inputs
    const authRegName = document.getElementById('auth-reg-name');
    const authRegEmail = document.getElementById('auth-reg-email');
    const authRegPassword = document.getElementById('auth-reg-password');
    const authRegSubmitBtn = document.getElementById('auth-reg-submit-btn');

    const authLogEmail = document.getElementById('auth-log-email');
    const authLogPassword = document.getElementById('auth-log-password');
    const authLogSubmitBtn = document.getElementById('auth-log-submit-btn');

    // Info Modal Elements (For footer links)
    const infoModal = document.getElementById('info-modal');
    const closeInfoBtn = document.getElementById('close-info-btn');
    const infoTitle = document.getElementById('info-title');
    const infoContent = document.getElementById('info-content');
    
    // Review Modal Elements
    const reviewModal = document.getElementById('review-modal');
    const closeReviewBtn = document.getElementById('close-review-btn');
    const reviewForm = document.getElementById('review-form');
    const reviewProductId = document.getElementById('review-product-id');
    const reviewRating = document.getElementById('review-rating');
    const reviewText = document.getElementById('review-text');

    // OTP Elements (duplicate declarations removed)
    const googleLoginWrapper = document.getElementById('google-login-wrapper');
    const toggleAuthWrapper = document.getElementById('toggle-auth-wrapper');
    
    let pendingOtpEmail = null;

    // --- Utilities ---
    function showToast(message) {
        toastElement.textContent = message;
        toastElement.classList.remove('hidden');
        setTimeout(() => toastElement.classList.add('hidden'), 3000);
    }

    function setupModalClose(modal, closeBtn) {
        if (!modal || !closeBtn) return;
        closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        });
    }

    setupModalClose(cartModal, closeCartBtn);
    setupModalClose(searchModal, closeSearchBtn);
    setupModalClose(authModal, closeAuthBtn);
    setupModalClose(infoModal, closeInfoBtn);
    setupModalClose(reviewModal, closeReviewBtn);

    // --- Create Wishlist Modal Dynamically ---
    let wishlistModal = document.getElementById('wishlist-modal');
    if (!wishlistModal) {
        wishlistModal = document.createElement('div');
        wishlistModal.id = 'wishlist-modal';
        wishlistModal.className = 'modal-overlay hidden';
        wishlistModal.setAttribute('aria-hidden', 'true');
        wishlistModal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h2>My Wishlist ♥</h2>
                    <button id="close-wishlist-btn" class="close-btn" aria-label="Close wishlist">&times;</button>
                </div>
                <div class="modal-body" id="wishlist-items-container">
                    <p>Your wishlist is empty.</p>
                </div>
            </div>
        `;
        document.body.appendChild(wishlistModal);
        const closeWishlistBtn = document.getElementById('close-wishlist-btn');
        setupModalClose(wishlistModal, closeWishlistBtn);
    }

    function renderWishlist() {
        const container = document.getElementById('wishlist-items-container');
        if (!container) return;
        
        wishlistModal.classList.remove('hidden');
        
        if (wishlist.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--color-text-body); padding: 20px 0; line-height: 1.6;">You haven\'t discovered your favorite artifacts yet.<br><span style="color: var(--color-muted-gold); font-weight: bold;">Start exploring and add products to your wishlist!</span></p>';
            return;
        }
        
        container.innerHTML = `
            <div style="margin-bottom: 20px; text-align: center;">
                <button class="cta-button" id="wishlist-add-all-btn" style="width: 100%; font-size: 1rem; padding: 12px; background-color: var(--color-primary-accent); color: #fff; border-radius: 8px;">Add All to Cart</button>
            </div>
        ` + wishlist.map(item => `
            <div class="wishlist-item" style="display: flex; gap: 15px; margin-bottom: 15px; border-bottom: 1px solid rgba(181, 148, 111, 0.2); padding-bottom: 15px;">
                <img src="/frontend/${item.img}" alt="${item.name}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px;">
                <div style="flex-grow: 1; display: flex; flex-direction: column;">
                    <h4 style="margin: 0 0 5px 0;">${item.name}</h4>
                    <p style="margin: 0; color: var(--color-muted-gold); font-weight: bold;">$${parseFloat(item.price).toFixed(2)}</p>
                    <div style="margin-top: auto; display: flex; align-items: center; justify-content: space-between;">
                        <a href="/frontend/product.html?id=${item.id}" style="color: var(--color-primary-accent); text-decoration: none; font-size: 0.9em; font-weight: bold;">View Product</a>
                        <button class="cta-button wishlist-add-to-cart-btn" data-id="${item.id}" data-name="${item.name.replace(/"/g, '&quot;')}" data-price="${item.price}" data-img="${item.img}" style="padding: 5px 15px; font-size: 0.8em; line-height: 1.2;">Add to Cart</button>
                    </div>
                </div>
                <button class="remove-wishlist-btn" data-id="${item.id}" style="background: none; border: none; color: #d9534f; font-size: 1.5em; cursor: pointer; align-self: flex-start;" aria-label="Remove from Wishlist">&times;</button>
            </div>
        `).join('');

        container.querySelectorAll('.remove-wishlist-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                toggleWishlist(id, null);
                renderWishlist();
            });
        });

        container.querySelectorAll('.wishlist-add-to-cart-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const b = e.currentTarget;
                addToCart(b.dataset.id, b.dataset.name, parseFloat(b.dataset.price), b.dataset.img);
            });
        });

        const addAllBtn = container.querySelector('#wishlist-add-all-btn');
        if (addAllBtn) {
            addAllBtn.addEventListener('click', () => {
                wishlist.forEach(item => {
                    addToCart(item.id, item.name, parseFloat(item.price), item.img);
                });
                showToast('All items added to cart!');
            });
        }
    }

    window.renderWishlist = renderWishlist;

    function toggleWishlist(productId, productObj) {
        const index = wishlist.findIndex(item => item.id == productId);
        if (index > -1) {
            wishlist.splice(index, 1);
            showToast('Removed from wishlist');
        } else if (productObj) {
            wishlist.push(productObj);
            showToast('Added to wishlist ♥');
        }
        localStorage.setItem('chettinad_wishlist', JSON.stringify(wishlist));
        syncDataToServer();
        
        // Update heart icons on screen
        document.querySelectorAll(`.wishlist-btn`).forEach(btn => {
            if (btn.dataset.id == productId) {
                btn.classList.toggle('active');
                btn.innerHTML = wishlist.some(i => i.id == productId) ? '♥' : '♡';
                btn.style.color = wishlist.some(i => i.id == productId) ? '#d9534f' : '#333';
            }
        });
    }


    // --- CSRF Fetching ---
    async function fetchCsrfToken() {
        try {
            const res = await fetch('/backend/api.php?action=csrf_token');
            const data = await res.json();
            if (data.success) {
                globalCsrfToken = data.data.csrf_token;
            }
        } catch(e) {
            console.error('Failed to get CSRF token', e);
        }
    }
    await fetchCsrfToken();
    
    async function fetchSyncData() {
        if (!currentUser) return;
        try {
            const res = await apiFetch('/backend/api.php?action=get_sync_data');
            const data = await res.json();
            if (data.success) {
                if (data.data.cart && Array.isArray(data.data.cart)) {
                    // Check if cart has changed before updating UI
                    const serverCartStr = JSON.stringify(data.data.cart);
                    const localCartStr = JSON.stringify(cart);
                    if (serverCartStr !== localCartStr) {
                        cart = data.data.cart;
                        localStorage.setItem('chettinad_cart', JSON.stringify(cart));
                        updateCartCountUI();
                        // Only re-render if modal is currently open and cart changed
                        const cartModal = document.getElementById('cart-modal');
                        if (cartModal && !cartModal.classList.contains('hidden') && typeof renderCartItems === 'function') {
                            renderCartItems();
                        }
                    }
                }
                if (data.data.wishlist && Array.isArray(data.data.wishlist)) {
                    wishlist = data.data.wishlist;
                    localStorage.setItem('chettinad_wishlist', JSON.stringify(wishlist));
                }
            }
        } catch(e) {
            console.error('Failed to fetch sync data', e);
        }
    }
    
    // Poll for cross-device synchronization every 8 seconds
    setInterval(async () => {
        if (currentUser) {
            await fetchSyncData();
        }
    }, 8000);
    
    // We need apiFetch to be defined before we can use it, so move apiFetch up or call fetchSyncData after.
    function apiFetch(url, options = {}) {
        if (!options.headers) options.headers = {};
        options.headers['X-CSRF-Token'] = globalCsrfToken;
        return fetch(url, options);
    }
    
    await fetchSyncData();
    
    async function syncDataToServer() {
        if (!currentUser) return;
        try {
            await apiFetch('/backend/api.php?action=sync_data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cart: cart, wishlist: wishlist })
            });
        } catch (e) {
            console.error("Failed to sync data", e);
        }
    }

    // --- Form Validation (Real-time) ---
    function validateInput(input) {
        let isValid = false;
        if (input.type === 'email') {
            const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            isValid = re.test(input.value.trim());
        } else if (input.type === 'password') {
            isValid = input.value.trim().length >= 6;
        } else {
            isValid = input.value.trim().length > 0;
        }

        if (input.value.trim() === '') {
            input.classList.remove('is-valid', 'is-invalid');
        } else if (isValid) {
            input.classList.add('is-valid');
            input.classList.remove('is-invalid');
        } else {
            input.classList.add('is-invalid');
            input.classList.remove('is-valid');
        }
    }

    [authRegName, authRegEmail, authRegPassword, authLogEmail, authLogPassword, searchInput].forEach(input => {
        if (input) {
            input.addEventListener('input', () => validateInput(input));
        }
    });

    // --- Authentication Logic ---
    function updateAuthUI() {
        if (currentUser) {
            const displayName = currentUser.name ? currentUser.name.split(' ')[0] : (currentUser.email ? currentUser.email.split('@')[0] : 'User');
            authBtn.textContent = `Hi, ${displayName}`;
        } else {
            authBtn.textContent = 'Login / Account';
        }
    }

    if (authBtn) {
        authBtn.addEventListener('click', () => {
            if (currentUser) {
                // Show logged-in view
                if (authOptionsView) authOptionsView.classList.add('hidden');
                if (authRegisterForm) authRegisterForm.classList.add('hidden');
                if (authLoginForm) authLoginForm.classList.add('hidden');
                if (otpForm) otpForm.classList.add('hidden');
                
                if (authLoggedInView) authLoggedInView.classList.remove('hidden');
                
                const displayName = currentUser.name ? currentUser.name.split(' ')[0] : (currentUser.email ? currentUser.email.split('@')[0] : 'User');
                if (authTitle) authTitle.textContent = `Hi, ${displayName}`;
                
                authModal.classList.remove('hidden');
            } else {
                // Show options by default
                if (authOptionsView) authOptionsView.classList.remove('hidden');
                if (authRegisterForm) authRegisterForm.classList.add('hidden');
                if (authLoginForm) authLoginForm.classList.add('hidden');
                if (otpForm) {
                    otpForm.classList.add('hidden');
                    otpForm.reset();
                }
                if (authLoggedInView) authLoggedInView.classList.add('hidden');
                if (authTitle) authTitle.textContent = 'Welcome';
                
                if (authRegisterForm) authRegisterForm.reset();
                if (authLoginForm) authLoginForm.reset();
                pendingOtpEmail = null;
                
                authModal.classList.remove('hidden');
            }
        });
    }

    if (btnGoDashboard) {
        btnGoDashboard.addEventListener('click', () => {
            window.location.href = '/frontend/dashboard.html';
        });
    }

    if (btnLogout) {
        btnLogout.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Check if modal already exists
            let logoutModal = document.getElementById('logout-confirm-modal');
            if (!logoutModal) {
                // Dynamically inject the modal HTML
                const modalHTML = `
                <div id="logout-confirm-modal" class="modal-overlay hidden" style="z-index: 2000;">
                    <div class="modal-content" style="max-width: 400px; text-align: center; background-color: var(--color-bg-secondary);">
                        <div class="modal-header">
                            <h2>Log Out</h2>
                            <button class="close-btn" id="close-logout-modal" aria-label="Close modal">&times;</button>
                        </div>
                        <div class="modal-body">
                            <p style="margin-bottom: 20px;">Are you sure you want to log out?</p>
                            <div style="display: flex; gap: 10px; justify-content: center;">
                                <button id="confirm-logout-btn" class="cta-button" style="background: transparent; border: 1px solid var(--color-primary-accent); color: var(--color-primary-accent);">Yes, Log Out</button>
                                <button id="abort-logout-btn" class="cta-button">Cancel</button>
                            </div>
                        </div>
                    </div>
                </div>`;
                document.body.insertAdjacentHTML('beforeend', modalHTML);
                
                logoutModal = document.getElementById('logout-confirm-modal');
                
                // Add event listeners to the new modal's buttons
                document.getElementById('close-logout-modal').addEventListener('click', () => {
                    logoutModal.classList.add('hidden');
                });
                document.getElementById('abort-logout-btn').addEventListener('click', () => {
                    logoutModal.classList.add('hidden');
                });
                document.getElementById('confirm-logout-btn').addEventListener('click', () => {
                    localStorage.removeItem('chettinad_user');
                    if (window.location.pathname.includes('dashboard.html')) {
                        window.location.href = '/frontend/index.html';
                    } else {
                        window.location.reload();
                    }
                });
            }
            
            // Show the modal
            logoutModal.classList.remove('hidden');
        });
    }

    if (btnShowEmailSignup) {
        btnShowEmailSignup.addEventListener('click', () => {
            authOptionsView.classList.add('hidden');
            authRegisterForm.classList.remove('hidden');
            authTitle.textContent = 'Sign Up';
            if (authRegName) authRegName.focus();
        });
    }

    if (btnShowLogin) {
        btnShowLogin.addEventListener('click', (e) => {
            e.preventDefault();
            authOptionsView.classList.add('hidden');
            authLoginForm.classList.remove('hidden');
            authTitle.textContent = 'Log In';
            if (authLogEmail) authLogEmail.focus();
        });
    }

    backToOptionsBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            authOptionsView.classList.remove('hidden');
            authRegisterForm.classList.add('hidden');
            authLoginForm.classList.add('hidden');
            otpForm.classList.add('hidden');
            authTitle.textContent = 'Welcome';
        });
    });

    if (authRegisterForm) {
        authRegisterForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                name: authRegName.value.trim(),
                email: authRegEmail.value.trim(),
                password: authRegPassword.value
            };

            try {
                authRegSubmitBtn.disabled = true;
                authRegSubmitBtn.textContent = 'Processing...';
                
                const res = await apiFetch('/backend/api.php?action=register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (!data.success) throw new Error(data.error ? data.error.detail : 'Registration failed');
                
                // If registered, trigger login automatically to get OTP
                const loginPayload = {
                    email: payload.email,
                    password: payload.password
                };
                const loginRes = await apiFetch('/backend/api.php?action=login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(loginPayload)
                });
                const loginData = await loginRes.json();
                if (!loginData.success) throw new Error(loginData.error ? loginData.error.detail : 'Auto-login failed');
                
                if (loginData.data && loginData.data.status === 'otp_required') {
                    pendingOtpEmail = loginData.data.email;
                    alert(`[DEV ONLY]\n\nYour OTP is: ${loginData.data.dev_otp}`);
                    showToast(`Account created! OTP generated.`);
                    authRegisterForm.classList.add('hidden');
                    otpForm.classList.remove('hidden');
                    authTitle.textContent = 'Verify Email';
                }
            } catch (error) {
                showToast(`Error: ${error.message}`);
            } finally {
                authRegSubmitBtn.disabled = false;
                authRegSubmitBtn.textContent = 'Create Account';
            }
        });
    }

    if (authLoginForm) {
        authLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                email: authLogEmail.value.trim(),
                password: authLogPassword.value
            };

            try {
                authLogSubmitBtn.disabled = true;
                authLogSubmitBtn.textContent = 'Processing...';
                
                const res = await apiFetch('/backend/api.php?action=login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                const data = await res.json();
                
                if (!data.success) {
                    throw new Error(data.error ? data.error.detail : 'Authentication failed');
                }
                
                if (data.data && data.data.status === 'otp_required') {
                    pendingOtpEmail = data.data.email;
                    alert(`[DEV ONLY]\n\nYour OTP is: ${data.data.dev_otp}`);
                    showToast(`OTP generated.`);
                    authLoginForm.classList.add('hidden');
                    otpForm.classList.remove('hidden');
                    authTitle.textContent = 'Verify Email';
                }
            } catch (error) {
                showToast(`Error: ${error.message}`);
            } finally {
                authLogSubmitBtn.disabled = false;
                authLogSubmitBtn.textContent = 'Login';
            }
        });
    }

    if (otpForm) {
        otpForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const otpBtn = otpForm.querySelector('button[type="submit"]');
            try {
                otpBtn.disabled = true;
                otpBtn.textContent = 'Verifying...';
                
                const res = await apiFetch('/backend/api.php?action=verify_otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: pendingOtpEmail, otp: authOtp.value.trim() })
                });
                
                const data = await res.json();
                if (!data.success) throw new Error(data.error ? data.error.detail : 'OTP verification failed');
                
                currentUser = data.data;
                localStorage.setItem('chettinad_user', JSON.stringify({
                    user: currentUser,
                    timestamp: Date.now()
                }));
                
                if (data.data.cart && Array.isArray(data.data.cart)) {
                    cart = data.data.cart;
                    localStorage.setItem('chettinad_cart', JSON.stringify(cart));
                    updateCartCountUI();
                }
                if (data.data.wishlist && Array.isArray(data.data.wishlist)) {
                    wishlist = data.data.wishlist;
                    localStorage.setItem('chettinad_wishlist', JSON.stringify(wishlist));
                }
                
                updateAuthUI();
                authModal.classList.add('hidden');
                showToast('OTP Verified! Logged in successfully.');
                otpForm.reset();
                if (authLoginForm) authLoginForm.reset();
                if (authRegisterForm) authRegisterForm.reset();
            } catch (err) {
                showToast(`Error: ${err.message}`);
            } finally {
                otpBtn.disabled = false;
                otpBtn.textContent = 'Verify OTP';
            }
        });
    }

    // Google Login Callback
    window.handleCredentialResponse = async function(response) {
        try {
            const res = await apiFetch('/backend/api.php?action=google_login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential: response.credential })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error ? data.error.detail : 'Google Login failed');
            
            currentUser = data.data;
            localStorage.setItem('chettinad_user', JSON.stringify({
                user: currentUser,
                timestamp: Date.now()
            }));
            
            if (data.data.cart && Array.isArray(data.data.cart)) {
                cart = data.data.cart;
                localStorage.setItem('chettinad_cart', JSON.stringify(cart));
                updateCartCountUI();
            }
            if (data.data.wishlist && Array.isArray(data.data.wishlist)) {
                wishlist = data.data.wishlist;
                localStorage.setItem('chettinad_wishlist', JSON.stringify(wishlist));
            }
            
            updateAuthUI();
            if(authModal) authModal.classList.add('hidden');
            showToast('Logged in with Google successfully!');
        } catch (err) {
            showToast(`Google Login Error: ${err.message}`);
        }
    };

    // --- Search Logic ---
    searchBtn.addEventListener('click', () => {
        searchModal.classList.remove('hidden');
        searchInput.focus();
    });

    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (query) {
            const currentParams = new URLSearchParams(window.location.search);
            currentParams.set('search', query);
            window.location.href = `products.html?${currentParams.toString()}`;
        }
    });

    // --- Cart Logic ---
    function saveCart() {
        localStorage.setItem('chettinad_cart', JSON.stringify(cart));
        updateCartCountUI();
        syncDataToServer();
    }

    function updateCartCountUI() {
        if (cartCountElement) {
            const totalItems = cart.reduce((sum, item) => sum + parseInt(item.quantity || 0, 10), 0);
            cartCountElement.textContent = totalItems;
        }
    }

    window.addToCart = function(id, name, price, img, quantity = 1) {
        quantity = parseInt(quantity, 10) || 1;
        const existingItem = cart.find(item => item.id == id);
        if (existingItem) {
            existingItem.quantity = parseInt(existingItem.quantity, 10) + quantity;
        } else {
            cart.push({ id, name, price: parseFloat(price), img, quantity });
        }
        saveCart();
        showToast(`✓ ${name} added to your cart!`);
        
        cartBtn.classList.remove('cart-pop');
        void cartBtn.offsetWidth;
        cartBtn.classList.add('cart-pop');
    }

    window.updateCartQuantity = function(id, delta) {
        const item = cart.find(i => i.id == id);
        if (item) {
            item.quantity = parseInt(item.quantity, 10) + parseInt(delta, 10);
            if (item.quantity <= 0) {
                cart = cart.filter(i => i.id != id);
            }
            saveCart();
            renderCartItems(); 
        }
    }

    cartBtn.addEventListener('click', () => {
        renderCartItems();
        cartModal.classList.remove('hidden');
    });

    function renderCartItems() {
        if (cart.length === 0) {
            cartItemsContainer.innerHTML = '<p>Your cart is empty.</p>';
            cartTotalPrice.textContent = '0.00';
            checkoutBtn.disabled = true;
            return;
        }

        checkoutBtn.disabled = false;
        cartItemsContainer.innerHTML = '';
        let total = 0;

        cart.forEach(item => {
            const itemTotal = item.price * item.quantity;
            total += itemTotal;

            const div = document.createElement('div');
            div.className = 'cart-item';
            div.innerHTML = `
                <img src="${item.img || ''}" alt="${item.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; margin-right: 10px;">
                <div class="cart-item-details" style="flex: 1;">
                    <h4 style="margin: 0;"><a href="product.html?id=${item.id}" style="text-decoration: none; color: inherit;">${item.name}</a></h4>
                    <p style="margin: 5px 0 0 0;">$${parseFloat(item.price).toFixed(2)} x ${item.quantity} = $${parseFloat(itemTotal).toFixed(2)}</p>
                </div>
                <div class="cart-item-controls">
                    <button onclick="updateCartQuantity(${item.id}, -1)">-</button>
                    <span>${item.quantity}</span>
                    <button onclick="updateCartQuantity(${item.id}, 1)">+</button>
                </div>
            `;
            cartItemsContainer.appendChild(div);
        });

        cartTotalPrice.textContent = total.toFixed(2);
    }

    // --- Checkout Logic ---
    const clearCartBtn = document.getElementById('clear-cart-btn');
    if (clearCartBtn) {
        clearCartBtn.addEventListener('click', () => {
            if (cart.length === 0) return;
            document.getElementById('clear-cart-modal').classList.remove('hidden');
        });
    }

    document.getElementById('close-clear-cart-modal')?.addEventListener('click', () => {
        document.getElementById('clear-cart-modal').classList.add('hidden');
    });

    document.getElementById('abort-clear-cart-btn')?.addEventListener('click', () => {
        document.getElementById('clear-cart-modal').classList.add('hidden');
    });

    document.getElementById('confirm-clear-cart-btn')?.addEventListener('click', () => {
        cart = [];
        saveCart();
        renderCartItems();
        showToast('Cart cleared.');
        document.getElementById('clear-cart-modal').classList.add('hidden');
    });

    checkoutBtn.addEventListener('click', async () => {
        if (cart.length === 0) return;
        
        if (!currentUser) {
            cartModal.classList.add('hidden');
            authModal.classList.remove('hidden');
            showToast('Please login to continue checkout.');
            return;
        }
        
        // Redirect to new Checkout Page (Phase 8)
        window.location.href = 'checkout.html';
    });



    const toggleFilterBtn = document.getElementById('toggle-filter-btn');
    const filterBar = document.getElementById('filter-bar');
    if (toggleFilterBtn && filterBar) {
        toggleFilterBtn.addEventListener('click', () => {
            if (filterBar.classList.contains('filter-hidden')) {
                filterBar.classList.remove('filter-hidden');
                filterBar.classList.add('filter-visible');
            } else {
                filterBar.classList.remove('filter-visible');
                filterBar.classList.add('filter-hidden');
            }
        });
    }

    // --- Review Logic ---
    window.openReviewModal = function(productId) {
        if (!currentUser) {
            authModal.classList.remove('hidden');
            showToast('Please login to write a review.');
            return;
        }
        reviewProductId.value = productId;
        reviewForm.reset();
        reviewModal.classList.remove('hidden');
    }

    if (reviewForm) {
        reviewForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                product_id: reviewProductId.value,
                rating: reviewRating.value,
                review_text: reviewText.value.trim(),
                user_email: currentUser.email
            };

            try {
                const res = await apiFetch('/backend/api.php?action=submit_review', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                
                if (data.success) {
                    showToast('Review submitted successfully!');
                    reviewModal.classList.add('hidden');
                    fetchProducts(currentCategory, currentSearch, currentPage);
                } else {
                    throw new Error(data.error ? data.error.detail : 'Failed to submit review');
                }
            } catch (e) {
                showToast(e.message);
            }
        });
    }

    // --- Filter Bar Logic ---
    const applyFiltersBtn = document.getElementById('apply-filters-btn');
    const filterCategory = document.getElementById('filter-category');
    const filterMinPrice = document.getElementById('filter-min-price');
    const filterMaxPrice = document.getElementById('filter-max-price');
    const filterSort = document.getElementById('filter-sort');

    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
            const category = filterCategory.value;
            currentMinPrice = parseFloat(filterMinPrice.value) || 0;
            currentMaxPrice = parseFloat(filterMaxPrice.value) || 0;
            currentSortBy = filterSort.value;
            fetchProducts(category, currentSearch, 1);
        });
        
        filterSort.addEventListener('change', () => {
            currentSortBy = filterSort.value;
            fetchProducts(currentCategory, currentSearch, 1);
        });
    }

    // --- Product Fetching with Lazy Loading ---
    async function fetchProducts(category = '', search = '', page = 1) {
        if (!productListElement) return;
        
        currentCategory = category;
        currentSearch = search;
        currentPage = page;
        
        if (filterCategory && category !== null) {
            filterCategory.value = category;
        }
        
        productListElement.style.opacity = '0.5';
        productListElement.style.pointerEvents = 'none';
        
        let url = '/backend/api.php?action=products';
        const params = new URLSearchParams();
        if (category) params.append('category', category);
        if (search) params.append('search', search);
        if (currentMinPrice > 0) params.append('min_price', currentMinPrice);
        if (currentMaxPrice > 0) params.append('max_price', currentMaxPrice);
        if (currentSortBy) params.append('sort_by', currentSortBy);
        params.append('page', page);
        params.append('limit', 12);
        
        if (params.toString()) {
            url += '&' + params.toString();
        }

        try {
            let response = await fetch(url);
            let json = await response.json();
            
            if (!json.success) {
                throw new Error(json.error ? json.error.detail : 'Failed to fetch products');
            }
            
            let products = json.data.products;
            let pagination = json.data.pagination;
            
            let searchFailed = false;
            if (products.length === 0 && search) {
                searchFailed = true;
                let fallbackUrl = '/backend/api.php?action=products';
                const fallbackParams = new URLSearchParams();
                if (category) fallbackParams.append('category', category);
                if (currentMinPrice > 0) fallbackParams.append('min_price', currentMinPrice);
                if (currentMaxPrice > 0) fallbackParams.append('max_price', currentMaxPrice);
                if (currentSortBy) fallbackParams.append('sort_by', currentSortBy);
                fallbackParams.append('page', 1);
                fallbackParams.append('limit', 12);
                if (fallbackParams.toString()) fallbackUrl += '&' + fallbackParams.toString();
                
                response = await fetch(fallbackUrl);
                json = await response.json();
                if (json.success) {
                    products = json.data.products;
                    pagination = json.data.pagination;
                }
            }
            
            const titleElement = document.getElementById('collection-title') || document.querySelector('#featured h2');
            const descElement = document.getElementById('collection-desc');
            
            if (titleElement) {
                const oldClearBtn = document.getElementById('clear-search-btn');
                if (oldClearBtn) oldClearBtn.remove();
                const oldNoMatchMsg = document.getElementById('no-match-msg');
                if (oldNoMatchMsg) oldNoMatchMsg.remove();
                
                if (search && !searchFailed) {
                    titleElement.textContent = `Search Results for "${search}"`;
                    if (descElement) descElement.style.display = 'none';
                    
                    const clearBtn = document.createElement('button');
                    clearBtn.id = 'clear-search-btn';
                    clearBtn.className = 'cta-button';
                    clearBtn.style.marginTop = '15px';
                    clearBtn.style.padding = '8px 15px';
                    clearBtn.style.background = 'transparent';
                    clearBtn.style.border = '1px solid var(--color-primary-accent)';
                    clearBtn.style.color = 'var(--color-primary-accent)';
                    clearBtn.textContent = 'Clear Search';
                    clearBtn.onclick = () => {
                        const params = new URLSearchParams(window.location.search);
                        params.delete('search');
                        window.location.href = `products.html?${params.toString()}`;
                    };
                    titleElement.parentNode.insertBefore(clearBtn, titleElement.nextSibling);
                } else {
                    if (category) {
                        const formattedCat = category.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                        titleElement.textContent = `${formattedCat} Collection`;
                        if (descElement) {
                            descElement.style.display = 'block';
                            descElement.textContent = `Explore our exquisite ${formattedCat} artifacts and pieces, carefully curated for your collection.`;
                        }
                    } else {
                        titleElement.textContent = 'The Complete Collection';
                        if (descElement) {
                            descElement.style.display = 'block';
                            descElement.textContent = `Discover our entire curated selection of Chettinad artifacts, modern art, and timeless Indian craftsmanship—available for you all in one place.`;
                        }
                    }

                    if (searchFailed) {
                        const noMatchMsg = document.createElement('div');
                        noMatchMsg.id = 'no-match-msg';
                        noMatchMsg.style.display = 'inline-block';
                        noMatchMsg.style.marginTop = '20px';
                        noMatchMsg.style.padding = '10px 20px';
                        noMatchMsg.style.backgroundColor = 'rgba(193, 154, 107, 0.1)';
                        noMatchMsg.style.border = '1px solid var(--color-primary-accent)';
                        noMatchMsg.style.borderRadius = '4px';
                        noMatchMsg.style.color = 'var(--color-primary-accent)';
                        noMatchMsg.style.fontWeight = 'bold';
                        noMatchMsg.style.fontSize = '1.1em';
                        noMatchMsg.innerHTML = `<span style="margin-right:8px;">ℹ</span> No product match '${search}'`;
                        
                        // Insert after description if it exists and is visible, else after title
                        const insertAfterElem = (descElement && descElement.style.display !== 'none') ? descElement : titleElement;
                        insertAfterElem.parentNode.insertBefore(noMatchMsg, insertAfterElem.nextSibling);
                    }
                }
            }

            renderProducts(products, searchFailed ? '' : search);
            renderPagination(pagination);
        } catch (error) {
            console.error("Error fetching products:", error);
            productListElement.innerHTML = '<p class="error-state" style="text-align:center;">Sorry, our catalog is temporarily unavailable.</p>';
        } finally {
            productListElement.style.opacity = '1';
            productListElement.style.pointerEvents = 'auto';
        }
    }

    function renderProducts(products, searchQuery) {
        if (!productListElement) return;
        
        productListElement.innerHTML = '';
        if (products.length === 0) {
            productListElement.innerHTML = '<p style="text-align:center; margin: 2rem 0;">No products found.</p>';
            return;
        }

        products.forEach(product => {
            const article = document.createElement('article');
            article.className = 'product-card';
            const safeName = product.name.replace(/'/g, "\\'");
            const safeImg = product.img.replace(/'/g, "\\'");
            
            const dynamicHtml = product.dynamic_alert 
                ? `<div style="background: var(--color-primary-accent); color: var(--color-deep-background); padding: 5px; font-size: 0.8em; text-align: center; margin-bottom: 5px; border-radius: 4px;">${product.dynamic_alert}</div>`
                : '';
                
            const priceHtml = product.dynamic_alert
                ? `<p class="price"><span style="text-decoration: line-through; color: #888; font-size: 0.8em; margin-right: 5px;">$${parseFloat(product.original_price).toFixed(2)}</span> <span style="color: var(--color-primary-accent);">$${parseFloat(product.price).toFixed(2)}</span></p>`
                : `<p class="price" style="color: var(--color-primary-accent);">$${parseFloat(product.price).toFixed(2)}</p>`;
            
            const isWishlisted = wishlist.some(item => item.id == product.id);
            const heartIcon = isWishlisted ? '♥' : '♡';
            const heartColor = isWishlisted ? '#d9534f' : '#333';
            
            article.innerHTML = `
                <button class="wishlist-btn ${isWishlisted ? 'active' : ''}" data-id="${product.id}" data-name="${safeName}" data-price="${product.price}" data-img="${safeImg}" style="position: absolute; top: 10px; right: 10px; background: white; border: none; border-radius: 50%; width: 32px; height: 32px; font-size: 1.2em; color: ${heartColor}; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.2); z-index: 10; display: flex; align-items: center; justify-content: center; line-height: 1;" aria-label="Toggle Wishlist">${heartIcon}</button>
                <a href="product.html?id=${product.id}" style="text-decoration: none; color: inherit; display: block;">
                    <img data-src="${product.img}" src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" alt="${product.name}" class="lazy-image">
                    <h3>${product.name}</h3>
                    ${dynamicHtml}
                    <p class="category-label">${product.category}</p>
                    ${priceHtml}
                </a>
                <p class="stock-label">In Stock: ${product.stock}</p>
                <button class="add-to-cart-btn" onclick="addToCart(${product.id}, '${safeName}', ${product.price}, '${safeImg}')" ${product.stock === 0 ? 'disabled' : ''}>
                    ${product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
                </button>
            `;
            productListElement.appendChild(article);
        });

        // Add event listeners to new wishlist buttons
        document.querySelectorAll('.wishlist-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                const obj = {
                    id: id,
                    name: btn.dataset.name,
                    price: parseFloat(btn.dataset.price),
                    img: btn.dataset.img
                };
                toggleWishlist(id, obj);
            });
        });

        setupLazyLoading();
    }
    
    function renderPagination(pagination) {
        if (pagination.total_pages <= 1) return;
        
        const prevDisabled = pagination.current_page === 1 ? 'disabled' : '';
        const nextDisabled = pagination.current_page === pagination.total_pages ? 'disabled' : '';
        
        // Ensure the container itself is a centered flexbox
        paginationControls.style.display = 'flex';
        paginationControls.style.justifyContent = 'center';
        paginationControls.style.alignItems = 'center';
        paginationControls.style.flexWrap = 'wrap';
        paginationControls.style.gap = '15px';
        paginationControls.style.marginTop = '40px';

        paginationControls.innerHTML = `
            <button class="cta-button" onclick="changePage(-1)" ${prevDisabled} style="min-width: 120px; text-align: center;">&laquo; PREV</button>
            <span style="font-weight: bold; color: var(--color-text-body); white-space: nowrap;">Page ${pagination.current_page} of ${pagination.total_pages}</span>
            <button class="cta-button" onclick="changePage(1)" ${nextDisabled} style="min-width: 120px; text-align: center;">NEXT &raquo;</button>
        `;
    }

    window.changePage = function(delta) {
        fetchProducts(currentCategory, currentSearch, currentPage + delta);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function setupLazyLoading() {
        const lazyImages = document.querySelectorAll('.lazy-image');
        
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.classList.remove('lazy-image');
                        imageObserver.unobserve(img);
                    }
                });
            });

            lazyImages.forEach(img => imageObserver.observe(img));
        } else {
            lazyImages.forEach(img => {
                img.src = img.dataset.src;
            });
        }
    }

    // --- Footer Links ---

    // Make footer links functional (open info modal)
    document.querySelectorAll('footer a, footer li, .nav-links a').forEach(link => {
        if (link.tagName === 'A' && link.getAttribute('href') && link.getAttribute('href').startsWith('#') && link.getAttribute('href').length > 1) {
            return;
        }

        link.style.cursor = 'pointer';
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const text = link.textContent.trim();
            infoTitle.textContent = text;
            
            if (text === 'Contact Us') {
                infoContent.innerHTML = '<p>Reach out to us at <strong>hello@shadesofchettinad.com</strong> or call us at <strong>+91-800-KARA-ART</strong>.</p>';
            } else if (text === 'Returns & Exchanges') {
                infoContent.innerHTML = '<p>We accept returns within 30 days of purchase for vintage items. Custom modern arts are non-refundable.</p>';
            } else if (text === 'About Karaikudi') {
                infoContent.innerHTML = '<p>Karaikudi is the capital of the Chettinad region in Tamil Nadu, India, known for its sprawling mansions, unique architecture, and spicy cuisine.</p>';
            } else {
                infoContent.innerHTML = `<p>More information about <strong>${text}</strong> is coming soon.</p>`;
            }
            infoModal.classList.remove('hidden');
        });
    });

    // --- Initialization ---
    updateAuthUI();
    updateCartCountUI();
    
    // Guaranteed Initialization: Fetch Products after all elements are bound
    if (productListElement) {
        const urlParams = new URLSearchParams(window.location.search);
        const urlCat = urlParams.get('category') || '';
        const urlSearch = urlParams.get('search') || '';
        fetchProducts(urlCat, urlSearch);
    }
});
