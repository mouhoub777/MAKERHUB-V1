// Email Marketing - JavaScript Functionality
// MAKERHUB V1 - Collecte d'emails seulement (envoi désactivé)

// Email subscribers data - connect to your database
let allData = [];
let filteredData = [];

// Firebase initialization check
if (typeof firebase === 'undefined') {
  console.error('Firebase not loaded. Make sure to include Firebase scripts in emails.html');
}

// Source badge class mapping
function getSourceBadgeClass(source) {
  switch(source) {
    case "One-Time Purchase": return "source-onetime";
    case "Stripe Checkout": return "source-onetime";
    case "Telegram Subscriber": return "source-telegram";
    case "Live / Masterclass / Webinar": return "source-live";
    case "Lead Capture": return "source-lead";
    case "Scheduled Booking": return "source-booking";
    default: return "source-onetime";
  }
}

// Source icon mapping
function getSourceIcon(source) {
  switch(source) {
    case "One-Time Purchase": return "fas fa-shopping-cart";
    case "Stripe Checkout": return "fas fa-shopping-cart";
    case "Telegram Subscriber": return "fab fa-telegram-plane";
    case "Live / Masterclass / Webinar": return "fas fa-video";
    case "Lead Capture": return "fas fa-bullseye";
    case "Scheduled Booking": return "fas fa-calendar-check";
    default: return "fas fa-user";
  }
}

// Load emails from Firebase Firestore
async function loadEmailsFromFirebase() {
  try {
    // Check if user is authenticated
    const user = firebase.auth().currentUser;
    if (!user) {
      window.location.href = '/auth.html';
      return;
    }

    // V1: Load from collected_emails collection (emails collected via Stripe webhook)
    const emailsRef = firebase.firestore()
      .collection('collected_emails')
      .where('creatorId', '==', user.uid)
      .orderBy('createdAt', 'desc');

    const snapshot = await emailsRef.get();
    
    allData = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      allData.push({
        id: doc.id,
        firstName: data.customerName ? data.customerName.split(' ')[0] : 'N/A',
        email: data.email,
        source: data.source || 'Stripe Checkout',
        landingPageId: data.landingPageId || 'N/A',
        createdAt: data.createdAt,
        opens: data.opens || 0,
        clicks: data.clicks || 0
      });
    });

    // PAS DE DEMO DATA - Afficher directement les vrais emails
    filteredData = [...allData];
    renderTable();
    
  } catch (error) {
    console.error('Error loading emails:', error);
    // Show error message
    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; padding: 40px; color: var(--danger);">
          <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 16px; display: block;"></i>
          <div style="font-size: 16px; font-weight: 500; margin-bottom: 8px;">Error loading emails</div>
          <div style="font-size: 14px;">${error.message}</div>
        </td>
      </tr>
    `;
  }
}

// Render table with filtered data
function renderTable() {
  const tableBody = document.getElementById('tableBody');
  
  if (filteredData.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; padding: 40px; color: var(--text-tertiary);">
          <i class="fas fa-inbox" style="font-size: 48px; margin-bottom: 16px; display: block;"></i>
          <div style="font-size: 16px; font-weight: 500; margin-bottom: 8px;">Aucun email collecté</div>
          <div style="font-size: 14px;">Les emails seront collectés automatiquement après chaque paiement Stripe</div>
        </td>
      </tr>
    `;
    updateStats();
    return;
  }
  
  tableBody.innerHTML = '';
  
  filteredData.forEach((subscriber, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="checkbox-cell">
        <input type="checkbox" class="subscriber-checkbox" value="${index}" onchange="updateSelectedCount()">
      </td>
      <td>${subscriber.firstName}</td>
      <td>${subscriber.email}</td>
      <td>
        <span class="source-badge ${getSourceBadgeClass(subscriber.source)}">
          <i class="${getSourceIcon(subscriber.source)}"></i>
          ${subscriber.source}
        </span>
      </td>
    `;
    tableBody.appendChild(row);
  });
  
  updateStats();
}

// Toggle select all checkboxes
function toggleSelectAll() {
  const selectAll = document.getElementById('selectAll');
  const checkboxes = document.querySelectorAll('.subscriber-checkbox');
  
  checkboxes.forEach(checkbox => {
    checkbox.checked = selectAll.checked;
  });
  
  updateSelectedCount();
}

// Update selected count and button state
function updateSelectedCount() {
  const checkboxes = document.querySelectorAll('.subscriber-checkbox');
  const selectedCheckboxes = document.querySelectorAll('.subscriber-checkbox:checked');
  const count = selectedCheckboxes.length;
  
  document.getElementById('selectedCount').textContent = count;
  document.getElementById('selectedDisplay').textContent = `${count} selected`;
  document.getElementById('sendEmailBtn').disabled = count === 0;
  
  // Update select all checkbox state
  const selectAll = document.getElementById('selectAll');
  if (count === 0) {
    selectAll.indeterminate = false;
    selectAll.checked = false;
  } else if (count === checkboxes.length) {
    selectAll.indeterminate = false;
    selectAll.checked = true;
  } else {
    selectAll.indeterminate = true;
  }
}

// Update statistics
function updateStats() {
  document.getElementById('totalSubscribers').textContent = allData.length;
  document.getElementById('filteredCount').textContent = filteredData.length;
}

// V1: Send email functionality disabled - export CSV instead
function sendEmailToSelected() {
  const selectedCheckboxes = document.querySelectorAll('.subscriber-checkbox:checked');
  
  if (selectedCheckboxes.length === 0) {
    alert('Please select at least one email to export.');
    return;
  }
  
  // Show V1 message
  const choice = confirm(
    '📧 Email campaigns will be available in V2!\n\n' +
    'The SMTP system is ready but not deployed in this version.\n\n' +
    'Would you like to export the selected emails as CSV instead?'
  );
  
  if (choice) {
    exportSelectedEmails();
  }
}

// Export selected emails to CSV
function exportSelectedEmails() {
  const selectedCheckboxes = document.querySelectorAll('.subscriber-checkbox:checked');
  const selectedData = [];
  
  selectedCheckboxes.forEach(checkbox => {
    const index = parseInt(checkbox.value);
    selectedData.push(filteredData[index]);
  });
  
  if (selectedData.length === 0) {
    alert('No emails selected for export');
    return;
  }
  
  // Create CSV content
  const csvHeaders = ['First Name', 'Email', 'Source', 'Landing Page', 'Date Collected', 'Opens', 'Clicks'];
  const csvRows = selectedData.map(subscriber => [
    subscriber.firstName || '',
    subscriber.email,
    subscriber.source,
    subscriber.landingPageId,
    subscriber.createdAt ? new Date(subscriber.createdAt.toDate ? subscriber.createdAt.toDate() : subscriber.createdAt).toLocaleDateString() : '',
    subscriber.opens || 0,
    subscriber.clicks || 0
  ]);
  
  // Combine headers and rows
  const csvContent = [
    csvHeaders,
    ...csvRows
  ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  
  // Create and download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `makerhub-emails-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
  
  alert(`✅ Successfully exported ${selectedData.length} email${selectedData.length > 1 ? 's' : ''} to CSV!`);
}

// Export all emails
function exportAllEmails() {
  if (allData.length === 0) {
    alert('No emails to export');
    return;
  }
  
  // Select all emails programmatically
  const checkboxes = document.querySelectorAll('.subscriber-checkbox');
  checkboxes.forEach(checkbox => checkbox.checked = true);
  updateSelectedCount();
  
  // Export
  exportSelectedEmails();
  
  // Deselect all
  checkboxes.forEach(checkbox => checkbox.checked = false);
  updateSelectedCount();
}

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
  // Check Firebase auth state
  if (typeof firebase !== 'undefined' && firebase.auth) {
    firebase.auth().onAuthStateChanged(function(user) {
      if (user) {
        console.log('User authenticated:', user.email);
        loadEmailsFromFirebase();
      } else {
        console.log('No user authenticated, redirecting to login');
        window.location.href = '/auth.html';
      }
    });
  } else {
    console.error('Firebase Auth not initialized');
    // PAS DE DEMO DATA - Afficher message d'erreur
    const tableBody = document.getElementById('tableBody');
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; padding: 40px; color: var(--danger);">
            <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 16px; display: block;"></i>
            <div style="font-size: 16px; font-weight: 500; margin-bottom: 8px;">Firebase non initialisé</div>
            <div style="font-size: 14px;">Veuillez rafraîchir la page ou vérifier la configuration</div>
          </td>
        </tr>
      `;
    }
  }
  
  // Initialize sidebar links
  const sidebarLinks = document.querySelectorAll('.sidebar-link');
  sidebarLinks.forEach(link => {
    link.onclick = (e) => {
      e.preventDefault();
      window.location.href = link.getAttribute('href');
    };
  });
});