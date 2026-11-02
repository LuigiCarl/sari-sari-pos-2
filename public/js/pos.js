(function () {
  const cart = new Map(); // productId -> { id, name, price, qty, stock, unit }
  let selectedCategory = 'all';

  const cartBody = document.getElementById('cartBody');
  const cartTotalEl = document.getElementById('cartTotal');
  const changeEl = document.getElementById('changeAmount');
  const amountPaidInput = document.getElementById('amountPaid');
  const itemsInput = document.getElementById('itemsInput');
  const checkoutBtn = document.getElementById('checkoutBtn');
  const checkoutForm = document.getElementById('checkoutForm');
  const productGrid = document.getElementById('productGrid');
  const searchInput = document.getElementById('productSearch');
  const categoryPills = document.getElementById('categoryPills');
  const quickCashButtons = document.getElementById('quickCashButtons');

  function peso(n) {
    return '₱' + Number(n).toFixed(2);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function getCartTotal() {
    let total = 0;
    cart.forEach((item) => {
      total += item.price * item.qty;
    });
    return total;
  }

  function addToCart(tile) {
    const id = tile.dataset.id;
    const stock = Number(tile.dataset.stock);
    const existing = cart.get(id);
    if (existing) {
      if (existing.qty < stock) existing.qty += 1;
    } else {
      cart.set(id, {
        id,
        name: tile.dataset.name,
        price: Number(tile.dataset.price),
        unit: tile.dataset.unit,
        stock,
        qty: 1,
      });
    }
    render();
  }

  function changeQty(id, delta) {
    const item = cart.get(id);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
      cart.delete(id);
    } else if (item.qty > item.stock) {
      item.qty = item.stock;
    }
    render();
  }

  function removeItem(id) {
    cart.delete(id);
    render();
  }

  function render() {
    cartBody.innerHTML = '';
    const total = getCartTotal();

    cart.forEach((item) => {
      const subtotal = item.price * item.qty;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(item.name)}</td>
        <td>${peso(item.price)}</td>
        <td class="qty-controls">
          <button type="button" data-action="dec" data-id="${item.id}" class="btn btn-small">−</button>
          <span>${item.qty}</span>
          <button type="button" data-action="inc" data-id="${item.id}" class="btn btn-small">+</button>
        </td>
        <td>${peso(subtotal)}</td>
        <td><button type="button" data-action="remove" data-id="${item.id}" class="btn btn-small btn-danger">✕</button></td>
      `;
      cartBody.appendChild(tr);
    });

    cartTotalEl.textContent = peso(total);
    updateChange(total);
  }

  function updateChange(total) {
    const paid = Number(amountPaidInput.value) || 0;
    const change = paid - total;
    changeEl.textContent = peso(change >= 0 ? change : 0);
    changeEl.classList.toggle('text-danger', paid > 0 && change < 0);

    const isValid = cart.size > 0 && paid >= total && total > 0;
    checkoutBtn.disabled = !isValid;
  }

  // Filter products by category and search term
  function filterProducts() {
    const q = (searchInput ? searchInput.value : '').toLowerCase().trim();
    const tiles = productGrid.querySelectorAll('.product-tile');
    let firstVisible = null;

    tiles.forEach((tile) => {
      const name = (tile.dataset.name || '').toLowerCase();
      const barcode = (tile.dataset.barcode || '').toLowerCase();
      const catId = tile.dataset.category || '';

      const matchCat = selectedCategory === 'all' || catId === selectedCategory;
      const matchSearch = !q || name.includes(q) || barcode.includes(q);
      const isVisible = matchCat && matchSearch;

      tile.style.display = isVisible ? '' : 'none';
      if (isVisible && !firstVisible) {
        firstVisible = tile;
      }
    });

    return firstVisible;
  }

  // Category Pills Click
  if (categoryPills) {
    categoryPills.addEventListener('click', (e) => {
      const btn = e.target.closest('.category-pill');
      if (!btn) return;
      categoryPills.querySelectorAll('.category-pill').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      selectedCategory = btn.dataset.category;
      filterProducts();
    });
  }

  // Quick Cash Buttons Click
  if (quickCashButtons) {
    quickCashButtons.addEventListener('click', (e) => {
      const btn = e.target.closest('.quick-cash-btn');
      if (!btn) return;
      const total = getCartTotal();
      if (btn.dataset.action === 'exact') {
        amountPaidInput.value = total > 0 ? total.toFixed(2) : '';
      } else if (btn.dataset.cash) {
        amountPaidInput.value = Number(btn.dataset.cash).toFixed(2);
      }
      updateChange(total);
      amountPaidInput.focus();
    });
  }

  // Cart Interactions
  cartBody.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'inc') changeQty(id, 1);
    if (action === 'dec') changeQty(id, -1);
    if (action === 'remove') removeItem(id);
  });

  // Product Grid Tile Click
  productGrid.addEventListener('click', (e) => {
    const tile = e.target.closest('.product-tile');
    if (tile) addToCart(tile);
  });

  // Amount Paid Input Change
  amountPaidInput.addEventListener('input', () => {
    const total = getCartTotal();
    updateChange(total);
  });

  // Checkout Form Submission
  checkoutForm.addEventListener('submit', (e) => {
    if (cart.size === 0) {
      e.preventDefault();
      return;
    }
    const items = Array.from(cart.values()).map((i) => ({ productId: Number(i.id), quantity: i.qty }));
    itemsInput.value = JSON.stringify(items);
  });

  // Instant Search Input
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      filterProducts();
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const firstVisible = filterProducts();
        if (firstVisible) {
          addToCart(firstVisible);
          // If search was a barcode or exact match, clear it after adding
          if (/^\d+$/.test(searchInput.value.trim())) {
            searchInput.value = '';
            filterProducts();
          }
        }
      }
    });
  }

  // Global Keyboard Shortcuts (F2: search, F4: pay, Esc: clear search)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F2') {
      e.preventDefault();
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    } else if (e.key === 'F4') {
      e.preventDefault();
      if (amountPaidInput) {
        amountPaidInput.focus();
        amountPaidInput.select();
      }
    } else if (e.key === 'Escape') {
      if (document.activeElement === searchInput) {
        searchInput.value = '';
        filterProducts();
      }
    }
  });

  render();
})();
