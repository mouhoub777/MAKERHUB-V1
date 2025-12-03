// statistiques.js - MAKERHUB V1 Analytics
'use strict';

console.log('📊 MAKERHUB Analytics v1.0 loaded');

let auth = null;
let db = null;
let currentUser = null;
let mainChart = null;
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

  // Mobile menu
  document.getElementById('menuToggle')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('active');
  });
}

async function loadStatistics(days = 30) {
  try {
    // Load pages
    const pagesSnapshot = await db.collection('landingPages')
      .where('userId', '==', currentUser.uid)
      .get();

    let totalViews = 0;
    let totalConversions = 0;
    const topPages = [];

    pagesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      totalViews += data.views || 0;
      totalConversions += data.conversions || 0;
      topPages.push({ id: doc.id, ...data });
    });

    // Load sales
    const salesSnapshot = await db.collection('sales')
      .where('creatorId', '==', currentUser.uid)
      .orderBy('createdAt', 'desc')
      .get();

    let totalRevenue = 0;
    const dailyData = {};
    const endDate = new Date();
    const startDate = new Date(endDate - days * 24 * 60 * 60 * 1000);

    // Initialize daily data
    for (let i = 0; i < days; i++) {
      const date = new Date(endDate - i * 24 * 60 * 60 * 1000);
      const key = date.toISOString().split('T')[0];
      dailyData[key] = { views: 0, conversions: 0, revenue: 0 };
    }

    // Process sales
    salesSnapshot.docs.forEach(doc => {
      const sale = doc.data();
      const date = sale.createdAt?.toDate?.() || new Date(sale.createdAt);
      const key = date.toISOString().split('T')[0];
      
      totalRevenue += sale.amount || 0;
      
      if (dailyData[key]) {
        dailyData[key].conversions++;
        dailyData[key].revenue += sale.amount || 0;
      }
    });

    // Update stats cards
    const conversionRate = totalViews > 0 ? ((totalConversions / totalViews) * 100).toFixed(1) : 0;
    
    document.getElementById('totalViews').textContent = formatNumber(totalViews);
    document.getElementById('totalConversions').textContent = formatNumber(totalConversions);
    document.getElementById('conversionRate').textContent = conversionRate + '%';
    document.getElementById('totalRevenue').textContent = formatCurrency(totalRevenue);

    // Update charts
    updateCharts(dailyData, days);

    // Update top pages table
    updateTopPages(topPages);

  } catch (error) {
    console.error('❌ Load statistics error:', error);
    showToast('Failed to load statistics', 'error');
  }
}

function updateCharts(dailyData, days) {
  const labels = Object.keys(dailyData).sort().map(date => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });
  
  const conversions = Object.keys(dailyData).sort().map(key => dailyData[key].conversions);
  const revenue = Object.keys(dailyData).sort().map(key => dailyData[key].revenue);

  // Main chart (Conversions)
  const mainCtx = document.getElementById('mainChart')?.getContext('2d');
  if (mainCtx) {
    if (mainChart) mainChart.destroy();
    
    mainChart = new Chart(mainCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Conversions',
          data: conversions,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  }

  // Revenue chart
  const revenueCtx = document.getElementById('revenueChart')?.getContext('2d');
  if (revenueCtx) {
    if (revenueChart) revenueChart.destroy();
    
    revenueChart = new Chart(revenueCtx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Revenue',
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
          y: { beginAtZero: true }
        }
      }
    });
  }
}

function updateTopPages(pages) {
  const tbody = document.getElementById('topPagesBody');
  if (!tbody) return;

  // Sort by conversions
  const sorted = pages.sort((a, b) => (b.conversions || 0) - (a.conversions || 0)).slice(0, 10);

  if (sorted.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty">No pages yet</td></tr>';
    return;
  }

  tbody.innerHTML = sorted.map(page => {
    const rate = page.views > 0 ? ((page.conversions / page.views) * 100).toFixed(1) : 0;
    return `
      <tr>
        <td>
          <div class="page-name">
            <strong>${escapeHtml(page.brand || page.channelName)}</strong>
            <small>/${page.profileName}/${page.channelName}</small>
          </div>
        </td>
        <td>${formatNumber(page.views || 0)}</td>
        <td>${formatNumber(page.conversions || 0)}</td>
        <td>${rate}%</td>
        <td>-</td>
      </tr>
    `;
  }).join('');
}

// Helpers
function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function formatCurrency(amount, currency = 'EUR') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'check-circle'}"></i><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
