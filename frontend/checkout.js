document.addEventListener('DOMContentLoaded', () => {
    const cart = JSON.parse(localStorage.getItem('chettinad_cart')) || [];
    const itemsList = document.getElementById('checkout-items-list');
    const totalDisplay = document.getElementById('checkout-grand-total');
    const placeOrderBtn = document.getElementById('place-order-btn');
    const errorDisplay = document.getElementById('checkout-error');
    const form = document.getElementById('checkout-form');

    if (cart.length === 0) {
        itemsList.innerHTML = '<p>Your cart is empty.</p>';
        placeOrderBtn.disabled = true;
        return;
    }

    // Pre-fill default address if available (Phase 9)
    fetch('/backend/api.php?action=get_user_profile')
        .then(res => res.json())
        .then(data => {
            if (data.success && data.data && data.data.default_address) {
                const addr = data.data.default_address;
                document.getElementById('shipping-name').value = addr.name || '';
                document.getElementById('shipping-address').value = addr.address_line_1 || '';
                document.getElementById('shipping-city').value = addr.city || '';
                document.getElementById('shipping-zip').value = addr.zip || '';
            }
        }).catch(err => console.error("Could not fetch profile", err));

    let subtotal = 0;
    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;
        const div = document.createElement('div');
        div.className = 'summary-item';
        div.innerHTML = `
            <span>${item.name} (x${item.quantity})</span>
            <span>$${itemTotal.toFixed(2)}</span>
        `;
        itemsList.appendChild(div);
    });

    const countrySelect = document.getElementById('shipping-country');
    
    function updateTotals() {
        const country = countrySelect ? countrySelect.value : 'IN';
        let shipping = 0;
        let taxRate = 0;
        
        if (country !== 'IN') {
            shipping = 15.00;
            taxRate = 0.10;
        } else {
            shipping = 5.00;
            taxRate = 0.05;
        }
        
        const tax = subtotal * taxRate;
        const total = subtotal + shipping + tax;
        
        document.getElementById('checkout-subtotal').textContent = `$${subtotal.toFixed(2)}`;
        document.getElementById('checkout-shipping').textContent = `$${shipping.toFixed(2)}`;
        document.getElementById('checkout-tax').textContent = `$${tax.toFixed(2)}`;
        document.getElementById('checkout-grand-total').textContent = `$${total.toFixed(2)}`;
    }
    
    if (countrySelect) {
        countrySelect.addEventListener('change', updateTotals);
    }
    updateTotals();

    // Toggle billing fields
    const sameAsShipping = document.getElementById('same-as-shipping');
    const billingFields = document.getElementById('billing-fields');
    if (sameAsShipping && billingFields) {
        sameAsShipping.addEventListener('change', (e) => {
            if (e.target.checked) {
                billingFields.style.display = 'none';
                // Remove required attributes
                document.getElementById('billing-name').removeAttribute('required');
                document.getElementById('billing-address').removeAttribute('required');
                document.getElementById('billing-city').removeAttribute('required');
                document.getElementById('billing-zip').removeAttribute('required');
            } else {
                billingFields.style.display = 'block';
                // Add required attributes
                document.getElementById('billing-name').setAttribute('required', 'required');
                document.getElementById('billing-address').setAttribute('required', 'required');
                document.getElementById('billing-city').setAttribute('required', 'required');
                document.getElementById('billing-zip').setAttribute('required', 'required');
            }
        });
    }

    // Toggle Payment Methods
    const paymentRadios = document.querySelectorAll('input[name="payment-method"]');
    const cardDetails = document.getElementById('card-details');
    const paypalDetails = document.getElementById('paypal-details');
    
    function updatePaymentUI() {
        const selected = document.querySelector('input[name="payment-method"]:checked').value;
        if (selected === 'card') {
            cardDetails.style.display = 'block';
            paypalDetails.style.display = 'none';
            document.getElementById('card-name').setAttribute('required', 'required');
            document.getElementById('card-number').setAttribute('required', 'required');
            document.getElementById('card-expiry').setAttribute('required', 'required');
            document.getElementById('card-cvv').setAttribute('required', 'required');
        } else if (selected === 'paypal') {
            cardDetails.style.display = 'none';
            paypalDetails.style.display = 'block';
            document.getElementById('card-name').removeAttribute('required');
            document.getElementById('card-number').removeAttribute('required');
            document.getElementById('card-expiry').removeAttribute('required');
            document.getElementById('card-cvv').removeAttribute('required');
        }
    }
    
    paymentRadios.forEach(radio => {
        radio.addEventListener('change', updatePaymentUI);
    });

    placeOrderBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        errorDisplay.style.display = 'none';
        
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const shippingData = {
            name: document.getElementById('shipping-name').value,
            address: document.getElementById('shipping-address').value,
            city: document.getElementById('shipping-city').value,
            zip: document.getElementById('shipping-zip').value,
            country: document.getElementById('shipping-country') ? document.getElementById('shipping-country').value : 'IN'
        };

        const paymentMethod = document.querySelector('input[name="payment-method"]:checked').value;

        const payload = {
            cart: cart,
            shipping: shippingData,
            payment_method: paymentMethod
        };

        placeOrderBtn.disabled = true;
        placeOrderBtn.textContent = 'Processing...';

        try {
            // Fetch CSRF Token
            const csrfRes = await fetch('/backend/api.php?action=csrf_token');
            const csrfData = await csrfRes.json();
            const token = csrfData.success ? csrfData.data.csrf_token : '';

            const response = await fetch('/backend/api.php?action=checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': token
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            
            if (response.ok && result.success) {
                // Empty the cart
                localStorage.removeItem('chettinad_cart');
                // Redirect to thank you
                window.location.href = `thank-you.html?orderId=${result.data.order_id}`;
            } else {
                if (result.error && result.error.code === 'ERR_UNAUTHORIZED') {
                    alert('You are not logged in. Please log in first.');
                    window.location.href = 'index.html';
                } else {
                    errorDisplay.textContent = result.error ? result.error.detail : 'An error occurred during checkout.';
                    errorDisplay.style.display = 'block';
                    placeOrderBtn.disabled = false;
                    placeOrderBtn.textContent = 'Place Order';
                }
            }
        } catch (error) {
            console.error('Checkout error:', error);
            errorDisplay.textContent = 'Network error. Please try again.';
            errorDisplay.style.display = 'block';
            placeOrderBtn.disabled = false;
            placeOrderBtn.textContent = 'Place Order';
        }
    });
});
