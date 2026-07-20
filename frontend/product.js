document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');
    
    if (!productId) {
        document.getElementById('product-detail-section').innerHTML = '<p>Product not found.</p>';
        return;
    }

    let currentUser = null;
    let globalCsrfToken = '';
    const storedUserData = JSON.parse(localStorage.getItem('chettinad_user'));
    if (storedUserData && (Date.now() - storedUserData.timestamp <= 30 * 60 * 1000)) {
        currentUser = storedUserData.user;
    }

    const toastElement = document.getElementById('toast');
    function showToast(message) {
        toastElement.textContent = message;
        toastElement.classList.remove('hidden');
        setTimeout(() => toastElement.classList.add('hidden'), 3000);
    }

    async function fetchCsrfToken() {
        try {
            const res = await fetch('/backend/api.php?action=csrf_token');
            const data = await res.json();
            if (data.success) {
                globalCsrfToken = data.data.csrf_token;
            }
        } catch(e) {}
    }
    await fetchCsrfToken();

    function apiFetch(url, options = {}) {
        if (!options.headers) options.headers = {};
        options.headers['X-CSRF-Token'] = globalCsrfToken;
        return fetch(url, options);
    }

    const detailSection = document.getElementById('product-detail-section');
    const reviewsSection = document.getElementById('product-reviews-section');
    
    let productData = null;

    async function loadProduct() {
        try {
            const res = await fetch(`/backend/api.php?action=product_details&id=${productId}`);
            const data = await res.json();
            if (!data.success) throw new Error(data.error.detail);
            
            productData = data.data.product;
            productData.reviews = data.data.reviews;
            productData.is_verified_buyer = data.data.is_verified_buyer;
            renderProduct();
            
            logProductView();
            loadRecommendations();
        } catch(e) {
            detailSection.innerHTML = `<p class="error-state">Error loading product: ${e.message}</p>`;
        }
    }
    
    async function logProductView() {
        try {
            const formData = new FormData();
            formData.append('product_id', productId);
            await apiFetch('/backend/api.php?action=log_view', {
                method: 'POST',
                body: formData
            });
        } catch(e) { console.error('Failed to log view', e); }
    }

    async function loadRecommendations() {
        try {
            const res = await fetch(`/backend/api.php?action=get_recommendations&product_id=${productId}`);
            const data = await res.json();
            if (data.success && data.data.recommendations && data.data.recommendations.length > 0) {
                const recs = data.data.recommendations;
                const recSection = document.getElementById('product-recommendations-section');
                const recGrid = document.getElementById('recommendations-grid');
                recSection.style.display = 'block';
                
                recGrid.innerHTML = recs.map(p => {
                    const dynamicHtml = p.dynamic_alert 
                        ? `<div style="background: var(--color-primary-accent); color: var(--color-deep-background); padding: 5px; font-size: 0.8em; text-align: center; margin-bottom: 5px; border-radius: 4px;">${p.dynamic_alert}</div>
                           <p class="price" style="margin: 10px 0;"><span style="text-decoration: line-through; color: #888; margin-right: 5px;">$${p.original_price.toFixed(2)}</span> <span style="color: var(--color-primary-accent); font-weight: bold;">$${p.price.toFixed(2)}</span></p>`
                        : `<p class="price" style="margin: 10px 0; font-weight: bold; color: var(--color-primary-accent);">$${p.price.toFixed(2)}</p>`;
                        
                    return `
                        <div class="product-card" style="border: 1px solid #eee; border-radius: 8px; overflow: hidden; display: flex; flex-direction: column;">
                            <img src="${p.img}" alt="${p.name}" style="width: 100%; height: 200px; object-fit: cover; cursor: pointer;" onclick="window.location.href='product.html?id=${p.id}'">
                            <div class="product-info" style="padding: 15px; display: flex; flex-direction: column; flex-grow: 1;">
                                <h3 style="margin-top: 0; font-size: 1.1em; cursor: pointer;" onclick="window.location.href='product.html?id=${p.id}'">${p.name}</h3>
                                ${dynamicHtml}
                                <button style="margin-top: auto; padding: 10px; background: #9b2226; color: white; border: none; border-radius: 4px; cursor: pointer;" onclick="window.location.href='product.html?id=${p.id}'">View Details</button>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        } catch(e) { console.error('Failed to load recommendations', e); }
    }

    function renderProduct() {
        document.title = `${productData.name} | Shades of Chettinad`;
        const catEl = document.getElementById('breadcrumb-category');
        catEl.textContent = productData.category;
        catEl.href = `products.html?category=${encodeURIComponent(productData.category)}`;
        document.getElementById('breadcrumb-name').textContent = productData.name;

        const ratingHtml = productData.avg_rating 
            ? `★ ${parseFloat(productData.avg_rating).toFixed(1)} (${productData.review_count} reviews)` 
            : `<span>No reviews yet</span>`;

        let priceHtml = `<h2 style="color: var(--color-primary-accent); font-size: 2em; margin: 10px 0;">$${productData.price.toFixed(2)}</h2>`;
        let alertHtml = '';
        if (productData.dynamic_alert) {
            alertHtml = `<div style="background: var(--color-primary-accent); color: var(--color-deep-background); padding: 10px; border-radius: 4px; margin-bottom: 15px;"><strong>${productData.dynamic_alert}</strong></div>`;
            priceHtml = `<h2 style="color: var(--color-primary-accent); font-size: 2em; margin: 10px 0;"><span style="text-decoration: line-through; color: #888; font-size: 0.6em; margin-right: 10px;">$${productData.original_price.toFixed(2)}</span>$${productData.price.toFixed(2)}</h2>`;
        }

        detailSection.innerHTML = `
            <div style="flex: 1; min-width: 300px;">
                <img src="${productData.img}" alt="${productData.name}" style="width: 100%; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
            </div>
            <div style="flex: 1; min-width: 300px; display: flex; flex-direction: column; justify-content: center;">
                ${alertHtml}
                <h1 style="margin-top: 0; color: var(--color-muted-gold);">${productData.name}</h1>
                <p style="font-size: 1.1em; margin-bottom: 5px;">${ratingHtml}</p>
                ${priceHtml}
                <p style="line-height: 1.6; margin: 20px 0;">${productData.description}</p>
                
                <div style="margin: 20px 0; padding: 15px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px;">
                    <h3 style="margin-top: 0; font-size: 1.2em;">Product Specifications</h3>
                    <ul style="padding-left: 20px; margin-bottom: 0;">
                        <li><strong>Material:</strong> Authentic material sourced from Karaikudi</li>
                        <li><strong>Dimensions:</strong> Standard size (varies by handcrafted nature)</li>
                        <li><strong>Care:</strong> Wipe with a dry cloth. Do not use harsh chemicals.</li>
                    </ul>
                </div>
                
                <p style="font-weight: bold; color: ${productData.stock > 0 ? '#2E7D32' : '#C62828'};">
                    ${productData.stock > 0 ? `In Stock (${productData.stock} available)` : 'Out of Stock'}
                </p>
                
                <div style="display: flex; gap: 10px; margin-top: 10px;">
                    <button class="cta-button large-btn" id="add-to-cart-btn" ${productData.stock === 0 ? 'disabled' : ''} style="flex: 1;">
                        ${productData.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
                    </button>
                    <button class="cta-button large-btn" id="share-btn" style="flex: 1; background: transparent; color: var(--color-primary-accent); border: 1px solid var(--color-primary-accent);">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 5px; vertical-align: text-bottom;"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg> Share
                    </button>
                </div>
            </div>
        `;

        const addBtn = document.getElementById('add-to-cart-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                let cart = JSON.parse(localStorage.getItem('chettinad_cart')) || [];
                const existingItem = cart.find(item => item.id === productData.id);
                if (existingItem) {
                    existingItem.quantity += 1;
                } else {
                    cart.push({ id: productData.id, name: productData.name, price: productData.price, quantity: 1, img: productData.img });
                }
                localStorage.setItem('chettinad_cart', JSON.stringify(cart));
                showToast(`✓ ${productData.name} added to your cart!`);
                const cartBtn = document.querySelector('.cart-btn');
                if (cartBtn) {
                    cartBtn.classList.remove('cart-pop');
                    void cartBtn.offsetWidth;
                    cartBtn.classList.add('cart-pop');
                }
            });
        }

        const shareBtn = document.getElementById('share-btn');
        if (shareBtn) {
            shareBtn.addEventListener('click', async () => {
                const url = window.location.href;
                const shareData = {
                    title: `${productData.name} | Shades of Chettinad`,
                    text: `Check out ${productData.name} on Shades of Chettinad!`,
                    url: url
                };
                try {
                    if (navigator.share) {
                        await navigator.share(shareData);
                    } else if (navigator.clipboard) {
                        await navigator.clipboard.writeText(url);
                        showToast('Link copied to clipboard!');
                    } else {
                        // Fallback for non-secure contexts (HTTP)
                        const textArea = document.createElement("textarea");
                        textArea.value = url;
                        // Avoid scrolling to bottom
                        textArea.style.top = "0";
                        textArea.style.left = "0";
                        textArea.style.position = "fixed";
                        document.body.appendChild(textArea);
                        textArea.focus();
                        textArea.select();
                        try {
                            const successful = document.execCommand('copy');
                            if (successful) {
                                showToast('Link copied to clipboard!');
                            } else {
                                showToast('Failed to copy link.');
                            }
                        } catch (err) {
                            console.error('Fallback: Oops, unable to copy', err);
                        }
                        document.body.removeChild(textArea);
                    }
                } catch (err) {
                    console.error('Error sharing', err);
                }
            });
        }
        
        renderReviews();
    }

    function renderReviews() {
        const reviewsHtml = productData.reviews.length === 0 
            ? '<p>No reviews yet. Be the first to review this product!</p>' 
            : productData.reviews.map(r => `
                <div style="border-bottom: 1px solid #eee; padding: 15px 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                        <strong>${r.user_name || r.user_email}</strong>
                        ${r.is_verified_purchase ? '<span style="background:#2E7D32; color:white; padding:2px 5px; border-radius:3px; font-size:0.7em; margin-left:5px;">Verified Buyer</span>' : ''}
                        <span style="color: #888; font-size: 0.9em;">${new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                    <div style="color: #e6b800; margin-bottom: 10px;">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div>
                    <p style="margin: 0; color: #444;">${r.review_text || ''}</p>
                </div>
            `).join('');

        reviewsSection.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #9b2226; padding-bottom: 10px; margin-bottom: 20px;">
                <h2 style="margin: 0;">Customer Reviews</h2>
                ${productData.is_verified_buyer ? '<button class="cta-button" id="write-review-btn">Write a Review</button>' : '<p style="color: #666; font-size: 0.9em; margin: 0;">Only verified buyers can review.</p>'}
            </div>
            ${reviewsHtml}
        `;

        const writeReviewBtn = document.getElementById('write-review-btn');
        if (writeReviewBtn) {
            writeReviewBtn.addEventListener('click', () => {
                if (!currentUser) {
                    showToast('Please go to the home page to login before writing a review.');
                    return;
                }
                document.getElementById('review-modal').classList.remove('hidden');
            });
        }
    } // Close renderReviews function

    // Modal logic
    const reviewModal = document.getElementById('review-modal');
    const closeReviewBtn = document.getElementById('close-review-btn');
    const reviewForm = document.getElementById('review-form');

    closeReviewBtn.addEventListener('click', () => reviewModal.classList.add('hidden'));

    reviewForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            product_id: productId,
            rating: document.getElementById('review-rating').value,
            review_text: document.getElementById('review-text').value.trim(),
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
                loadProduct(); // reload to show new review
            } else {
                throw new Error(data.error ? data.error.detail : 'Failed to submit review');
            }
        } catch (e) {
            showToast(e.message);
        }
    });

    loadProduct();
});
