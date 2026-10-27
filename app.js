/**
 * ЧИО ЧИО — Экспресс-парикмахерская
 * Клиентский терминал:
 * 1. Телефон -> 2. Выбор мастера -> 3. Переход на стрижки -> 4. Расчет и оплата (50% мастеру)
 * Поддерживает работу с Node.js бэкендом и автономный режим для GitHub Pages
 */

const isGitHubPages = window.location.hostname.includes('github.io') || window.location.protocol === 'file:';

// State
const state = {
  activeTab: 'terminal',
  wizardStep: 1,
  services: [],
  masters: [],
  selectedService: null,
  selectedMaster: null,
  selectedPayMethod: 'sbp_qr',
  currentClient: null,
  adminKey: localStorage.getItem('chio_admin_key') || null,
  adminUser: localStorage.getItem('chio_admin_user') || null,
  selectedMasterCabinetId: null,
};

// Web Audio API Sound Chimes (Zero external dependencies)
function playSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'click') {
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === 'success') {
      const now = ctx.currentTime;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.1);
      osc.frequency.setValueAtTime(783.99, now + 0.2);
      osc.frequency.setValueAtTime(1046.50, now + 0.3);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.start(now);
      osc.stop(now + 0.6);
    } else if (type === 'celebration') {
      const now = ctx.currentTime;
      [440, 554.37, 659.25, 880].forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.frequency.setValueAtTime(freq, now + i * 0.1);
        g.gain.setValueAtTime(0.15, now + i * 0.1);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.4);
        o.start(now + i * 0.1);
        o.stop(now + i * 0.1 + 0.4);
      });
    }
  } catch (e) {
    // Audio context may be restricted
  }
}

// Toast notification helper
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  const colors = {
    info: 'bg-[#181822] border-[#2e2e42] text-white',
    success: 'bg-[#0f2e1b] border-emerald-500/50 text-emerald-300',
    error: 'bg-[#3b0d11] border-red-500 text-red-200'
  };

  toast.className = `p-3.5 rounded-2xl border text-xs sm:text-sm font-semibold shadow-2xl flex items-center gap-2 transform transition-all duration-300 translate-y-4 opacity-0 pointer-events-auto ${colors[type] || colors.info}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✅' : type === 'error' ? '⚠️' : 'ℹ️'}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-4', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/* ==========================================================================
   OFFLINE & GITHUB PAGES PERSISTENT MOCK STORAGE
   ========================================================================== */

const MockDB = {
  get(key, defaultVal) {
    const raw = localStorage.getItem('chio_mock_' + key);
    if (!raw) {
      this.set(key, defaultVal);
      return defaultVal;
    }
    try { return JSON.parse(raw); } catch (e) { return defaultVal; }
  },
  set(key, val) {
    localStorage.setItem('chio_mock_' + key, JSON.stringify(val));
  },
  init() {
    if (!localStorage.getItem('chio_mock_initialized')) {
      this.set('masters', [
        { id: 1, name: 'Артем Волков', specialization: 'Топ-Барбер • Скоростной фейд', phone: '+7 (999) 111-22-33', avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80', active: 1, total_earnings: 12500, current_balance: 3500, cuts_count: 42 },
        { id: 2, name: 'Даниил Ким', specialization: 'Мастер экспресс-стрижек', phone: '+7 (999) 222-33-44', avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80', active: 1, total_earnings: 9800, current_balance: 2400, cuts_count: 36 },
        { id: 3, name: 'Елена Соколова', specialization: 'Стилист-универсал • Модельные стрижки', phone: '+7 (999) 333-44-55', avatar_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80', active: 1, total_earnings: 14200, current_balance: 4100, cuts_count: 48 },
        { id: 4, name: 'Тимур Алиев', specialization: 'Барбер • Бороды и геометрия', phone: '+7 (999) 444-55-66', avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80', active: 1, total_earnings: 8600, current_balance: 1900, cuts_count: 29 },
      ]);
      this.set('services', [
        { id: 1, name: 'Мужская экспресс-стрижка', price: 500, duration_min: 15, description: 'Классическая или модельная стрижка за 15 минут по японской технологии', active: 1 },
        { id: 2, name: 'Стрижка машинкой (1-2 насадки)', price: 350, duration_min: 10, description: 'Быстрая однородная стрижка под насадку с чистой окантовкой', active: 1 },
        { id: 3, name: 'Оформление бороды и усов', price: 400, duration_min: 15, description: 'Четкие контуры, снятие длины, шейвер и масло для ухода', active: 1 },
        { id: 4, name: 'Комплекс: Стрижка + Борода', price: 800, duration_min: 25, description: 'Фирменная стрижка волос и детальное оформление бороды', active: 1 },
        { id: 5, name: 'Детская стрижка (до 12 лет)', price: 450, duration_min: 15, description: 'Быстрая и аккуратная стрижка в специальном кресле', active: 1 },
        { id: 6, name: 'Премиум комплекс с мытьем и укладкой', price: 1000, duration_min: 30, description: 'Мытье головы, стрижка, распаривание, окантовка и стайлинг', active: 1 },
      ]);
      this.set('clients', [
        { id: 1, phone: '+7 (900) 123-45-67', name: 'Максим Иванов', visits_count: 2, free_haircuts_received: 0, last_visit_at: new Date(Date.now() - 86400000 * 2).toISOString() },
        { id: 2, phone: '+7 (911) 777-88-99', name: 'Александр', visits_count: 0, free_haircuts_received: 0, last_visit_at: null },
        { id: 3, phone: '+7 (922) 555-44-33', name: 'Дмитрий', visits_count: 3, free_haircuts_received: 1, last_visit_at: new Date(Date.now() - 86400000 * 4).toISOString() },
      ]);
      this.set('orders', []);
      this.set('payouts', []);
      localStorage.setItem('chio_mock_initialized', 'true');
    }
  }
};

MockDB.init();

// Universal API fetcher: attempts real API, falls back gracefully to MockDB on GitHub Pages
async function api(path, options = {}) {
  if (!isGitHubPages) {
    try {
      const res = await fetch(path, options);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      // Fallback to local mock if server isn't reachable
    }
  }

  // MOCK ROUTER (For GitHub Pages static hosting)
  const method = (options.method || 'GET').toUpperCase();
  const body = options.body ? JSON.parse(options.body) : {};

  // 1. Services
  if (path === '/api/services' && method === 'GET') {
    return MockDB.get('services', []).filter(s => s.active);
  }

  // 2. Masters
  if (path === '/api/masters' && method === 'GET') {
    return MockDB.get('masters', []).filter(m => m.active);
  }

  // 3. Client Lookup
  if (path === '/api/client/lookup' && method === 'POST') {
    let clients = MockDB.get('clients', []);
    let client = clients.find(c => c.phone === body.phone);
    if (!client) {
      client = {
        id: clients.length + 1,
        phone: body.phone,
        name: body.name || '',
        visits_count: 0,
        free_haircuts_received: 0,
        created_at: new Date().toISOString(),
        last_visit_at: null
      };
      clients.push(client);
      MockDB.set('clients', clients);
    } else if (body.name && !client.name) {
      client.name = body.name;
      MockDB.set('clients', clients);
    }

    const cycleStep = (client.visits_count % 3) + 1;
    const isNextFree = (cycleStep === 3);

    const orders = MockDB.get('orders', []).filter(o => o.client_phone === body.phone);

    return {
      client: {
        ...client,
        cycleStep,
        isNextFree,
        remainingToFree: isNextFree ? 0 : (3 - cycleStep)
      },
      history: orders
    };
  }

  // 4. Checkout
  if (path === '/api/checkout' && method === 'POST') {
    let clients = MockDB.get('clients', []);
    let client = clients.find(c => c.phone === body.phone);
    if (!client) {
      client = { id: clients.length + 1, phone: body.phone, name: body.name || '', visits_count: 0, free_haircuts_received: 0 };
      clients.push(client);
    }

    const masters = MockDB.get('masters', []);
    const master = masters.find(m => m.id === Number(body.masterId)) || masters[0];

    const services = MockDB.get('services', []);
    const service = services.find(s => s.id === Number(body.serviceId)) || services[0];

    const isFree = (client.visits_count % 3 === 2);
    const origPrice = service.price;
    const finalPrice = isFree ? 0 : origPrice;
    const discountAmount = isFree ? origPrice : 0;
    const masterShare = origPrice * 0.50; // Salon compensates 50% on free cuts
    const salonShare = isFree ? -(origPrice * 0.50) : (finalPrice * 0.50);

    // Update client
    client.visits_count += 1;
    if (isFree) client.free_haircuts_received += 1;
    client.last_visit_at = new Date().toISOString();
    MockDB.set('clients', clients);

    // Update master
    master.total_earnings += masterShare;
    master.current_balance += masterShare;
    master.cuts_count += 1;
    MockDB.set('masters', masters);

    // Record order
    const orders = MockDB.get('orders', []);
    const orderId = orders.length + 1;
    const newOrder = {
      id: orderId,
      client_id: client.id,
      client_phone: client.phone,
      client_name: client.name || 'Клиент',
      master_id: master.id,
      master_name: master.name,
      service_id: service.id,
      service_name: service.name,
      original_price: origPrice,
      discount_amount: discountAmount,
      final_price: finalPrice,
      master_share: masterShare,
      salon_share: salonShare,
      is_free: isFree ? 1 : 0,
      payment_method: body.paymentMethod || 'sbp_qr',
      created_at: new Date().toISOString()
    };
    orders.unshift(newOrder);
    MockDB.set('orders', orders);

    return {
      success: true,
      orderId,
      receipt: {
        orderId,
        date: new Date().toISOString(),
        clientPhone: client.phone,
        clientName: client.name || 'Клиент',
        serviceName: service.name,
        originalPrice: origPrice,
        discountAmount: discountAmount,
        finalPrice: finalPrice,
        isFree: isFree,
        paymentMethod: body.paymentMethod || 'sbp_qr',
        masterName: master.name,
        masterShare: masterShare,
        salonShare: salonShare,
        visitsCount: client.visits_count,
        nextCycleStep: (client.visits_count % 3) + 1,
        celebrationMessage: isFree
          ? '🎉 Ваша 3-я стрижка в ЧИО ЧИО совершенно БЕСПЛАТНАЯ! Спасибо за вашу верность!'
          : `✂️ Спасибо за визит! Это ваша стрижка #${client.visits_count}. До следующей бесплатной осталось: ${3 - ((client.visits_count % 3) || 3)}.`
      },
      masterInfo: {
        name: master.name,
        earnedFromThisCut: masterShare,
        newBalance: master.current_balance
      }
    };
  }

  // 5. Master Cabinet
  if (path.startsWith('/api/master/cabinet')) {
    const url = new URL('http://dummy.com' + path);
    const id = Number(url.searchParams.get('id'));
    const masters = MockDB.get('masters', []);
    const master = masters.find(m => m.id === id) || masters[0];
    const orders = MockDB.get('orders', []).filter(o => o.master_id === master.id);
    return {
      master: {
        ...master,
        today_earnings: orders.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString()).reduce((a, c) => a + c.master_share, 0),
        today_cuts: orders.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString()).length
      },
      orders: orders.slice(0, 20)
    };
  }

  // 6. Admin Login
  if (path === '/api/admin/login' && method === 'POST') {
    if (body.username === 'admin' && body.secret_key === 'chio2026') {
      return { success: true, admin: { id: 1, username: 'admin', name: 'Главный администратор' } };
    }
    throw new Error('Неверный логин или секретный ключ (admin / chio2026)');
  }

  // 7. Admin Dashboard
  if (path === '/api/admin/dashboard') {
    const orders = MockDB.get('orders', []);
    const masters = MockDB.get('masters', []);
    const clients = MockDB.get('clients', []);
    return {
      summary: {
        totalRevenue: orders.reduce((s, o) => s + o.final_price, 0),
        totalMasterShare: orders.reduce((s, o) => s + o.master_share, 0),
        totalSalonShare: orders.reduce((s, o) => s + o.salon_share, 0),
        totalOrders: orders.length,
        freeOrders: orders.filter(o => o.is_free).length,
        todayRevenue: 0,
        todayCuts: 0,
        totalClients: clients.length,
        mastersCount: masters.length
      }
    };
  }

  // 8. Admin Masters
  if (path === '/api/admin/masters') {
    if (method === 'GET') return MockDB.get('masters', []);
    if (method === 'POST') {
      const masters = MockDB.get('masters', []);
      const newM = {
        id: masters.length + 1,
        name: body.name,
        specialization: body.specialization || 'Барбер-стилист',
        phone: body.phone,
        avatar_url: body.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
        active: 1,
        total_earnings: 0,
        current_balance: 0,
        cuts_count: 0
      };
      masters.push(newM);
      MockDB.set('masters', masters);
      return newM;
    }
  }

  // 9. Admin Payout
  if (path.includes('/payout') && method === 'POST') {
    const parts = path.split('/');
    const masterId = Number(parts[parts.length - 2]);
    const masters = MockDB.get('masters', []);
    const m = masters.find(item => item.id === masterId);
    if (m) {
      const amt = Number(body.amount) || m.current_balance;
      m.current_balance = Math.max(0, m.current_balance - amt);
      MockDB.set('masters', masters);
    }
    return { success: true, message: 'Выплата 50% успешно проведена' };
  }

  // 10. Admin Services
  if (path === '/api/admin/services') {
    if (method === 'GET') return MockDB.get('services', []);
    if (method === 'POST') {
      const services = MockDB.get('services', []);
      const newS = {
        id: services.length + 1,
        name: body.name,
        price: Number(body.price),
        duration_min: Number(body.duration_min) || 15,
        description: body.description || '',
        active: 1
      };
      services.push(newS);
      MockDB.set('services', services);
      return newS;
    }
  }

  // 11. Admin Orders
  if (path === '/api/admin/orders') {
    return MockDB.get('orders', []);
  }

  // 12. Admin Clients
  if (path === '/api/admin/clients') {
    return MockDB.get('clients', []);
  }

  return {};
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons();
  loadServices();
  loadMasters();

  if (state.adminKey) {
    checkAdminAuth();
  }
});

// Format phone number dynamically
function formatPhone(input) {
  let numbers = input.replace(/\D/g, '');
  if (numbers.startsWith('7') || numbers.startsWith('8')) {
    numbers = numbers.substring(1);
  }
  let res = '+7';
  if (numbers.length > 0) res += ' (' + numbers.substring(0, 3);
  if (numbers.length >= 4) res += ') ' + numbers.substring(3, 6);
  if (numbers.length >= 7) res += '-' + numbers.substring(6, 8);
  if (numbers.length >= 9) res += '-' + numbers.substring(8, 10);
  return res;
}

let phoneDebounceTimer = null;
function handlePhoneInput(val) {
  const formatted = formatPhone(val);
  const input = document.getElementById('client-phone-input');
  if (input.value !== formatted) {
    input.value = formatted;
  }

  clearTimeout(phoneDebounceTimer);
  const digits = val.replace(/\D/g, '');
  if (digits.length >= 10) {
    phoneDebounceTimer = setTimeout(() => {
      autoLookupClient(formatted);
    }, 400);
  } else {
    document.getElementById('live-loyalty-preview').classList.add('hidden');
  }
}

// Quick pre-fill for demo buttons
function fillDemoPhone(phone, name) {
  playSound('click');
  const pInput = document.getElementById('client-phone-input');
  const nInput = document.getElementById('client-name-input');
  pInput.value = phone;
  nInput.value = name || '';
  autoLookupClient(phone, name);
}

// Switch main navigation tabs
function switchTab(tabId) {
  playSound('click');
  state.activeTab = tabId;

  ['terminal', 'loyalty', 'master', 'admin'].forEach(t => {
    const btn = document.getElementById(`nav-btn-${t}`);
    const sec = document.getElementById(`tab-${t}`);
    if (t === tabId) {
      btn.className = 'nav-btn px-3 sm:px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 bg-[#e61e2b] text-white shadow';
      sec.classList.remove('hidden');
    } else {
      btn.className = 'nav-btn px-3 sm:px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 text-gray-400 hover:text-white';
      sec.classList.add('hidden');
    }
  });

  if (tabId === 'master') {
    populateMasterCabinetSelect();
  }
  if (tabId === 'admin' && state.adminKey) {
    refreshAdminData();
  }

  if (window.lucide) lucide.createIcons();
}

/* ==========================================================================
   DATA FETCHING
   ========================================================================== */

async function loadServices() {
  try {
    state.services = await api('/api/services');
    renderServices();
    renderAdminServicesTable();
  } catch (err) {
    console.error('Failed to load services:', err);
  }
}

async function loadMasters() {
  try {
    state.masters = await api('/api/masters');
    renderMasters();
    populateMasterCabinetSelect();
  } catch (err) {
    console.error('Failed to load masters:', err);
  }
}

/* ==========================================================================
   WIZARD FLOW & CLIENT IDENTIFICATION
   ========================================================================== */

async function autoLookupClient(phone, prefilledName) {
  const spinner = document.getElementById('phone-lookup-spinner');
  spinner.classList.remove('hidden');

  try {
    const data = await api('/api/client/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, name: prefilledName || document.getElementById('client-name-input').value })
    });

    spinner.classList.add('hidden');

    if (data && data.client) {
      state.currentClient = data.client;
      renderLiveLoyaltyPreview(data.client);
    }
  } catch (e) {
    spinner.classList.add('hidden');
    console.error(e);
  }
}

function renderLiveLoyaltyPreview(client) {
  const previewBox = document.getElementById('live-loyalty-preview');
  previewBox.classList.remove('hidden');

  const badge = document.getElementById('preview-client-badge');
  const banner = document.getElementById('preview-banner-msg');

  const slot1 = document.getElementById('preview-slot-1');
  const slot2 = document.getElementById('preview-slot-2');
  const slot3 = document.getElementById('preview-slot-3');

  [slot1, slot2, slot3].forEach(s => {
    s.classList.remove('completed', 'active', 'gift-active');
  });

  const cycleVisits = client.visits_count % 3;

  if (cycleVisits === 0) {
    slot1.classList.add('active');
    badge.innerText = `Новый цикл • Визит #1`;
    banner.className = 'mt-3 text-center p-3 rounded-xl text-xs font-bold bg-[#1a1a24] text-gray-300 border border-[#2b2b3a]';
    banner.innerHTML = `✂️ Это ваша 1-я стрижка в цикле. Каждая 3-я стрижка для вас — БЕСПЛАТНАЯ!`;
  } else if (cycleVisits === 1) {
    slot1.classList.add('completed');
    slot1.querySelector('.slot-status').innerText = 'Пройдено ✓';
    slot2.classList.add('active');
    badge.innerText = `Пройдено 1/3`;
    banner.className = 'mt-3 text-center p-3 rounded-xl text-xs font-bold bg-[#1a1a24] text-gray-300 border border-[#2b2b3a]';
    banner.innerHTML = `✂️ 1-я стрижка пройдена. Еще одна стрижка — и 3-я будет совершенно БЕСПЛАТНОЙ!`;
  } else if (cycleVisits === 2) {
    slot1.classList.add('completed');
    slot1.querySelector('.slot-status').innerText = 'Пройдено ✓';
    slot2.classList.add('completed');
    slot2.querySelector('.slot-status').innerText = 'Пройдено ✓';
    slot3.classList.add('gift-active');
    badge.innerText = `🎉 3-Я СТРИЖКА БЕСПЛАТНО!`;
    badge.className = 'badge-red text-xs px-2.5 py-0.5 rounded-full font-bold bg-red-600 text-white';
    banner.className = 'mt-3 text-center p-3 rounded-xl text-xs font-bold bg-[#261014] text-red-200 border border-red-500/50 shadow-lg';
    banner.innerHTML = `🎁 ПОЗДРАВЛЯЕМ! Это ваша 3-я стрижка — она для вас БЕСПЛАТНАЯ (0 ₽)!`;
  }
}

async function checkClientAndProceed() {
  playSound('click');
  const phone = document.getElementById('client-phone-input').value.trim();
  const name = document.getElementById('client-name-input').value.trim();

  if (!phone || phone.length < 11) {
    showToast('Пожалуйста, введите корректный номер телефона', 'error');
    return;
  }

  try {
    const data = await api('/api/client/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, name })
    });

    state.currentClient = data.client;
    // Step 2 is choosing master FIRST!
    goToStep(2);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function goToStep(step) {
  state.wizardStep = step;

  // Toggle step indicators (1, 2, 3, 4)
  [1, 2, 3, 4].forEach(s => {
    const wrap = document.getElementById(`wizard-step-${s}`);
    const ind = document.getElementById(`step-indicator-${s}`);
    if (!wrap || !ind) return;

    if (s === step) {
      wrap.classList.remove('hidden');
      ind.className = 'flex items-center gap-2 p-2 sm:p-2.5 rounded-xl bg-[#e61e2b]/15 border border-[#e61e2b] text-white';
      ind.querySelector('span:first-child').className = 'w-6 h-6 rounded-full bg-[#e61e2b] text-white font-bold text-xs flex items-center justify-center flex-shrink-0';
      ind.querySelector('span:first-child').innerText = String(s);
    } else if (s < step) {
      wrap.classList.add('hidden');
      ind.className = 'flex items-center gap-2 p-2 sm:p-2.5 rounded-xl bg-[#121218] border border-[#2b2b3a] text-emerald-400';
      ind.querySelector('span:first-child').className = 'w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0';
      ind.querySelector('span:first-child').innerText = '✓';
    } else {
      wrap.classList.add('hidden');
      ind.className = 'flex items-center gap-2 p-2 sm:p-2.5 rounded-xl bg-[#14141b] border border-[#242430] text-gray-400';
      ind.querySelector('span:first-child').className = 'w-6 h-6 rounded-full bg-[#20202a] text-gray-300 font-bold text-xs flex items-center justify-center flex-shrink-0';
      ind.querySelector('span:first-child').innerText = String(s);
    }
  });

  // Step 2: Choose Master First
  if (step === 2 && state.currentClient) {
    document.getElementById('wizard-client-phone-display').innerText = state.currentClient.phone + (state.currentClient.name ? ` (${state.currentClient.name})` : '');
    const isFree = (state.currentClient.visits_count % 3 === 2);
    document.getElementById('wizard-client-status-display').innerHTML = isFree
      ? `<span class="text-red-400 font-bold">🎉 Ваша текущая 3-я стрижка — БЕСПЛАТНО! (100% скидка)</span>`
      : `<span>Посещений: ${state.currentClient.visits_count}. До бесплатной осталось: ${3 - (state.currentClient.visits_count % 3)}</span>`;
    renderMasters();
  }

  // Step 3: Choose Haircut / Service (Transitioned from master)
  if (step === 3) {
    if (state.selectedMaster) {
      document.getElementById('step3-selected-master-avatar').src = state.selectedMaster.avatar_url;
      document.getElementById('step3-selected-master-name').innerText = state.selectedMaster.name;
      document.getElementById('step3-selected-master-spec').innerText = state.selectedMaster.specialization;
    }
    renderServices();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (window.lucide) lucide.createIcons();
}

/* ==========================================================================
   RENDER MASTERS (STEP 2: FIRST SELECTION)
   ========================================================================== */

function renderMasters() {
  const container = document.getElementById('masters-grid');
  if (!container) return;

  container.innerHTML = state.masters.map(m => {
    const isSelected = state.selectedMaster && state.selectedMaster.id === m.id;
    return `
      <div
        onclick="selectMasterAndProceed(${m.id})"
        class="select-card p-5 rounded-2xl relative text-center group ${isSelected ? 'selected' : ''}"
      >
        <div class="w-20 h-20 mx-auto rounded-2xl overflow-hidden border-2 ${isSelected ? 'border-red-500 red-glow-sm' : 'border-[#2c2c3c]'} mb-3 transition group-hover:scale-105">
          <img src="${m.avatar_url}" alt="${m.name}" class="w-full h-full object-cover">
        </div>
        <h4 class="font-black text-white text-base truncate">${m.name}</h4>
        <span class="text-xs text-red-400 font-semibold block truncate mt-0.5">${m.specialization}</span>
        
        <div class="mt-3 pt-2.5 border-t border-[#232332] flex items-center justify-center gap-1.5 text-xs text-emerald-400 font-semibold">
          <i data-lucide="badge-percent" class="w-4 h-4"></i>
          <span>Получит 50% чека</span>
        </div>

        <div class="mt-2 text-[11px] text-gray-500 font-medium group-hover:text-red-400 transition">
          ${isSelected ? '✓ Выбран' : 'Нажмите, чтобы выбрать ➔'}
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// User requested: "сначала я выбирал мастера и после меня перекидовало на варианты стрижек"
function selectMasterAndProceed(id) {
  playSound('click');
  state.selectedMaster = state.masters.find(m => m.id === id);
  renderMasters();

  // Instant visual feedback with smooth auto-transition to Step 3 (Services)
  setTimeout(() => {
    goToStep(3);
  }, 200);
}

function confirmMasterAndProceedToServices() {
  if (!state.selectedMaster) {
    showToast('Пожалуйста, выберите мастера, который вас подстригал', 'error');
    return;
  }
  playSound('click');
  goToStep(3);
}

/* ==========================================================================
   RENDER SERVICES (STEP 3: HAIRCUT OPTIONS)
   ========================================================================== */

function renderServices() {
  const container = document.getElementById('services-grid');
  if (!container) return;

  const isFree = state.currentClient && (state.currentClient.visits_count % 3 === 2);

  container.innerHTML = state.services.map(svc => {
    const isSelected = state.selectedService && state.selectedService.id === svc.id;
    return `
      <div
        onclick="selectService(${svc.id})"
        class="select-card p-4 rounded-2xl relative ${isSelected ? 'selected' : ''}"
      >
        <div class="flex items-start justify-between gap-2 mb-2">
          <div class="w-9 h-9 rounded-xl bg-[#242432] text-red-500 flex items-center justify-center">
            <i data-lucide="scissors" class="w-4 h-4"></i>
          </div>
          <span class="text-[11px] font-bold text-gray-400 bg-[#1e1e28] px-2 py-0.5 rounded-lg flex items-center gap-1">
            <i data-lucide="clock" class="w-3 h-3"></i>
            <span>${svc.duration_min} мин</span>
          </span>
        </div>

        <h4 class="font-extrabold text-white text-sm mb-1">${svc.name}</h4>
        <p class="text-xs text-gray-400 line-clamp-2 mb-3">${svc.description || 'Классическая экспресс-стрижка'}</p>

        <div class="pt-2 border-t border-[#252535] flex items-center justify-between">
          <div>
            ${isFree ? `
              <div class="flex items-center gap-1.5">
                <span class="text-xs text-gray-500 line-through font-mono">${svc.price} ₽</span>
                <span class="text-base font-black text-red-500 font-mono">0 ₽</span>
                <span class="text-[9px] bg-red-600 text-white font-extrabold px-1 rounded uppercase">АКЦИЯ</span>
              </div>
            ` : `
              <span class="text-base font-black text-white font-mono">${svc.price} ₽</span>
            `}
          </div>
          <div class="w-6 h-6 rounded-full border-2 ${isSelected ? 'border-red-500 bg-red-600 text-white' : 'border-gray-600'} flex items-center justify-center text-xs">
            ${isSelected ? '✓' : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function selectService(id) {
  playSound('click');
  state.selectedService = state.services.find(s => s.id === id);
  renderServices();
}

/* ==========================================================================
   CHECKOUT CALCULATION & PAYMENT (STEP 4)
   ========================================================================== */

function prepareCheckoutStep() {
  if (!state.selectedMaster) {
    showToast('Пожалуйста, вернитесь и выберите мастера', 'error');
    goToStep(2);
    return;
  }
  if (!state.selectedService) {
    showToast('Пожалуйста, выберите выполненную стрижку / услугу', 'error');
    return;
  }

  playSound('click');

  const isFree = state.currentClient && (state.currentClient.visits_count % 3 === 2);
  const origPrice = state.selectedService.price;
  const finalPrice = isFree ? 0 : origPrice;

  const masterCut = origPrice * 0.50;

  document.getElementById('checkout-summary-phone').innerText = state.currentClient.phone;
  document.getElementById('checkout-summary-master').innerText = state.selectedMaster.name;
  document.getElementById('checkout-summary-service').innerText = state.selectedService.name;
  document.getElementById('checkout-summary-orig-price').innerText = `${origPrice} ₽`;

  const banner = document.getElementById('free-cut-celebration-banner');
  const discountRow = document.getElementById('checkout-summary-discount-row');
  const discountVal = document.getElementById('checkout-summary-discount-val');
  const finalPriceEl = document.getElementById('checkout-summary-final-price');
  const payLabel = document.getElementById('btn-pay-label');
  const explanation = document.getElementById('checkout-split-explanation');

  if (isFree) {
    banner.classList.remove('hidden');
    discountRow.classList.remove('hidden');
    discountVal.innerText = `-${origPrice} ₽ (100%)`;
    finalPriceEl.innerText = `0 ₽ (БЕСПЛАТНО)`;
    payLabel.innerText = `Завершить бесплатную стрижку`;
    explanation.innerHTML = `Вам стрижка обходится в <b>0 ₽</b> по акции лояльности ЧИО ЧИО! При этом салон <b>компенсирует мастеру ${masterCut} ₽ (50%)</b> за отличную работу.`;
    playSound('celebration');
  } else {
    banner.classList.add('hidden');
    discountRow.classList.add('hidden');
    finalPriceEl.innerText = `${finalPrice} ₽`;
    payLabel.innerText = `Оплатить ${finalPrice} ₽ и получить чек`;
    explanation.innerHTML = `Из суммы <b>${finalPrice} ₽</b> мастер ${state.selectedMaster.name} сразу получит <b>${masterCut} ₽ (50%)</b>, а 50% поступает салону ЧИО ЧИО.`;
  }

  goToStep(4);
}

function selectPayMethod(method) {
  playSound('click');
  state.selectedPayMethod = method;

  ['sbp_qr', 'card', 'cash'].forEach(m => {
    const btn = document.getElementById(`pm-${m}`);
    if (m === method) {
      btn.className = 'pay-method-btn p-3 rounded-xl border border-red-500 bg-[#220a0d] text-left transition flex flex-col justify-between';
    } else {
      btn.className = 'pay-method-btn p-3 rounded-xl border border-[#272736] bg-[#121218] text-left transition flex flex-col justify-between';
    }
  });

  const qrBox = document.getElementById('sbp-qr-box');
  if (method === 'sbp_qr') {
    qrBox.classList.remove('hidden');
  } else {
    qrBox.classList.add('hidden');
  }
}

async function executePayment() {
  const btn = document.getElementById('btn-confirm-payment');
  btn.disabled = true;
  btn.innerHTML = `<span class="animate-spin mr-2">⚙️</span> Обработка оплаты...`;

  try {
    const data = await api('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: state.currentClient.phone,
        name: state.currentClient.name,
        serviceId: state.selectedService.id,
        masterId: state.selectedMaster.id,
        paymentMethod: state.selectedPayMethod
      })
    });

    playSound('success');
    showReceiptModal(data.receipt, data.masterInfo);
    loadMasters();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <i data-lucide="check-circle-2" class="w-5 h-5"></i>
      <span id="btn-pay-label">Оплатить и получить чек</span>
    `;
    if (window.lucide) lucide.createIcons();
  }
}

/* ==========================================================================
   RECEIPT MODAL
   ========================================================================== */

function showReceiptModal(receipt, masterInfo) {
  const modal = document.getElementById('receipt-modal');
  modal.classList.remove('hidden');

  document.getElementById('receipt-number').innerText = `ЧЕК #${receipt.orderId.toString().padStart(6, '0')}`;
  document.getElementById('receipt-datetime').innerText = new Date(receipt.date).toLocaleString('ru-RU');
  document.getElementById('receipt-master').innerText = receipt.masterName;
  document.getElementById('receipt-service').innerText = receipt.serviceName;
  document.getElementById('receipt-client').innerText = receipt.clientPhone;

  const payNames = { sbp_qr: 'СБП (QR-код)', card: 'Банковская карта', cash: 'Наличные' };
  document.getElementById('receipt-method').innerText = payNames[receipt.paymentMethod] || receipt.paymentMethod;

  document.getElementById('receipt-orig-price').innerText = `${receipt.originalPrice} ₽`;

  const discRow = document.getElementById('receipt-discount-row');
  const discVal = document.getElementById('receipt-discount-val');
  if (receipt.isFree) {
    discRow.classList.remove('hidden');
    discVal.innerText = `-${receipt.originalPrice} ₽ (100% БЕСПЛАТНО)`;
    document.getElementById('receipt-final-price').innerText = `0 ₽`;
  } else {
    discRow.classList.add('hidden');
    document.getElementById('receipt-final-price').innerText = `${receipt.finalPrice} ₽`;
  }

  document.getElementById('receipt-master-share').innerText = `${receipt.masterShare} ₽`;

  const celebBox = document.getElementById('receipt-celebration-box');
  const celebText = document.getElementById('receipt-celebration-text');
  celebText.innerText = receipt.celebrationMessage;
  if (receipt.isFree) {
    celebBox.className = 'p-3 rounded-xl bg-[#261014] text-red-300 font-bold text-xs border border-red-500/50 shadow-lg';
  } else {
    celebBox.className = 'p-3 rounded-xl bg-[#1a1a24] text-gray-300 border border-[#2b2b3a] text-xs font-semibold';
  }

  const stampsRow = document.getElementById('receipt-stamps-row');
  const currentStep = ((receipt.visitsCount - 1) % 3) + 1;
  stampsRow.innerHTML = [1, 2, 3].map(step => {
    const isCompleted = step <= currentStep;
    const isGift = step === 3;
    return `
      <div class="w-9 h-9 rounded-xl border flex items-center justify-center font-bold text-xs ${
        isCompleted
          ? (isGift ? 'bg-red-600 text-white border-red-500' : 'bg-emerald-600/30 text-emerald-400 border-emerald-500')
          : 'bg-[#181820] text-gray-500 border-[#2b2b3a]'
      }">
        ${isGift ? '🎁' : (isCompleted ? '✓' : step)}
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function closeReceiptModal() {
  document.getElementById('receipt-modal').classList.add('hidden');
  state.selectedService = null;
  state.selectedMaster = null;
  state.currentClient = null;
  document.getElementById('client-phone-input').value = '';
  document.getElementById('client-name-input').value = '';
  document.getElementById('live-loyalty-preview').classList.add('hidden');
  goToStep(1);
}

/* ==========================================================================
   LOYALTY CARD LOOKUP (TAB 2)
   ========================================================================== */

async function lookupLoyaltyCard() {
  playSound('click');
  const phone = document.getElementById('loyalty-check-phone').value.trim();
  if (!phone || phone.length < 6) {
    showToast('Введите корректный номер телефона', 'error');
    return;
  }

  try {
    const data = await api('/api/client/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });

    renderLoyaltyCardResult(data.client, data.history);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderLoyaltyCardResult(client, history) {
  const resultBox = document.getElementById('loyalty-card-result');
  resultBox.classList.remove('hidden');

  document.getElementById('card-owner-name').innerText = client.name || 'Постоянный клиент';
  document.getElementById('card-owner-phone').innerText = client.phone;
  document.getElementById('card-total-visits').innerText = client.visits_count;

  const cycleVisits = client.visits_count % 3;
  const s1 = document.getElementById('card-stamp-1');
  const s2 = document.getElementById('card-stamp-2');
  const s3 = document.getElementById('card-stamp-3');

  [s1, s2, s3].forEach(s => s.classList.remove('completed', 'active', 'gift-active'));

  const callout = document.getElementById('card-status-callout');

  if (cycleVisits === 0) {
    s1.classList.add('active');
    callout.className = 'p-4 rounded-2xl text-center font-bold text-sm bg-[#161622] text-gray-300 border border-[#2b2b3a]';
    callout.innerHTML = `✂️ У вас начался новый цикл! 1-я стрижка впереди. Каждая 3-я стрижка — БЕСПЛАТНАЯ!`;
  } else if (cycleVisits === 1) {
    s1.classList.add('completed');
    s1.querySelector('.slot-desc').innerText = 'Пройдено ✓';
    s2.classList.add('active');
    callout.className = 'p-4 rounded-2xl text-center font-bold text-sm bg-[#161622] text-gray-300 border border-[#2b2b3a]';
    callout.innerHTML = `✂️ Выполнена 1 стрижка. До бесплатной 3-й стрижки остался 1 визит!`;
  } else if (cycleVisits === 2) {
    s1.classList.add('completed');
    s1.querySelector('.slot-desc').innerText = 'Пройдено ✓';
    s2.classList.add('completed');
    s2.querySelector('.slot-desc').innerText = 'Пройдено ✓';
    s3.classList.add('gift-active');
    callout.className = 'p-4 rounded-2xl text-center font-bold text-sm bg-[#261014] text-red-200 border border-red-500/40 shadow-xl';
    callout.innerHTML = `🎉 ПОЗДРАВЛЯЕМ! Ваша следующая (3-я) стрижка в ЧИО ЧИО — совершенно БЕСПЛАТНАЯ!`;
  }

  const tbody = document.getElementById('loyalty-orders-tbody');
  if (history && history.length > 0) {
    tbody.innerHTML = history.map(o => `
      <tr class="hover:bg-[#1a1a24] transition">
        <td class="py-2.5 px-3 font-mono text-gray-400">${new Date(o.created_at).toLocaleDateString('ru-RU')}</td>
        <td class="py-2.5 px-3 font-bold text-white">${o.service_name}</td>
        <td class="py-2.5 px-3 text-gray-300">${o.master_name}</td>
        <td class="py-2.5 px-3 font-mono font-bold ${o.is_free ? 'text-red-400' : 'text-white'}">
          ${o.is_free ? '0 ₽' : o.final_price + ' ₽'}
        </td>
        <td class="py-2.5 px-3">
          ${o.is_free
            ? '<span class="bg-red-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded uppercase">Бесплатная 3-я</span>'
            : '<span class="text-emerald-400 font-semibold text-xs">Оплачено</span>'
          }
        </td>
      </tr>
    `).join('');
  } else {
    tbody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-gray-500">Пока нет записей о стрижках</td></tr>`;
  }

  if (window.lucide) lucide.createIcons();
}

/* ==========================================================================
   MASTER SELF-SERVICE CABINET (TAB 3)
   ========================================================================== */

function populateMasterCabinetSelect() {
  const sel = document.getElementById('master-select-cabinet');
  if (!sel) return;

  sel.innerHTML = state.masters.map(m => `
    <option value="${m.id}" ${state.selectedMasterCabinetId === m.id ? 'selected' : ''}>
      ${m.name} (${m.specialization})
    </option>
  `).join('');

  if (state.masters.length > 0 && !state.selectedMasterCabinetId) {
    state.selectedMasterCabinetId = state.masters[0].id;
    loadMasterCabinet(state.masters[0].id);
  } else if (state.selectedMasterCabinetId) {
    loadMasterCabinet(state.selectedMasterCabinetId);
  }
}

async function loadMasterCabinet(masterId) {
  state.selectedMasterCabinetId = Number(masterId);

  try {
    const data = await api(`/api/master/cabinet?id=${masterId}`);
    const m = data.master;

    document.getElementById('mkpi-balance').innerText = `${m.current_balance} ₽`;
    document.getElementById('mkpi-today').innerText = `${m.today_earnings} ₽`;
    document.getElementById('mkpi-today-cuts').innerText = `${m.today_cuts} стрижек за смену`;
    document.getElementById('mkpi-cuts').innerText = m.cuts_count;
    document.getElementById('mkpi-total').innerText = `${m.total_earnings} ₽`;

    document.getElementById('mcard-avatar').src = m.avatar_url;
    document.getElementById('mcard-name').innerText = m.name;
    document.getElementById('mcard-spec').innerText = m.specialization;
    document.getElementById('mcard-phone').innerText = m.phone;

    const tbody = document.getElementById('master-orders-tbody');
    if (data.orders && data.orders.length > 0) {
      tbody.innerHTML = data.orders.map(o => `
        <tr class="hover:bg-[#1a1a24] transition">
          <td class="py-2.5 px-3 font-mono text-gray-400 text-xs">${new Date(o.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</td>
          <td class="py-2.5 px-3 font-mono text-gray-300">${o.client_phone}</td>
          <td class="py-2.5 px-3 font-bold text-white">${o.service_name}</td>
          <td class="py-2.5 px-3 font-mono text-gray-300">
            ${o.is_free ? '<span class="text-red-400">0 ₽ (Акция)</span>' : o.final_price + ' ₽'}
          </td>
          <td class="py-2.5 px-3 text-right font-mono font-black text-emerald-400">
            +${o.master_share} ₽
          </td>
        </tr>
      `).join('');
    } else {
      tbody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-gray-500">Стрижек пока нет</td></tr>`;
    }

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ==========================================================================
   ADMIN PANEL (TAB 4)
   ========================================================================== */

function toggleAdminKeyVisibility() {
  const input = document.getElementById('admin-secret-key-input');
  input.type = input.type === 'password' ? 'text' : 'password';
}

async function handleAdminLogin(e) {
  e.preventDefault();
  const username = document.getElementById('admin-username-input').value.trim();
  const secretKey = document.getElementById('admin-secret-key-input').value.trim();
  const errBox = document.getElementById('admin-login-error');

  errBox.classList.add('hidden');

  try {
    const data = await api('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, secret_key: secretKey })
    });

    playSound('success');
    state.adminKey = secretKey;
    state.adminUser = data.admin.username;
    localStorage.setItem('chio_admin_key', secretKey);
    localStorage.setItem('chio_admin_user', data.admin.username);

    showAdminDashboard(data.admin);
    refreshAdminData();
  } catch (err) {
    errBox.innerText = err.message;
    errBox.classList.remove('hidden');
  }
}

function checkAdminAuth() {
  if (state.adminKey) {
    showAdminDashboard({ username: state.adminUser || 'admin' });
    refreshAdminData();
  }
}

function showAdminDashboard(admin) {
  document.getElementById('admin-login-view').classList.add('hidden');
  document.getElementById('admin-dashboard-view').classList.remove('hidden');
  document.getElementById('admin-user-badge').innerText = `Администратор: ${admin.username} (Ключ проверен)`;
}

function adminLogout() {
  playSound('click');
  state.adminKey = null;
  state.adminUser = null;
  localStorage.removeItem('chio_admin_key');
  localStorage.removeItem('chio_admin_user');
  document.getElementById('admin-dashboard-view').classList.add('hidden');
  document.getElementById('admin-login-view').classList.remove('hidden');
}

async function refreshAdminData() {
  if (!state.adminKey) return;

  try {
    const data = await api('/api/admin/dashboard', {
      headers: { 'x-admin-key': state.adminKey }
    });
    const s = data.summary;

    document.getElementById('akpi-total-rev').innerText = `${s.totalRevenue} ₽`;
    document.getElementById('akpi-master-share').innerText = `${s.totalMasterShare} ₽`;
    document.getElementById('akpi-salon-share').innerText = `${s.totalSalonShare} ₽`;
    document.getElementById('akpi-cuts-count').innerText = s.totalOrders;
    document.getElementById('akpi-today-cuts').innerText = `Сегодня: ${s.todayCuts}`;
    document.getElementById('akpi-free-cuts').innerText = s.freeOrders;

    loadAdminMasters();
    loadAdminServices();
    loadAdminOrders();
    loadAdminClients();
  } catch (err) {
    console.error('Failed refreshing admin:', err);
  }
}

function switchAdminSection(secId) {
  playSound('click');
  ['masters', 'services', 'orders', 'clients'].forEach(sec => {
    const btn = document.getElementById(`asub-btn-${sec}`);
    const div = document.getElementById(`asec-${sec}`);
    if (sec === secId) {
      btn.className = 'admin-sub-btn px-4 py-2 rounded-xl font-bold bg-[#e61e2b] text-white flex items-center gap-2';
      div.classList.remove('hidden');
    } else {
      btn.className = 'admin-sub-btn px-4 py-2 rounded-xl font-bold bg-[#171720] text-gray-400 hover:text-white flex items-center gap-2';
      div.classList.add('hidden');
    }
  });
  if (window.lucide) lucide.createIcons();
}

/* ==========================================================================
   ADMIN: MASTERS MANAGEMENT & 50% PAYOUT
   ========================================================================== */

async function loadAdminMasters() {
  try {
    const masters = await api('/api/admin/masters', {
      headers: { 'x-admin-key': state.adminKey }
    });
    state.masters = masters;

    const grid = document.getElementById('admin-masters-grid');
    grid.innerHTML = masters.map(m => `
      <div class="bg-[#14141b] border border-[#262635] rounded-2xl p-5 flex flex-col justify-between">
        <div>
          <div class="flex items-center gap-3 mb-3">
            <div class="w-12 h-12 rounded-xl overflow-hidden border border-[#333344] flex-shrink-0">
              <img src="${m.avatar_url}" alt="${m.name}" class="w-full h-full object-cover">
            </div>
            <div class="overflow-hidden">
              <h5 class="font-black text-white text-sm truncate">${m.name}</h5>
              <span class="text-xs text-red-400 block truncate">${m.specialization}</span>
              <span class="text-[11px] text-gray-400 font-mono block">${m.phone}</span>
            </div>
          </div>

          <div class="bg-[#0e0e13] p-3 rounded-xl border border-[#21212d] space-y-1.5 text-xs">
            <div class="flex justify-between">
              <span class="text-gray-400">Стрижек выполнено:</span>
              <span class="font-bold text-white">${m.cuts_count}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-400">Всего заработано (50%):</span>
              <span class="font-mono text-gray-300 font-bold">${m.total_earnings} ₽</span>
            </div>
            <div class="flex justify-between border-t border-[#1e1e28] pt-1">
              <span class="text-gray-400">Текущий баланс к выплате:</span>
              <span class="font-mono text-emerald-400 font-black text-sm">${m.current_balance} ₽</span>
            </div>
          </div>
        </div>

        <div class="flex gap-2 mt-4 pt-3 border-t border-[#222230]">
          <button
            onclick="openPayoutModal(${m.id}, '${m.name.replace(/'/g, "\\'")}', ${m.current_balance})"
            class="flex-1 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
            ${m.current_balance <= 0 ? 'disabled style="opacity: 0.5"' : ''}
          >
            <i data-lucide="wallet" class="w-3.5 h-3.5"></i>
            <span>Выплатить 50%</span>
          </button>
          <button
            onclick="deleteMaster(${m.id})"
            class="p-2 bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/20 rounded-xl text-xs transition"
            title="Деактивировать мастера"
          >
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
    `).join('');

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.error(err);
  }
}

function openAddMasterModal() {
  playSound('click');
  document.getElementById('add-master-modal').classList.remove('hidden');
}

function closeAddMasterModal() {
  document.getElementById('add-master-modal').classList.add('hidden');
}

async function submitNewMaster(e) {
  e.preventDefault();
  const name = document.getElementById('new-master-name').value.trim();
  const specialization = document.getElementById('new-master-spec').value.trim();
  const phone = document.getElementById('new-master-phone').value.trim();
  const avatar_url = document.getElementById('new-master-avatar').value.trim();

  try {
    await api('/api/admin/masters', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': state.adminKey
      },
      body: JSON.stringify({ name, specialization, phone, avatar_url })
    });

    playSound('success');
    showToast(`Мастер ${name} успешно добавлен!`, 'success');
    closeAddMasterModal();
    refreshAdminData();
    loadMasters();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openPayoutModal(id, name, balance) {
  playSound('click');
  document.getElementById('payout-master-id').value = id;
  document.getElementById('payout-master-name').innerText = `Мастер: ${name}`;
  document.getElementById('payout-current-balance').innerText = `${balance} ₽`;
  document.getElementById('payout-amount').value = balance;
  document.getElementById('payout-modal').classList.remove('hidden');
}

function closePayoutModal() {
  document.getElementById('payout-modal').classList.add('hidden');
}

async function submitPayout(e) {
  e.preventDefault();
  const id = document.getElementById('payout-master-id').value;
  const amount = document.getElementById('payout-amount').value;
  const notes = document.getElementById('payout-notes').value;

  try {
    const data = await api(`/api/admin/masters/${id}/payout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': state.adminKey
      },
      body: JSON.stringify({ amount, notes })
    });

    playSound('success');
    showToast(data.message, 'success');
    closePayoutModal();
    refreshAdminData();
    loadMasters();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteMaster(id) {
  if (!confirm('Вы уверены, что хотите деактивировать этого мастера?')) return;
  try {
    await api(`/api/admin/masters/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-key': state.adminKey }
    });
    showToast('Мастер скрыт из активных', 'info');
    refreshAdminData();
    loadMasters();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ==========================================================================
   ADMIN: SERVICES MANAGEMENT
   ========================================================================= */

async function loadAdminServices() {
  try {
    state.services = await api('/api/admin/services', {
      headers: { 'x-admin-key': state.adminKey }
    });
    renderAdminServicesTable();
  } catch (err) {
    console.error(err);
  }
}

function renderAdminServicesTable() {
  const tbody = document.getElementById('admin-services-tbody');
  if (!tbody) return;

  tbody.innerHTML = state.services.map(s => `
    <tr class="hover:bg-[#181822] transition">
      <td class="py-3 px-4">
        <span class="font-bold text-white block">${s.name}</span>
        <span class="text-xs text-gray-400 block">${s.description || ''}</span>
      </td>
      <td class="py-3 px-4 text-gray-300 font-mono">${s.duration_min} мин</td>
      <td class="py-3 px-4 font-mono font-bold text-white">${s.price} ₽</td>
      <td class="py-3 px-4 font-mono font-bold text-emerald-400">${s.price * 0.5} ₽</td>
      <td class="py-3 px-4">
        <span class="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded">Активна</span>
      </td>
      <td class="py-3 px-4 text-right">
        <button onclick="deleteService(${s.id})" class="p-1.5 text-gray-400 hover:text-red-400 rounded-lg">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </td>
    </tr>
  `).join('');

  if (window.lucide) lucide.createIcons();
}

function openAddServiceModal() {
  playSound('click');
  document.getElementById('add-service-modal').classList.remove('hidden');
}

function closeAddServiceModal() {
  document.getElementById('add-service-modal').classList.add('hidden');
}

async function submitNewService(e) {
  e.preventDefault();
  const name = document.getElementById('new-service-name').value.trim();
  const price = document.getElementById('new-service-price').value;
  const duration_min = document.getElementById('new-service-duration').value;
  const description = document.getElementById('new-service-desc').value.trim();

  try {
    await api('/api/admin/services', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': state.adminKey
      },
      body: JSON.stringify({ name, price, duration_min, description })
    });

    playSound('success');
    showToast(`Услуга "${name}" добавлена в прайс!`, 'success');
    closeAddServiceModal();
    refreshAdminData();
    loadServices();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteService(id) {
  if (!confirm('Вы уверены, что хотите скрыть эту услугу?')) return;
  try {
    await api(`/api/admin/services/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-key': state.adminKey }
    });
    showToast('Услуга деактивирована', 'info');
    refreshAdminData();
    loadServices();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ==========================================================================
   ADMIN: ORDERS JOURNAL & CLIENTS
   ========================================================================== */

async function loadAdminOrders() {
  try {
    const orders = await api('/api/admin/orders', {
      headers: { 'x-admin-key': state.adminKey }
    });

    const tbody = document.getElementById('admin-orders-tbody');
    tbody.innerHTML = orders.map(o => `
      <tr class="hover:bg-[#181822] transition">
        <td class="py-3 px-4 font-mono font-bold text-red-400">#${o.id.toString().padStart(5, '0')}</td>
        <td class="py-3 px-4 font-mono text-xs text-gray-400">${new Date(o.created_at).toLocaleString('ru-RU')}</td>
        <td class="py-3 px-4 font-mono text-gray-200">${o.client_phone}</td>
        <td class="py-3 px-4 text-gray-300">${o.master_name}</td>
        <td class="py-3 px-4 font-bold text-white">${o.service_name}</td>
        <td class="py-3 px-4 font-mono font-black ${o.is_free ? 'text-red-400' : 'text-white'}">
          ${o.is_free ? '0 ₽ (3-я БЕСПЛАТНО)' : o.final_price + ' ₽'}
        </td>
        <td class="py-3 px-4 font-mono font-bold text-emerald-400">+${o.master_share} ₽</td>
        <td class="py-3 px-4 font-mono font-bold text-red-400">${o.salon_share} ₽</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

async function loadAdminClients() {
  try {
    const clients = await api('/api/admin/clients', {
      headers: { 'x-admin-key': state.adminKey }
    });

    const tbody = document.getElementById('admin-clients-tbody');
    tbody.innerHTML = clients.map(c => {
      const cycleStep = (c.visits_count % 3) + 1;
      const isNextFree = (cycleStep === 3);
      return `
        <tr class="hover:bg-[#181822] transition">
          <td class="py-3 px-4 font-mono text-gray-500">#${c.id}</td>
          <td class="py-3 px-4 font-mono font-bold text-white">${c.phone}</td>
          <td class="py-3 px-4 text-gray-300">${c.name || '—'}</td>
          <td class="py-3 px-4 font-mono font-bold text-white">${c.visits_count}</td>
          <td class="py-3 px-4">
            ${isNextFree
              ? `<span class="bg-red-600 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full uppercase animate-pulse">Следующая БЕСПЛАТНО! (Шаг 3/3)</span>`
              : `<span class="text-xs text-gray-300">Шаг ${cycleStep}/3 (до подарка ${3 - cycleStep})</span>`
            }
          </td>
          <td class="py-3 px-4 font-mono text-amber-400 font-bold">${c.free_haircuts_received}</td>
          <td class="py-3 px-4 font-mono text-xs text-gray-400">${c.last_visit_at ? new Date(c.last_visit_at).toLocaleDateString('ru-RU') : '—'}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error(err);
  }
}
