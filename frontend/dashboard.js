document.addEventListener('DOMContentLoaded', () => {
    // --- Navigation ---
    const links = document.querySelectorAll('.sidebar-menu a');
    const panels = document.querySelectorAll('.panel');

    links.forEach(link => {
        link.addEventListener('click', (e) => {
            links.forEach(l => l.classList.remove('active'));
            panels.forEach(p => p.classList.remove('active'));
            
            e.target.classList.add('active');
            const targetId = e.target.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
        });
    });

    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab') || 'history'; // Default to history
    if (tab) {
        const targetLink = document.querySelector(`.sidebar-menu a[data-target="panel-${tab}"]`);
        if (targetLink) {
            targetLink.click();
        }
    }

    // --- Helpers ---
    const toastElement = document.getElementById('toast');
    function showToast(message) {
        if (!toastElement) return;
        toastElement.textContent = message;
        toastElement.classList.remove('hidden');
        setTimeout(() => toastElement.classList.add('hidden'), 3000);
    }

    // --- Helper for API calls ---
    let globalCsrfToken = '';
    async function initCsrf() {
        try {
            const res = await fetch('/backend/api.php?action=csrf_token');
            const data = await res.json();
            if (data.success) {
                globalCsrfToken = data.data.csrf_token;
            }
        } catch (e) {
            console.error('Failed to init CSRF', e);
        }
    }

    async function fetchApi(url, options = {}) {
        try {
            if (!options.headers) options.headers = {};
            if (globalCsrfToken) options.headers['X-CSRF-Token'] = globalCsrfToken;
            if (!options.cache) options.cache = 'no-store';
            
            // Aggressive cache-busting for mobile browsers
            if (!options.method || options.method === 'GET') {
                url += (url.includes('?') ? '&' : '?') + 't=' + new Date().getTime();
            }

            const res = await fetch(url, options);
            const data = await res.json();
            if (res.ok && data.success) return data.data;
            if (data.error && data.error.code === 'ERR_UNAUTHORIZED') {
                window.location.href = 'index.html'; // redirect if not logged in
            }
            throw new Error(data.error ? data.error.detail : 'API Error');
        } catch (e) {
            console.error(e);
            showToast(e.message);
            return null;
        }
    }

    // --- Profile & Header ---
    async function loadProfile() {
        const data = await fetchApi('/backend/api.php?action=get_user_profile');
        if (data) {
            document.getElementById('welcome-message').textContent = `Welcome back, ${data.profile.name.split(' ')[0]}!`;
            
            const nameInput = document.getElementById('profile-name');
            const emailInput = document.getElementById('profile-email');
            const mobileInput = document.getElementById('profile-mobile');
            const whatsappInput = document.getElementById('profile-whatsapp');
            const sameAsMobileCheck = document.getElementById('whatsapp-same-as-mobile');
            const whatsappGroup = document.getElementById('whatsapp-group');
            
            if (nameInput) nameInput.value = data.profile.name || '';
            if (emailInput) emailInput.value = data.profile.email || '';
            if (mobileInput) mobileInput.value = data.profile.mobile_number || '';
            if (whatsappInput) whatsappInput.value = data.profile.whatsapp_number || '';
            
            if (sameAsMobileCheck && mobileInput && whatsappInput && whatsappGroup) {
                if (data.profile.mobile_number && data.profile.mobile_number === data.profile.whatsapp_number) {
                    sameAsMobileCheck.checked = true;
                    whatsappGroup.style.display = 'none';
                } else {
                    sameAsMobileCheck.checked = false;
                    whatsappGroup.style.display = 'block';
                }
            }
        }
    }

    const sameAsMobileCheck = document.getElementById('whatsapp-same-as-mobile');
    const mobileInput = document.getElementById('profile-mobile');
    const whatsappInput = document.getElementById('profile-whatsapp');
    const whatsappGroup = document.getElementById('whatsapp-group');

    if (sameAsMobileCheck && whatsappGroup) {
        sameAsMobileCheck.addEventListener('change', (e) => {
            if (e.target.checked) {
                whatsappGroup.style.display = 'none';
            } else {
                whatsappGroup.style.display = 'block';
            }
        });
    }

    const profileForm = document.getElementById('profile-settings-form');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            let whatsappVal = document.getElementById('profile-whatsapp').value;
            const sameAsMobile = document.getElementById('whatsapp-same-as-mobile');
            if (sameAsMobile && sameAsMobile.checked) {
                whatsappVal = document.getElementById('profile-mobile').value;
            }
            
            const payload = {
                name: document.getElementById('profile-name').value,
                mobile_number: document.getElementById('profile-mobile').value,
                whatsapp_number: whatsappVal
            };
            const data = await fetchApi('/backend/api.php?action=update_profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (data) {
                showToast('Profile updated successfully!');
                loadProfile();
            }
        });
    }

    // --- Logout ---
    document.getElementById('logout-btn').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('chettinad_user');
        // A real logout endpoint should be called here, but for now we'll just redirect
        window.location.href = 'index.html';
    });

    // --- Order History ---
    const ordersContainer = document.getElementById('orders-container');
    const orderModal = document.getElementById('order-details-modal');
    const orderContent = document.getElementById('order-details-content');
    const suggestionsContainer = document.getElementById('order-suggestions');
    const suggestionsList = document.getElementById('suggestions-list');

    document.getElementById('close-order-details').addEventListener('click', () => orderModal.classList.add('hidden'));

    let allOrders = [];

    async function loadOrders() {
        const data = await fetchApi('/backend/api.php?action=get_user_history');
        if (data) {
            const orders = data.orders;
            allOrders = orders;
            if (orders.length === 0) {
                ordersContainer.innerHTML = '<p>You have no past orders.</p>';
                return;
            }
            
            ordersContainer.innerHTML = '';
            orders.forEach(order => {
                const date = new Date(order.created_at).toLocaleDateString();
                const card = document.createElement('div');
                card.className = 'order-card';
                let displayStatus = order.status;
                if (displayStatus === 'AWAITING PAYMENT/COD CONFIRMATION') {
                    displayStatus = 'Awaiting Payment';
                } else if (displayStatus === 'CANCELLED') {
                    displayStatus = 'Cancelled';
                } else {
                    displayStatus = displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1).toLowerCase();
                }

                card.innerHTML = `
                    <div class="order-header">
                        <div>
                            <strong>Order #${order.id}</strong><br>
                            <span style="font-size: 0.8em; color: var(--color-text-body);">${date}</span>
                        </div>
                        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 5px;">
                            <span style="font-weight: bold; font-size: 1.1em;">$${Number(order.total).toFixed(2)}</span>
                            <span class="status-badge">${displayStatus}</span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center; width: 100%;">
                        <button class="cta-button" style="padding: 8px 15px; font-size: 0.9em;" onclick='viewOrderById(${order.id})'>View Details</button>
                        <button class="cta-button" style="padding: 8px 15px; font-size: 0.9em; background: transparent; color: var(--color-muted-gold); border: 1px solid var(--color-muted-gold);" onclick='reorderItemsById(${order.id})'>Reorder Items</button>
                        ${(order.status === 'AWAITING PAYMENT/COD CONFIRMATION' || order.status === 'Processing') ? `<button style="background: none; border: none; color: #777; font-size: 0.85em; text-decoration: underline; padding: 8px 5px; cursor: pointer; margin-left: auto;" onmouseover="this.style.color='#aaa'" onmouseout="this.style.color='#777'" onclick='cancelOrder(${order.id})'>Cancel Order</button>` : ''}
                    </div>
                `;
                ordersContainer.appendChild(card);
            });
        }
    }

    window.viewOrderById = function(orderId) {
        const order = allOrders.find(o => o.id == orderId);
        if (order) viewOrder(order);
    };

    window.reorderItemsById = function(orderId) {
        const order = allOrders.find(o => o.id == orderId);
        if (order) reorderItems(order.items);
    };

    window.viewOrder = function(order) {
        let itemsHtml = order.items.map(item => `
            <div class="order-item-row">
                <img src="${item.img}" class="order-item-img" alt="${item.name}">
                <div style="flex: 1;">
                    <h4 style="margin: 0;">${item.name}</h4>
                    <p style="margin: 5px 0 0 0; font-size: 0.9em;">$${Number(item.price).toFixed(2)} x ${item.quantity}</p>
                </div>
            </div>
        `).join('');
        
        orderContent.innerHTML = `
            <div style="margin-bottom: 20px;">
                <p><strong>Shipping Address:</strong><br>${order.shipping_address}</p>
            </div>
            ${itemsHtml}
            <div style="border-top: 1px solid #eee; margin-top: 15px; padding-top: 10px; font-weight: bold; text-align: right;">
                Total: $${Number(order.total).toFixed(2)}
            </div>
        `;
        
        // Smart Suggestions
        if (order.suggestions && order.suggestions.length > 0) {
            suggestionsContainer.classList.remove('hidden');
            suggestionsList.innerHTML = order.suggestions.map(sugg => `
                <div class="suggestion-item">
                    <img src="${sugg.img}" alt="${sugg.name}">
                    <div style="padding: 10px;">
                        <h4 style="margin: 0; font-size: 0.9em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${sugg.name}</h4>
                        <p style="margin: 5px 0 0 0; color: #666;">$${sugg.price}</p>
                        <button onclick="addToCart(${sugg.id}, '${sugg.name.replace(/'/g, "\\'")}', ${sugg.price}, '${sugg.img}')" style="margin-top: 5px; font-size: 0.8em; padding: 2px 5px; background: #333; color: #fff; border: none; cursor: pointer;">Add to Cart</button>
                    </div>
            `).join('');
        } else {
            suggestionsContainer.classList.add('hidden');
        }
        
        orderModal.classList.remove('hidden');
    };

    window.reorderItems = function(items) {
        let cart = JSON.parse(localStorage.getItem('chettinad_cart')) || [];
        items.forEach(item => {
            const existing = cart.find(c => c.id == item.product_id);
            if (existing) {
                existing.quantity += item.quantity;
            } else {
                cart.push({
                    id: item.product_id,
                    name: item.name,
                    price: item.price,
                    img: item.img,
                    quantity: item.quantity
                });
            }
        });
        localStorage.setItem('chettinad_cart', JSON.stringify(cart));
        showToast('Items added to cart! Redirecting to checkout...');
        setTimeout(() => {
            window.location.href = 'checkout.html';
        }, 1500);
    };
    
    window.updateCartCount = function() {
        const cartCountEl = document.getElementById('cart-count');
        if (cartCountEl) {
            const cart = JSON.parse(localStorage.getItem('chettinad_cart')) || [];
            const count = cart.reduce((acc, item) => acc + parseInt(item.quantity, 10), 0);
            cartCountEl.textContent = count;
        }
    };

    window.openCartModal = function() {
        renderCartItems();
        document.getElementById('cart-modal').classList.remove('hidden');
    };

    document.getElementById('close-modal-btn')?.addEventListener('click', () => {
        document.getElementById('cart-modal').classList.add('hidden');
    });

    document.getElementById('cart-modal')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('cart-modal')) {
            document.getElementById('cart-modal').classList.add('hidden');
        }
    });

    document.getElementById('clear-cart-btn')?.addEventListener('click', () => {
        document.getElementById('clear-cart-modal').classList.remove('hidden');
    });

    document.getElementById('close-clear-cart-modal')?.addEventListener('click', () => {
        document.getElementById('clear-cart-modal').classList.add('hidden');
    });

    document.getElementById('abort-clear-cart-btn')?.addEventListener('click', () => {
        document.getElementById('clear-cart-modal').classList.add('hidden');
    });

    document.getElementById('confirm-clear-cart-btn')?.addEventListener('click', () => {
        localStorage.setItem('chettinad_cart', JSON.stringify([]));
        updateCartCount();
        renderCartItems();
        document.getElementById('clear-cart-modal').classList.add('hidden');
    });

    document.getElementById('checkout-btn')?.addEventListener('click', () => {
        const cart = JSON.parse(localStorage.getItem('chettinad_cart')) || [];
        if (cart.length > 0) {
            window.location.href = 'checkout.html';
        }
    });

    window.updateCartQuantity = function(id, delta) {
        let cart = JSON.parse(localStorage.getItem('chettinad_cart')) || [];
        const item = cart.find(i => i.id == id);
        if (item) {
            item.quantity = parseInt(item.quantity, 10) + parseInt(delta, 10);
            if (item.quantity <= 0) {
                cart = cart.filter(i => i.id != id);
            }
            localStorage.setItem('chettinad_cart', JSON.stringify(cart));
            updateCartCount();
            renderCartItems();
        }
    };

    function renderCartItems() {
        const container = document.getElementById('cart-items-container');
        const totalPriceEl = document.getElementById('cart-total-price');
        const checkoutBtn = document.getElementById('checkout-btn');
        if (!container || !totalPriceEl || !checkoutBtn) return;
        
        let cart = JSON.parse(localStorage.getItem('chettinad_cart')) || [];
        if (cart.length === 0) {
            container.innerHTML = '<p>Your cart is empty.</p>';
            totalPriceEl.textContent = '0.00';
            checkoutBtn.disabled = true;
            return;
        }

        checkoutBtn.disabled = false;
        container.innerHTML = '';
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
            container.appendChild(div);
        });

        totalPriceEl.textContent = total.toFixed(2);
    }

    window.addToCart = function(id, name, price, img, silent = false) {
        let cart = JSON.parse(localStorage.getItem('chettinad_cart')) || [];
        const existing = cart.find(c => c.id == id);
        if (existing) existing.quantity += 1;
        else cart.push({id, name, price, img, quantity: 1});
        localStorage.setItem('chettinad_cart', JSON.stringify(cart));
        updateCartCount();
        if (!silent) showToast(name + ' added to cart!');
    };

    // --- Addresses ---
    const addressesContainer = document.getElementById('addresses-container');
    const addressModal = document.getElementById('add-address-modal');
    const addressForm = document.getElementById('add-address-form');

    document.getElementById('btn-add-address').addEventListener('click', () => {
        document.getElementById('addr-id').value = '';
        addressForm.reset();
        addressModal.classList.remove('hidden');
    });
    document.getElementById('close-add-address').addEventListener('click', () => addressModal.classList.add('hidden'));

    async function loadAddresses() {
        const data = await fetchApi('/backend/api.php?action=manage_addresses');
        if (data) {
            const addresses = data.addresses;
            if (addresses.length === 0) {
                addressesContainer.innerHTML = '<p>No saved addresses.</p>';
                return;
            }
            addressesContainer.innerHTML = '';
            addresses.forEach(addr => {
                const card = document.createElement('div');
                card.className = `address-card ${addr.is_default ? 'default-address' : ''}`;
                card.innerHTML = `
                    ${addr.is_default ? '<div class="default-badge">Default</div>' : ''}
                    <strong>${addr.name}</strong><br>
                    ${addr.address_line_1}<br>
                    ${addr.city}, ${addr.zip}
                    <div style="margin-top: 10px; display: flex; gap: 10px;">
                        <button onclick="editAddress(${addr.id}, '${addr.name.replace(/'/g, "\\'")}', '${addr.address_line_1.replace(/'/g, "\\'")}', '${addr.city.replace(/'/g, "\\'")}', '${addr.zip.replace(/'/g, "\\'")}', ${addr.is_default})" style="background: transparent; border: 1px solid var(--color-primary-accent); color: var(--color-primary-accent); padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8em;">Edit</button>
                        <button onclick="deleteAddress(${addr.id})" style="background: transparent; border: 1px solid #888; color: #888; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8em;">Delete</button>
                    </div>
                `;
                addressesContainer.appendChild(card);
            });
        }
    }

    addressForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Basic ZIP validation via Regex in HTML pattern, but we verify here too
        const zip = document.getElementById('addr-zip').value;
        if (!/^[a-zA-Z0-9\s\-]{4,10}$/.test(zip)) {
            showToast('Please enter a valid ZIP/Postal code format.');
            return;
        }

        const payload = {
            id: document.getElementById('addr-id').value,
            name: document.getElementById('addr-name').value,
            address_line_1: document.getElementById('addr-line1').value,
            city: document.getElementById('addr-city').value,
            zip: zip,
            is_default: document.getElementById('addr-default').checked
        };

        const data = await fetchApi('/backend/api.php?action=manage_addresses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (data) {
            addressModal.classList.add('hidden');
            addressForm.reset();
            loadAddresses();
        }
    });
    // --- Wishlist ---
    function loadWishlist() {
        const wishlistContainer = document.getElementById('wishlist-container');
        if (!wishlistContainer) return;
        
        let wishlist = [];
        try {
            wishlist = JSON.parse(localStorage.getItem('chettinad_wishlist')) || [];
        } catch(e) {}
        
        const addAllBtn = document.getElementById('wishlist-add-all-btn');
        const browseBtn = document.getElementById('wishlist-browse-btn');

        if (wishlist.length === 0) {
            wishlistContainer.innerHTML = '<p>Your wishlist is empty.</p>';
            if (addAllBtn) addAllBtn.style.display = 'none';
            if (browseBtn) browseBtn.style.display = 'inline-block';
            return;
        }

        if (addAllBtn) addAllBtn.style.display = 'inline-block';
        if (browseBtn) browseBtn.style.display = 'none';
        
        wishlistContainer.innerHTML = '';
        wishlist.forEach(item => {
            const card = document.createElement('div');
            card.className = 'product-card';
            // Some inline overrides to make it look decent in the dashboard grid
            card.style.background = 'var(--color-shadow-depth)';
            card.style.padding = '10px';
            card.style.border = '1px solid var(--border-color)';
            card.style.borderRadius = '4px';
            card.style.position = 'relative';
            card.innerHTML = `
                <button onclick="removeFromWishlist(${item.id})" style="position: absolute; top: 15px; right: 15px; background: white; border: none; border-radius: 50%; width: 32px; height: 32px; font-size: 1.2em; color: #d9534f; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.2); z-index: 10; display: flex; align-items: center; justify-content: center; line-height: 1;" title="Remove from Wishlist">❤</button>
                <img src="${item.img}" alt="${item.name}" style="width:100%; height:200px; object-fit:cover; border-radius:4px;">
                <h4 style="margin-top:10px; font-size:1.1em; color:var(--color-text-body);">${item.name}</h4>
                <p style="color:var(--color-primary-accent); margin-bottom:10px;">$${Number(item.price).toFixed(2)}</p>
                <button class="cta-button" style="width:100%; padding: 8px; margin-bottom: 5px;" onclick="addToCart(${item.id}, '${item.name.replace(/'/g, "\\'")}', ${item.price}, '${item.img}')">Add to Cart</button>
                <button class="cta-button" style="width:100%; padding: 8px; background: transparent; border: 1px solid var(--color-primary-accent); color: var(--color-primary-accent);" onclick="window.location.href='product.html?id=${item.id}'">View in Store</button>
            `;
            wishlistContainer.appendChild(card);
        });
    }

    // Init
    (async function init() {
        await initCsrf();
        await Promise.all([
            loadOrders(),
            loadAddresses(),
            loadProfile(),
            loadWishlist()
        ]);
        if (window.updateCartCount) window.updateCartCount();

        // Auto-open order details if orderId is in URL
        const autoOrderId = urlParams.get('orderId');
        if (autoOrderId && tab === 'history') {
            viewOrderById(autoOrderId);
        }
    })(); const cancelModal = document.getElementById('cancel-confirm-modal');
    let orderToCancelId = null;

    window.cancelOrder = function(orderId) {
        orderToCancelId = orderId;
        cancelModal.classList.remove('hidden');
    };

    window.editAddress = function(id, name, line1, city, zip, isDefault) {
        document.getElementById('addr-id').value = id;
        document.getElementById('addr-name').value = name;
        document.getElementById('addr-line1').value = line1;
        document.getElementById('addr-city').value = city;
        document.getElementById('addr-zip').value = zip;
        document.getElementById('addr-default').checked = !!isDefault;
        addressModal.classList.remove('hidden');
    };

    window.deleteAddress = async function(id) {
        addressToDeleteId = id;
        document.getElementById('delete-address-modal').classList.remove('hidden');
    };

    window.addAllWishlistToCart = function() {
        let wishlist = [];
        try {
            wishlist = JSON.parse(localStorage.getItem('chettinad_wishlist')) || [];
        } catch(e) {}
        
        if (wishlist.length === 0) {
            showToast('Your wishlist is empty!');
            return;
        }
        
        if (window.addToCart) {
            wishlist.forEach(item => {
                addToCart(item.id, item.name, item.price, item.img, true);
            });
            showToast('All wishlist items have been added to your cart!');
        } else {
            console.error('addToCart function not found');
        }
    };

    const deleteAddressModal = document.getElementById('delete-address-modal');
    let addressToDeleteId = null;

    document.getElementById('close-delete-address-modal')?.addEventListener('click', () => {
        deleteAddressModal.classList.add('hidden');
        addressToDeleteId = null;
    });

    document.getElementById('abort-delete-address-btn')?.addEventListener('click', () => {
        deleteAddressModal.classList.add('hidden');
        addressToDeleteId = null;
    });

    document.getElementById('confirm-delete-address-btn')?.addEventListener('click', async () => {
        if (!addressToDeleteId) return;
        
        const payload = { id: addressToDeleteId };
        const data = await fetchApi('/backend/api.php?action=manage_addresses', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (data) {
            deleteAddressModal.classList.add('hidden');
            addressToDeleteId = null;
            loadAddresses();
        }
    });

    document.getElementById('close-cancel-modal')?.addEventListener('click', () => {
        cancelModal.classList.add('hidden');
        orderToCancelId = null;
    });

    document.getElementById('abort-cancel-btn')?.addEventListener('click', () => {
        cancelModal.classList.add('hidden');
        orderToCancelId = null;
    });

    document.getElementById('confirm-cancel-btn')?.addEventListener('click', async () => {
        if (!orderToCancelId) return;
        cancelModal.classList.add('hidden');
        const res = await fetchApi('/backend/api.php?action=cancel_order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: orderToCancelId })
        });
        if (res) {
            showToast('Order cancelled successfully.');
            loadOrders();
        }
        orderToCancelId = null;
    });

    window.removeFromWishlist = function(id) {
        let wishlist = JSON.parse(localStorage.getItem('chettinad_wishlist')) || [];
        wishlist = wishlist.filter(item => item.id != id);
        localStorage.setItem('chettinad_wishlist', JSON.stringify(wishlist));
        loadWishlist();
        showToast('Item removed from wishlist');
    };
});
