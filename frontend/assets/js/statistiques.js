// statistiques.js - MAKERHUB V1 Analytics
'use strict';

console.log('📊 MAKERHUB Analytics v1.0 loaded');

let auth = null;
let db = null;
let currentUser = null;
let clicksChart = null;
let revenueChart = null;

document.addEventListener('DOMContentLoaded', initializeStats);

function initializeStats() {
  const checkFirebase = setInterval(() => {
    if (window.firebaseAuth && window.firebaseDb) {
      clearInterval(checkFirebase);
      auth = window.firebaseAuth;
      db = window.firebaseDb;
      setupAuth();
      setupEventListeners();
    }
  }, 100);
}

function setupAuth() {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      currentUser = user;
      await loadStatistics(30);
      await loadLandingPages();
    } else {
      window.location.href = '/auth.html';
    }
  });
}

function setupEventListeners() {
  // Period filter
  document.getElementById('periodFilter')?.addEventListener('change', async (e) => {
    await loadStatistics(parseInt(e.target.value));
  });

  // Landing page filter
  document.getElementById('landingFilter')?.addEventListener('change', async (e) => {
    await loadStatistics(parseInt(document.getElementById('periodFilter')?.value || 30), e.target.value);
  });

  // Refresh button
  document.getElementById('refreshBtn')?.addEventListener('click', async () => {
    const days = parseInt(document.getElementById('periodFilter')?.value || 30);
    const pageFilter = document.getElementById('landingFilter')?.value || 'all';
    await loadStatistics(days, pageFilter);
    showToast('Statistics refreshed', 'success');
  });

  // Mobile menu
  document.getElementById('menuToggle')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('active');
  });
}

async function loadLandingPages() {
  try {
    const pagesSnapshot = await db.collection('landingPages')
      .where('creatorId', '==', currentUser.uid)
      .get();

    const select = document.getElementById('landingFilter');
    if (!select) return;

    // Keep "All Pages" option
    select.innerHTML = '<option value="all">All Pages</option>';

    pagesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const option = document.createElement('option');
      option.value = doc.id;
      option.textContent = data.brand || data.channelName || 'Untitled';
      select.appendChild(option);
    });

  } catch (error) {
    console.error('❌ Load landing pages error:', error);
  }
}

async function loadStatistics(days = 30, pageFilter = 'all') {
  try {
    showLoading(true);

    // ========================================
    // 1. Load Landing Pages
    // ========================================
    let pagesQuery = db.collection('landingPages')
      .where('creatorId', '==', currentUser.uid);

    const pagesSnapshot = await pagesQuery.get();

    let totalViews = 0;
    let totalClicks = 0;
    const topPages = [];
    const pageIds = [];

    pagesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      pageIds.push(doc.id);
      
      // Only count if matches filter
      if (pageFilter === 'all' || pageFilter === doc.id) {
        totalViews += data.viewCount || data.views || 0;
        totalClicks += data.clickCount || data.clicks || 0;
        topPages.push({ id: doc.id, ...data });
      }
    });

    // ========================================
    // 2. Load Sales (with camelCase fields)
    // ========================================
    let salesQuery = db.collection('sales')
      .where('creatorId', '==', currentUser.uid)
      .orderBy('createdAt', 'desc');

    const salesSnapshot = await salesQuery.get();

    let totalRevenue = 0;
    let totalSubscriptions = 0;
    const dailyData = {};
    const pageRevenue = {};
    const endDate = new Date();
    const startDate = new Date(endDate - days * 24 * 60 * 60 * 1000);

    // Initialize daily data
    for (let i = 0; i < days; i++) {
      const date = new Date(endDate - i * 24 * 60 * 60 * 1000);
      const key = date.toISOString().split('T')[0];
      dailyData[key] = { views: 0, clicks: 0, subscriptions: 0, revenue: 0 };
    }

    // Process sales
    salesSnapshot.docs.forEach(doc => {
      const sale = doc.data();
      const salePageId = sale.pageId || sale.page_id;
      
      // Filter by page if needed
      if (pageFilter !== 'all' && salePageId !== pageFilter) {
        return;
      }

      const date = sale.createdAt?.toDate?.() || new Date(sale.createdAt);
      const key = date.toISOString().split('T')[0];
      
      // Only count sales within the date range
      if (date >= startDate && date <= endDate) {
        const amount = sale.amount || 0;
        totalRevenue += amount;
        totalSubscriptions++;
        
        if (dailyData[key]) {
          dailyData[key].subscriptions++;
          dailyData[key].revenue += amount;
        }

        // Track revenue by page
        if (salePageId) {
          pageRevenue[salePageId] = (pageRevenue[salePageId] || 0) + amount;
        }
      }
    });

    // ========================================
    // 3. Update Stats Cards
    // ========================================
    const conversionRate = totalViews > 0 ? ((totalSubscriptions / totalViews) * 100).toFixed(1) : 0;
    const avgRevenue = totalSubscriptions > 0 ? (totalRevenue / totalSubscriptions) : 0;

    // ✅ Use correct HTML element IDs
    const totalViewsEl = document.getElementById('totalViews');
    const totalClicksEl = document.getElementById('totalClicks');
    const totalSubscriptionsEl = document.getElementById('totalSubscriptions');
    const conversionRateEl = document.getElementById('conversionRate');
    const totalRevenueEl = document.getElementById('totalRevenue');
    const avgRevenueEl = document.getElementById('avgRevenue');

    if (totalViewsEl) totalViewsEl.textContent = formatNumber(totalViews);
    if (totalClicksEl) totalClicksEl.textContent = formatNumber(totalClicks);
    if (totalSubscriptionsEl) totalSubscriptionsEl.textContent = formatNumber(totalSubscriptions);
    if (conversionRateEl) conversionRateEl.textContent = conversionRate + '%';
    if (totalRevenueEl) totalRevenueEl.textContent = formatCurrency(totalRevenue);
    if (avgRevenueEl) avgRevenueEl.textContent = formatCurrency(avgRevenue);

    // ========================================
    // 4. Update Charts
    // ========================================
    updateCharts(dailyData, days);

    // ========================================
    // 5. Update Top Pages Table
    // ========================================
    updateTopPages(topPages, pageRevenue);

    // Update page count
    const pagesCountEl = document.getElementById('pagesCount');
    if (pagesCountEl) {
      pagesCountEl.textContent = `${topPages.length} page${topPages.length !== 1 ? 's' : ''}`;
    }

    showLoading(false);

  } catch (error) {
    console.error('❌ Load statistics error:', error);
    showToast('Failed to load statistics: ' + error.message, 'error');
    showLoading(false);
  }
}

function updateCharts(dailyData, days) {
  const sortedKeys = Object.keys(dailyData).sort();
  
  const labels = sortedKeys.map(date => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });
  
  const subscriptions = sortedKeys.map(key => dailyData[key].subscriptions);
  const revenue = sortedKeys.map(key => dailyData[key].revenue);

  // Check if there's any data
  const hasData = subscriptions.some(v => v > 0) || revenue.some(v => v > 0);

  // ✅ Clicks/Subscriptions Chart (ID: clicksChart)
  const clicksCanvas = document.getElementById('clicksChart');
  const clicksPlaceholder = document.getElementById('clicksPlaceholder');
  
  if (clicksCanvas && hasData) {
    clicksCanvas.style.display = 'block';
    if (clicksPlaceholder) clicksPlaceholder.style.display = 'none';
    
    const ctx = clicksCanvas.getContext('2d');
    if (clicksChart) clicksChart.destroy();
    
    clicksChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Subscriptions',
          data: subscriptions,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { 
            beginAtZero: true,
            ticks: { stepSize: 1 }
          }
        }
      }
    });
  } else if (clicksCanvas) {
    clicksCanvas.style.display = 'none';
    if (clicksPlaceholder) clicksPlaceholder.style.display = 'flex';
  }

  // ✅ Revenue Chart (ID: revenueChart)
  const revenueCanvas = document.getElementById('revenueChart');
  const revenuePlaceholder = document.getElementById('revenuePlaceholder');
  
  if (revenueCanvas && revenue.some(v => v > 0)) {
    revenueCanvas.style.display = 'block';
    if (revenuePlaceholder) revenuePlaceholder.style.display = 'none';
    
    const ctx = revenueCanvas.getContext('2d');
    if (revenueChart) revenueChart.destroy();
    
    revenueChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Revenue (€)',
          data: revenue,
          backgroundColor: '#ffd600',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { 
            beginAtZero: true,
            ticks: {
              callback: value => '€' + value
            }
          }
        }
      }
    });
  } else if (revenueCanvas) {
    revenueCanvas.style.display = 'none';
    if (revenuePlaceholder) revenuePlaceholder.style.display = 'flex';
  }
}

function updateTopPages(pages, pageRevenue) {
  // ✅ Correct ID: linksTableBody
  const tbody = document.getElementById('linksTableBody');
  if (!tbody) return;

  // Add revenue to pages and sort
  const pagesWithRevenue = pages.map(page => ({
    ...page,
    revenue: pageRevenue[page.id] || 0
  }));

  // Sort by revenue (descending)
  const sorted = pagesWithRevenue
    .sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
    .slice(0, 10);

  if (sorted.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">
          <i class="fas fa-chart-line"></i>
          <span>No landing pages yet</span>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = sorted.map(page => {
    const views = page.viewCount || page.views || 0;
    const clicks = page.clickCount || page.clicks || 0;
    const subscriptions = page.subscriptionCount || page.conversions || 0;
    const rate = views > 0 ? ((subscriptions / views) * 100).toFixed(1) : 0;
    const revenue = page.revenue || 0;

    return `
      <tr>
        <td>
          <div class="page-info">
            <strong>${escapeHtml(page.brand || page.channelName || 'Untitled')}</strong>
            <small>/${escapeHtml(page.profileName || '')}/${escapeHtml(page.slug || page.channelSlug || '')}</small>
          </div>
        </td>
        <td>${formatNumber(views)}</td>
        <td>${formatNumber(clicks)}</td>
        <td>${formatNumber(subscriptions)}</td>
        <td>${rate}%</td>
        <td>${formatCurrency(revenue)}</td>
      </tr>
    `;
  }).join('');
}

// ========================================
// Helper Functions
// ========================================

function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function formatCurrency(amount, currency = 'EUR') {
  if (amount === null || amount === undefined) amount = 0;
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency
  }).format(amount);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showLoading(show) {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.style.display = show ? 'flex' : 'none';
  }
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icons = {
    success: 'fa-check-circle',
    error: 'fa-exclamation-circle',
    warning: 'fa-exclamation-triangle',
    info: 'fa-info-circle'
  };

  toast.innerHTML = `
    <i class="fas ${icons[type] || icons.info}"></i>
    <span>${escapeHtml(message)}</span>
  `;
  
  container.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}