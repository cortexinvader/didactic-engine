// State
let config = {};
let products = [];
let cart = JSON.parse(localStorage.getItem('cart')) || [];

// DOM Elements
const app = document.getElementById('app');
const productView = document.getElementById('product-view');
const checkoutView = document.getElementById('checkout-view');
const productGrid = document.getElementById('product-grid');
const cartCount = document.getElementById('cart-count');
const cartItemsContainer = document.getElementById('cart-items-container');
const cartTotal = document.getElementById('cart-total');
const checkoutForm = document.getElementById('checkout-form');

// Initialize
async function init() {
    try {
        const [configRes, productsRes] = await Promise.all([
            fetch('config.json'),
            fetch('products.json')
        ]);
        config = await configRes.json();
        products = await productsRes.json();
        
        applyConfig();
        renderProducts();
        updateCartUI();
        loadUserInfo(); // Auto-fill form from localStorage
    } catch (e) {
        console.error("Error loading data:", e);
        alert("Failed to load store data.");
    }
}

// Apply Config to UI
function applyConfig() {
    document.title = config.business_name;
    document.getElementById('business-name').textContent = config.business_name;
    document.getElementById('logo-img').src = config.logo_url;
}

// Render Products
function renderProducts() {
    productGrid.innerHTML = products.map(p => {
        // Generate Info Tags HTML
        const tagsHtml = (p.info || []).map(tag => `<span class="tag">${tag}</span>`).join('');
        
        return `
        <div class="product-card">
            <img src="${p.image_url}" alt="${p.name}" class="product-img">
            <div class="card-details">
                <div class="card-header">
                    <span class="p-name">${p.name}</span>
                    <span class="p-price">${config.currency_symbol}${p.price.toFixed(2)}</span>
                </div>
                <div class="p-desc">${p.description}</div>
                <div class="info-tags">${tagsHtml}</div>
                <div class="card-actions">
                    <button class="explain-btn" onclick="triggerAI('explain', ${p.id})">
                        <i class="fas fa-question-circle"></i> Explain
                    </button>
                    <button class="add-btn" onclick="addToCart(${p.id})">
                        Add to Cart
                    </button>
                </div>
            </div>
        </div>
        `;
    }).join('');
}

// Cart Logic
function addToCart(id) {
    const existing = cart.find(item => item.id === id);
    if (existing) {
        existing.qty++;
    } else {
        const product = products.find(p => p.id === id);
        cart.push({ ...product, qty: 1 });
    }
    saveCart();
    updateCartUI();
    showToast("Added to cart!");
}

function updateCartQty(id, change) {
    const itemIndex = cart.findIndex(item => item.id === id);
    if (itemIndex > -1) {
        cart[itemIndex].qty += change;
        if (cart[itemIndex].qty <= 0) {
            cart.splice(itemIndex, 1);
        }
        saveCart();
        renderCartItems();
    }
}

function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartUI();
}

function updateCartUI() {
    const count = cart.reduce((sum, item) => sum + item.qty, 0);
    cartCount.textContent = count;
}

// Toggle Views (SPA feel)
function toggleCartView() {
    if (productView.classList.contains('active-view')) {
        productView.classList.remove('active-view');
        productView.classList.add('hidden-view');
        checkoutView.classList.remove('hidden-view');
        checkoutView.classList.add('active-view');
        renderCartItems();
    } else {
        checkoutView.classList.remove('active-view');
        checkoutView.classList.add('hidden-view');
        productView.classList.remove('hidden-view');
        productView.classList.add('active-view');
    }
}

function renderCartItems() {
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = "<p>Your cart is empty.</p>";
        cartTotal.textContent = "0.00";
        return;
    }

    let total = 0;
    cartItemsContainer.innerHTML = cart.map(item => {
        const itemTotal = item.price * item.qty;
        total += itemTotal;
        return `
        <div class="cart-item">
            <div>
                <strong>${item.name}</strong><br>
                <small>${config.currency_symbol}${item.price} each</small>
            </div>
            <div class="cart-controls">
                <button onclick="updateCartQty(${item.id}, -1)">-</button>
                <span style="margin:0 10px">${item.qty}</span>
                <button onclick="updateCartQty(${item.id}, 1)">+</button>
            </div>
            <div>${config.currency_symbol}${itemTotal.toFixed(2)}</div>
        </div>
        `;
    }).join('');
    
    cartTotal.textContent = config.currency_symbol + total.toFixed(2);
}

// User Data Management (Privacy First)
function loadUserInfo() {
    const saved = JSON.parse(localStorage.getItem('user_info'));
    if (saved) {
        document.getElementById('c-name').value = saved.name || '';
        document.getElementById('c-phone').value = saved.phone || '';
        document.getElementById('c-email').value = saved.email || '';
        document.getElementById('c-social').value = saved.social || '';
    }
    // Message field is intentionally NOT loaded
}

function saveUserInfo() {
    const userInfo = {
        name: document.getElementById('c-name').value,
        phone: document.getElementById('c-phone').value,
        email: document.getElementById('c-email').value,
        social: document.getElementById('c-social').value
    };
    localStorage.setItem('user_info', JSON.stringify(userInfo));
}

function resetUserInfo() {
    localStorage.removeItem('user_info');
    document.getElementById('checkout-form').reset();
    showToast("Saved info cleared.");
}

// Checkout & Telegram
checkoutForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (cart.length === 0) {
        alert("Your cart is empty!");
        return;
    }

    // 1. Save Contact Info for next time
    saveUserInfo();

    // 2. Prepare Data
    const formData = {
        name: document.getElementById('c-name').value,
        phone: document.getElementById('c-phone').value,
        email: document.getElementById('c-email').value,
        social: document.getElementById('c-social').value,
        message: document.getElementById('c-message').value
    };

    // 3. Construct Message
    let itemsList = cart.map(i => `- ${i.name} x${i.qty} (${config.currency_symbol}${(i.price*i.qty).toFixed(2)})`).join('\n');
    let totalVal = document.getElementById('cart-total').textContent;

    const telegramMsg = `
╭──⦿【 ⚡ NEW ORDER ALERT 】
│ 🏪 Business : ${config.business_name}
│
│ 👤 Customer : ${formData.name}
│ 📞 Phone    : ${formData.phone}
│ 📧 Email    : ${formData.email || 'N/A'}
│ 💬 Social   : ${formData.social || 'N/A'}
│
│ 📝 Message :
│ ${formData.message || 'No message'}
│
│ 🛒 Items :
│ ${itemsList}
│
│ 💰 Total : ${totalVal}
╰────────⦿
`;

    // 4. Send to Telegram
    const btn = document.querySelector('.checkout-btn');
    const originalText = btn.textContent;
    btn.textContent = "Sending...";
    btn.disabled = true;

    try {
        const url = `https://api.telegram.org/bot${config.telegram_bot_token}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: config.telegram_chat_id,
                text: telegramMsg,
                parse_mode: 'Markdown'
            })
        });

        if (response.ok) {
            showToast("Order placed successfully!");
            cart = []; // Clear cart object
            saveCart(); // Clear cart storage
            document.getElementById('c-message').value = ''; // Clear message field
            toggleCartView(); // Go back to products
            updateCartUI(); // Reset UI counters
        } else {
            throw new Error("Telegram API Error");
        }
    } catch (err) {
        alert("Error sending order. Please contact us directly.");
        console.error(err);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
});

// AI & Modal Logic
function triggerAI(type, productId = null) {
    const modal = document.getElementById('ai-modal');
    const modalText = document.getElementById('modal-text');
    const escMsg = document.getElementById('escalation-msg');
    const btnGroup = document.getElementById('contact-buttons');
    
    let text = "";
    
    // Logic to choose text
    if (type === 'explain' && productId) {
        const p = products.find(i => i.id === productId);
        text = p.custom_explanation || config.ai_responses.explain_product_default;
    } else if (type === 'help_me_choose') {
        const opts = config.ai_responses.help_me_choose;
        text = opts[Math.floor(Math.random() * opts.length)];
} else if (type === 'compare_cart') {
        if (cart.length === 0) {
            showToast("Cart is already empty!");
            closeModal(); // Close the modal since there's nothing to compare/clear
            return;
        }

        if (confirm("Are you sure you want to clear the entire cart?")) {
            cart = [];
            saveCart();
            renderCartItems();
            showToast("Cart cleared!");
        }
        closeModal(); 
        return; 
    }

    modalText.textContent = text;
    escMsg.textContent = config.escalation_message;

    // Build Escalation Buttons
    btnGroup.innerHTML = '';
    config.supported_contact_types.forEach(type => {
        let href = "#";
        let label = type;
        const c = config.contact;

        if(type === 'phone') { href = `tel:${c.phone}`; label = "Call"; }
        if(type === 'email') { href = `mailto:${c.email}`; label = "Email"; }
        if(type === 'whatsapp') { href = `https://wa.me/${c.whatsapp}`; label = "WhatsApp"; }
        if(type === 'telegram') { href = `https://t.me/${c.telegram}`; label = "Telegram"; }

        if(href !== "#") {
            const a = document.createElement('a');
            a.className = 'contact-btn';
            a.href = href;
            a.target = '_blank';
            a.innerHTML = `<i class="fas fa-${getIcon(type)}"></i> ${label}`;
            btnGroup.appendChild(a);
        }
    });

    modal.classList.remove('hidden');
}

function getIcon(type) {
    if(type === 'phone') return 'phone';
    if(type === 'email') return 'envelope';
    if(type === 'whatsapp') return 'brands fa-whatsapp';
    if(type === 'telegram') return 'brands fa-telegram';
    return 'link';
}

function closeModal() {
    document.getElementById('ai-modal').classList.add('hidden');
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    setTimeout(() => t.classList.add('hidden'), 3000);
}

// Window click to close modal
window.onclick = function(event) {
    const modal = document.getElementById('ai-modal');
    if (event.target == modal) {
        closeModal();
    }
}

// Start
init();
