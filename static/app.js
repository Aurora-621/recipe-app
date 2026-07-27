// ========== 全局状态 ==========
const API_BASE = '';
let TOKEN = localStorage.getItem('token') || '';
let CURRENT_USER = JSON.parse(localStorage.getItem('user') || 'null');
let CURRENT_PAGE = localStorage.getItem('shiyu_page') || 'learn';
let bloggersCache = [];
let recipesCache = [];
let currentFilter = { keyword: '', category: '全部', blogger_id: 'all' };

// ========== API 封装 ==========
async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (TOKEN) headers['Authorization'] = 'Bearer ' + TOKEN;

  const res = await fetch(API_BASE + path, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '请求失败');
  return data;
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// ========== 入口 ==========
function render() {
  const app = document.getElementById('app');
  if (!TOKEN) {
    app.innerHTML = renderAuthPage();
    bindAuthEvents();
    return;
  }
  app.innerHTML = renderMainPage();
  navigateTo(CURRENT_PAGE);
}

// ========== 登录页 ==========
function renderAuthPage() {
  return `
    <div class="auth-page">
      <div class="auth-logo">
        <div class="auth-logo-icon">🍳</div>
        <h1>食遇日记</h1>
        <p>记录美食灵感 · 复刻博主好菜</p>
      </div>
      <div class="auth-form">
        <div class="error-msg" id="authError"></div>
        <div class="auth-tabs">
          <div class="auth-tab active" data-tab="login">登录</div>
          <div class="auth-tab" data-tab="register">注册</div>
        </div>
        <div id="authFields">
          <div class="field">
            <label class="label">用户名</label>
            <input class="input" id="username" placeholder="输入用户名">
          </div>
          <div class="field" id="nicknameField" style="display:none">
            <label class="label">昵称(可选)</label>
            <input class="input" id="nickname" placeholder="你的昵称">
          </div>
          <div class="field">
            <label class="label">密码</label>
            <input class="input" id="password" type="password" placeholder="输入密码">
          </div>
        </div>
        <button class="btn btn-block" id="authSubmit">登录</button>
      </div>
    </div>
  `;
}

function bindAuthEvents() {
  let mode = 'login';
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      mode = tab.dataset.tab;
      document.getElementById('nicknameField').style.display = mode === 'register' ? 'block' : 'none';
      document.getElementById('authSubmit').textContent = mode === 'login' ? '登录' : '注册';
    };
  });

  document.getElementById('authSubmit').onclick = async () => {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const nickname = document.getElementById('nickname').value.trim();
    const errEl = document.getElementById('authError');
    errEl.classList.remove('show');

    if (!username || !password) {
      errEl.textContent = '用户名和密码不能为空';
      errEl.classList.add('show');
      return;
    }

    try {
      const body = { username, password };
      if (mode === 'register' && nickname) body.nickname = nickname;
      const res = await api(`/api/${mode}`, { method: 'POST', body: JSON.stringify(body) });
      TOKEN = res.token;
      CURRENT_USER = res.user;
      localStorage.setItem('token', TOKEN);
      localStorage.setItem('user', JSON.stringify(CURRENT_USER));
      render();
    } catch (e) {
      errEl.textContent = e.message;
      errEl.classList.add('show');
    }
  };

  document.getElementById('password').addEventListener('keypress', e => {
    if (e.key === 'Enter') document.getElementById('authSubmit').click();
  });
}

// ========== 主框架 ==========
function renderMainPage() {
  return `
    <div id="pageContent"></div>
    <div class="tabbar">
      <div class="tab-item ${CURRENT_PAGE === 'learn' ? 'active' : ''}" data-page="learn">
        <div class="tab-icon">🥣</div><span>学菜</span>
      </div>
      <div class="tab-item ${CURRENT_PAGE === 'cards' ? 'active' : ''}" data-page="cards">
        <div class="tab-icon">📇</div><span>菜卡</span>
      </div>
      <div class="tab-item ${CURRENT_PAGE === 'calendar' ? 'active' : ''}" data-page="calendar">
        <div class="tab-icon">📅</div><span>日历</span>
      </div>
      <div class="tab-item ${CURRENT_PAGE === 'family' ? 'active' : ''}" data-page="family">
        <div class="tab-icon">👨‍👩‍👧</div><span>家宴</span>
      </div>
      <div class="tab-item ${CURRENT_PAGE === 'profile' ? 'active' : ''}" data-page="profile">
        <div class="tab-icon">👤</div><span>我的</span>
      </div>
    </div>
    <button class="fab" id="fabBtn" style="display:none">+</button>
  `;
}

function navigateTo(page) {
  CURRENT_PAGE = page;
  localStorage.setItem('shiyu_page', page);
  document.querySelectorAll('.tab-item').forEach(t => t.classList.toggle('active', t.dataset.page === page));

  const fab = document.getElementById('fabBtn');
  if (page === 'cards') {
    fab.style.display = 'flex';
    fab.onclick = () => openRecipeForm();
  } else {
    fab.style.display = 'none';
  }

  const content = document.getElementById('pageContent');
  if (page === 'learn') { content.innerHTML = renderLearnPage(); loadLearnData(); }
  else if (page === 'cards') { content.innerHTML = renderCardsPage(); loadCardsData(); }
  else if (page === 'calendar') { content.innerHTML = renderCalendarPage(); loadCalendarData(); }
  else if (page === 'family') { content.innerHTML = renderFamilyPage(); loadFamilyData(); }
  else if (page === 'profile') {
    content.innerHTML = renderProfilePage();
    loadProfileStats();
  }

  document.querySelectorAll('.tab-item').forEach(t => t.onclick = () => navigateTo(t.dataset.page));
}

// ========== 学菜页(发现) ==========
function renderLearnPage() {
  return `
    <div class="page">
      <div class="app-header">
        <div class="header-top">
          <div class="app-title">食遇菜谱库</div>
          <div class="header-actions">
            <button class="icon-btn-header" onclick="shareApp()">🔗</button>
          </div>
        </div>
        <div class="blogger-scroll" id="bloggerScroll">
          <div class="blogger-chip active" data-id="all">
            <div class="avatar">🍳</div><span>全部</span>
          </div>
          <div class="loading" style="padding:0">加载中...</div>
        </div>
      </div>
      <div class="search-box">
        <input class="search-input" id="searchInput" placeholder="搜索菜名或食材..." value="${escapeHtml(currentFilter.keyword)}">
      </div>
      <div class="category-section">
        <div class="category-scroll" id="categoryScroll">
          <div class="category-chip active" data-cat="全部">全部</div>
          <div class="category-chip" data-cat="肉类">🥩 肉类</div>
          <div class="category-chip" data-cat="海鲜">🦐 海鲜</div>
          <div class="category-chip" data-cat="素菜">🥬 素菜</div>
          <div class="category-chip" data-cat="面食">🍜 面食</div>
          <div class="category-chip" data-cat="汤品">🥣 汤品</div>
          <div class="category-chip" data-cat="主食">🍚 主食</div>
          <div class="category-chip" data-cat="凉菜">🥗 凉菜</div>
          <div class="category-chip" data-cat="早餐">🌅 早餐</div>
          <div class="category-chip" data-cat="午餐">☀️ 午餐</div>
          <div class="category-chip" data-cat="晚餐">🌙 晚餐</div>
        </div>
      </div>
      <div id="recipeListContainer">
        <div class="loading"><div class="spinner"></div>加载中...</div>
      </div>
    </div>
  `;
}

async function loadLearnData() {
  try {
    if (!bloggersCache.length) {
      bloggersCache = (await api('/api/bloggers')).bloggers;
    }
    renderBloggerChips();
    bindLearnEvents();
    await loadDiscoverRecipes();
  } catch (e) {
    document.getElementById('recipeListContainer').innerHTML =
      `<div class="empty-state"><div class="empty-icon">😕</div><div class="empty-title">${e.message}</div></div>`;
  }
}

function renderBloggerChips() {
  const scroll = document.getElementById('bloggerScroll');
  const chips = [`
    <div class="blogger-chip ${currentFilter.blogger_id === 'all' ? 'active' : ''}" data-id="all">
      <div class="avatar">🍳</div><span>全部</span>
    </div>
  `];
  bloggersCache.forEach(b => {
    chips.push(`
      <div class="blogger-chip ${currentFilter.blogger_id === b.id ? 'active' : ''}" data-id="${b.id}">
        <div class="avatar">${b.avatar}</div><span>${escapeHtml(b.name)}</span>
      </div>
    `);
  });
  scroll.innerHTML = chips.join('');

  scroll.querySelectorAll('.blogger-chip').forEach(chip => {
    chip.onclick = () => {
      currentFilter.blogger_id = chip.dataset.id;
      loadDiscoverRecipes();
    };
  });
}

function bindLearnEvents() {
  let searchTimer;
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.oninput = (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        currentFilter.keyword = e.target.value;
        loadDiscoverRecipes();
      }, 300);
    };
  }

  document.querySelectorAll('.category-chip').forEach(chip => {
    chip.onclick = () => {
      document.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter.category = chip.dataset.cat;
      loadDiscoverRecipes();
    };
  });
}

async function loadDiscoverRecipes() {
  const container = document.getElementById('recipeListContainer');
  container.innerHTML = `<div class="loading"><div class="spinner"></div>加载中...</div>`;

  try {
    let url = '/api/recipes?source=all';
    if (currentFilter.blogger_id !== 'all') url = `/api/recipes?source=blogger&blogger_id=${currentFilter.blogger_id}`;
    if (currentFilter.keyword) url += `&keyword=${encodeURIComponent(currentFilter.keyword)}`;
    if (currentFilter.category !== '全部') url += `&category=${encodeURIComponent(currentFilter.category)}`;

    const data = await api(url);
    recipesCache = data.recipes;
    renderDiscoverRecipeList(data.recipes);
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">😕</div><div class="empty-title">${e.message}</div></div>`;
  }
}

function renderDiscoverRecipeList(recipes) {
  const container = document.getElementById('recipeListContainer');
  if (!recipes.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🍳</div>
        <div class="empty-title">暂无相关食谱</div>
        <div class="empty-hint">换个关键词或分类试试</div>
      </div>
    `;
    return;
  }

  container.innerHTML = `<div class="recipe-list">${recipes.map(r => `
    <div class="recipe-card" data-id="${r.id}">
      <div class="card-actions">
        <button class="card-action-btn ${r.is_collected ? 'active' : ''}" data-action="collect" title="收藏">♥</button>
      </div>
      <div class="recipe-card-header">
        <div class="recipe-card-img">${r.image || '🍽️'}</div>
        <div class="recipe-card-main">
          <div class="recipe-card-title">${escapeHtml(r.name)}</div>
          <div class="recipe-card-blogger">${r.blogger_id ? '👤 ' + escapeHtml(r.blogger_name || '博主') : '🍳 官方推荐'}</div>
          <div class="recipe-card-meta">
            <span>⏱ ${r.cook_time || '未知'}</span>
            <span>📊 ${r.difficulty || '简单'}</span>
          </div>
        </div>
      </div>
      <div class="recipe-card-summary">${getSummary(r)}</div>
      <div class="recipe-card-tags">${r.tags.slice(0, 3).map(t => `<span class="recipe-card-tag">${escapeHtml(t)}</span>`).join('')}</div>
    </div>
  `).join('')}</div>`;

  container.querySelectorAll('.recipe-card').forEach(card => {
    card.onclick = (e) => {
      if (e.target.closest('.card-action-btn')) return;
      openRecipeDetail(card.dataset.id, 'discover');
    };
  });

  container.querySelectorAll('[data-action="collect"]').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const card = btn.closest('.recipe-card');
      try {
        const res = await api(`/api/recipes/${card.dataset.id}/collect`, { method: 'POST' });
        btn.classList.toggle('active', res.saved);
        toast(res.saved ? '已收藏' : '取消收藏');
      } catch (e) { toast(e.message); }
    };
  });
}

function getSummary(r) {
  if (r.steps && r.steps.length) return escapeHtml(r.steps[0]);
  if (r.ingredients && r.ingredients.length) return escapeHtml(r.ingredients.slice(0, 3).join('、'));
  return '暂无描述';
}

// ========== 菜卡页(我的食谱本) ==========
function renderCardsPage() {
  return `
    <div class="page">
      <div class="app-header" style="padding-bottom:14px">
        <div class="header-top">
          <div class="app-title">我的菜卡</div>
        </div>
      </div>
      <div class="search-box">
        <input class="search-input" id="cardsSearch" placeholder="搜索我的菜谱...">
      </div>
      <div id="cardsListContainer">
        <div class="loading"><div class="spinner"></div>加载中...</div>
      </div>
    </div>
  `;
}

async function loadCardsData() {
  try {
    const data = await api('/api/recipes?source=mine');
    renderCardsList(data.recipes);
    bindCardsEvents();
  } catch (e) {
    document.getElementById('cardsListContainer').innerHTML =
      `<div class="empty-state"><div class="empty-icon">😕</div><div class="empty-title">${e.message}</div></div>`;
  }
}

function renderCardsList(recipes) {
  const container = document.getElementById('cardsListContainer');
  if (!recipes.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📇</div>
        <div class="empty-title">还没有菜卡</div>
        <div class="empty-hint">在学菜页看到喜欢的食谱,<br>点击"复刻到我的菜卡"即可记录</div>
      </div>
    `;
    return;
  }

  container.innerHTML = `<div class="recipe-list">${recipes.map(r => `
    <div class="recipe-card" data-id="${r.id}">
      <div class="card-actions">
        <button class="card-action-btn" data-action="edit" title="编辑">✏️</button>
        <button class="card-action-btn" data-action="delete" title="删除" style="color:#E85A5A">🗑</button>
      </div>
      <div class="recipe-card-header">
        <div class="recipe-card-img">${r.image || '🍽️'}</div>
        <div class="recipe-card-main">
          <div class="recipe-card-title">${escapeHtml(r.name)}</div>
          <div class="recipe-card-blogger" style="background:${r.source_type === 'clone' ? '#E8F5E9' : '#FFF3D6'};color:${r.source_type === 'clone' ? '#2E7D32' : '#E09000'}">
            ${r.source_type === 'clone' ? '✨ 已复刻' : '📝 原创'}
          </div>
          <div class="recipe-card-meta">
            <span>⏱ ${r.cook_time || '未知'}</span>
            <span>📊 ${r.difficulty || '简单'}</span>
          </div>
        </div>
      </div>
      <div class="recipe-card-summary">${getSummary(r)}</div>
    </div>
  `).join('')}</div>`;

  container.querySelectorAll('.recipe-card').forEach(card => {
    card.onclick = (e) => {
      if (e.target.closest('.card-action-btn')) return;
      openRecipeDetail(card.dataset.id, 'mine');
    };
  });

  container.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const card = btn.closest('.recipe-card');
      const recipe = (await api(`/api/recipes/${card.dataset.id}`));
      openRecipeForm(recipe);
    };
  });

  container.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const card = btn.closest('.recipe-card');
      if (!confirm('确定删除这道菜卡?')) return;
      try {
        await api(`/api/recipes/${card.dataset.id}`, { method: 'DELETE' });
        toast('已删除');
        loadCardsData();
      } catch (e) { toast(e.message); }
    };
  });
}

function bindCardsEvents() {
  let timer;
  document.getElementById('cardsSearch').oninput = (e) => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const kw = e.target.value.toLowerCase();
      const data = await api('/api/recipes?source=mine');
      const filtered = data.recipes.filter(r =>
        r.name.toLowerCase().includes(kw) ||
        r.ingredients.some(i => i.toLowerCase().includes(kw))
      );
      renderCardsList(filtered);
    }, 300);
  };
}

// ========== 日历页 ==========
function renderCalendarPage() {
  return `
    <div class="page">
      <div class="app-header" style="padding-bottom:14px">
        <div class="header-top">
          <div class="app-title">饮食日历</div>
        </div>
      </div>
      <div class="week-tabs" id="weekTabs"></div>
      <div id="menuContent">
        <div class="loading"><div class="spinner"></div>加载中...</div>
      </div>
    </div>
  `;
}

function getWeekDates(offset = 0) {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1 + offset * 7);
  const dates = [];
  const dayNames = ['一','二','三','四','五','六','日'];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push({
      date: d.toISOString().slice(0, 10),
      dayName: dayNames[i],
      dayNum: d.getDate(),
      isWeekend: i >= 5,
      isToday: d.toISOString().slice(0,10) === today.toISOString().slice(0,10)
    });
  }
  return dates;
}

let menuWeekOffset = 0;
let currentMenu = { items: [] };

async function loadCalendarData() {
  const weekDates = getWeekDates(menuWeekOffset);
  const weekKey = weekDates[0].date;

  const tabsEl = document.getElementById('weekTabs');
  tabsEl.innerHTML = weekDates.map((d, i) => `
    <div class="week-tab ${d.isWeekend ? 'weekend' : ''} ${i === 0 ? 'active' : ''}" data-date="${d.date}">
      <div class="day">${d.isToday ? '今天' : '周' + d.dayName}</div>
      <div class="date">${d.dayNum}</div>
    </div>
  `).join('');

  let selectedDate = weekDates[0].date;
  tabsEl.querySelectorAll('.week-tab').forEach(t => {
    t.onclick = () => {
      tabsEl.querySelectorAll('.week-tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      selectedDate = t.dataset.date;
      renderMenuContent(currentMenu, selectedDate);
    };
  });

  try {
    const data = await api(`/api/menu?week=${weekKey}`);
    currentMenu = data;
    renderMenuContent(data, selectedDate);
  } catch (e) {
    document.getElementById('menuContent').innerHTML =
      `<div class="empty-state"><div class="empty-icon">📅</div><div class="empty-title">${e.message}</div></div>`;
  }
}

function renderMenuContent(menu, date) {
  const dayItems = menu.items.filter(i => i.date === date);
  const meals = ['早餐', '午餐', '晚餐'];

  document.getElementById('menuContent').innerHTML = meals.map(meal => {
    const items = dayItems.filter(i => i.meal_type === meal);
    return `
      <div class="meal-section">
        <div class="meal-title">${meal === '早餐' ? '🌅' : meal === '午餐' ? '☀️' : '🌙'} ${meal}</div>
        ${items.length ? items.map(item => `
          <div class="meal-item">
            <div class="meal-item-emoji">${item.recipe.image || '🍽️'}</div>
            <div class="meal-item-info">
              <div class="meal-item-name">${escapeHtml(item.recipe.name || '(已删除)')}</div>
              <div class="meal-item-by">${item.recipe.blogger_name || '我的菜卡'}</div>
            </div>
            <button class="meal-item-remove" data-id="${item.id}">×</button>
          </div>
        `).join('') : '<div style="color:var(--text-light);font-size:13px;padding:8px 0">暂无安排</div>'}
        <button class="add-meal-btn" data-meal="${meal}">+ 添加${meal}</button>
      </div>
    `;
  }).join('');

  document.querySelectorAll('.add-meal-btn').forEach(btn => {
    btn.onclick = () => openRecipePicker(date, btn.dataset.meal);
  });
  document.querySelectorAll('.meal-item-remove').forEach(btn => {
    btn.onclick = async () => {
      try {
        await api(`/api/menu/${btn.dataset.id}?week=${getWeekDates(menuWeekOffset)[0].date}`, { method: 'DELETE' });
        toast('已移除');
        loadCalendarData();
      } catch (e) { toast(e.message); }
    };
  });
}

function openRecipePicker(date, mealType) {
  const modal = document.createElement('div');
  modal.className = 'modal-page';
  modal.innerHTML = `
    <div class="form-header">
      <button class="icon-btn-header" style="width:auto;padding:0 10px" onclick="this.closest('.modal-page').remove()">返回</button>
      <h2>选择${mealType}</h2>
      <div style="width:50px"></div>
    </div>
    <div class="recipe-picker">
      <input class="input" id="pickerSearch" placeholder="搜索菜卡..." style="margin-bottom:12px">
      <div id="pickerList"></div>
    </div>
  `;
  document.body.appendChild(modal);

  async function loadPicker() {
    try {
      const [mine, collected] = await Promise.all([
        api('/api/recipes?source=mine'),
        api('/api/recipes?source=collected')
      ]);
      const all = [...mine.recipes, ...collected.recipes];
      renderPicker(all);
    } catch (e) { toast(e.message); }
  }

  function renderPicker(list) {
    const el = modal.querySelector('#pickerList');
    if (!list.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">📇</div><div class="empty-title">没有可选的菜卡</div></div>';
      return;
    }
    el.innerHTML = list.map(r => `
      <div class="picker-item" data-id="${r.id}">
        <div class="picker-item-emoji">${r.image || '🍽️'}</div>
        <div>
          <div class="picker-item-name">${escapeHtml(r.name)}</div>
          <div class="picker-item-cat">${r.category} · ${r.cook_time || '未知'}</div>
        </div>
      </div>
    `).join('');

    el.querySelectorAll('.picker-item').forEach(item => {
      item.onclick = async () => {
        try {
          await api('/api/menu', {
            method: 'POST',
            body: JSON.stringify({
              recipe_id: item.dataset.id,
              date,
              meal_type: mealType,
              week: getWeekDates(menuWeekOffset)[0].date
            })
          });
          toast('已添加到日历');
          modal.remove();
          loadCalendarData();
        } catch (e) { toast(e.message); }
      };
    });
  }

  modal.querySelector('#pickerSearch').oninput = async (e) => {
    const kw = e.target.value.toLowerCase();
    const [mine, collected] = await Promise.all([
      api('/api/recipes?source=mine'),
      api('/api/recipes?source=collected')
    ]);
    const all = [...mine.recipes, ...collected.recipes].filter(r =>
      r.name.toLowerCase().includes(kw) || r.ingredients.some(i => i.toLowerCase().includes(kw))
    );
    renderPicker(all);
  };

  loadPicker();
}

// ========== 家宴页(家庭) ==========
function renderFamilyPage() {
  return `
    <div class="page">
      <div class="app-header" style="padding-bottom:14px">
        <div class="header-top">
          <div class="app-title">家宴</div>
        </div>
      </div>
      <div id="familyListContainer">
        <div class="loading"><div class="spinner"></div>加载中...</div>
      </div>
    </div>
  `;
}

async function loadFamilyData() {
  try {
    const data = await api('/api/family/my');
    renderFamilyList(data.families);
  } catch (e) {
    document.getElementById('familyListContainer').innerHTML =
      `<div class="empty-state"><div class="empty-icon">👨‍👩‍👧</div><div class="empty-title">${e.message}</div></div>`;
  }
}

function renderFamilyList(families) {
  const container = document.getElementById('familyListContainer');
  if (!families.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">👨‍👩‍👧</div>
        <div class="empty-title">还没有家庭</div>
        <div class="empty-hint">创建家庭,和家人共享每周菜单</div>
        <button class="btn" style="margin-top:16px" onclick="openFamilyForm()">创建家庭</button>
      </div>
    `;
    return;
  }

  container.innerHTML = families.map(f => `
    <div class="detail-section" style="margin:0 20px 14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-size:17px;font-weight:700">${escapeHtml(f.name)}</div>
        <span style="font-size:12px;color:var(--primary-dark);background:var(--primary-light);padding:3px 10px;border-radius:10px">${f.owner === CURRENT_USER.username ? '创建者' : '成员'}</span>
      </div>
      <div style="background:var(--bg-warm);border-radius:var(--radius-md);padding:14px;text-align:center;margin:12px 0">
        <div style="font-size:12px;color:var(--text-secondary)">邀请码</div>
        <div style="font-size:26px;font-weight:800;letter-spacing:4px;color:var(--primary-dark);margin:4px 0">${f.invite_code}</div>
        <button class="btn btn-secondary" style="font-size:12px;padding:5px 14px" onclick="copyText('${f.invite_code}')">复制邀请码</button>
      </div>
      <div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px">家庭成员 (${f.member_info.length})</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${f.member_info.map(m => `
          <div style="display:flex;align-items:center;gap:5px;background:var(--bg);padding:4px 10px 4px 4px;border-radius:20px">
            <div style="width:26px;height:26px;border-radius:50%;background:${m.avatar_color};display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:700">${m.nickname[0]}</div>
            <span style="font-size:12px">${escapeHtml(m.nickname)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('') + `
    <div style="padding:0 20px">
      <button class="btn btn-outline btn-block" style="margin-bottom:10px" onclick="openFamilyForm()">+ 创建/加入家庭</button>
    </div>
  `;
}

function openFamilyForm() {
  const modal = document.createElement('div');
  modal.className = 'modal-page';
  modal.innerHTML = `
    <div class="form-header">
      <button class="icon-btn-header" style="width:auto;padding:0 10px" onclick="this.closest('.modal-page').remove()">返回</button>
      <h2>家庭</h2>
      <div style="width:50px"></div>
    </div>
    <div class="form-body">
      <div class="detail-section">
        <h3 style="font-size:16px;margin-bottom:14px">🏠 创建家庭</h3>
        <div class="field">
          <label class="label">家庭名称</label>
          <input class="input" id="familyName" placeholder="如:温馨小厨房">
        </div>
        <button class="btn btn-block" id="createFamilyBtn">创建</button>
      </div>
      <div class="detail-section">
        <h3 style="font-size:16px;margin-bottom:14px">🔑 加入家庭</h3>
        <div class="field">
          <label class="label">邀请码</label>
          <input class="input" id="inviteCode" placeholder="输入6位邀请码" maxlength="6" style="text-transform:uppercase;letter-spacing:2px">
        </div>
        <button class="btn btn-secondary btn-block" id="joinFamilyBtn">加入</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('#createFamilyBtn').onclick = async () => {
    const name = modal.querySelector('#familyName').value.trim();
    if (!name) return toast('请输入家庭名称');
    try {
      await api('/api/family/create', { method: 'POST', body: JSON.stringify({ name }) });
      toast('家庭已创建');
      modal.remove();
      loadFamilyData();
    } catch (e) { toast(e.message); }
  };

  modal.querySelector('#joinFamilyBtn').onclick = async () => {
    const code = modal.querySelector('#inviteCode').value.trim().toUpperCase();
    if (!code) return toast('请输入邀请码');
    try {
      await api('/api/family/join', { method: 'POST', body: JSON.stringify({ invite_code: code }) });
      toast('已加入家庭');
      modal.remove();
      loadFamilyData();
    } catch (e) { toast(e.message); }
  };
}

// ========== 我的页 ==========
function renderProfilePage() {
  return `
    <div class="page">
      <div class="profile-header">
        <div class="profile-avatar" style="background:${CURRENT_USER.avatar_color}">${CURRENT_USER.nickname[0]}</div>
        <div class="profile-name">${escapeHtml(CURRENT_USER.nickname)}</div>
        <div class="profile-id">@${escapeHtml(CURRENT_USER.username)}</div>
      </div>
      <div class="profile-stats" id="profileStats">
        <div class="profile-stat"><div class="num">-</div><div class="label">菜卡</div></div>
        <div class="profile-stat"><div class="num">-</div><div class="label">收藏</div></div>
        <div class="profile-stat"><div class="num">-</div><div class="label">家宴</div></div>
      </div>
      <div class="menu-list">
        <div class="menu-item" onclick="navigateTo('cards')">
          <div class="menu-item-left">
            <div class="menu-item-icon">📇</div>
            <div class="menu-item-text">我的菜卡</div>
          </div>
          <div class="menu-item-arrow">›</div>
        </div>
        <div class="menu-item" onclick="navigateTo('calendar')">
          <div class="menu-item-left">
            <div class="menu-item-icon">📅</div>
            <div class="menu-item-text">饮食日历</div>
          </div>
          <div class="menu-item-arrow">›</div>
        </div>
        <div class="menu-item" onclick="shareApp()">
          <div class="menu-item-left">
            <div class="menu-item-icon">📱</div>
            <div class="menu-item-text">添加到主屏幕</div>
          </div>
          <div class="menu-item-arrow">›</div>
        </div>
        <div class="menu-item" onclick="logout()">
          <div class="menu-item-left">
            <div class="menu-item-icon" style="color:var(--red)">🚪</div>
            <div class="menu-item-text" style="color:var(--red)">退出登录</div>
          </div>
          <div class="menu-item-arrow" style="color:var(--red)">›</div>
        </div>
      </div>
    </div>
  `;
}

async function loadProfileStats() {
  try {
    const [mine, collected, family] = await Promise.all([
      api('/api/recipes?source=mine'),
      api('/api/recipes?source=collected'),
      api('/api/family/my')
    ]);
    const statContainer = document.getElementById('profileStats');
    if (statContainer) {
      statContainer.querySelector('.profile-stat:nth-child(1) .num').textContent = mine.recipes.length;
      statContainer.querySelector('.profile-stat:nth-child(2) .num').textContent = collected.recipes.length;
      statContainer.querySelector('.profile-stat:nth-child(3) .num').textContent = family.families.length;
    }
  } catch (e) {}
}

function logout() {
  if (!confirm('确定退出登录?')) return;
  TOKEN = '';
  CURRENT_USER = null;
  localStorage.clear();
  render();
}

function shareApp() {
  toast('用 Safari 打开,点分享按钮,选择"添加到主屏幕"');
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => toast('已复制'));
}

// ========== 食谱详情 ==========
async function openRecipeDetail(id, from) {
  try {
    const recipe = await api(`/api/recipes/${id}`);
    const modal = document.createElement('div');
    modal.className = 'modal-page';

    const isMine = recipe.owner === CURRENT_USER.username && recipe.source_type !== 'system';
    const isSystem = recipe.source_type === 'system';
    const hasCloned = !!recipe.user_clone_id;

    modal.innerHTML = `
      <div class="detail-hero">
        <button class="back-btn" onclick="this.closest('.modal-page').remove()">←</button>
        <div class="top-actions">
          ${!isMine ? `<button class="back-btn" style="position:static" onclick="event.stopPropagation();collectDetail(this,'${id}')">${recipe.is_collected ? '♥' : '♡'}</button>` : ''}
        </div>
        ${recipe.image || '🍽️'}
      </div>
      <div class="detail-body">
        <div class="detail-title">${escapeHtml(recipe.name)}</div>
        ${recipe.blogger_name ? `<div class="detail-blogger">${recipe.blogger_id ? '👤' : '🍳'} ${escapeHtml(recipe.blogger_name)}</div>` : ''}
        <div class="detail-meta">
          <div class="detail-meta-item">📂 ${recipe.category}</div>
          ${recipe.cook_time ? `<div class="detail-meta-item">⏱ ${recipe.cook_time}</div>` : ''}
          ${recipe.difficulty ? `<div class="detail-meta-item">📊 ${recipe.difficulty}</div>` : ''}
          ${recipe.servings ? `<div class="detail-meta-item">👥 ${recipe.servings}人份</div>` : ''}
        </div>

        ${recipe.ingredients && recipe.ingredients.length ? `
          <div class="detail-section">
            <div class="detail-section-title">🥘 食材清单</div>
            ${recipe.ingredients.map(ing => `<div class="ingredient-item">${escapeHtml(ing)}</div>`).join('')}
          </div>
        ` : ''}

        ${recipe.steps && recipe.steps.length ? `
          <div class="detail-section">
            <div class="detail-section-title">👨‍🍳 制作步骤</div>
            ${recipe.steps.map((s, i) => `<div class="step-item"><div class="step-num">${i+1}</div><div class="step-text">${escapeHtml(s)}</div></div>`).join('')}
          </div>
        ` : ''}

        ${recipe.notes ? `
          <div class="detail-section">
            <div class="detail-section-title">💡 小贴士</div>
            <div style="font-size:14px;line-height:1.7;color:var(--text-secondary)">${escapeHtml(recipe.notes)}</div>
          </div>
        ` : ''}

        ${recipe.tags && recipe.tags.length ? `
          <div class="detail-section">
            <div class="detail-section-title">🏷 标签</div>
            <div class="detail-tags">${recipe.tags.map(t => `<span class="detail-tag">${escapeHtml(t)}</span>`).join('')}</div>
          </div>
        ` : ''}

        <div class="detail-actions">
          ${isSystem ? `
            <button class="btn ${hasCloned ? 'btn-secondary' : ''}" id="cloneBtn">
              ${hasCloned ? '✓ 已复刻' : '✨ 复刻到我的菜卡'}
            </button>
            <button class="btn btn-secondary" onclick="addToMenu('${id}')">📅 加入日历</button>
          ` : isMine ? `
            <button class="btn" onclick="editRecipe('${id}')">✏️ 编辑</button>
            <button class="btn btn-secondary" onclick="addToMenu('${id}')">📅 加入日历</button>
          ` : `
            <button class="btn btn-secondary" onclick="addToMenu('${id}')">📅 加入日历</button>
          `}
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const cloneBtn = modal.querySelector('#cloneBtn');
    if (cloneBtn) {
      cloneBtn.onclick = async () => {
        try {
          const res = await api(`/api/recipes/${id}/clone`, { method: 'POST' });
          toast(res.already_cloned ? '已经复刻过了' : '已复刻到菜卡');
          cloneBtn.textContent = '✓ 已复刻';
          cloneBtn.classList.add('btn-secondary');
        } catch (e) { toast(e.message); }
      };
    }
  } catch (e) { toast(e.message); }
}

async function collectDetail(btn, id) {
  try {
    const res = await api(`/api/recipes/${id}/collect`, { method: 'POST' });
    btn.textContent = res.saved ? '♥' : '♡';
    toast(res.saved ? '已收藏' : '取消收藏');
  } catch (e) { toast(e.message); }
}

async function editRecipe(id) {
  document.querySelector('.modal-page')?.remove();
  const recipe = await api(`/api/recipes/${id}`);
  openRecipeForm(recipe);
}

function addToMenu(id) {
  document.querySelector('.modal-page')?.remove();
  navigateTo('calendar');
  setTimeout(() => {
    const today = new Date().toISOString().slice(0, 10);
    openRecipePicker(today, '午餐');
  }, 300);
}

// ========== 食谱表单 ==========
function openRecipeForm(recipe = null) {
  const isEdit = !!recipe;
  const modal = document.createElement('div');
  modal.className = 'modal-page form-page';
  modal.innerHTML = `
    <div class="form-header">
      <button class="icon-btn-header" style="width:auto;padding:0 10px" onclick="this.closest('.modal-page').remove()">返回</button>
      <h2>${isEdit ? '编辑菜卡' : '新建菜卡'}</h2>
      <button class="icon-btn-header" style="width:auto;padding:0 10px;color:var(--primary-dark);font-weight:700" id="saveRecipeBtn">保存</button>
    </div>
    <div class="form-body">
      <div class="field">
        <label class="label">菜名 *</label>
        <input class="input" id="r_name" placeholder="如:番茄炒蛋" value="${recipe ? escapeHtml(recipe.name) : ''}">
      </div>
      <div class="field">
        <label class="label">封面 Emoji</label>
        <input class="input" id="r_image" placeholder="如:🍅" maxlength="2" value="${recipe ? escapeHtml(recipe.image || '') : ''}" style="font-size:20px;text-align:center">
      </div>
      <div style="display:flex;gap:12px">
        <div class="field" style="flex:1">
          <label class="label">分类</label>
          <select class="select" id="r_category">
            ${['肉类','海鲜','素菜','面食','汤品','主食','凉菜','早餐','午餐','晚餐','甜点','其他'].map(c =>
              `<option value="${c}" ${recipe && recipe.category === c ? 'selected' : ''}>${c}</option>`
            ).join('')}
          </select>
        </div>
        <div class="field" style="flex:1">
          <label class="label">难度</label>
          <select class="select" id="r_difficulty">
            ${['简单','中等','困难'].map(d =>
              `<option value="${d}" ${recipe && recipe.difficulty === d ? 'selected' : ''}>${d}</option>`
            ).join('')}
          </select>
        </div>
      </div>
      <div style="display:flex;gap:12px">
        <div class="field" style="flex:1">
          <label class="label">烹饪时间</label>
          <input class="input" id="r_cook_time" placeholder="如:30分钟" value="${recipe ? escapeHtml(recipe.cook_time || '') : ''}">
        </div>
        <div class="field" style="flex:1">
          <label class="label">份数</label>
          <input class="input" id="r_servings" type="number" min="1" value="${recipe ? recipe.servings : 2}">
        </div>
      </div>
      <div class="field">
        <label class="label">标签(回车添加)</label>
        <div class="tag-input-wrap" id="tagWrap">
          <input id="tagInput" placeholder="如:家常菜">
        </div>
      </div>
      <div class="field">
        <label class="label">食材</label>
        <div id="ingredientList"></div>
        <button class="add-row-btn" id="addIngredientBtn">+ 添加食材</button>
      </div>
      <div class="field">
        <label class="label">步骤</label>
        <div id="stepList"></div>
        <button class="add-row-btn" id="addStepBtn">+ 添加步骤</button>
      </div>
      <div class="field">
        <label class="label">小贴士(可选)</label>
        <textarea class="textarea" id="r_notes" placeholder="记录烹饪心得...">${recipe ? escapeHtml(recipe.notes || '') : ''}</textarea>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // 标签
  let tags = recipe ? [...(recipe.tags || [])] : [];
  function renderTags() {
    const wrap = document.getElementById('tagWrap');
    wrap.querySelectorAll('.tag-pill').forEach(p => p.remove());
    tags.forEach((t, i) => {
      const pill = document.createElement('div');
      pill.className = 'tag-pill';
      pill.innerHTML = `${escapeHtml(t)} <span data-i="${i}">×</span>`;
      pill.querySelector('span').onclick = () => { tags.splice(i, 1); renderTags(); };
      wrap.insertBefore(pill, document.getElementById('tagInput'));
    });
  }
  document.getElementById('tagInput').onkeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = e.target.value.trim();
      if (val && !tags.includes(val)) { tags.push(val); e.target.value = ''; renderTags(); }
    }
  };
  renderTags();

  // 食材
  function addIngredientRow(val = '') {
    const div = document.createElement('div');
    div.className = 'ingredient-row';
    div.innerHTML = `<input class="input" placeholder="如:鸡蛋 3个" value="${escapeHtml(val)}"><button class="row-remove">×</button>`;
    div.querySelector('.row-remove').onclick = () => div.remove();
    document.getElementById('ingredientList').appendChild(div);
  }
  document.getElementById('addIngredientBtn').onclick = () => addIngredientRow();
  if (recipe && recipe.ingredients && recipe.ingredients.length) recipe.ingredients.forEach(i => addIngredientRow(i));
  else addIngredientRow();

  // 步骤
  function addStepRow(val = '') {
    const div = document.createElement('div');
    div.className = 'step-row';
    div.innerHTML = `<textarea class="textarea" placeholder="描述这一步..." style="min-height:70px">${escapeHtml(val)}</textarea><button class="row-remove">×</button>`;
    div.querySelector('.row-remove').onclick = () => div.remove();
    document.getElementById('stepList').appendChild(div);
  }
  document.getElementById('addStepBtn').onclick = () => addStepRow();
  if (recipe && recipe.steps && recipe.steps.length) recipe.steps.forEach(s => addStepRow(s));
  else addStepRow();

  // 保存
  document.getElementById('saveRecipeBtn').onclick = async () => {
    const name = document.getElementById('r_name').value.trim();
    if (!name) return toast('请输入菜名');

    const ingredients = [...document.querySelectorAll('#ingredientList .input')].map(i => i.value.trim()).filter(Boolean);
    const steps = [...document.querySelectorAll('#stepList .textarea')].map(s => s.value.trim()).filter(Boolean);

    const body = {
      name,
      image: document.getElementById('r_image').value.trim(),
      category: document.getElementById('r_category').value,
      difficulty: document.getElementById('r_difficulty').value,
      cook_time: document.getElementById('r_cook_time').value.trim(),
      servings: parseInt(document.getElementById('r_servings').value) || 2,
      tags,
      ingredients,
      steps,
      notes: document.getElementById('r_notes').value.trim()
    };

    try {
      if (isEdit) {
        await api(`/api/recipes/${recipe.id}`, { method: 'PUT', body: JSON.stringify(body) });
        toast('已更新');
      } else {
        await api('/api/recipes', { method: 'POST', body: JSON.stringify(body) });
        toast('已保存');
      }
      modal.remove();
      if (CURRENT_PAGE === 'cards') loadCardsData();
      else navigateTo('cards');
    } catch (e) { toast(e.message); }
  };
}

// ========== 启动 ==========
async function checkSession() {
  if (TOKEN) {
    try {
      CURRENT_USER = await api('/api/me');
      localStorage.setItem('user', JSON.stringify(CURRENT_USER));
    } catch (e) {
      TOKEN = '';
      localStorage.removeItem('token');
    }
  }
  render();
}

checkSession();
