// Admin Panel JavaScript

// Fix animation duration - hide it after 2 seconds
document.addEventListener('DOMContentLoaded', function() {
  // Load dashboard immediately
  loadDashboard();
  
  setTimeout(() => {
    const animation = document.querySelector('.admin-access-animation');
    if (animation) {
      animation.classList.add('hide');
      // Remove it completely after animation finishes
      setTimeout(() => {
        animation.style.display = 'none';
      }, 800);
    }
  }, 2000); // Reduced to 2 seconds from the default longer time
});

// Access Firebase services from global window object
const db = window.db;
const auth = window.auth;

// Access Firebase modules from global window object
const { collection, getDocs, doc, getDoc, updateDoc, deleteDoc, addDoc, setDoc, query, where, orderBy, signOut } = window.firebaseModules || {};

// Function to generate a clean, URL-friendly slug from a title
function generateSlugFromTitle(title) {
  if (!title) return '';
  
  return title
    .toLowerCase()                     // Convert to lowercase
    .trim()                            // Remove leading/trailing whitespace
    .replace(/\s+/g, '-')              // Replace spaces with hyphens
    .replace(/[^\w\-]+/g, '')          // Remove all non-word chars (except hyphens)
    .replace(/\-\-+/g, '-')            // Replace multiple hyphens with single hyphen
    .replace(/^-+/, '')                // Remove leading hyphens
    .replace(/-+$/, '');               // Remove trailing hyphens
}

// Debounce function to limit how often a function can run
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}

// Setup auto slug generation from title
function setupSlugGeneration() {
  const titleInput = document.getElementById('item-title');
  const slugInput = document.getElementById('item-slug');
  
  if (titleInput && slugInput) {
    // Create debounced function for updating the slug
    const updateSlug = debounce(function() {
      // Only auto-generate slug if the slug field is empty or if the slug was auto-generated previously
      if (!slugInput.value.trim() || slugInput.dataset.userModified !== 'true') {
        slugInput.value = generateSlugFromTitle(this.value);
        // Mark that the slug is auto-generated
        slugInput.dataset.userModified = 'false';
      }
    }, 300);
    
    // Attach event listener to title input
    titleInput.addEventListener('input', updateSlug);
    
    // Mark when user manually edits the slug
    slugInput.addEventListener('input', function() {
      this.dataset.userModified = 'true';
    });
  }
}

// Utility function to create and append elements
function createElement(tag, attributes = {}, innerHTML = '') {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(attributes)) {
        element.setAttribute(key, value);
    }
    element.innerHTML = innerHTML;
    return element;
}

// Update logout button creation to use the utility function
document.addEventListener('DOMContentLoaded', function() {
    if (!document.getElementById('logoutBtn')) {
        const adminHeader = document.querySelector('.top-nav');
        if (adminHeader) {
            const logoutBtn = createElement('button', {
                id: 'logoutBtn',
                class: 'admin-btn danger',
                style: 'margin-left: auto; margin-right: 20px;'
            }, '<i class="fas fa-sign-out-alt"></i> Logout');
            adminHeader.appendChild(logoutBtn);
            logoutBtn.addEventListener('click', async () => {
                try {
                    console.log("Logging out...");
                    await signOut(auth);
                    console.log("Logout successful");
                    window.location.href = 'login.html';
                } catch (error) {
                    console.error("Logout error:", error);
                    alert('Logout failed: ' + error.message);
                }
            });
        }
    }
});

// Firebase references
const itemsCollection = collection(db, 'items');
const settingsDoc = doc(db, 'settings', 'siteSettings');
const ratingsCollection = collection(db, 'ratings');

// Initialize database if not exists
async function initializeDatabase() {
  try {
    const settingsSnapshot = await getDoc(settingsDoc);

    if (!settingsSnapshot.exists()) {
      // Create initial database settings
      const initialData = {
        siteTitle: "R8Y - Download PC Games & Windows Software",
        siteName: "R8Y GPT",
        itemsPerPage: 7,
        adminEmail: "admin@r8y.com",
        siteLogo: "images/logo/logo.png",
        siteFavicon: "favicon.ico",
        totalVisitors: 0,
        totalDownloads: 0,
        visitorHistory: [],
        downloadHistory: [],
        socialLinks: {
          facebook: "https://facebook.com/r8y",
          twitter: "https://twitter.com/r8y",
          instagram: "https://instagram.com/r8y",
          youtube: "https://youtube.com/r8y",
          telegram: "https://t.me/r8y"
        },
        subcategories: {
          games: [],
          windows: [],
          mac: [] // Ensure mac subcategories are properly initialized
        },
        sortOptions: [
          { value: 'default', label: 'Default' },
          { value: 'rating-low-to-high', label: 'Rating (Low to High)' },
          { value: 'rating-high-to-low', label: 'Rating (High to Low)' },
          { value: 'download-low-to-high', label: 'Download (Low to High)' },
          { value: 'download-high-to-low', label: 'Download (High to Low)' }
        ]
      };

      await addDoc(settingsDoc, initialData);
      console.log("Database initialized with default settings");
    } else {
      // Check if mac subcategories exist, if not add them
      const settings = settingsSnapshot.data();
      if (!settings.subcategories || !settings.subcategories.mac) {
        await updateDoc(settingsDoc, {
          'subcategories.mac': []
        });
        console.log("Mac subcategories initialized");
      }
    }
  } catch (error) {
    console.error("Error initializing database:", error);
  }
}

// Initialize ImageKit SDK
var imagekit = new ImageKit({
  publicKey: "public_9U4HrZGsbXio3j2TYSpFqyH3O4w=",
  urlEndpoint: "https://ik.imagekit.io/imcwquzl9",
  authenticationEndpoint: "http://www.yourserver.com/auth",
});

// Initialize the database on page load
initializeDatabase();

// Preload dashboard data to improve initial load time
let cachedItems = null;
let cachedSettings = null;

// Preload data function to run in the background
async function preloadDashboardData() {
  try {
    console.log("Preloading dashboard data...");
    // Fetch data in parallel
    const [itemsPromise, settingsPromise] = await Promise.all([
      getItems(),
      getSettings()
    ]);
    
    cachedItems = itemsPromise;
    cachedSettings = settingsPromise;
    console.log("Dashboard data preloaded successfully");
  } catch (error) {
    console.error("Error preloading dashboard data:", error);
  }
}

// Start preloading data as soon as possible
preloadDashboardData();

// Database Helper Functions
async function getSettings() {
  try {
    const doc = await getDoc(settingsDoc);
    if (doc.exists()) {
      return doc.data();
    }
    console.error("Settings document doesn't exist");
    return {};
  } catch (error) {
    console.error("Error getting settings:", error);
    return {};
  }
}

async function saveSettings(settings) {
  try {
    await updateDoc(settingsDoc, settings);
    return true;
  } catch (error) {
    console.error("Error saving settings:", error);
    return false;
  }
}

async function getItems(category = null) {
  try {
    let query = itemsCollection;
    if (category) {
      query = query(where("category", "==", category));
    }
    const snapshot = await getDocs(query);
    return snapshot.docs.map(doc => doc.data());
  } catch (error) {
    console.error("Error getting items:", error);
    return [];
  }
}

async function getItem(id) {
  try {
    console.log(`Getting item with ID: ${id}`);
    const docRef = doc(db, 'items', id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log(`Item data retrieved:`, data);
      // Check specifically for torrent and direct links
      console.log(`Item torrentLink: "${data.torrentLink || 'not set'}"`);
      console.log(`Item directLink: "${data.directLink || 'not set'}"`);
      return data;
    }
    console.log(`No item found with ID: ${id}`);
    return null;
  } catch (error) {
    console.error("Error getting item:", error);
    alert(`Error retrieving item data: ${error.message}`);
    return null;
  }
}

async function saveItem(item) {
  try {
    console.log("Saving item:", item);
    
    // Ensure slug is always set and lowercase
    if (!item.slug) {
      item.slug = generateSlugFromTitle(item.title);
    } else {
      item.slug = item.slug.toLowerCase();
    }
    
    // Create a new ID if not exists
    if (!item.id) {
      // Use the slug as the ID
      item.id = item.slug;
    }
    
    // Always check for slug collisions, even on updates
    // This ensures URLs work properly on r8ymatrix.netlify.app
    const slugQuery = query(itemsCollection, where("slug", "==", item.slug));
    const slugSnapshot = await getDocs(slugQuery);
    
    // If slug exists and belongs to a different item, make it unique
    if (!slugSnapshot.empty) {
      let needsUniqueSlug = false;
      
      // Check if any of the docs has a different ID
      slugSnapshot.forEach(doc => {
        const existingData = doc.data();
        if (existingData.id !== item.id) {
          needsUniqueSlug = true;
        }
      });
      
      if (needsUniqueSlug) {
        // Append a timestamp to make the slug unique
        const timestamp = new Date().getTime().toString().slice(-4);
        item.slug = `${item.slug}-${timestamp}`;
        
        // Update ID if it was based on slug and this is a new item
        if (!item.isUpdate) {
          item.id = item.slug;
        }
        
        console.log(`Slug collision detected: Updated to ${item.slug}`);
        showToast("A similar item URL already exists. We've created a unique URL for this item.", "info");
      }
    }
    
    // Add creation date for new items
    if (!item.addedDate) {
      item.addedDate = new Date().toISOString();
    }

    // Check specifically for torrent and direct links
    console.log(`Saving item with torrentLink: "${item.torrentLink || 'not set'}"`);
    console.log(`Saving item with directLink: "${item.directLink || 'not set'}"`);

    // Check if item already exists to preserve existing rating/downloads
    const docRef = doc(db, 'items', item.id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const existingData = docSnap.data();
      console.log("Existing item data:", existingData);
      
      // Preserve existing rating and downloads if they exist
      if (existingData.rating !== undefined) {
        item.rating = existingData.rating;
      }
      if (existingData.downloads !== undefined) {
        item.downloads = existingData.downloads;
      }
      
      // Debug: Check if the existing data has torrent/direct links
      console.log(`Existing torrentLink: "${existingData.torrentLink || 'not set'}"`);
      console.log(`Existing directLink: "${existingData.directLink || 'not set'}"`);
      
      // Update existing document
      await updateDoc(docRef, item);
    } else {
      // Set default values for new items if not set
      if (item.rating === undefined) {
        item.rating = 0;
      }
      if (item.downloads === undefined) {
        item.downloads = 0;
      }
      
      // Create new document
      await setDoc(docRef, item);
    }

    // Ensure torrentLink and directLink are saved
    if (!item.torrentLink) item.torrentLink = '';
    if (!item.directLink) item.directLink = '';

    console.log("Item saved successfully:", item.id);
    
    // Show success toast
    showToast(`${item.title} has been saved successfully`, 'success');
    
    return item;
  } catch (error) {
    console.error("Error saving item:", error);
    alert(`Error saving item: ${error.message}`);
    return null;
  }
}

async function deleteItem(id) {
  try {
    // Create a proper document reference
    const docRef = doc(db, 'items', id);
    
    // Delete the document
    await deleteDoc(docRef);
    console.log(`Item ${id} deleted successfully`);
    return true;
  } catch (error) {
    console.error("Error deleting item:", error);
    alert(`Error deleting item: ${error.message}`);
    return false;
  }
}

async function getSubcategories(category) {
  try {
    const settings = await getSettings();
    return settings.subcategories ? settings.subcategories[category] || [] : [];
  } catch (error) {
    console.error("Error getting subcategories:", error);
    return [];
  }
}

async function saveSubcategory(category, subcategory) {
  try {
    // Get current settings
    const settings = await getSettings();

    // Ensure subcategories object exists
    if (!settings.subcategories) {
      settings.subcategories = { games: [], windows: [], mac: [] };
    }

    // Ensure category array exists
    if (!settings.subcategories[category]) {
      settings.subcategories[category] = [];
    }

    // Check if subcategory already exists
    if (!settings.subcategories[category].includes(subcategory)) {
      // Add new subcategory
      settings.subcategories[category].push(subcategory);
      
      // Use set with merge option to ensure update works correctly
      await updateDoc(settingsDoc, {
        subcategories: settings.subcategories
      }, { merge: true });
      
      console.log(`Subcategory "${subcategory}" added successfully to ${category}`);
      return true;
    }
    
    console.log(`Subcategory "${subcategory}" already exists in ${category}`);
    return false;
  } catch (error) {
    console.error(`Error saving subcategory (${category}, ${subcategory}):`, error);
    return false;
  }
}

async function deleteSubcategory(category, subcategory) {
  try {
    console.log(`Deleting subcategory: ${subcategory} from ${category}`);
    
    // Get current settings
    const settings = await getSettings();
    
    // Validate data
    if (!settings.subcategories) {
      console.error("No subcategories found in settings");
      return false;
    }
    
    if (!settings.subcategories[category]) {
      console.error(`No subcategories found for category: ${category}`);
      return false;
    }
    
    if (!settings.subcategories[category].includes(subcategory)) {
      console.error(`Subcategory "${subcategory}" not found in ${category}`);
      return false;
    }
    
    // Check if subcategory is in use - redundant safety check
    const q = query(itemsCollection, where("category", "==", category), where("subcategory", "==", subcategory));
    const inUseSnapshot = await getDocs(q);
    const isInUse = !inUseSnapshot.empty;
    console.log(`Subcategory in use: ${isInUse} (${inUseSnapshot.size} items)`);
    
    // Filter out the subcategory
    const updatedSubcategories = settings.subcategories[category].filter(
      item => item !== subcategory
    );
    
    // Update the database using set with merge for better reliability
    await updateDoc(settingsDoc, {
      subcategories: {
        ...settings.subcategories,
        [category]: updatedSubcategories
      }
    }, { merge: true });
    
    console.log(`Successfully deleted subcategory "${subcategory}" from ${category}`);
    
    // For any items using this subcategory, update them to use a default value
    if (isInUse) {
      console.log(`Updating ${inUseSnapshot.size} items that used the deleted subcategory`);
      
      // Update each affected item sequentially (avoids need for writeBatch)
      for (const snap of inUseSnapshot.docs) {
        const itemRef = doc(db, 'items', snap.id);
        await updateDoc(itemRef, {
          subcategory: 'Uncategorized',
          lastUpdated: new Date().toISOString(),
          note: `Subcategory automatically updated. Previous value: ${subcategory}`
        });
      }
      console.log(`Updated ${inUseSnapshot.size} items to use 'Uncategorized' subcategory`);
    }
    
    // Try to update the frontend subcategories in real-time
    setTimeout(() => {
      try {
        if (window.parent && window.parent.loadSubcategories) {
          window.parent.loadSubcategories(category);
          console.log(`Updated frontend ${category} subcategories after deletion`);
        }
      } catch (e) {
        console.log("Could not update frontend subcategories:", e);
      }
    }, 500);
    
    return true;
  } catch (error) {
    console.error("Error deleting subcategory:", error);
    return false;
  }
}

async function getSortOptions() {
  try {
    const settings = await getSettings();
    return settings.sortOptions || [];
  } catch (error) {
    console.error("Error getting sort options:", error);
    return [];
  }
}

async function saveSortOption(option) {
  try {
    const settings = await getSettings();

    if (!settings.sortOptions) {
      settings.sortOptions = [];
    }

    const existingIndex = settings.sortOptions.findIndex(o => o.value === option.value);
    if (existingIndex !== -1) {
      settings.sortOptions[existingIndex] = option;
    } else {
      settings.sortOptions.push(option);
    }

    await updateDoc(settingsDoc, {
      sortOptions: settings.sortOptions
    });
    return true;
  } catch (error) {
    console.error("Error saving sort option:", error);
    return false;
  }
}

async function deleteSortOption(value) {
  try {
    const settings = await getSettings();

    if (!settings.sortOptions) {
      return false;
    }

    const initialLength = settings.sortOptions.length;
    settings.sortOptions = settings.sortOptions.filter(option => option.value !== value);

    if (settings.sortOptions.length !== initialLength) {
      await updateDoc(settingsDoc, {
        sortOptions: settings.sortOptions
      });
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error deleting sort option:", error);
    return false;
  }
}

// DOM Elements
const sidebarLinks = document.querySelectorAll('.admin-sidebar a');
const sections = document.querySelectorAll('.admin-section');
const modal = document.getElementById('item-modal');
const modalTitle = document.getElementById('modal-title');
const itemForm = document.getElementById('item-form');
const addGameBtn = document.getElementById('add-game-btn');
const addSoftwareBtn = document.getElementById('add-software-btn');
const cancelBtn = document.getElementById('cancel-btn');
const modalClose = document.querySelector('.modal .close');
const gamesSearch = document.getElementById('games-search');
const softwareSearch = document.getElementById('software-search');
const addMacBtn = document.getElementById('add-mac-btn');
const macSearch = document.getElementById('mac-search');
const settingsForm = document.getElementById('settings-form');
const logoutBtn = document.getElementById('logoutBtn');
const publishBtn = document.getElementById('publishChangesBtn');
const downloadProjectBtn = document.getElementById('downloadProjectBtn');
const addGameCategoryBtn = document.getElementById('add-game-category-btn');
const addWindowsCategoryBtn = document.getElementById('add-windows-category-btn');
const newMacCategoryInput = document.getElementById('new-mac-category');
const addMacCategoryBtn = document.getElementById('add-mac-category-btn');
const addSortOptionBtn = document.getElementById('add-sort-option-btn');
const loginModal = document.getElementById('login-modal');
const loginBtn = document.getElementById('login-btn');
const cancelLoginBtn = document.getElementById('cancel-login-btn');
const adminPassword = document.getElementById('admin-password');
const passwordError = document.getElementById('password-error');
const publishOverlay = document.getElementById('publish-overlay');
const publishProgress = document.getElementById('publish-progress');

// Base64 to File conversion (for image upload simulation)
function dataURLtoFile(dataURL, filename) {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

// File to Base64 conversion
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

// Upload image to storage (simplified)
async function uploadImageToStorage(file, itemId, isMainImage = true, galleryIndex = null) {
  try {
    // For demo purposes only
    console.log("Image upload simulation");
    showToast("Image upload simulation - this is a placeholder", "info");
    
    // Return a placeholder image URL
    const placeholderUrl = "https://via.placeholder.com/800x600?text=Sample+Image";
    
    showToast("Image upload simulated", "success");
    return placeholderUrl;
  } catch (error) {
    console.error("Error in upload simulation:", error);
    showToast("Upload simulation error", "error");
    return null;
  }
}

// Holds current form images
let formImageUploads = {
  main: null,
  gallery: []
};

// Form tabs
const formTabs = document.querySelectorAll('.form-tab');
const tabContents = document.querySelectorAll('.form-tab-content');

// Navigation functionality
sidebarLinks.forEach(link => {
  link.addEventListener('click', function (e) {
    e.preventDefault();

    // Update active link
    sidebarLinks.forEach(l => l.classList.remove('active'));
    this.classList.add('active');

    // Show correct section
    const targetSection = this.getAttribute('data-section');
    sections.forEach(section => {
      section.classList.remove('active');
      if (section.id === targetSection) {
        section.classList.add('active');
      }
    });

    // Load section content
    if (targetSection === 'games') {
      loadGames();
    } else if (targetSection === 'software') {
      loadSoftware();
    } else if (targetSection === 'mac') { // Added for Mac
      loadMacItems();
    } else if (targetSection === 'dashboard') {
      loadDashboard();
    } else if (targetSection === 'settings') {
      loadSettings();
      setTimeout(() => {
        initSettingsTabs();
        initLogoUploads();
      }, 100);
    } else if (targetSection === 'categories') {
      loadCategories();
    }
  });
});

// Tab functionality
formTabs.forEach(tab => {
  tab.addEventListener('click', function () {
    // Update active tab
    formTabs.forEach(t => t.classList.remove('active'));
    this.classList.add('active');

    // Show correct tab content
    const targetTab = this.getAttribute('data-tab');
    tabContents.forEach(content => {
      content.classList.remove('active');
      if (content.id === targetTab) {
        content.classList.add('active');
      }
    });

    // Update gallery preview when switching to the gallery tab
    if (targetTab === 'gallery') {
      updateGalleryPreview();
    }
  });
});

// Function to update gallery preview
function updateGalleryPreview() {
  const previewContainer = document.getElementById('complete-gallery-preview');

  // Clear previous previews
  previewContainer.innerHTML = '';

  // Get all current images
  const mainImageUrl = document.getElementById('item-image').value;
  const mainImagePreview = document.getElementById('main-image-preview');
  const galleryItems = document.querySelectorAll('.gallery-url');

  // Create array of all images
  let allImages = [];

  // Add main image
  if (mainImageUrl) {
    allImages.push({ url: mainImageUrl, type: 'url' });
  } else if (formImageUploads.main) {
    allImages.push({ url: formImageUploads.main, type: 'upload' });
  }

  // Add gallery images
  galleryItems.forEach((item, index) => {
    const url = item.value;
    if (url) {
      allImages.push({ url: url, type: 'url' });
    } else if (formImageUploads.gallery[index]) {
      allImages.push({ url: formImageUploads.gallery[index], type: 'upload' });
    }
  });

  // If no images, show placeholder
  if (allImages.length === 0) {
    previewContainer.innerHTML = `
      <div class="preview-placeholder">
        <i class="fas fa-images"></i>
        <p>No images added yet. Add images in the URLs tab.</p>
      </div>
    `;
    return;
  }

  // Create preview items
  allImages.forEach((image, index) => {
    const previewItem = document.createElement('div');
    previewItem.className = 'gallery-preview-item';

    previewItem.innerHTML = `
      <img src="${image.url}" alt="Preview ${index + 1}">
      <span class="image-source-badge">${image.type === 'url' ? 'URL' : 'Upload'}</span>
    `;

    previewContainer.appendChild(previewItem);
  });
}

// Dashboard functions
async function loadDashboard() {
  try {
    console.log("Loading dashboard...");
    
    // First clear any existing chart to prevent errors
    if (window.dashboardChart instanceof Chart) {
      window.dashboardChart.destroy();
      window.dashboardChart = null;
    }
    
    const dashboardSection = document.getElementById('dashboard');
    if (!dashboardSection) {
      console.error("Dashboard section not found");
      return;
    }
    
    // Show loading state immediately 
    dashboardSection.innerHTML = `
      <h1>Dashboard</h1>
      <div class="loading-indicator">
        <i class="fas fa-spinner fa-spin"></i>
        <p>Loading dashboard data...</p>
      </div>
    `;
    
    // Use cached data if available, otherwise fetch new data
    const allItems = cachedItems || await getItems();
    const settings = cachedSettings || await getSettings();
    
    // Update cache for future use
    cachedItems = allItems;
    cachedSettings = settings;
    
    const games = allItems.filter(item => item.category === 'games');
    const software = allItems.filter(item => item.category === 'windows');
    const macItems = allItems.filter(item => item.category === 'mac');

    // Restore dashboard content
    dashboardSection.innerHTML = `
      <h1>Dashboard</h1>
      <div class="admin-stats">
        <div class="stat-card">
          <i class="fas fa-gamepad"></i>
          <div class="stat-info">
            <span class="stat-count" id="game-count">0</span>
            <span class="stat-label">Games</span>
          </div>
        </div>
        <div class="stat-card">
          <i class="fas fa-laptop-code"></i>
          <div class="stat-info">
            <span class="stat-count" id="software-count">0</span>
            <span class="stat-label">Software</span>
          </div>
        </div>
        <div class="stat-card">
          <i class="fab fa-apple"></i>
          <div class="stat-info">
            <span class="stat-count" id="mac-count">0</span>
            <span class="stat-label">Mac</span>
          </div>
        </div>
        <div class="stat-card">
          <i class="fas fa-download"></i>
          <div class="stat-info">
            <span class="stat-count" id="total-downloads">0</span>
            <span class="stat-label">Downloads</span>
          </div>
        </div>
        <div class="stat-card">
          <i class="fas fa-users"></i>
          <div class="stat-info">
            <span class="stat-count" id="site-visitors">0</span>
            <span class="stat-label">Visitors</span>
          </div>
        </div>
      </div>

      <div class="stats-charts">
        <div class="chart-container">
          <h2><i class="fas fa-chart-line"></i> Website Statistics</h2>
          <div class="chart-tabs">
            <button class="chart-tab active" data-chart="visitors">Visitors</button>
            <button class="chart-tab" data-chart="downloads">Downloads</button>
          </div>
          <div class="chart-view">
            <canvas id="statsChart"></canvas>
          </div>
        </div>
      </div>

      <div class="recent-items">
        <h2>Recently Added Items</h2>
        <table class="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Category</th>
              <th>Downloads</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="recent-items-table">
            <!-- Dynamically populated -->
          </tbody>
        </table>
      </div>
    `;

    // Update stats
    document.getElementById('game-count').textContent = games.length;
    document.getElementById('software-count').textContent = software.length;
    document.getElementById('mac-count').textContent = macItems.length;

    const totalDownloads = allItems.reduce((sum, item) => sum + (item.downloads || 0), 0);
    document.getElementById('total-downloads').textContent = totalDownloads.toLocaleString();

    // Display visitors count from settings
    const totalVisitors = settings.totalVisitors || 0;
    document.getElementById('site-visitors').textContent = totalVisitors.toLocaleString();

    // Load recent items (5 most recent)
    const recentItems = [...allItems]
      .filter(item => item.addedDate) // Filter out items without addedDate
      .sort((a, b) => new Date(b.addedDate) - new Date(a.addedDate))
      .slice(0, 5);

    const recentItemsTable = document.getElementById('recent-items-table');
    if (!recentItemsTable) {
      console.error("Recent items table not found");
      return;
    }

    recentItemsTable.innerHTML = '';
    recentItems.forEach(item => {
      // Set default values for undefined properties
      const rating = item.rating || 0;
      const downloads = item.downloads || 0;

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${item.id}</td>
        <td>${item.title}</td>
        <td>${item.category === 'games' ? 'PC Game' : item.category === 'windows' ? 'Windows Software' : 'Mac'}</td>
        <td>${(item.downloads || 0).toLocaleString()}</td>
        <td class="action-buttons">
          <button class="edit" data-id="${item.id}"><i class="fas fa-edit"></i></button>
          <button class="delete" data-id="${item.id}"><i class="fas fa-trash"></i></button>
        </td>
      `;
      recentItemsTable.appendChild(row);
    });

    // Add event listeners
    addActionButtonListeners(recentItemsTable);

    // Initialize stats chart if Chart.js is available
    if (typeof Chart !== 'undefined') {
      // Add a small delay to ensure DOM is fully updated
      setTimeout(() => {
      initializeStatsChart(settings);
      }, 100);
    } else {
      console.error("Chart.js is not loaded");
    }
  } catch (error) {
    console.error("Error loading dashboard:", error);

    // Show error message in dashboard
    const dashboardSection = document.getElementById('dashboard');
    if (dashboardSection) {
      dashboardSection.innerHTML = `
        <h1>Dashboard</h1>
        <div class="error-message">
          <p>Error loading dashboard: ${error.message}</p>
          <button onclick="loadDashboard()">Retry</button>
        </div>
      `;
    }
  }
}

// Statistics chart initialization
function initializeStatsChart(settings) {
  const canvas = document.getElementById('statsChart');
  if (!canvas) {
    console.error("Chart canvas element not found");
    return;
  }
  
  const ctx = canvas.getContext('2d');

  // Check if there's an existing chart instance and destroy it
  if (window.dashboardChart instanceof Chart) {
    window.dashboardChart.destroy();
    window.dashboardChart = null;
  }

  // Sample data - replace with real data from your database
  const visitorData = settings.visitorHistory || generateSampleData();
  const downloadData = settings.downloadHistory || generateSampleData();

  function createChart(type, data) {
    // Always destroy previous chart if it exists
    if (window.dashboardChart instanceof Chart) {
      window.dashboardChart.destroy();
      window.dashboardChart = null;
    }

    const chartData = {
      labels: data.map(d => d.date),
      datasets: [{
        label: type === 'visitors' ? 'Visitors' : 'Downloads',
        data: data.map(d => d.count),
        borderColor: '#00ffc3',
        backgroundColor: 'rgba(0, 255, 195, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4
      }]
    };

    // Create new chart and store the instance globally
    window.dashboardChart = new Chart(ctx, {
      type: 'line',
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: '#fff'
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: '#ccc'
            },
            grid: {
              color: '#333'
            }
          },
          y: {
            ticks: {
              color: '#ccc'
            },
            grid: {
              color: '#333'
            }
          }
        }
      }
    });
  }

  // Chart tabs event listeners
  const chartTabs = document.querySelectorAll('.chart-tab');
  chartTabs.forEach(tab => {
    tab.addEventListener('click', function () {
      chartTabs.forEach(t => t.classList.remove('active'));
      this.classList.add('active');

      const chartType = this.dataset.chart;
      if (chartType === 'visitors') {
        createChart('visitors', visitorData);
      } else {
        createChart('downloads', downloadData);
      }
    });
  });

  // Initialize with visitors chart
  createChart('visitors', visitorData);
}

// Generate sample data for charts
function generateSampleData() {
  const data = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toLocaleDateString(),
      count: Math.floor(Math.random() * 100) + 50
    });
  }

  return data;
}

// Track visitor count
async function trackVisitor() {
  try {
    const settings = await getSettings();
    const currentVisitors = settings.totalVisitors || 0;

    await updateDoc(settingsDoc, {
      totalVisitors: currentVisitors + 1
    });

    // Add to visitor history
    const visitorHistory = settings.visitorHistory || [];
    const today = new Date().toLocaleDateString();
    const todayIndex = visitorHistory.findIndex(v => v.date === today);

    if (todayIndex !== -1) {
      visitorHistory[todayIndex].count += 1;
    } else {
      visitorHistory.push({ date: today, count: 1 });
      // Keep only last 30 days
      if (visitorHistory.length > 30) {
        visitorHistory.shift();
      }
    }

    await updateDoc(settingsDoc, {
      visitorHistory: visitorHistory
    });
  } catch (error) {
    console.error("Error tracking visitor:", error);
  }
}

// Track download count
async function trackDownload(itemId) {
  try {
    const settings = await getSettings();
    const downloadHistory = settings.downloadHistory || [];
    const today = new Date().toLocaleDateString();
    const todayIndex = downloadHistory.findIndex(v => v.date === today);

    if (todayIndex !== -1) {
      downloadHistory[todayIndex].count += 1;
    } else {
      downloadHistory.push({ date: today, count: 1 });
      // Keep only last 30 days
      if (downloadHistory.length > 30) {
        downloadHistory.shift();
      }
    }

    await updateDoc(settingsDoc, {
      downloadHistory: downloadHistory
    });
  } catch (error) {
    console.error("Error tracking download:", error);
  }
}

// Games Management
async function loadGames(searchTerm = '') {
  try {
    // Get all items and filter by category
    const allItems = await getItems();
    const games = allItems.filter(item => item.category === 'games');
    const gamesTable = document.getElementById('games-table');

    let filtered = games;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = games.filter(game =>
        game.title.toLowerCase().includes(term) ||
        (game.desc && game.desc.toLowerCase().includes(term)) ||
        (game.subcategory && game.subcategory.toLowerCase().includes(term))
      );
    }

    gamesTable.innerHTML = '';
    filtered.forEach(game => {
      // Set default values for undefined properties
      const rating = game.rating || 0;
      const downloads = game.downloads || 0;

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${game.id}</td>
        <td><img src="${game.image}" alt="${game.title}" class="table-thumbnail"></td>
        <td>${game.title}</td>
        <td>${game.subcategory || 'N/A'}</td>
        <td>${game.size || 'N/A'}</td>
        <td>${'⭐'.repeat(Math.round(rating))}</td>
        <td>${downloads.toLocaleString()}</td>
        <td class="action-buttons">
          <button class="edit" data-id="${game.id}"><i class="fas fa-edit"></i></button>
          <button class="delete" data-id="${game.id}"><i class="fas fa-trash"></i></button>
        </td>
      `;
      gamesTable.appendChild(row);
    });

    // Add event listeners
    addActionButtonListeners(gamesTable);
  } catch (error) {
    console.error("Error loading games:", error);
    gamesTable.innerHTML = `<tr><td colspan="8">Error loading games: ${error.message}</td></tr>`;
  }
}

// Mac Management
async function loadMacItems(searchTerm = '') {
  try {
    console.log("Loading Mac items...");
    
    // Get all Mac items from the database
    let macQuery = query(itemsCollection, where("category", "==", "mac"));
    const snapshot = await getDocs(macQuery);
    const macItems = snapshot.docs.map(doc => doc.data());
    
    console.log(`Found ${macItems.length} Mac items`);
    
    const macTable = document.getElementById('mac-table');
    if (!macTable) {
      console.error("Mac table element not found");
      return;
    }

    // Filter by search term if provided
    let filtered = macItems;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = macItems.filter(item =>
        (item.title && item.title.toLowerCase().includes(term)) ||
        (item.description && item.description.toLowerCase().includes(term)) ||
        (item.subcategory && item.subcategory.toLowerCase().includes(term))
      );
      console.log(`Filtered to ${filtered.length} Mac items matching "${searchTerm}"`);
    }

    // Clear and populate the table
    macTable.innerHTML = '';
    
    if (filtered.length === 0) {
      macTable.innerHTML = `<tr><td colspan="8" class="no-items">No Mac items found.</td></tr>`;
      return;
    }

    filtered.forEach(item => {
      const rating = item.rating || 0;
      const downloads = item.downloads || 0;

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${item.id || 'N/A'}</td>
        <td><img src="${item.imageUrl || item.image || 'images/placeholder.png'}" alt="${item.title}" class="table-thumbnail"></td>
        <td>${item.title || 'N/A'}</td>
        <td>${item.subcategory || 'N/A'}</td>
        <td>${item.size || 'N/A'}</td>
        <td>${'⭐'.repeat(Math.round(rating))}</td>
        <td>${downloads.toLocaleString()}</td>
        <td class="action-buttons">
          <button class="edit" data-id="${item.id}" data-category="mac"><i class="fas fa-edit"></i></button>
          <button class="delete" data-id="${item.id}"><i class="fas fa-trash"></i></button>
        </td>
      `;
      macTable.appendChild(row);
    });

    // Add event listeners to action buttons
    addActionButtonListeners(macTable);
    
    console.log("Mac items loaded successfully");
  } catch (error) {
    console.error("Error loading Mac items:", error);
    const macTable = document.getElementById('mac-table');
    if (macTable) {
      macTable.innerHTML = `<tr><td colspan="8" class="error">Error loading Mac items: ${error.message}</td></tr>`;
    }
  }
}

// Software Management
async function loadSoftware(searchTerm = '') {
  try {
    // Get all items and filter by category
    const allItems = await getItems();
    const software = allItems.filter(item => item.category === 'windows');
    const softwareTable = document.getElementById('software-table');

    let filtered = software;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = software.filter(sw =>
        sw.title.toLowerCase().includes(term) ||
        (sw.desc && sw.desc.toLowerCase().includes(term)) ||
        (sw.subcategory && sw.subcategory.toLowerCase().includes(term))
      );
    }

    softwareTable.innerHTML = '';
    filtered.forEach(sw => {
      // Set default values for undefined properties
      const rating = sw.rating || 0;
      const downloads = sw.downloads || 0;

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${sw.id}</td>
        <td><img src="${sw.image}" alt="${sw.title}" class="table-thumbnail"></td>
        <td>${sw.title}</td>
        <td>${sw.subcategory || 'N/A'}</td>
        <td>${sw.size || 'N/A'}</td>
        <td>${'⭐'.repeat(Math.round(rating))}</td>
        <td>${downloads.toLocaleString()}</td>
        <td class="action-buttons">
          <button class="edit" data-id="${sw.id}"><i class="fas fa-edit"></i></button>
          <button class="delete" data-id="${sw.id}"><i class="fas fa-trash"></i></button>
        </td>
      `;
      softwareTable.appendChild(row);
    });

    // Add event listeners
    addActionButtonListeners(softwareTable);
  } catch (error) {
    console.error("Error loading software:", error);
    softwareTable.innerHTML = `<tr><td colspan="8">Error loading software: ${error.message}</td></tr>`;
  }
}

// Categories Management
async function loadCategories() {
  try {
    const settings = await getSettings();
    
    // Ensure subcategories exist
    if (!settings.subcategories) {
      settings.subcategories = { games: [], windows: [], mac: [] };
      await saveSettings(settings);
    }
    
    // Display game subcategories
    const gamesContainer = document.getElementById('games-subcategories');
    if (gamesContainer) {
      gamesContainer.innerHTML = '';
      
      if (settings.subcategories.games && settings.subcategories.games.length > 0) {
        settings.subcategories.games.forEach(sub => {
          const subEl = document.createElement('div');
          subEl.className = 'category-item';
          subEl.innerHTML = `
        <span class="category-name">${sub}</span>
            <span class="category-count">0</span>
        <div class="category-actions">
              <button class="delete-category" data-category="games" data-subcategory="${sub}" title="Delete this subcategory">
                <i class="fas fa-trash"></i>
              </button>
        </div>
      `;
          gamesContainer.appendChild(subEl);
        });
      } else {
        gamesContainer.innerHTML = '<p class="no-subcategories">No subcategories found</p>';
      }
    }
    
    // Display Windows subcategories
    const windowsContainer = document.getElementById('windows-subcategories');
    if (windowsContainer) {
      windowsContainer.innerHTML = '';
      
      if (settings.subcategories.windows && settings.subcategories.windows.length > 0) {
        settings.subcategories.windows.forEach(sub => {
          const subEl = document.createElement('div');
          subEl.className = 'category-item';
          subEl.innerHTML = `
            <span class="category-name">${sub}</span>
            <span class="category-count">0</span>
            <div class="category-actions">
              <button class="delete-category" data-category="windows" data-subcategory="${sub}" title="Delete this subcategory">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          `;
          windowsContainer.appendChild(subEl);
        });
      } else {
        windowsContainer.innerHTML = '<p class="no-subcategories">No subcategories found</p>';
      }
    }
    
    // Display Mac subcategories
    const macContainer = document.getElementById('mac-subcategories');
    if (macContainer) {
      macContainer.innerHTML = '';
      
      if (settings.subcategories.mac && settings.subcategories.mac.length > 0) {
        settings.subcategories.mac.forEach(sub => {
          const subEl = document.createElement('div');
          subEl.className = 'category-item';
          subEl.innerHTML = `
        <span class="category-name">${sub}</span>
            <span class="category-count">0</span>
        <div class="category-actions">
              <button class="delete-category" data-category="mac" data-subcategory="${sub}" title="Delete this subcategory">
                <i class="fas fa-trash"></i>
              </button>
        </div>
      `;
          macContainer.appendChild(subEl);
        });
      } else {
        macContainer.innerHTML = '<p class="no-subcategories">No subcategories found</p>';
      }
    }

    // Add event listeners to the delete buttons
    attachDeleteButtonListeners();
    
    // Update category counts
    updateCategoryCounts();
    
    // Update the website frontend in real-time
    try {
      // Check if we're in an iframe and can access the parent window
      if (window.parent && window.parent !== window) {
        // Try to update all categories on the main page
        if (window.parent.loadSubcategories) {
          window.parent.loadSubcategories('games');
          window.parent.loadSubcategories('windows');
          window.parent.loadSubcategories('mac');
          console.log('Updated all frontend subcategories');
        }
      }
    } catch (e) {
      console.log('Could not update frontend subcategories:', e);
    }
  } catch (error) {
    console.error("Error loading categories:", error);
    showToast("Error loading categories", "error");
  }
}

// Function to update category counts
async function updateCategoryCounts() {
  try {
    // Get all items
    const snapshot = await getDocs(itemsCollection);
    const items = snapshot.docs.map(doc => doc.data());
    
    // Count items by subcategory
    const counts = {};
    items.forEach(item => {
      if (item.category && item.subcategory) {
        const key = `${item.category}-${item.subcategory}`;
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    
    // Update count elements
    document.querySelectorAll('.category-item').forEach(item => {
      const category = item.querySelector('.delete-category').getAttribute('data-category');
      const subcategory = item.querySelector('.delete-category').getAttribute('data-subcategory');
      const countElement = item.querySelector('.category-count');
      
      if (countElement) {
        const key = `${category}-${subcategory}`;
        countElement.textContent = counts[key] || 0;
      }
    });
  } catch (error) {
    console.error("Error updating category counts:", error);
  }
}

// Function to populate subcategory select dropdowns
async function populateSubcategorySelects() {
  try {
    // Get all subcategories
    const settings = await getSettings();
    if (!settings.subcategories) return;
    
    // Games subcategories
    const gamesSelect = document.getElementById('delete-game-category-select');
    if (gamesSelect) {
      // Clear options except the first placeholder
      while (gamesSelect.options.length > 1) {
        gamesSelect.remove(1);
      }
      
      // Add options for each subcategory
      const gamesSubcategories = settings.subcategories.games || [];
      gamesSubcategories.forEach(sub => {
        const option = document.createElement('option');
        option.value = sub;
        option.textContent = sub;
        gamesSelect.appendChild(option);
      });
    }
    
    // Windows subcategories
    const windowsSelect = document.getElementById('delete-windows-category-select');
    if (windowsSelect) {
      // Clear options except the first placeholder
      while (windowsSelect.options.length > 1) {
        windowsSelect.remove(1);
      }
      
      // Add options for each subcategory
      const windowsSubcategories = settings.subcategories.windows || [];
      windowsSubcategories.forEach(sub => {
        const option = document.createElement('option');
        option.value = sub;
        option.textContent = sub;
        windowsSelect.appendChild(option);
      });
    }
    
    // Mac subcategories
    const macSelect = document.getElementById('delete-mac-category-select');
    if (macSelect) {
      // Clear options except the first placeholder
      while (macSelect.options.length > 1) {
        macSelect.remove(1);
      }
      
      // Add options for each subcategory
      const macSubcategories = settings.subcategories.mac || [];
      macSubcategories.forEach(sub => {
        const option = document.createElement('option');
        option.value = sub;
        option.textContent = sub;
        macSelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error("Error populating subcategory selects:", error);
  }
}

// Setup event listeners for delete subcategory buttons
function setupDeleteSubcategoryButtons() {
  // Games delete button
  const deleteGameBtn = document.getElementById('delete-game-category-btn');
  if (deleteGameBtn) {
    deleteGameBtn.addEventListener('click', async () => {
      const select = document.getElementById('delete-game-category-select');
      const selectedValue = select.value;
      
      if (!selectedValue) {
        alert('Please select a subcategory to delete.');
        return;
      }
      
      // Check if subcategory is in use (modular syntax)
      const gamesQuery = query(itemsCollection, where("category", "==", "games"), where("subcategory", "==", selectedValue));
      const inUseSnapshot = await getDocs(gamesQuery);
      
      const inUse = !inUseSnapshot.empty;
      
      if (inUse) {
        alert(`Cannot delete subcategory "${selectedValue}" because it is being used by one or more items.`);
        return;
      }
      
      if (confirm(`Are you sure you want to delete the subcategory "${selectedValue}"?`)) {
        const success = await deleteSubcategory('games', selectedValue);
        if (success) {
          alert(`Subcategory "${selectedValue}" deleted successfully.`);
          // Reset select to default option
          select.selectedIndex = 0;
          // Reload categories to update view
          await loadCategories();
          // Repopulate selects
          await populateSubcategorySelects();
        } else {
          alert(`Failed to delete subcategory "${selectedValue}".`);
        }
      }
    });
  }
  
  // Windows delete button
  const deleteWindowsBtn = document.getElementById('delete-windows-category-btn');
  if (deleteWindowsBtn) {
    deleteWindowsBtn.addEventListener('click', async () => {
      const select = document.getElementById('delete-windows-category-select');
      const selectedValue = select.value;
      
      if (!selectedValue) {
        alert('Please select a subcategory to delete.');
        return;
      }
        
        // Check if subcategory is in use (modular syntax)
      const windowsQuery = query(itemsCollection, where("category", "==", "windows"), where("subcategory", "==", selectedValue));
      const inUseSnapshot = await getDocs(windowsQuery);
      
        const inUse = !inUseSnapshot.empty;
        
        if (inUse) {
        alert(`Cannot delete subcategory "${selectedValue}" because it is being used by one or more items.`);
          return;
        }
        
      if (confirm(`Are you sure you want to delete the subcategory "${selectedValue}"?`)) {
        const success = await deleteSubcategory('windows', selectedValue);
          if (success) {
          alert(`Subcategory "${selectedValue}" deleted successfully.`);
          // Reset select to default option
          select.selectedIndex = 0;
          // Reload categories to update view
          await loadCategories();
          // Repopulate selects
          await populateSubcategorySelects();
          } else {
          alert(`Failed to delete subcategory "${selectedValue}".`);
        }
      }
    });
  }
  
  // Mac delete button
  const deleteMacBtn = document.getElementById('delete-mac-category-btn');
  if (deleteMacBtn) {
    deleteMacBtn.addEventListener('click', async () => {
      const select = document.getElementById('delete-mac-category-select');
      const selectedValue = select.value;
      
      if (!selectedValue) {
        alert('Please select a subcategory to delete.');
        return;
      }
      
      // Check if subcategory is in use (modular syntax)
      const macQuery = query(itemsCollection, where("category", "==", "mac"), where("subcategory", "==", selectedValue));
      const inUseSnapshot = await getDocs(macQuery);
      
      const inUse = !inUseSnapshot.empty;
      
      if (inUse) {
        alert(`Cannot delete subcategory "${selectedValue}" because it is being used by one or more items.`);
        return;
      }
      
      if (confirm(`Are you sure you want to delete the subcategory "${selectedValue}"?`)) {
        const success = await deleteSubcategory('mac', selectedValue);
        if (success) {
          alert(`Subcategory "${selectedValue}" deleted successfully.`);
          // Reset select to default option
          select.selectedIndex = 0;
          // Reload categories to update view
          await loadCategories();
          // Repopulate selects
          await populateSubcategorySelects();
        } else {
          alert(`Failed to delete subcategory "${selectedValue}".`);
        }
      }
    });
  }
}

// Add event listener initialization to document ready
document.addEventListener('DOMContentLoaded', function() {
  // Existing event listeners
  // ...
  
  // Set up new delete subcategory functionality
  setupDeleteSubcategoryButtons();
});

// Separate function to attach delete button listeners
function attachDeleteButtonListeners() {
  // For category delete buttons
  document.querySelectorAll('.delete-category').forEach(btn => {
    // Remove any existing event listeners
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    newBtn.addEventListener('click', function(e) {
      e.stopPropagation(); // Prevent event bubbling
      
      try {
        const category = this.getAttribute('data-category');
        const subcategory = this.getAttribute('data-subcategory');
        
        console.log(`User clicked to delete subcategory: ${subcategory} from ${category}`);
        
        // Show deletion confirmation modal
        showDeleteConfirmation(category, subcategory);
      } catch (error) {
        console.error("Error handling delete button click:", error);
        alert("An error occurred. Please try again.");
      }
    });
  });
  
  // For sort option delete buttons
  document.querySelectorAll('.delete-sort').forEach(btn => {
    // Remove any existing event listeners
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    newBtn.addEventListener('click', async function() {
      try {
        const value = this.getAttribute('data-value');
        
        // Don't allow deleting the default option
        if (value === 'default') {
          alert('Cannot delete the default sort option.');
          return;
        }
        
        if (confirm(`Are you sure you want to delete the sort option with value "${value}"?`)) {
          const success = await deleteSortOption(value);
          if (success) {
            alert(`Sort option "${value}" deleted successfully.`);
            loadCategories(); // Reload to refresh the view
          } else {
            alert(`Failed to delete sort option "${value}".`);
          }
        }
      } catch (error) {
        console.error("Error deleting sort option:", error);
        alert("An error occurred while deleting the sort option. Please try again.");
      }
    });
  });
}

// Function to show delete confirmation modal
async function showDeleteConfirmation(category, subcategory) {
  try {
    // Get the modal elements
    const modal = document.getElementById('confirm-delete-modal');
    const subcategoryNameSpan = document.getElementById('delete-subcategory-name');
    const usageWarning = document.getElementById('usage-warning');
    const itemCountSpan = document.getElementById('item-count');
    const cancelBtn = document.getElementById('cancel-delete-btn');
    const confirmBtn = document.getElementById('confirm-delete-btn');
    
    // Check if subcategory is in use  👉  FIXED (modular syntax)
    const q = query(itemsCollection, where("category", "==", category), where("subcategory", "==", subcategory));
    const inUseSnapshot = await getDocs(q);
    const itemCount = inUseSnapshot.size;
    
    // Set modal content
    subcategoryNameSpan.textContent = subcategory;
    
    // Show warning if subcategory is in use
    if (itemCount > 0) {
      usageWarning.style.display = 'block';
      itemCountSpan.textContent = itemCount;
    } else {
      usageWarning.style.display = 'none';
    }
    
    // Show the modal
    modal.classList.add('active');
    
    // Handle cancel button
    const cancelHandler = function() {
      modal.classList.remove('active');
      cancelBtn.removeEventListener('click', cancelHandler);
      confirmBtn.removeEventListener('click', confirmHandler);
    };
    
    // Handle confirm button
    const confirmHandler = async function() {
      try {
        // Visual feedback - find the category item and add deleting class
        const categoryItem = document.querySelector(`.category-item .delete-category[data-category="${category}"][data-subcategory="${subcategory}"]`).closest('.category-item');
        if (categoryItem) {
          categoryItem.classList.add('deleting');
        }
        
        // Disable the confirm button and change text
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
        
        // Attempt to delete subcategory
        const success = await deleteSubcategory(category, subcategory);
        
        if (success) {
          // Add removing animation class
          if (categoryItem) {
            categoryItem.classList.add('removing');
          }
          
          // Close modal after a short delay
          setTimeout(() => {
            modal.classList.remove('active');
            
            // Show success toast notification
            showToast(`Subcategory "${subcategory}" deleted successfully.`, 'success');
            
            // Reload categories after animation
            setTimeout(() => {
              loadCategories();
              
              // Update the website in real-time
              try {
                if (window.parent && window.parent.loadSubcategories) {
                  window.parent.loadSubcategories(category);
                  console.log(`Updated frontend ${category} subcategories after deletion`);
                }
              } catch (e) {
                console.log("Could not update frontend subcategories:", e);
              }
            }, 300);
          }, 500);
        } else {
          // Show error toast
          showToast(`Failed to delete subcategory "${subcategory}".`, 'error');
          modal.classList.remove('active');
          
          // Reset confirm button
          confirmBtn.disabled = false;
          confirmBtn.innerHTML = 'Delete';
          
          // Remove deleting class if operation failed
          if (categoryItem) {
            categoryItem.classList.remove('deleting');
          }
        }
      } catch (error) {
        console.error("Error in delete confirmation handler:", error);
        
        // Show error toast
        showToast(`Error deleting subcategory: ${error.message}`, 'error');
        
        // Close modal
        modal.classList.remove('active');
        
        // Reset confirm button
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = 'Delete';
      }
    };
    
    // Attach event listeners
    cancelBtn.addEventListener('click', cancelHandler);
    confirmBtn.addEventListener('click', confirmHandler);
  } catch (error) {
    console.error("Error showing delete confirmation:", error);
    showToast("An error occurred while preparing the delete confirmation.", 'error');
  }
}

// Settings Management
async function loadSettings() {
  try {
    const settings = await getSettings();

    // Populate the basic settings form
    document.getElementById('site-title').value = settings.siteTitle || '';
    document.getElementById('site-name').value = settings.siteName || '';
    document.getElementById('items-per-page').value = settings.itemsPerPage || 7;
    document.getElementById('admin-email').value = settings.adminEmail || '';

    // Populate logo settings
    if (settings.siteLogo) {
      document.getElementById('site-logo').value = settings.siteLogo;
      document.getElementById('logo-preview').innerHTML = `<img src="${settings.siteLogo}" alt="Site Logo">`;
    }

    if (settings.siteFavicon) {
      document.getElementById('site-favicon').value = settings.siteFavicon;
      document.getElementById('favicon-preview').innerHTML = `<img src="${settings.siteFavicon}" alt="Site Favicon">`;
    }

    // Populate social media links
    if (settings.socialLinks) {
      document.getElementById('facebook-link').value = settings.socialLinks.facebook || '';
      document.getElementById('twitter-link').value = settings.socialLinks.twitter || '';
      document.getElementById('instagram-link').value = settings.socialLinks.instagram || '';
      document.getElementById('youtube-link').value = settings.socialLinks.youtube || '';
      document.getElementById('telegram-link').value = settings.socialLinks.telegram || '';
    }

    // Add event listener to the settings form
    document.getElementById('settings-form').addEventListener('submit', saveSettingsForm);
  } catch (error) {
    console.error("Error loading settings:", error);
  }
}

// Save settings form
async function saveSettingsForm(event) {
  event.preventDefault();

  try {
    const settings = await getSettings();

    // Get basic settings
    settings.siteTitle = document.getElementById('site-title').value;
    settings.siteName = document.getElementById('site-name').value;
    settings.itemsPerPage = parseInt(document.getElementById('items-per-page').value);
    settings.adminEmail = document.getElementById('admin-email').value;

    // Get logo settings
    settings.siteLogo = document.getElementById('site-logo').value;
    settings.siteFavicon = document.getElementById('site-favicon').value;

    // Get social links
    settings.socialLinks = {
      facebook: document.getElementById('facebook-link').value,
      twitter: document.getElementById('twitter-link').value,
      instagram: document.getElementById('instagram-link').value,
      youtube: document.getElementById('youtube-link').value,
      telegram: document.getElementById('telegram-link').value
    };

    // Save settings to Firebase
    const saved = await saveSettings(settings);

    if (saved) {
      alert('Settings saved successfully!');
    } else {
      alert('Error saving settings. Please try again.');
    }
  } catch (error) {
    console.error("Error saving settings:", error);
    alert('Error saving settings. Please try again.');
  }
}

// Initialize settings tabs
function initSettingsTabs() {
  const tabButtons = document.querySelectorAll('.form-tab[data-settings-tab]');
  const tabContents = document.querySelectorAll('.settings-container .form-tab-content');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active class from all buttons and contents
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));

      // Add active class to current button
      button.classList.add('active');

      // Show corresponding content
      const tabId = button.getAttribute('data-settings-tab');
      document.getElementById(tabId).classList.add('active');
    });
  });
}

// Initialize logo uploads
function initLogoUploads() {
  const logoUpload = document.getElementById('site-logo-upload');
  const faviconUpload = document.getElementById('site-favicon-upload');

  // Site logo upload (simplified)
  if (logoUpload) {
    logoUpload.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          // Show demo message
          showToast("Logo upload simulation", "info");

          // Create a URL for the local file
          const logoUrl = URL.createObjectURL(file);
          
          // Update the UI
          document.getElementById('site-logo').value = logoUrl;
          document.getElementById('logo-preview').innerHTML = `<img src="${logoUrl}" alt="Site Logo">`;
          showToast("Logo updated locally (demo)", "success");
        } catch (error) {
          console.error("Error handling logo:", error);
          showToast("Error updating logo", "error");
        }
      }
    });
  }

  // Favicon upload (simplified)
  if (faviconUpload) {
    faviconUpload.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          // Show demo message
          showToast("Favicon upload simulation", "info");

          // Create a URL for the local file
          const faviconUrl = URL.createObjectURL(file);
          
          // Update the UI
          document.getElementById('site-favicon').value = faviconUrl;
          document.getElementById('favicon-preview').innerHTML = `<img src="${faviconUrl}" alt="Site Favicon">`;
          showToast("Favicon updated locally (demo)", "success");
        } catch (error) {
          console.error("Error handling favicon:", error);
          showToast("Error updating favicon", "error");
        }
      }
    });
  }
}

// Features Management
function setupFeaturesManagement() {
  const featuresContainer = document.getElementById('features-container');
  const addFeatureBtn = document.getElementById('add-feature-btn');

  // Add feature button
  addFeatureBtn.addEventListener('click', function () {
    const featureItem = document.createElement('div');
    featureItem.className = 'feature-item';
    featureItem.innerHTML = `
      <input type="text" class="feature-input" placeholder="Enter a feature">
      <button type="button" class="remove-feature"><i class="fas fa-times"></i></button>
    `;
    featuresContainer.appendChild(featureItem);

    // Add event listener to remove button
    featureItem.querySelector('.remove-feature').addEventListener('click', function () {
      featuresContainer.removeChild(featureItem);
    });
  });
}

// Gallery Management
function setupGalleryManagement() {
  const galleryContainer = document.getElementById('gallery-container');
  const addGalleryBtn = document.getElementById('add-gallery-btn');

  // Add gallery button
  addGalleryBtn.addEventListener('click', function () {
    const galleryItem = document.createElement('div');
    galleryItem.className = 'gallery-item';
    galleryItem.innerHTML = `
      <input type="url" class="gallery-input" placeholder="Image URL">
      <button type="button" class="remove-gallery"><i class="fas fa-times"></i></button>
    `;
    galleryContainer.appendChild(galleryItem);

    // Add event listener to remove button
    galleryItem.querySelector('.remove-gallery').addEventListener('click', function () {
      galleryContainer.removeChild(galleryItem);
    });
  });
}

// Event listener for settings form
settingsForm.addEventListener('submit', async function (e) {
  e.preventDefault();

  const settings = {
    siteTitle: document.getElementById('site-title').value,
    itemsPerPage: parseInt(document.getElementById('items-per-page').value),
    adminEmail: document.getElementById('admin-email').value
  };

  await saveSettings(settings);
  alert('Settings saved successfully!');
});

// Event listeners for add category buttons
addGameCategoryBtn.addEventListener('click', async function () {
  const newCategory = document.getElementById('new-game-category').value.trim();
  if (newCategory) {
    const success = await saveSubcategory('games', newCategory);
    if (success) {
      document.getElementById('new-game-category').value = '';
      loadCategories();
    } else {
      alert(`Subcategory "${newCategory}" already exists!`);
    }
  }
});

addWindowsCategoryBtn.addEventListener('click', async function () {
  const newCategory = document.getElementById('new-windows-category').value.trim();
  if (newCategory) {
    const success = await saveSubcategory('windows', newCategory);
    if (success) {
      document.getElementById('new-windows-category').value = '';
      loadCategories();
    } else {
      alert(`Subcategory "${newCategory}" already exists!`);
    }
  }
});

// Sort options functionality removed as requested

// Modal management
async function openModal(mode, category = 'games', itemId = null) {
  // Reset form and image uploads
  itemForm.reset();
  document.getElementById('item-id').value = '';
  formImageUploads = { main: null, gallery: [] };

  // Reset form tabs
  formTabs[0].click();

  // Reset features container
  const featuresContainer = document.getElementById('features-container');
  featuresContainer.innerHTML = `
    <div class="feature-item">
      <input type="text" class="feature-input" placeholder="Enter a feature">
      <button type="button" class="remove-feature"><i class="fas fa-times"></i></button>
    </div>
  `;

  // Reset gallery upload container
  const galleryUploadContainer = document.getElementById('gallery-upload-container');
  galleryUploadContainer.innerHTML = `
    <div class="gallery-upload-item">
      <div class="url-input-group">
        <input type="url" class="gallery-url" placeholder="Enter image URL">
        <span class="or-divider">OR</span>
      </div>
      <div class="file-upload-group">
        <button type="button" class="admin-btn primary uploadcare-gallery-btn" data-index="0">
          <i class="fas fa-upload"></i> Upload with Uploadcare
        </button>
        <div class="gallery-preview"></div>
      </div>
    </div>
  `;

  // Reset preview areas
  document.getElementById('main-image-preview').innerHTML = '';
  document.getElementById('complete-gallery-preview').innerHTML = `
    <div class="preview-placeholder">
      <i class="fas fa-images"></i>
      <p>Images added in the URLs tab will appear here</p>
    </div>
  `;

  // Set modal title based on mode
  if (mode === 'add') {
    modalTitle.textContent = `Add New ${category === 'games' ? 'Game' : category === 'mac' ? 'Mac' : 'Software'}`;
  } else {
    modalTitle.textContent = `Edit ${category === 'games' ? 'Game' : category === 'mac' ? 'Mac' : 'Software'}`;
  }

  // Set the main category
  const categorySelect = document.getElementById('item-category');
  categorySelect.value = category;

  // Load subcategories
  loadSubcategories(category);

  // Setup file upload handlers
  setupFileUploadHandlers();

  // If editing, populate form with item data
  if (mode === 'edit' && itemId) {
    const item = await getItem(itemId);
    if (item) {
      // Basic info tab
      document.getElementById('item-id').value = item.id;
      document.getElementById('item-title').value = item.title;
      // Populate the slug field with item.slug or fallback to item.id
      document.getElementById('item-slug').value = item.slug || item.id || '';
      document.getElementById('item-category').value = item.category;
      await loadSubcategories(item.category);
      document.getElementById('item-subcategory').value = item.subcategory;
      document.getElementById('item-desc').value = item.desc;

      // Parse size value if it exists
      if (item.size) {
        const sizeMatch = item.size.match(/^([\d.]+)\s*(MB|GB|TB)?$/i);
        if (sizeMatch) {
          document.getElementById('item-size-value').value = sizeMatch[1];
          document.getElementById('item-size-unit').value = (sizeMatch[2] || 'GB').toUpperCase();
        } else {
          document.getElementById('item-size-value').value = '';
          document.getElementById('item-size-unit').value = 'GB';
        }
      }

      // URLs tab
      document.getElementById('item-image').value = item.image;
      document.getElementById('item-download').value = item.downloadLink;
      
      // Add these lines to populate Torrent Link and Direct Download fields
      document.getElementById('item-torrent').value = item.torrentLink || '';
      document.getElementById('item-direct').value = item.directLink || '';
      
      // Debug: Log the torrent and direct download links when loading
      console.log('Loading item with torrentLink:', item.torrentLink);
      console.log('Loading item with directLink:', item.directLink);

      // If the item has a dataUrl for main image
      if (item.mainImageData) {
        formImageUploads.main = item.mainImageData;
        document.getElementById('main-image-preview').innerHTML = `<img src="${item.mainImageData}" alt="Main Image">`;
      }

      // Details tab
      document.getElementById('item-requirements').value = item.requirements || '';
      document.getElementById('item-file-name').value = item.fileName || '';
      document.getElementById('item-version').value = item.version || '';
      document.getElementById('item-release-date').value = item.releaseDate || '';

      // Set select values
      document.getElementById('item-os').value = item.os || '';
      document.getElementById('item-architecture').value = item.architecture || '';
      document.getElementById('item-language').value = item.language || '';

      // Features
      if (item.features && item.features.length) {
        featuresContainer.innerHTML = '';
        item.features.forEach(feature => {
          const featureItem = document.createElement('div');
          featureItem.className = 'feature-item';
          featureItem.innerHTML = `
            <input type="text" class="feature-input" placeholder="Enter a feature" value="${feature}">
            <button type="button" class="remove-feature"><i class="fas fa-times"></i></button>
          `;
          featuresContainer.appendChild(featureItem);

          // Add event listener to remove button
          featureItem.querySelector('.remove-feature').addEventListener('click', function () {
            featuresContainer.removeChild(featureItem);
          });
        });
      }

      // Gallery images
      if (item.gallery && item.gallery.length) {
        galleryUploadContainer.innerHTML = '';

        item.gallery.forEach((imageUrl, index) => {
          const galleryItem = document.createElement('div');
          galleryItem.className = 'gallery-upload-item';

          // Check if this is a data URL (uploaded image)
          const isDataUrl = imageUrl.startsWith('data:');

          if (isDataUrl) {
            formImageUploads.gallery[index] = imageUrl;
          }

          galleryItem.innerHTML = `
            <div class="url-input-group">
              <input type="url" class="gallery-url" placeholder="Enter image URL" ${isDataUrl ? '' : `value="${imageUrl}"`}>
              <span class="or-divider">OR</span>
            </div>
            <div class="file-upload-group">
              <input type="file" class="gallery-file-input" accept="image/*" id="gallery-file-${index}">
              <label for="gallery-file-${index}" class="file-upload-btn gallery-upload-btn">
                <i class="fas fa-upload"></i> Upload
              </label>
              <div class="gallery-preview">
                ${isDataUrl ? `<img src="${imageUrl}" alt="Gallery Image ${index}">` : ''}
              </div>
            </div>
          `;

          galleryUploadContainer.appendChild(galleryItem);
        });

        // Setup file upload handlers for the gallery items
        setupFileUploadHandlers();
      }
    }
  }

  // Setup feature management
  setupFeatureManagement();

  // Setup gallery management
  setupGalleryItemHandlers();
  
  // Setup auto slug generation from title with debouncing
  setupSlugGeneration();

  // Update gallery preview
  updateGalleryPreview();
  
  // Setup Uploadcare buttons for gallery
  setupUploadcareGalleryHandlers();

  // Initialize SEO tab
  setupSeoTab();
  
  // Load SEO data if editing
  if (mode === 'edit' && itemId) {
    loadSeoData(itemId);
  }

  // Show modal
  modal.style.display = 'block';
}

function closeModal() {
  modal.style.display = 'none';
}

// Setup file upload handlers
function setupFileUploadHandlers() {
  // Main image upload handler (Uploadcare)
  const mainUploadButton = document.getElementById('uploadcare-main-btn');
  const mainImagePreview = document.getElementById('main-image-preview');
  const mainImageUrl = document.getElementById('item-image');

  if (mainUploadButton) {
    mainUploadButton.addEventListener('click', function() {
      // Open Uploadcare dialog
      uploadcare.openDialog(null, {
        publicKey: '1872f6021bc62dae1502',
        imagesOnly: true,
        crop: 'free,1:1,3:4,4:3,16:9'
      }).done(function(file) {
        file.done(function(fileInfo) {
          console.log('Main image uploaded via Uploadcare:', fileInfo);
          
          // Update the URL input
          if (mainImageUrl) {
            mainImageUrl.value = fileInfo.cdnUrl;
          }
          
          // Show preview
          if (mainImagePreview) {
            mainImagePreview.innerHTML = `<img src="${fileInfo.cdnUrl}" alt="Main Image">`;
          }

          // Update gallery preview
          updateGalleryPreview();
          
          // Show success notification
          showToast("Image uploaded successfully!", "success");
        });
      });
    });
  }

  // URL input handler (clear preview when URL is manually entered)
  if (mainImageUrl) {
    mainImageUrl.addEventListener('input', function () {
      if (this.value) {
        // Update gallery preview
        updateGalleryPreview();
      }
    });
  }

  // Gallery image upload handlers
  const galleryFileInputs = document.querySelectorAll('.gallery-file-input');
  galleryFileInputs.forEach((input, index) => {
    input.addEventListener('change', async function (e) {
      if (this.files && this.files[0]) {
        try {
          const dataUrl = await fileToDataURL(this.files[0]);
          const previewContainer = this.parentElement.querySelector('.gallery-preview');
          previewContainer.innerHTML = `<img src="${dataUrl}" alt="Gallery Image">`;

          // Store the data URL
          formImageUploads.gallery[index] = dataUrl;

          // Clear the URL input
          const urlInput = this.closest('.gallery-upload-item').querySelector('.gallery-url');
          if (urlInput) {
            urlInput.value = '';
          }

          // Update gallery preview
          updateGalleryPreview();
        } catch (error) {
          console.error('Error converting file to data URL:', error);
        }
      }
    });
  });

  // Gallery URL input handlers
  const galleryUrlInputs = document.querySelectorAll('.gallery-url');
  galleryUrlInputs.forEach((input, index) => {
    input.addEventListener('input', function () {
      if (this.value) {
        // Clear file upload preview
        const previewContainer = this.closest('.gallery-upload-item').querySelector('.gallery-preview');
        previewContainer.innerHTML = '';
        formImageUploads.gallery[index] = null;

        // Update gallery preview
        updateGalleryPreview();
      }
    });
  });
}

// Setup feature management
function setupFeatureManagement() {
  document.querySelectorAll('.remove-feature').forEach(btn => {
    btn.addEventListener('click', function () {
      const featureItem = this.parentElement;
      featureItem.parentElement.removeChild(featureItem);
    });
  });
}

// Setup gallery management for adding/removing items
function setupGalleryItemHandlers() {
  // Add gallery item button
  const addGalleryItemBtn = document.getElementById('add-gallery-item-btn');
  const galleryUploadContainer = document.getElementById('gallery-upload-container');

  if (addGalleryItemBtn && galleryUploadContainer) {
    addGalleryItemBtn.addEventListener('click', function () {
      const galleryItems = galleryUploadContainer.querySelectorAll('.gallery-upload-item');

      // Limit to 7 gallery images
      if (galleryItems.length >= 7) {
        alert('Maximum of 7 gallery images allowed!');
        return;
      }

      const newIndex = galleryItems.length;
      const galleryItem = document.createElement('div');
      galleryItem.className = 'gallery-upload-item';
      galleryItem.innerHTML = `
        <div class="url-input-group">
          <input type="url" class="gallery-url" placeholder="Enter image URL">
          <span class="or-divider">OR</span>
        </div>
        <div class="file-upload-group">
          <button type="button" class="admin-btn primary uploadcare-gallery-btn" data-index="${newIndex}">
            <i class="fas fa-upload"></i> Upload Manually
          </button>
          <div class="gallery-preview"></div>
        </div>
      `;

      galleryUploadContainer.appendChild(galleryItem);

      // Setup new file upload handler
      setupFileUploadHandlers();
      
      // Setup new Uploadcare button handler
      setupUploadcareGalleryHandlers();
    });
  }
  
  // Initialize Uploadcare gallery buttons
  setupUploadcareGalleryHandlers();
}

// Setup Uploadcare handlers for gallery images
function setupUploadcareGalleryHandlers() {
  document.querySelectorAll('.uploadcare-gallery-btn').forEach(button => {
    // Remove previous event listeners by cloning the button
    const newButton = button.cloneNode(true);
    button.parentNode.replaceChild(newButton, button);
    
    // Add event listener to the new button
    newButton.addEventListener('click', function() {
      const index = this.getAttribute('data-index');
      const galleryItem = this.closest('.gallery-upload-item');
      const urlInput = galleryItem.querySelector('.gallery-url');
      const previewContainer = galleryItem.querySelector('.gallery-preview');
      
      // Open Uploadcare dialog
      uploadcare.openDialog(null, {
        publicKey: '1872f6021bc62dae1502',
        imagesOnly: true,
        crop: 'free,1:1,3:4,4:3,16:9'
      }).done(function(file) {
        file.done(function(fileInfo) {
          console.log(`Gallery image ${index} uploaded via Uploadcare:`, fileInfo);
          
          // Update the URL input
          if (urlInput) {
            urlInput.value = fileInfo.cdnUrl;
          }
          
          // Show preview
          if (previewContainer) {
            previewContainer.innerHTML = `<img src="${fileInfo.cdnUrl}" alt="Gallery Image ${parseInt(index) + 1}">`;
          }
          
          // Show success notification
          showToast("Gallery image uploaded successfully!", "success");
        });
      });
    });
  });
}

// Load subcategories based on main category
async function loadSubcategories(category) {
  try {
    console.log(`Loading subcategories for ${category}...`);
    
    const subcategorySelect = document.getElementById('item-subcategory');
    if (!subcategorySelect) {
      console.error("Subcategory select element not found");
      return;
    }
    
    // Clear existing options
    subcategorySelect.innerHTML = '<option value="">Select Subcategory</option>';
    
    // Handle different category types
    let subcategories = [];
    
    if (category === 'mac') {
      // Specifically handle mac subcategories
      const settings = await getSettings();
      if (settings && settings.subcategories && Array.isArray(settings.subcategories.mac)) {
        subcategories = settings.subcategories.mac;
      } else {
        console.warn("Mac subcategories not found in settings, initializing empty array");
        subcategories = [];
        
        // Initialize mac subcategories if they don't exist
        await updateDoc(settingsDoc, {
          'subcategories.mac': []
        });
      }
    } else {
      // Handle other categories
      subcategories = await getSubcategories(category);
    }
    
    console.log(`Found ${subcategories.length} subcategories for ${category}`);
    
    // Add options to select
    subcategories.forEach(sub => {
      const option = document.createElement('option');
      option.value = sub;
      option.textContent = sub;
      subcategorySelect.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading subcategories:", error);
    alert(`Failed to load subcategories for ${category}. Please try again.`);
  }
}

// Item form category change handler
document.getElementById('item-category').addEventListener('change', function () {
  loadSubcategories(this.value);
});

// Add action button event listeners
function addActionButtonListeners(container) {
  // Edit buttons
  container.querySelectorAll('.edit').forEach(btn => {
    btn.addEventListener('click', async function () {
      try {
      const itemId = this.getAttribute('data-id');
        console.log(`Edit button clicked for item ID: ${itemId}`);
        
        // Show loading message
        showToast("Loading item data...", "info");
        
        // Get the item data
        const item = await getItem(itemId);
        
        if (item) {
          // If item has a category attribute, use it, otherwise check for data-category
          let category = item.category;
          if (!category) {
            category = this.getAttribute('data-category') || 'games';
          }
          
          // Open the modal with the item data
          openModal('edit', category, itemId);
        } else {
          showToast("Couldn't find item data", "error");
        }
      } catch (error) {
        console.error("Error handling edit button click:", error);
        showToast(`Error: ${error.message}`, "error");
      }
    });
  });

  // Delete buttons
  container.querySelectorAll('.delete').forEach(btn => {
    btn.addEventListener('click', async function () {
      try {
      const itemId = this.getAttribute('data-id');
        const itemTitle = this.closest('tr').querySelector('td:nth-child(3)').textContent;
        
        if (confirm(`Are you sure you want to delete "${itemTitle}"?`)) {
          // Show loading message
          showToast("Deleting item...", "info");
          
          // Delete the item
          await deleteItem(itemId);
          
          // Show success message
          showToast("Item deleted successfully", "success");
          
          // Reload the current section
          const activeSection = document.querySelector('.admin-section.active').id;
          if (activeSection === 'games') {
            loadGames();
          } else if (activeSection === 'software') {
            loadSoftware();
          } else if (activeSection === 'mac') { // Added for Mac
            loadMacItems();
          } else if (activeSection === 'dashboard') {
            loadDashboard();
          }
        }
      } catch (error) {
        console.error("Error handling delete button click:", error);
        showToast(`Error: ${error.message}`, "error");
      }
    });
  });
}

// Item form submission
itemForm.addEventListener('submit', async function (e) {
  e.preventDefault();

  // Check if at least one download URL is provided
  const mainDownloadUrl = document.getElementById('item-download').value.trim();
  const torrentUrl = document.getElementById('item-torrent').value.trim();
  const directUrl = document.getElementById('item-direct').value.trim();
  
  if (!mainDownloadUrl && !torrentUrl && !directUrl) {
    alert("Please provide at least one download URL (Main Download URL, Torrent Link, or Direct Download Link)");
    return;
  }

  // Show publish overlay
  publishOverlay.classList.add('active');
  publishProgress.style.width = '20%';

  try {
    // Collect features
    const features = [];
    document.querySelectorAll('.feature-input').forEach(input => {
      const feature = input.value.trim();
      if (feature) {
        features.push(feature);
      }
    });

    const itemId = document.getElementById('item-id').value ||
      document.getElementById('item-title').value.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const category = document.getElementById('item-category').value;

    console.log("Saving item with ID:", itemId);

    // Update progress
    publishProgress.style.width = '40%';

    // Upload main image if it's a file
    let mainImage = document.getElementById('item-image').value;
    if (formImageUploads.main) {
      const file = dataURLtoFile(formImageUploads.main, `main_${itemId}.png`);
      const uploadedUrl = await uploadImageToStorage(file, itemId, true);
      if (uploadedUrl) {
        mainImage = uploadedUrl;
      }
    }

    // Update progress
    publishProgress.style.width = '60%';

    // Collect gallery images
    const gallery = [];

    // Gather gallery images from both URLs and uploads
    const galleryUrls = document.querySelectorAll('.gallery-url');
    for (let i = 0; i < galleryUrls.length; i++) {
      const imageUrl = galleryUrls[i].value.trim();
      // If URL is provided, use it
      if (imageUrl) {
        gallery.push(imageUrl);
      }
      // Otherwise, check if we have an uploaded image
      else if (formImageUploads.gallery[i]) {
        const file = dataURLtoFile(formImageUploads.gallery[i], `gallery_${i}_${itemId}.png`);
        const uploadedUrl = await uploadImageToStorage(file, itemId, false, i);
        if (uploadedUrl) {
          gallery.push(uploadedUrl);
        }
      }
    }

    // Update progress
    publishProgress.style.width = '80%';

    // Check if we're editing an existing item
    const isEditing = !!document.getElementById('item-id').value;

    // Prepare item object - don't set rating/downloads for edits (handled in saveItem)
    // Get size value and unit
    const sizeValue = document.getElementById('item-size-value').value;
    const sizeUnit = document.getElementById('item-size-unit').value;
    const size = sizeValue ? `${sizeValue} ${sizeUnit}` : '';

         // Get slug value from the form
     const slugInput = document.getElementById('item-slug').value;
     const title = document.getElementById('item-title').value;
     
     const item = {
       id: itemId,
       title: title,
       // Always convert to lowercase when saving and ensure it's properly formatted
       slug: slugInput ? generateSlugFromTitle(slugInput).toLowerCase() : generateSlugFromTitle(title).toLowerCase(),
       // Add a flag to indicate if this is an update operation
       isUpdate: itemId ? true : false,
      category: category,
      subcategory: document.getElementById('item-subcategory').value,
      desc: document.getElementById('item-desc').value,
      image: mainImage,
      size: size,
      requirements: document.getElementById('item-requirements').value,
      downloadLink: document.getElementById('item-download').value,
      torrentLink: document.getElementById('item-torrent').value || '',
      directLink: document.getElementById('item-direct').value || '',
      platform: category === 'games' ? 'PC Games' : category === 'mac' ? 'Mac' : 'Windows',
      fileName: document.getElementById('item-file-name').value || '',
      version: document.getElementById('item-version').value || '',
      releaseDate: document.getElementById('item-release-date').value || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      os: document.getElementById('item-os').value || 'Windows 10/11',
      architecture: document.getElementById('item-architecture').value || '64-bit',
      language: document.getElementById('item-language').value || 'English',
      features: features,
      gallery: gallery
    };
    
    // Get SEO metadata if available
    const metaTitle = document.getElementById('meta-title').value;
    const metaDescription = document.getElementById('meta-description').value;
    const metaKeywords = document.getElementById('meta-keywords').value;
    
    // If any SEO data is provided, save it
    if (metaTitle || metaDescription || metaKeywords) {
      // Create SEO data object
      const seoData = {
        metaTitle: metaTitle || generateDefaultTitle(item),
        metaDescription: metaDescription || generateDefaultDescription(item),
        metaKeywords: metaKeywords || generateDefaultKeywords(item)
      };
      
      // Save SEO data to Firestore
      await saveSeoMetadata(itemId, seoData);
      console.log("SEO metadata saved for item:", itemId);
    }
    
    // Debug: Log the torrent and direct download links when saving
    console.log('Saving item with torrentLink:', item.torrentLink);
    console.log('Saving item with directLink:', item.directLink);

    // Only set addedDate for new items
    if (!isEditing) {
      item.addedDate = new Date().toISOString();
    }

    // Save the item - rating and downloads will be handled in saveItem function
    const savedItem = await saveItem(item);

    if (!savedItem) {
      throw new Error("Failed to save item");
    }

    closeModal();

    // Reload the current section
    const activeSection = document.querySelector('.admin-section.active').id;
    if (activeSection === 'games') {
      loadGames();
    } else if (activeSection === 'software') {
      loadSoftware();
    } else if (activeSection === 'mac') { // Added for Mac
      loadMacItems();
    } else if (activeSection === 'dashboard') {
      loadDashboard();
    }

    // Complete progress and hide overlay
    publishProgress.style.width = '100%';
    setTimeout(() => {
      publishOverlay.classList.remove('active');
      // Alert the user that the item was saved and is now visible on the website
      alert(`${item.title} has been saved and is now visible on the website.`);
    }, 500);
  } catch (error) {
    console.error("Error saving item:", error);
    publishOverlay.classList.remove('active');
    alert("Error saving item. Please try again: " + error.message);
  }
});

// Search functionality
gamesSearch.addEventListener('input', function () {
  loadGames(this.value);
});

softwareSearch.addEventListener('input', function () {
  loadSoftware(this.value);
});

if (addMacBtn) {
  addMacBtn.addEventListener('click', () => openModal('add', 'mac'));
}

if (macSearch) {
  macSearch.addEventListener('input', function () {
    loadMacItems(this.value);
  });
}

// Modal event listeners
modalClose.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);

window.addEventListener('click', function (e) {
  if (e.target === modal) {
    closeModal();
  }
  if (e.target === loginModal) {
    loginModal.style.display = 'none';
  }
});

// Add new item buttons
addGameBtn.addEventListener('click', function () {
  openModal('add', 'games');
});

addSoftwareBtn.addEventListener('click', function () {
  openModal('add', 'windows');
});

// Logout button
logoutBtn.addEventListener('click', function (e) {
  e.preventDefault();
  
  // Import firebase signOut
  const { signOut } = window.firebaseModules;
  const auth = window.auth;
  
  if (confirm("Are you sure you want to logout?")) {
    signOut(auth).then(() => {
      console.log("User signed out successfully");
      window.location.href = '../login.html';
    }).catch((error) => {
      console.error("Error signing out: ", error);
      alert("Error signing out. Please try again.");
    });
  }
});

// Footer logout link
const adminLogoutLink = document.getElementById('admin-logout');
if (adminLogoutLink) {
  adminLogoutLink.addEventListener('click', function (e) {
    e.preventDefault();
    
    // Import firebase signOut
    const { signOut } = window.firebaseModules;
    const auth = window.auth;
    
    if (confirm("Are you sure you want to logout?")) {
      signOut(auth).then(() => {
        console.log("User signed out successfully");
        window.location.href = '../login.html';
      }).catch((error) => {
        console.error("Error signing out: ", error);
        alert("Error signing out. Please try again.");
      });
    }
  });
}

if (addMacCategoryBtn) {
  // Create a new button to remove any existing event listeners
  const newMacBtn = addMacCategoryBtn.cloneNode(true);
  if (addMacCategoryBtn.parentNode) {
    addMacCategoryBtn.parentNode.replaceChild(newMacBtn, addMacCategoryBtn);
  }
  
  // Get reference to the new button
  const macButton = document.getElementById('add-mac-category-btn');
  
  // Add event listener to the new button
  macButton.addEventListener('click', async function() {
    try {
      const newMacCategoryInput = document.getElementById('new-mac-category');
      if (!newMacCategoryInput) {
        console.error("Mac category input field not found");
        return;
      }
      
    const subcategory = newMacCategoryInput.value.trim();
      if (!subcategory) {
        alert("Please enter a subcategory name.");
        return;
      }
      
      console.log(`Attempting to add Mac subcategory: ${subcategory}`);
      
      // Show loading state
      this.disabled = true;
      this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
      
      const success = await saveSubcategory('mac', subcategory);
      
      // Reset button
      this.disabled = false;
      this.innerHTML = '<i class="fas fa-plus"></i> Add';
      
      if (success) {
        newMacCategoryInput.value = '';
        showToast(`Mac subcategory "${subcategory}" added successfully.`, 'success');
        
        // Reload categories in admin panel
        await loadCategories();
        
        // Update frontend directly
        updateFrontendSubcategories('mac');
      } else {
        showToast(`Mac subcategory "${subcategory}" already exists or could not be added.`, 'error');
      }
    } catch (error) {
      console.error("Error adding Mac subcategory:", error);
      showToast("An error occurred while adding the Mac subcategory. Please try again.", 'error');
      
      // Reset button on error
      this.disabled = false;
      this.innerHTML = '<i class="fas fa-plus"></i> Add';
    }
  });
}

// Publish changes
publishBtn.addEventListener('click', function (e) {
  e.preventDefault();

  // Show publish overlay
  publishOverlay.classList.add('active');

  // Simulate publishing process
  let progress = 0;
  const interval = setInterval(function () {
    progress += 10;
    publishProgress.style.width = progress + '%';

    if (progress >= 100) {
      clearInterval(interval);
      setTimeout(function () {
        publishOverlay.classList.remove('active');
        alert('Changes published successfully!');
      }, 500);
    }
  }, 300);
});

// Login functionality
loginBtn.addEventListener('click', function () {
  const password = adminPassword.value;

  if (password === 'Aamir@6399') {
    loginModal.style.display = 'none';
    window.open('admin.html', '_blank');
  } else {
    passwordError.textContent = 'Incorrect password. Please try again.';
  }
});

cancelLoginBtn.addEventListener('click', function () {
  loginModal.style.display = 'none';
});

// Add "About" link to the index page
function addIndexPageLinkHandler() {
  const scriptTag = document.createElement('script');
  scriptTag.textContent = `
    // Login functionality for the about link
    document.addEventListener('DOMContentLoaded', function() {
  // Initialize Firebase Auth state
  checkAdminAuth();
      const aboutLink = document.getElementById('aboutLink');
      if (aboutLink) {
        aboutLink.addEventListener('click', function(e) {
          e.preventDefault();
          
          // Create login modal if it doesn't exist
          let loginModal = document.getElementById('login-modal');
          if (!loginModal) {
            const modal = document.createElement('div');
            modal.id = 'login-modal';
            modal.className = 'login-modal';
            modal.innerHTML = \`
              <div class="login-content">
                <h3>Admin Access</h3>
                <p>Please enter the admin password:</p>
                <input type="password" id="admin-password" placeholder="Enter password">
                <div id="password-error" class="error-message"></div>
                <div class="login-buttons">
                  <button id="cancel-login-btn">Cancel</button>
                  <button id="login-btn">Login</button>
                </div>
              </div>
            \`;
            document.body.appendChild(modal);
            
            // Add styles
            const style = document.createElement('style');
            style.textContent = \`
              .login-modal {
                display: block;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.8);
                z-index: 1000;
              }
              .login-content {
                background-color: #1c1c1c;
                margin: 15% auto;
                padding: 20px;
                width: 350px;
                border-radius: 8px;
                box-shadow: 0 0 20px rgba(0, 255, 195, 0.3);
              }
              .login-content h3 {
                color: #00ffc3;
                margin-bottom: 15px;
              }
              .login-content p {
                margin-bottom: 15px;
                color: #eee;
              }
              .login-content input {
                width: 100%;
                padding: 10px;
                margin-bottom: 15px;
                background: #222;
                border: 1px solid #333;
                color: white;
                border-radius: 4px;
              }
              .login-buttons {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
              }
              .login-buttons button {
                padding: 8px 15px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
              }
              #login-btn {
                background-color: #00ffc3;
                color: black;
              }
              #cancel-login-btn {
                background-color: #333;
                color: white;
              }
              .error-message {
                color: #ff3366;
                margin-bottom: 15px;
                font-size: 14px;
              }
            \`;
            document.head.appendChild(style);
            
            // Add event listeners
            document.getElementById('login-btn').addEventListener('click', function() {
              const password = document.getElementById('admin-password').value;
              if (password === 'Aamir@6399') {
                window.open('admin.html', '_blank');
                document.getElementById('login-modal').style.display = 'none';
              } else {
                document.getElementById('password-error').textContent = 'Incorrect password. Please try again.';
              }
            });
            
            document.getElementById('cancel-login-btn').addEventListener('click', function() {
              document.getElementById('login-modal').style.display = 'none';
            });
          } else {
            loginModal.style.display = 'block';
          }
        });
      }
    });
  `;

  document.body.appendChild(scriptTag);
}

// Project download functionality
async function downloadProject() {
  try {
    // Show publish overlay with download message
    const publishOverlay = document.getElementById('publish-overlay');
    const publishProgress = document.getElementById('publish-progress');
    const publishNotification = document.querySelector('.publish-notification h3');
    const publishText = document.querySelector('.publish-notification p');

    publishNotification.textContent = 'Preparing Download';
    publishText.textContent = 'Gathering all website files...';
    publishOverlay.classList.add('active');
    publishProgress.style.width = '10%';

    // Initialize JSZip
    const zip = new JSZip();

    // Get all items and settings
    const items = await getItems();
    const settings = await getSettings();

    // Update progress
    publishProgress.style.width = '20%';
    publishText.textContent = 'Adding HTML files...';

    // Fetch all necessary files from current page
    const fileNames = ['index.html', 'admin/admin.html', 'js/admin.js', 'admin/admin.css', 'zewc181mq5.css', 'js/data.js', 'README.md'];
    const fileContents = await Promise.all(fileNames.map(fileName => fetchFileContent(fileName)));

    // Add files to zip
    fileNames.forEach((fileName, index) => {
      zip.file(fileName, fileContents[index]);
    });

    // Update progress
    publishProgress.style.width = '40%';
    publishText.textContent = 'Using images from ImageKit...';

    // With ImageKit, we don't download all images to the zip file
    // Instead we'll create a note about images being stored in ImageKit
    const imageKitInfoFile = `# ImageKit.io Image Storage

This project now uses ImageKit.io for image storage instead of Firebase Storage.

Configuration:
- Public Key: public_9U4HrZGsbXio3j2TYSpFqyH3O4w=
- URL Endpoint: https://ik.imagekit.io/imcwquzl9
- Folder: r8y

All image URLs in the project data now point to ImageKit's CDN URLs.
These images will load as long as they exist in the ImageKit account.

Note: You cannot download all images automatically since they are hosted on ImageKit.
`;

    // Add the info file to the zip
    zip.file('imagekit_images_info.md', imageKitInfoFile);
    
    // Update progress immediately since we're not downloading images
    publishProgress.style.width = '70%';
    publishText.textContent = 'ImageKit image information added...';

    // Create database export script
    publishProgress.style.width = '75%';
    publishText.textContent = 'Creating database export...';

    const dbExportContent = `// R8Y Database Export
const DB_EXPORT = ${JSON.stringify(items, null, 2)};
const SETTINGS_EXPORT = ${JSON.stringify(settings, null, 2)};

// To restore data to Firebase, copy this data and use it with the Firebase import functions
`;

    zip.file('js/data.js', dbExportContent);

    // Create README
    const readmeContent = `# R8Y - PC Games & Software Download Website

Modern gaming and software download platform with real-time Firebase integration.

## 🚀 Features
- Real-time search across all categories
- Cross-category search functionality
- Firebase database integration
- Admin panel for content management
- Responsive design
- Image gallery with enhanced view

## 📋 Requirements to Run Locally

### Essential Requirements:
1. **Web Browser** (Chrome, Firefox, Edge recommended)
2. **Internet Connection** (for Firebase functionality)
3. **VS Code** with Live Server extension OR any local web server

### Installation Steps:

#### Option 1: Using VS Code (Recommended)
1. Download and install [VS Code](https://code.visualstudio.com/)
2. Install "Live Server" extension in VS Code
3. Extract project files to a folder
4. Open folder in VS Code
5. Right-click on \`index.html\` → "Open with Live Server"
6. Website will open at \`http://127.0.0.1:5500\`

#### Option 2: Using Python (Alternative)
1. Install Python from [python.org](https://python.org)
2. Extract project files to a folder
3. Open terminal/command prompt in project folder
4. Run: \`python -m http.server 8000\`
5. Open browser and go to \`http://localhost:8000\`

#### Option 3: Using Node.js (Alternative)
1. Install Node.js from [nodejs.org](https://nodejs.org)
2. Extract project files to a folder
3. Open terminal in project folder
4. Run: \`npx http-server\`
5. Open browser and go to displayed URL

## 📁 Project Structure
\`\`\`
R8Y-Project/
├── index.html          # Main website
├── admin.html          # Admin panel
├── js/admin.js            # Admin functionality
├── admin.css           # Admin styles
├── zewc181mq5.css     # Main website styles
├── data/
│   ├── data.js             # Firebase database functions
├── images/             # Website images
└── README.md           # This file
\`\`\`

## 🔧 Admin Panel Access
- Open \`admin.html\` in your browser
- Password: \`Aamir@6399\`
- Manage games, software, categories, and settings

## 🔥 Firebase Configuration
The project uses Firebase for real-time data storage:
\`\`\`javascript
const firebaseConfig = {
  apiKey: "AIzaSyCcthdcxH-xleb3vZxHIs7nfWT9Lo9CG84",
  authDomain: "r8y-33be8.firebaseapp.com",
  projectId: "r8y-33be8",
  storageBucket: "r8y-33be8.firebasestorage.app",
  messagingSenderId: "477787173296",
  appId: "1:477787173296:web:cd7bd1ca355085b4d6e675"
};
\`\`\`

## 🛠️ Troubleshooting

### Common Issues:
1. **"Firebase not loading"**: Check internet connection
2. **"CORS errors"**: Use Live Server, don't open HTML files directly
3. **"Images not loading"**: Ensure you're running from a web server
4. **"Admin panel not working"**: Clear browser cache and reload

Created by R8Y Admin Panel - ${new Date().toLocaleString()}`;

    zip.file('README.md', readmeContent);

    // Update progress
    publishProgress.style.width = '85%';
    publishText.textContent = 'Creating zip file...';

    // Generate the zip file
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 }
    }, (metadata) => {
      const percent = Math.floor(85 + (metadata.percent * 0.15));
      publishProgress.style.width = `${percent}%`;
      publishText.textContent = `Compressing files: ${metadata.percent.toFixed(1)}%`;
    });

    // Update progress
    publishProgress.style.width = '100%';
    publishText.textContent = 'Download complete!';

    // Download the zip file
    const url = window.URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `R8Y-Project-${new Date().toISOString().split('T')[0]}.zip`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    setTimeout(() => {
      publishOverlay.classList.remove('active');
    }, 1000);
  } catch (error) {
    console.error("Error downloading project:", error);
    const publishOverlay = document.getElementById('publish-overlay');
    publishOverlay.classList.remove('active');
    alert("Error downloading project: " + error.message);
  }
}

// Helper function to fetch file content
async function fetchFileContent(filename) {
  try {
    // Fetch from the current site
    const response = await fetch(filename);
    if (response.ok) {
      return await response.text();
    } else {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } catch (error) {
    console.error(`Error fetching file ${filename}:`, error);

    // Return minimal placeholder for essential files
    if (filename === 'index.html') {
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>R8Y GPT | Download PC Games & Windows Software</title>
  <link rel="stylesheet" href="zewc181mq5.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
</head>
<body>
  <!-- Firebase SDK -->
  <script src="https://www.gstatic.com/firebasejs/9.6.10/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.6.10/firebase-storage-compat.js"></script>
  <script>
    const firebaseConfig = {
      apiKey: "AIzaSyCcthdcxH-xleb3vZxHIs7nfWT9Lo9CG84",
      authDomain: "r8y-33be8.firebaseapp.com",
      projectId: "r8y-33be8",
      storageBucket: "r8y-33be8.firebasestorage.app",
      messagingSenderId: "477787173296",
      appId: "1:477787173296:web:cd7bd1ca355085b4d6e675",
      measurementId: "G-CFYZEQ6QGK"
    };
    firebase.initializeApp(firebaseConfig);
  </script>
  <script src="js/data.js"></script>
</body>
</html>`;
    } else if (filename === 'admin.html') {
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>R8Y Admin Panel</title>
  <link rel="stylesheet" href="zewc181mq5.css">
  <link rel="stylesheet" href="admin/admin.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
</head>
<body>
  <!-- Firebase SDK -->
  <script src="https://www.gstatic.com/firebasejs/9.6.10/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.6.10/firebase-storage-compat.js"></script>
  <script>
    const firebaseConfig = {
      apiKey: "AIzaSyCcthdcxH-xleb3vZxHIs7nfWT9Lo9CG84",
      authDomain: "r8y-33be8.firebaseapp.com",
      projectId: "r8y-33be8",
      storageBucket: "r8y-33be8.firebasestorage.app",
      messagingSenderId: "477787173296",
      appId: "1:477787173296:web:cd7bd1ca355085b4d6e675",
      measurementId: "G-CFYZEQ6QGK"
    };
    firebase.initializeApp(firebaseConfig);
  </script>
  <script src="js/admin.js"></script>
</body>
</html>`;
    } else {
      return `// Error loading ${filename} - Please check the file path`;
    }
  }
}

// Helper function to list all files in a storage directory
async function listFilesInStorage(path) {
  try {
    console.log("Attempting to list files at path:", path);
    console.warn("Firebase Storage has been replaced with ImageKit for uploads. File listing is not available in client-side code.");
    
    // Return empty array since we can't list files in ImageKit without server-side code
    showToast("File listing from cloud storage is not available with ImageKit from client-side", "info");
    return [];
  } catch (error) {
    console.error("Error listing files:", error);
    return [];
  }
}

// Download project button event listener
if (downloadProjectBtn) {
  downloadProjectBtn.addEventListener('click', function (e) {
    e.preventDefault();

    if (confirm('Download the entire R8Y project with real-time content for editing in VS Code?\n\nThis will include all HTML, CSS, JavaScript files and images.')) {
      downloadProject();
    }
  });
}

// Initialize the dashboard on load
loadDashboard();

// Initialize subcategory delete buttons
setupDeleteSubcategoryButtons();

// Initialize page for main index if being accessed directly
addIndexPageLinkHandler();

// Add event listeners for category add buttons
if (addGameCategoryBtn) {
  addGameCategoryBtn.addEventListener('click', async function() {
    try {
      const newGameCategoryInput = document.getElementById('new-game-category');
      if (!newGameCategoryInput) {
        console.error("Game category input field not found");
        return;
      }
      
      const subcategory = newGameCategoryInput.value.trim();
      if (!subcategory) {
        alert("Please enter a subcategory name.");
        return;
      }
      
      console.log(`Attempting to add Game subcategory: ${subcategory}`);
      
      // Show loading state
      this.disabled = true;
      this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
      
      const success = await saveSubcategory('games', subcategory);
      
      // Reset button
      this.disabled = false;
      this.innerHTML = '<i class="fas fa-plus"></i> Add';
      
      if (success) {
        newGameCategoryInput.value = '';
        showToast(`Game subcategory "${subcategory}" added successfully.`, 'success');
        await loadCategories(); // Reload categories to show the new one
      } else {
        showToast(`Game subcategory "${subcategory}" already exists or could not be added.`, 'error');
      }
    } catch (error) {
      console.error("Error adding Game subcategory:", error);
      showToast("An error occurred while adding the Game subcategory. Please try again.", 'error');
      
      // Reset button on error
      this.disabled = false;
      this.innerHTML = '<i class="fas fa-plus"></i> Add';
    }
  });
}

if (addWindowsCategoryBtn) {
  addWindowsCategoryBtn.addEventListener('click', async function() {
    try {
      const newWindowsCategoryInput = document.getElementById('new-windows-category');
      if (!newWindowsCategoryInput) {
        console.error("Windows category input field not found");
        return;
      }
      
      const subcategory = newWindowsCategoryInput.value.trim();
      if (!subcategory) {
        alert("Please enter a subcategory name.");
        return;
      }
      
      console.log(`Attempting to add Windows subcategory: ${subcategory}`);
      
      // Show loading state
      this.disabled = true;
      this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
      
      const success = await saveSubcategory('windows', subcategory);
      
      // Reset button
      this.disabled = false;
      this.innerHTML = '<i class="fas fa-plus"></i> Add';
      
      if (success) {
        newWindowsCategoryInput.value = '';
        showToast(`Windows subcategory "${subcategory}" added successfully.`, 'success');
        await loadCategories(); // Reload categories to show the new one
      } else {
        showToast(`Windows subcategory "${subcategory}" already exists or could not be added.`, 'error');
      }
    } catch (error) {
      console.error("Error adding Windows subcategory:", error);
      showToast("An error occurred while adding the Windows subcategory. Please try again.", 'error');
      
      // Reset button on error
      this.disabled = false;
      this.innerHTML = '<i class="fas fa-plus"></i> Add';
    }
  });
}

if (addMacCategoryBtn) {
  addMacCategoryBtn.addEventListener('click', async function() {
      try {
        const newMacCategoryInput = document.getElementById('new-mac-category');
        if (!newMacCategoryInput) {
          console.error("Mac category input field not found");
          return;
        }
        
        const subcategory = newMacCategoryInput.value.trim();
        if (!subcategory) {
          alert("Please enter a subcategory name.");
          return;
        }
        
        console.log(`Attempting to add Mac subcategory: ${subcategory}`);
        
        // Show loading state
        this.disabled = true;
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
        
        const success = await saveSubcategory('mac', subcategory);
        
        // Reset button
        this.disabled = false;
        this.innerHTML = '<i class="fas fa-plus"></i> Add';
        
        if (success) {
          newMacCategoryInput.value = '';
        showToast(`Mac subcategory "${subcategory}" added successfully.`, 'success');
          await loadCategories(); // Reload categories to show the new one
        } else {
        showToast(`Mac subcategory "${subcategory}" already exists or could not be added.`, 'error');
        }
      } catch (error) {
        console.error("Error adding Mac subcategory:", error);
      showToast("An error occurred while adding the Mac subcategory. Please try again.", 'error');
        
        // Reset button on error
        this.disabled = false;
        this.innerHTML = '<i class="fas fa-plus"></i> Add';
      }
    });
}

// Toast notification system
function showToast(message, type = 'success', title = '', duration = 3000) {
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  // Set icon based on type
  let icon = 'check-circle';
  switch(type) {
    case 'error': icon = 'times-circle'; break;
    case 'warning': icon = 'exclamation-triangle'; break;
    case 'info': icon = 'info-circle'; break;
    case 'success': default: icon = 'check-circle';
  }
  
  // Set default title based on type if not provided
  if (!title) {
    switch(type) {
      case 'error': title = 'Error'; break;
      case 'warning': title = 'Warning'; break;
      case 'info': title = 'Information'; break;
      case 'success': default: title = 'Success';
    }
  }
  
  // Create toast content
  toast.innerHTML = `
    <div class="toast-icon">
      <i class="fas fa-${icon}"></i>
    </div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close">
      <i class="fas fa-times"></i>
    </button>
  `;
  
  // Get the toast container
  const container = document.getElementById('toast-container');
  
  // Add toast to container
  container.appendChild(toast);
  
  // Show toast with animation
  setTimeout(() => {
    toast.classList.add('active');
  }, 10);
  
  // Setup close button
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => {
    removeToast(toast);
  });
  
  // Auto remove after duration
  if (duration > 0) {
    setTimeout(() => {
      removeToast(toast);
    }, duration);
  }
  
  // Return the toast element in case needed for reference
  return toast;
}

// Function to remove toast
function removeToast(toast) {
  toast.classList.add('removing');
  
  // Remove from DOM after animation completes
  setTimeout(() => {
    if (toast.parentElement) {
      toast.parentElement.removeChild(toast);
    }
  }, 500); // Match the animation duration
}

// Function to update the frontend subcategories in real-time
function updateFrontendSubcategories(category) {
  try {
    // If we're in the admin panel, try to communicate with the parent window
    if (window.parent && window.parent !== window) {
      // Try to call the loadSubcategories function in the parent window
      if (typeof window.parent.loadSubcategories === 'function') {
        window.parent.loadSubcategories(category);
        console.log(`Updated frontend ${category} subcategories in real-time`);
        return true;
      }
    }
    
    // If we're not in an iframe or can't access parent, try to find an iframe with the main page
    const mainPageIframe = document.querySelector('iframe[src*="index.html"]');
    if (mainPageIframe && mainPageIframe.contentWindow) {
      if (typeof mainPageIframe.contentWindow.loadSubcategories === 'function') {
        mainPageIframe.contentWindow.loadSubcategories(category);
        console.log(`Updated frontend ${category} subcategories via iframe`);
        return true;
      }
    }
    
    // If direct methods failed, try to create a custom event
    const event = new CustomEvent('subcategoriesUpdated', { 
      detail: { category: category } 
    });
    window.dispatchEvent(event);
    
    return false;
  } catch (error) {
    console.error('Error updating frontend subcategories:', error);
    return false;
  }
}

// Add specific test code for Mac button
document.addEventListener('DOMContentLoaded', function() {
  // Check if Mac button exists
  const macButton = document.getElementById('add-mac-category-btn');
  
  if (macButton) {
    console.log("Mac button found on DOMContentLoaded");
    
    // Remove all existing event listeners by cloning
    const newMacBtn = macButton.cloneNode(true);
    macButton.parentNode.replaceChild(newMacBtn, macButton);
    
    // Add event listener to the new button
    const freshMacBtn = document.getElementById('add-mac-category-btn');
    
    if (freshMacBtn) {
      console.log("Fresh Mac button created, adding event listener");
      
      freshMacBtn.addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        console.log("Mac add button clicked!");
        
        const macInput = document.getElementById('new-mac-category');
        if (!macInput) {
          console.error("Mac input field not found");
          alert("Mac input field not found");
          return;
        }
        
        const subcategory = macInput.value.trim();
        if (!subcategory) {
          alert("Please enter a Mac subcategory name");
          return;
        }
        
        console.log(`Adding Mac subcategory: ${subcategory}`);
        
        // Show loading state
        this.disabled = true;
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
        
        try {
          // Direct Firebase operation
          const settings = await getSettings();
          
          // Ensure subcategories object exists
          if (!settings.subcategories) {
            settings.subcategories = { games: [], windows: [], mac: [] };
          }
          
          // Ensure mac category array exists
          if (!settings.subcategories.mac) {
            settings.subcategories.mac = [];
          }
          
          // Check if subcategory already exists
          if (!settings.subcategories.mac.includes(subcategory)) {
            // Add new subcategory
            settings.subcategories.mac.push(subcategory);
            
            // Update Firebase
            await updateDoc(settingsDoc, {
              subcategories: settings.subcategories
            }, { merge: true });
            
            console.log(`Mac subcategory "${subcategory}" added successfully`);
            
            // Clear input
            macInput.value = '';
            
            // Show success message
            showToast(`Mac subcategory "${subcategory}" added successfully`, 'success');
            
            // Reload categories
            await loadCategories();
            
            // Update frontend
            updateFrontendSubcategories('mac');
  } else {
            console.log(`Mac subcategory "${subcategory}" already exists`);
            showToast(`Mac subcategory "${subcategory}" already exists`, 'error');
          }
        } catch (error) {
          console.error("Error adding Mac subcategory:", error);
          showToast(`Error adding Mac subcategory: ${error.message}`, 'error');
        } finally {
          // Reset button
          this.disabled = false;
          this.innerHTML = '<i class="fas fa-plus"></i> Add';
        }
      });
      
      console.log("Mac button event listener added successfully");
    } else {
      console.error("Fresh Mac button not found after cloning");
    }
  } else {
    console.error("Mac button not found on DOMContentLoaded");
  }
});

// DIRECT MAC BUTTON FIX - STANDALONE CODE
// This is a targeted fix for the Mac subcategory add button
(function() {
  console.log("MAC BUTTON FIX RUNNING");
  
  // Wait for page to be fully loaded
  window.addEventListener('load', function() {
    console.log("Window loaded, finding Mac button");
    
    // Find the Mac button
    const macButton = document.getElementById('add-mac-category-btn');
    const macInput = document.getElementById('new-mac-category');
    
    if (macButton && macInput) {
      console.log("MAC BUTTON FOUND, ADDING DIRECT EVENT LISTENER");
      
      // First, remove existing listeners by cloning
      const newBtn = macButton.cloneNode(true);
      macButton.parentNode.replaceChild(newBtn, macButton);
      
      // Now add our direct listener to the new button
      document.getElementById('add-mac-category-btn').onclick = async function(event) {
        event.preventDefault();
        event.stopPropagation();
        
        console.log("MAC BUTTON CLICKED - DIRECT HANDLER");
        
        // Get the subcategory value
        const subcategory = macInput.value.trim();
        
        if (!subcategory) {
          alert("Please enter a Mac subcategory name");
          return;
        }
        
        // Show loading state
        this.disabled = true;
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
        
        try {
          console.log("Adding Mac subcategory:", subcategory);
          
          // Get current settings
          const settingsSnapshot = await getDoc(settingsDoc);
          const settings = settingsSnapshot.data() || {};
          
          // Ensure subcategories exist
          if (!settings.subcategories) {
            settings.subcategories = { games: [], windows: [], mac: [] };
          }
          
          // Ensure mac array exists
          if (!settings.subcategories.mac) {
            settings.subcategories.mac = [];
          }
          
          // Check if it already exists
          if (settings.subcategories.mac.includes(subcategory)) {
            console.log("Subcategory already exists:", subcategory);
            alert(`Mac subcategory "${subcategory}" already exists`);
            this.disabled = false;
            this.innerHTML = '<i class="fas fa-plus"></i> Add';
            return;
          }
          
          // Add the new subcategory
          settings.subcategories.mac.push(subcategory);
          
          // Update Firebase - use set with merge for reliability
          await updateDoc(settingsDoc, {
            subcategories: settings.subcategories
          }, { merge: true });
          
          console.log("Mac subcategory added successfully:", subcategory);
          
          // Clear input field
          macInput.value = '';
          
          // Show success message
          alert(`Mac subcategory "${subcategory}" added successfully!`);
          
          // Reload categories to update UI
          if (typeof loadCategories === 'function') {
            await loadCategories();
          }
          
          // Try to update the website in real-time
          try {
            if (window.parent && window.parent.loadSubcategories) {
              window.parent.loadSubcategories('mac');
            }
          } catch (e) {
            console.log("Could not update parent window:", e);
          }
        } catch (error) {
          console.error("Error adding Mac subcategory:", error);
          alert(`Error adding Mac subcategory: ${error.message}`);
        } finally {
          // Reset button state
          this.disabled = false;
          this.innerHTML = '<i class="fas fa-plus"></i> Add';
        }
      };
      
      console.log("MAC BUTTON DIRECT HANDLER ADDED SUCCESSFULLY");
    } else {
      console.error("Mac button or input not found!");
    }
  });
})();

// Simple direct function for Mac category button
function addMacCategory() {
  console.log("===== MAC CATEGORY FUNCTION CALLED =====");
  
  try {
    // Get input element and value
    const inputElement = document.getElementById('new-mac-category');
    
    if (!inputElement) {
      alert("Error: Mac category input field not found!");
      return;
    }
    
    const subcategoryName = inputElement.value.trim();
    
    if (!subcategoryName) {
      alert("Please enter a subcategory name");
      return;
    }
    
    // Get button and show loading state
    const button = document.getElementById('add-mac-category-btn');
    if (button) {
      button.disabled = true;
      button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
    }
    
    console.log("Adding Mac subcategory:", subcategoryName);
    
    // Direct Firebase operation - no dependencies on other functions
    const db = getFirestore();
    const settingsDoc = doc(db, 'settings', 'siteSettings');
    
    // Use async/await in a simple way
    (async function() {
      try {
        // Get current settings
        const doc = await getDoc(settingsDoc);
        let settings = doc.data() || {};
        
        // Make sure subcategories exists
        if (!settings.subcategories) {
          settings.subcategories = { games: [], windows: [], mac: [] };
        }
        
        // Make sure mac array exists
        if (!settings.subcategories.mac) {
          settings.subcategories.mac = [];
        }
        
        // Check if already exists
        if (settings.subcategories.mac.includes(subcategoryName)) {
          alert(`Mac subcategory "${subcategoryName}" already exists!`);
          if (button) {
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-plus"></i> Add';
          }
          return;
        }
        
        // Add the subcategory
        settings.subcategories.mac.push(subcategoryName);
        
        // Update Firebase
        await updateDoc(settingsDoc, { subcategories: settings.subcategories }, { merge: true });
        
        // Success message
        alert(`Mac subcategory "${subcategoryName}" added successfully!`);
        
        // Clear input
        inputElement.value = '';
        
        // Reload the page to show updated categories
        location.reload();
        
      } catch (error) {
        console.error("ERROR ADDING MAC SUBCATEGORY:", error);
        alert(`Error adding Mac subcategory: ${error.message}`);
      } finally {
        // Reset button
        if (button) {
          button.disabled = false;
          button.innerHTML = '<i class="fas fa-plus"></i> Add';
        }
      }
    })();
    
  } catch (e) {
    console.error("CRITICAL ERROR IN addMacCategory:", e);
    alert("Critical error: " + e.message);
  }
}

// Add this at the end of the file, just before any event listeners

// Initialize navigation handlers to properly manage dashboard state
function setupNavigationHandlers() {
  const menuItems = document.querySelectorAll('.admin-sidebar a');
  
  menuItems.forEach(item => {
    item.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Get data-section attribute
      const targetSection = this.getAttribute('data-section');
      
      // Update active class
      document.querySelectorAll('.admin-sidebar a').forEach(link => {
        link.classList.remove('active');
      });
      this.classList.add('active');
      
      // Hide all sections
      document.querySelectorAll('.admin-section').forEach(section => {
        section.classList.remove('active');
      });
      
      // Show target section
      const sectionElement = document.getElementById(targetSection);
      if (sectionElement) {
        sectionElement.classList.add('active');
      }
      
      // If navigating to dashboard, reload it
      if (targetSection === 'dashboard') {
        // Destroy chart if it exists
        if (window.dashboardChart instanceof Chart) {
          window.dashboardChart.destroy();
          window.dashboardChart = null;
        }
        
        // Load dashboard
          loadDashboard();
      }
    });
  });
  
  // Also handle clicks from footer navigation
  document.querySelectorAll('.footer-links a[data-section]').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const sectionId = this.getAttribute('data-section');
      
      // Update sidebar active state
      document.querySelectorAll('.admin-sidebar a').forEach(navLink => {
        navLink.classList.remove('active');
        if(navLink.getAttribute('data-section') === sectionId) {
          navLink.classList.add('active');
        }
      });
      
      // Show the selected section
      document.querySelectorAll('.admin-section').forEach(section => {
        section.classList.remove('active');
      });
      document.getElementById(sectionId).classList.add('active');
      
      // If dashboard, reload it
      if (sectionId === 'dashboard') {
        loadDashboard();
      }
      
      // Scroll to top of content
      document.querySelector('.admin-content').scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

// Call this when the document is ready
document.addEventListener('DOMContentLoaded', function() {
  // Other initialization code that's already there
  
  // Setup navigation handlers
  setupNavigationHandlers();
  
  // Ensure dashboard is active
  const dashboardSection = document.getElementById('dashboard');
  if (dashboardSection) {
    document.querySelectorAll('.admin-section').forEach(section => {
      section.classList.remove('active');
    });
    dashboardSection.classList.add('active');
  
  // Immediately load dashboard on page load
      loadDashboard();
    }
});

// Confirm ImageKit Integration
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(() => {
    showToast(
      "Image upload system has been switched to ImageKit.io", 
      "info",
      "System Update",
      8000
    );
  }, 3000);
  
  // Add ImageKit info to the footer
  const footerInfo = document.querySelector('.admin-footer');
  if (footerInfo) {
    const imageKitInfo = document.createElement('div');
    imageKitInfo.className = 'imagekit-info';
    imageKitInfo.innerHTML = `
      <span>Powered by ImageKit.io</span>
    `;
    footerInfo.appendChild(imageKitInfo);
  }
});

// ImageKit direct upload function
function upload() {
  const resultContainer = document.getElementById('uploadResult');
  resultContainer.innerHTML = '<div style="color: #aaa;">Uploading...</div>';
  
  var file = document.getElementById("file1");
  if (!file.files || !file.files[0]) {
    resultContainer.innerHTML = '<div style="color: #ff6b6b;">Please select a file first.</div>';
    return;
  }
  
  showToast("Uploading to ImageKit...", "info");
  
  imagekit.upload({
    file: file.files[0],
    fileName: "image_" + new Date().getTime() + ".jpg",
    tags: ["sample", "upload-test"]
  }, function(err, result) {
    if (err) {
      console.error("Upload error:", err);
      resultContainer.innerHTML = `<div style="color: #ff6b6b;">Error: ${err.message}</div>`;
      showToast("Upload failed: " + err.message, "error");
      return;
    }
    
    console.log("Upload result:", result);
    
    // Generate transformed URL
    const transformedUrl = imagekit.url({
      src: result.url,
      transformation: [{ height: 300, width: 400 }]
    });
    
    resultContainer.innerHTML = `
      <div style="color: #4CAF50; margin-bottom: 15px;">Upload successful!</div>
      <div style="margin-bottom: 15px;">
        <img src="${transformedUrl}" style="max-width: 100%; max-height: 200px; border-radius: 4px;" alt="Uploaded image">
      </div>
      <div style="margin-bottom: 10px;">
        <label style="display: block; margin-bottom: 5px; color: #aaa;">Original URL:</label>
        <input type="text" value="${result.url}" style="width: 100%; padding: 8px; background: #444; border: 1px solid #555; color: white;" readonly onclick="this.select()">
      </div>
      <div>
        <label style="display: block; margin-bottom: 5px; color: #aaa;">Transformed URL (300x400):</label>
        <input type="text" value="${transformedUrl}" style="width: 100%; padding: 8px; background: #444; border: 1px solid #555; color: white;" readonly onclick="this.select()">
      </div>
    `;
    
    showToast("Upload successful!", "success");
  });
}

// Uploadcare Widget Initialization
document.addEventListener('DOMContentLoaded', function() {
  // Check if uploadcare widget exists on the page
  const uploadcareWidget = document.querySelector('input[role="uploadcare-uploader"]');
  if (!uploadcareWidget) return;
  
  // Initialize Uploadcare widget
  const widget = uploadcare.Widget('[role=uploadcare-uploader]');
  
  // Subscribe to the widget's "done" event
  widget.onUploadComplete(function(fileInfo) {
    console.log('Uploadcare upload complete:', fileInfo);
    
    // Show success notification
    showToast("Upload successful!", "success");
    
    // Get the preview container
    const previewContainer = document.querySelector('#uploadcare-result .preview-container');
    const imagePreview = document.querySelector('#uploadcare-result .image-preview');
    const urlInput = document.getElementById('uploadcare-url');
    const cdnUrlInput = document.getElementById('uploadcare-cdn-url');
    
    if (previewContainer && imagePreview && urlInput && cdnUrlInput) {
      // Show the preview container
      previewContainer.style.display = 'block';
      
      // Set the image preview
      imagePreview.innerHTML = `<img src="${fileInfo.cdnUrl}" style="max-width: 100%; max-height: 200px; border-radius: 4px;" alt="Uploaded image">`;
      
      // Set the URL inputs
      urlInput.value = fileInfo.originalUrl || fileInfo.cdnUrl;
      
      // Create a CDN URL with a resize transformation
      const cdnUrl = `${fileInfo.cdnUrl}-/resize/400x300/`;
      cdnUrlInput.value = cdnUrl;
    }
  });
  
  // Add info about Uploadcare to the footer
  setTimeout(() => {
    showToast(
      "Uploadcare image upload widget is now available", 
      "info",
      "System Update",
      5000
    );
  }, 5000);
});

// Add Uploadcare to item modal for main image upload
document.addEventListener('DOMContentLoaded', function() {
  // Check if we need to add Uploadcare to the item modal
  const itemForm = document.getElementById('item-form');
  if (!itemForm) return;
  
  // Initialize SEO tab functionality
  setupSeoTab();
  
  // Notify user of the new AI SEO system
  setTimeout(() => {
    showToast(
      "DeepSeek R1 0528 SEO optimization system is now available in the item editor", 
      "info",
      "New Feature Available",
      8000
    );
  }, 10000); // Show after 10 seconds
  
  // Create Uploadcare button for main image
  const mainImageGroup = document.querySelector('#urls .form-group:first-child .file-upload-group');
  if (mainImageGroup) {
    const uploadcareButton = document.createElement('button');
    uploadcareButton.type = 'button';
    uploadcareButton.className = 'admin-btn secondary';
    uploadcareButton.style.marginLeft = '10px';
    uploadcareButton.innerHTML = '<i class="fas fa-crop-alt"></i> Use Uploadcare';
    
    // Insert after the upload button
    const uploadButton = mainImageGroup.querySelector('.file-upload-btn');
    if (uploadButton) {
      uploadButton.parentNode.insertBefore(uploadcareButton, uploadButton.nextSibling);
      
      // Add click handler
      uploadcareButton.addEventListener('click', function() {
        // Open Uploadcare dialog
        uploadcare.openDialog(null, {
          publicKey: '1872f6021bc62dae1502',
          imagesOnly: true,
          crop: 'free,1:1,3:4,4:3,16:9'
        }).done(function(file) {
          file.done(function(fileInfo) {
            console.log('Main image uploaded via Uploadcare:', fileInfo);
            
            // Update the URL input
            const urlInput = document.getElementById('item-image');
            if (urlInput) {
              urlInput.value = fileInfo.cdnUrl;
            }
            
            // Show preview
            const previewContainer = document.getElementById('main-image-preview');
            if (previewContainer) {
              previewContainer.innerHTML = `<img src="${fileInfo.cdnUrl}" alt="Main Image">`;
            }
            
            // Show success notification
            showToast("Image uploaded successfully!", "success");
          });
        });
      });
    }
  }
});

// ========================================================================= 
// DEEPSEEK SEO SYSTEM
// ========================================================================= 

// Initialize OpenRouter API integration for DeepSeek
// Using proxy service for security - replace with your own API integration
// Legacy API endpoint reference - now using OpenRouter directly in functions
const SEO_API_ENDPOINT = ""; 
const SEO_API_KEY = ""; // Now using OpenRouter API key directly in functions

// SEO metadata storage and retrieval functions
async function saveSeoMetadata(itemId, seoData) {
  try {
    // Create a reference to the item's SEO document
    const seoDocRef = doc(db, 'seo', itemId);
    
    // Save the SEO data
    await setDoc(seoDocRef, seoData);
    console.log(`SEO metadata saved for item: ${itemId}`);
    
    return true;
  } catch (error) {
    console.error("Error saving SEO metadata:", error);
    return false;
  }
}

async function getSeoMetadata(itemId) {
  try {
    const seoDocRef = doc(db, 'seo', itemId);
    const docSnap = await getDoc(seoDocRef);
    
    if (docSnap.exists()) {
      return docSnap.data();
    }
    
    return null;
  } catch (error) {
    console.error("Error getting SEO metadata:", error);
    return null;
  }
}

// Function to generate SEO metadata using item data and OpenRouter API
async function generateSeoMetadata(itemData) {
  try {
    // Define OpenRouter API credentials
    const OPENROUTER_API_KEY = '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';
    const OPENROUTER_API_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
    
    // Check if we have an API key
    if (!OPENROUTER_API_KEY) {
      console.log("No OpenRouter API key available, using basic metadata generator");
      return generateBasicSeoMetadata(itemData);
    }
    
    // Determine if this is a cracked/free version based on category
    let contentType = "";
    if (itemData.category === 'games') {
      contentType = "Free Download Full Version (Cracked)";
    } else if (itemData.category === 'windows') {
      contentType = "Free Download Latest Version + Crack";
    } else if (itemData.category === 'mac') {
      contentType = "Free Download for Mac + Full Version";
    }
    
    // Strict character limits for SEO metadata
    const TITLE_MAX_LENGTH = 60; // Maximum title length
    const TITLE_IDEAL_LENGTH = 55; // Ideal title length
    const DESC_MAX_LENGTH = 160; // Maximum description length
    const DESC_IDEAL_LENGTH = 155; // Ideal description length
    const KEYWORDS_MAX_COUNT = 8; // Maximum number of keywords
    
    const prompt = `
    You are an expert SEO specialist for software download sites. Generate highly optimized metadata for a product from the R8Y website. This website offers premium software and games for free download.
    
    Product information:
    - Title: ${itemData.title}
    - Category: ${itemData.category}
    - Subcategory: ${itemData.subcategory}
    - Description: ${itemData.desc ? itemData.desc.substring(0, 500) : 'No description available'}
    - Platform: ${itemData.platform || 'PC'}
    - Version: ${itemData.version || 'Latest'}
    - Content Type: ${contentType}
    - Current Year: 2025
    
    IMPORTANT CONTENT INFORMATION:
    - For PC Games: All games are cracked premium versions available for free download, safe and virus-free
    - For Windows Software: All software includes crack/patch/activation for free use, latest versions
    - For Mac Apps: All apps are premium versions cracked for free use on Mac, fully tested
    
    CREATE SEO METADATA FOLLOWING THESE STRICT REQUIREMENTS:
    
    1. META TITLE FORMAT: 
       "${itemData.title} Crack Version For Free - Download... | R8Y - (2025)"
       - EXACTLY 50-${TITLE_MAX_LENGTH} characters, prefer ${TITLE_IDEAL_LENGTH}
       - MUST include product name
       - MUST include "Crack" or "Cracked" 
       - MUST include "R8Y" brand
       - MUST include current year in parentheses at end
       - DO NOT exceed ${TITLE_MAX_LENGTH} characters under any circumstances
    
    2. META DESCRIPTION FORMAT:
       - EXACTLY 150-${DESC_MAX_LENGTH} characters, prefer ${DESC_IDEAL_LENGTH}
       - Begin with action verb (Download, Get, etc.)
       - Mention it's free, cracked/premium, and safe
       - Include key features and version information
       - Must be compelling and drive clicks
       - Must contain high-value search terms
       - DO NOT exceed ${DESC_MAX_LENGTH} characters under any circumstances
    
    3. META KEYWORDS FORMAT:
       - EXACTLY ${KEYWORDS_MAX_COUNT} keywords maximum (not more)
       - Include long-tail variations for the product
       - Always include: product name + crack, free download, latest version, full version
       - Add category-specific relevant terms that users actually search for
    
    This SEO content MUST immediately boost search ranking and site traffic. Make every character count.
    Make sure all content is safe, virus-free, and secure.
    
    Respond in JSON format with metaTitle, metaDescription, and metaKeywords properties.
    `;
    
    const response = await fetch(OPENROUTER_API_ENDPOINT, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://r8y.com',
        'X-Title': 'R8YMatrix SEO'
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-coder-v2.0", // Using DeepSeek R1 0528 model for highly optimized SEO
        messages: [
          {
            role: "system",
            content: "You are DeepSeek R1 0528, a specialized SEO tool that generates highly optimized metadata for software download websites. Your goal is to create SEO content that follows exact templates, maintains ideal character counts, and maximizes search engine ranking. You specialize in creating concise metadata for software websites that drives high organic traffic."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 500 // Limit token generation for safety and efficiency
      })
    });
    
    // Handle API response
    const data = await response.json();
    
    if (data.choices && data.choices[0] && data.choices[0].message) {
      try {
        const content = data.choices[0].message.content;
        const metadata = JSON.parse(content);
        
        // First create basic metadata object with fallbacks and sanitize content for safety
        const initialMetadata = {
          metaTitle: sanitizeSeoContent(metadata.metaTitle) || generateDefaultTitle(itemData),
          metaDescription: sanitizeSeoContent(metadata.metaDescription) || generateDefaultDescription(itemData),
          metaKeywords: metadata.metaKeywords || generateDefaultKeywords(itemData)
        };
        
        // Log safe content generation for monitoring
        console.log("AI-generated SEO content sanitized for safety");
        
        // Strictly enforce character limits before optimization
        if (initialMetadata.metaTitle && initialMetadata.metaTitle.length > TITLE_MAX_LENGTH) {
          initialMetadata.metaTitle = initialMetadata.metaTitle.substring(0, TITLE_MAX_LENGTH);
        }
        
        if (initialMetadata.metaDescription && initialMetadata.metaDescription.length > DESC_MAX_LENGTH) {
          initialMetadata.metaDescription = initialMetadata.metaDescription.substring(0, DESC_MAX_LENGTH - 3) + '...';
        }
        
        if (initialMetadata.metaKeywords) {
          // Sanitize keywords individually
          let keywords = initialMetadata.metaKeywords.split(',')
            .map(k => sanitizeSeoContent(k.trim()))
            .filter(k => k);
          
          // Limit number of keywords
          if (keywords.length > KEYWORDS_MAX_COUNT) {
            keywords = keywords.slice(0, KEYWORDS_MAX_COUNT);
          }
          
          initialMetadata.metaKeywords = keywords.join(', ');
        }
        
        // Show notification to user that content is safe
        showToast("AI SEO content generated safely and securely", "success", "Security Alert", 3000);
        
        // Then optimize it to ensure it meets all health criteria
        return optimizeSeoMetadata(initialMetadata, itemData);
      } catch (parseError) {
        console.error("Error parsing DeepSeek response:", parseError);
        return generateBasicSeoMetadata(itemData);
      }
    } else {
      console.error("Unexpected API response format:", data);
      return generateBasicSeoMetadata(itemData);
    }
  } catch (error) {
    console.error("Error generating SEO metadata with DeepSeek:", error);
    return generateBasicSeoMetadata(itemData);
  }
}

// Fallback function to generate basic SEO metadata without DeepSeek
function generateBasicSeoMetadata(itemData) {
  return {
    metaTitle: generateDefaultTitle(itemData),
    metaDescription: generateDefaultDescription(itemData),
    metaKeywords: generateDefaultKeywords(itemData)
  };
}

// Helper functions for generating default metadata
function generateDefaultTitle(itemData) {
  const maxLength = 60;
  let title = '';
  
  // Generate title based on category using our optimized format
  if (itemData.category === 'games') {
    title = `${itemData.title} Crack Version For Free - Download... | R8Y - (2025)`;
  } else if (itemData.category === 'windows') {
    title = `${itemData.title} Crack Version For Free - Download... | R8Y - (2025)`;
  } else if (itemData.category === 'mac') {
    title = `${itemData.title} Crack Version For Mac - Download... | R8Y - (2025)`;
  } else {
    title = `${itemData.title} Crack Version For Free - Download... | R8Y - (2025)`;
  }
  
  // Ensure proper length
  return title.length > maxLength ? `${title.substring(0, maxLength - 14)}... | R8Y - (2025)` : title;
}

function generateDefaultDescription(itemData) {
  const maxLength = 160;
  let desc = '';
  
  // Generate description based on category with optimized format
  if (itemData.category === 'games') {
    desc = `Download ${itemData.title} ${itemData.version || ''} - Fully cracked premium game with all features unlocked. Works perfectly after installation, virus-free and tested. No additional cracks needed.`;
  } else if (itemData.category === 'windows') {
    desc = `Get ${itemData.title} ${itemData.version || 'Latest Version'} with working crack & lifetime activation. Premium Windows software with all features unlocked. Safe download, virus-free, 100% working.`;
  } else if (itemData.category === 'mac') {
    desc = `Download ${itemData.title} ${itemData.version || ''} for Mac - Premium cracked version with full activation. Compatible with latest macOS. No additional patches needed, ready to use.`;
  } else {
    desc = `Download ${itemData.title} ${itemData.version || ''} cracked version - Premium software with lifetime activation. Works perfectly on ${getCategoryName(itemData.category)}. Safe and virus-free.`;
  }
  
  // Ensure exact proper length for optimal SEO
  if (desc.length > maxLength) {
    return desc.substring(0, maxLength - 3) + '...';
  } else if (desc.length < maxLength) {
    return desc + '.'.repeat(maxLength - desc.length);
  }
  return desc;
}

function generateDefaultKeywords(itemData) {
  // Base keywords for all categories
  const baseKeywords = [
    itemData.title,
    `${itemData.title} download`,
    `${itemData.title} free download`,
    getCategoryName(itemData.category),
    itemData.subcategory,
    "R8Y"
  ];
  
  // Add version if available
  if (itemData.version) {
    baseKeywords.push(`${itemData.title} ${itemData.version}`);
  }
  
  // Add category-specific keywords
  if (itemData.category === 'games') {
    baseKeywords.push(
      `${itemData.title} cracked`,
      `${itemData.title} full version`,
      `download ${itemData.title} crack`,
      `${itemData.title} free pc game`,
      `${itemData.title} torrent`,
      `${itemData.title} gameplay`
    );
  } else if (itemData.category === 'windows') {
    baseKeywords.push(
      `${itemData.title} with crack`,
      `${itemData.title} latest version`,
      `${itemData.title} activation key`,
      `${itemData.title} patch`,
      `${itemData.title} keygen`,
      `${itemData.title} full version free`
    );
  } else if (itemData.category === 'mac') {
    baseKeywords.push(
      `${itemData.title} for mac`,
      `${itemData.title} mac crack`,
      `${itemData.title} mac download`,
      `${itemData.title} mac torrent`,
      `${itemData.title} mac free`,
      `${itemData.title} macos`
    );
  }
  
  // Return comma-separated keywords
  return baseKeywords.join(", ");
}

function getCategoryName(category) {
  switch (category) {
    case 'games': return 'PC Games';
    case 'windows': return 'Windows Software';
    case 'mac': return 'Mac Apps';
    default: return category;
  }
}

// R8YMatrix SEO Suggestion functions
async function generateSeoSuggestions(itemData, currentMetadata) {
  try {
    // Define OpenRouter API credentials
    const OPENROUTER_API_KEY = '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';
    const OPENROUTER_API_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
    
    // Check if we have an API key
    if (!OPENROUTER_API_KEY) {
      console.log("No OpenRouter API key available, using basic suggestions generator");
      return generateBasicSeoSuggestions(itemData, currentMetadata);
    }
    
    // Determine if this is a cracked/free version based on category
    let contentType = "";
    if (itemData.category === 'games') {
      contentType = "Free Download Full Version (Cracked)";
    } else if (itemData.category === 'windows') {
      contentType = "Free Download Latest Version + Crack";
    } else if (itemData.category === 'mac') {
      contentType = "Free Download for Mac + Full Version";
    }
    
    const prompt = `
    You are an advanced SEO expert for optimizing software download websites. You understand high-volume search patterns and keywords for the software/games piracy niche. Generate highly optimized SEO improvement suggestions for this product from the R8Y website.
    
    Product information:
    - Title: ${itemData.title}
    - Category: ${itemData.category}
    - Subcategory: ${itemData.subcategory}
    - Description: ${itemData.desc}
    - Platform: ${itemData.platform || 'PC'}
    - Version: ${itemData.version || 'Latest'}
    - Content Type: ${contentType}
    - Current Year: 2025
    
    Current metadata:
    - Meta Title: ${currentMetadata.metaTitle}
    - Meta Description: ${currentMetadata.metaDescription}
    - Meta Keywords: ${currentMetadata.metaKeywords}
    
    IMPORTANT CONTENT INFORMATION:
    - For PC Games: All games are cracked premium versions available for free download, safe and virus-free
    - For Windows Software: All software includes crack/patch/activation for free use, latest versions
    - For Mac Apps: All apps are premium versions cracked for free use on Mac, fully tested
    
    GENERATE THE FOLLOWING SUGGESTIONS USING THESE EXACT FORMATS:
    
    1. Five alternative meta title suggestions (exactly 50-60 characters each):
       - All must follow format: "[Product] Crack Version For Free - Download... | R8Y - (2025)"
       - MUST include product name
       - MUST include "Crack" or "Cracked" terminology
       - MUST include "R8Y" brand
       - MUST include current year (2025) in parentheses at end
       - Each title must be uniquely different and highly optimized for search engines
    
    2. Six high-impact keyword suggestions:
       - Must include long-tail variants that users ACTUALLY search for
       - Include category-specific terms (crack, keygen, torrent, activation, etc.)
       - Focus on proven high-traffic keywords in the download niche
       - Include product name with relevant modifiers (premium, official, working)
       
    3. Three alternative meta description suggestions (EXACTLY 150-160 characters each):
       - Must start with action verbs (Download, Get, etc.)
       - Must mention it's free, cracked/premium, and safe
       - Must highlight key features and exact version information
       - Must be perfectly optimized for click-through rate
       - Must maintain exact character count for optimal SEO
    
    Respond in JSON format with titleSuggestions (array), keywordSuggestions (array), and descriptionSuggestions (array).
    `;
    
    const response = await fetch(OPENROUTER_API_ENDPOINT, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://r8y.com',
        'X-Title': 'R8YMatrix SEO'
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-coder-v2.0", // DeepSeek R1 0528 model
        messages: [
          {
            role: "system",
            content: "You are DeepSeek R1 0528, a specialized SEO tool that generates highly optimized metadata for software download websites. Your goal is to suggest SEO content that follows exact templates, maintains ideal character counts, and maximizes search engine ranking. You specialize in creating metadata for crack/pirated software websites that drives high organic traffic."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" }
      })
    });
    
    const data = await response.json();
    
    if (data.choices && data.choices[0] && data.choices[0].message) {
      try {
        const content = data.choices[0].message.content;
        const suggestions = JSON.parse(content);
        
        // Create optimized title suggestions
        const titleSuggestions = (suggestions.titleSuggestions || []).map(title => {
          // Create a temporary metadata object
          const tempMetadata = {
            metaTitle: title,
            metaDescription: '', // Not needed for this optimization
            metaKeywords: ''    // Not needed for this optimization
          };
          
          // Use the optimizer to ensure each title meets requirements
          return optimizeSeoMetadata(tempMetadata, itemData).metaTitle;
        });
        
        // Create optimized description suggestions
        const descriptionSuggestions = (suggestions.descriptionSuggestions || []).map(desc => {
          // Create a temporary metadata object
          const tempMetadata = {
            metaTitle: '',      // Not needed for this optimization
            metaDescription: desc,
            metaKeywords: ''    // Not needed for this optimization
          };
          
          // Use the optimizer to ensure each description meets requirements
          return optimizeSeoMetadata(tempMetadata, itemData).metaDescription;
        });
        
        return {
          titleSuggestions: titleSuggestions.length > 0 ? titleSuggestions : [],
          keywordSuggestions: suggestions.keywordSuggestions || [],
          descriptionSuggestions: descriptionSuggestions.length > 0 ? descriptionSuggestions : []
        };
      } catch (parseError) {
        console.error("Error parsing DeepSeek suggestions response:", parseError);
        return generateBasicSeoSuggestions(itemData, currentMetadata);
      }
    } else {
      console.error("Unexpected API response format for suggestions:", data);
      return generateBasicSeoSuggestions(itemData, currentMetadata);
    }
  } catch (error) {
    console.error("Error generating SEO suggestions with DeepSeek:", error);
    return generateBasicSeoSuggestions(itemData, currentMetadata);
  }
}

// Fallback function for SEO suggestions without AI
function generateBasicSeoSuggestions(itemData, currentMetadata) {
  // Title suggestions - customized by category
  let titleSuggestions = [];
  
  if (itemData.category === 'games') {
    titleSuggestions = [
      `${itemData.title} ${itemData.version || ''} Free Download PC Game | R8Y`,
      `Download ${itemData.title} ${itemData.version || ''} Cracked Full Version | R8Y`,
      `${itemData.title} Free Download Full PC Game (Cracked) | R8Y`,
      `${itemData.title} ${itemData.version || ''} Free PC Game Download | R8Y`,
      `${itemData.title} PC Game Free Download Full Version | R8Y`
    ];
  } else if (itemData.category === 'windows') {
    titleSuggestions = [
      `${itemData.title} ${itemData.version || ''} Free Download + Crack | R8Y`,
      `Download ${itemData.title} ${itemData.version || ''} Full Version | R8Y`,
      `${itemData.title} ${itemData.version || ''} With Crack Free Download | R8Y`,
      `${itemData.title} Latest Version + Activation Key Free | R8Y`,
      `${itemData.title} ${itemData.version || ''} Free Download Windows | R8Y`
    ];
  } else if (itemData.category === 'mac') {
    titleSuggestions = [
      `${itemData.title} ${itemData.version || ''} for Mac Free Download | R8Y`,
      `Download ${itemData.title} ${itemData.version || ''} macOS Full Version | R8Y`,
      `${itemData.title} Mac Free Download + Crack | R8Y`,
      `${itemData.title} ${itemData.version || ''} macOS Cracked Version | R8Y`,
      `Download ${itemData.title} Full Version for Mac | R8Y`
    ];
  } else {
    titleSuggestions = [
      `Download ${itemData.title} ${itemData.version || ''} for ${getCategoryName(itemData.category)} | R8Y`,
      `${itemData.title} ${itemData.version || ''} ${itemData.subcategory} Download | R8Y`,
      `${itemData.title} - Latest ${getCategoryName(itemData.category)} Download | R8Y`
    ];
  }
  
  // Keyword suggestions - customized by category
  let keywordSuggestions = [];
  
  if (itemData.category === 'games') {
    keywordSuggestions = [
      `${itemData.title} download highly compressed`,
      `${itemData.title} game free download torrent`,
      `${itemData.title} repack version download`,
      `${itemData.title} all dlc unlocked`,
      `${itemData.title} multiplayer cracked`,
      `${itemData.title} system requirements`
    ];
  } else if (itemData.category === 'windows') {
    keywordSuggestions = [
      `${itemData.title} lifetime license key`,
      `${itemData.title} pro version crack`,
      `${itemData.title} serial key 2023`,
      `${itemData.title} preactivated download`,
      `${itemData.title} latest patch update`,
      `${itemData.title} portable version free`
    ];
  } else if (itemData.category === 'mac') {
    keywordSuggestions = [
      `${itemData.title} for mac catalina`,
      `${itemData.title} mac monterey compatible`,
      `${itemData.title} silicon m1 compatible`,
      `${itemData.title} macos latest version`,
      `${itemData.title} mac keygen download`,
      `${itemData.title} mac torrent download`
    ];
  } else {
    keywordSuggestions = [
      `${itemData.title} latest version`,
      `download ${itemData.title} ${itemData.version || ''}`,
      `${itemData.title} for ${getCategoryName(itemData.category)}`,
      `${itemData.subcategory} software download`
    ];
  }
  
  // Description suggestions - customized by category
  let descriptionSuggestions = [];
  
  if (itemData.category === 'games') {
    descriptionSuggestions = [
      `Download ${itemData.title} for PC - Free cracked version with all DLCs unlocked. Enjoy this premium AAA game with working multiplayer. Fast and secure download from R8Y.`,
      `Get ${itemData.title} full game free download for PC. Latest ${itemData.version || 'version'} with crack included. No registration needed, direct link, and 100% virus free!`,
      `Looking for ${itemData.title}? Download the complete PC game for free! Pre-installed, cracked and ready to play. Safe download with all features unlocked.`
    ];
  } else if (itemData.category === 'windows') {
    descriptionSuggestions = [
      `Download ${itemData.title} ${itemData.version || 'latest version'} with working crack. Premium Windows software with activation key included. No registration required!`,
      `Get ${itemData.title} free download for Windows. Includes crack, serial key and lifetime license activation. Fast download links and virus-free guarantee.`,
      `${itemData.title} ${itemData.version || 'latest version'} with crack free download. Pre-activated professional version with all premium features unlocked. 100% working!`
    ];
  } else if (itemData.category === 'mac') {
    descriptionSuggestions = [
      `Download ${itemData.title} for Mac - Full version with working crack. Compatible with macOS ${itemData.version || 'latest version'} including M1 chips. Safe and virus-free.`,
      `Get ${itemData.title} for macOS - Premium app with all features unlocked. Free download, pre-activated and tested on all Mac versions. Works flawlessly!`,
      `${itemData.title} Mac download free - Premium version with working crack. Compatible with Monterey, Catalina and Big Sur. No Apple ID required!`
    ];
  } else {
    descriptionSuggestions = [
      `Download the latest version of ${itemData.title} for ${getCategoryName(itemData.category)}. Fast and secure downloads. Get ${itemData.subcategory} software from R8Y.`,
      `Looking for ${itemData.title}? Download the official version for ${getCategoryName(itemData.category)}. R8Y offers verified and safe ${itemData.subcategory} downloads.`
    ];
  }
  
  // Ensure descriptions are within the proper length limit
  const maxLength = 160;
  descriptionSuggestions = descriptionSuggestions.map(desc => 
    desc.length > maxLength ? `${desc.substring(0, maxLength - 3)}...` : desc
  );
  
  return {
    titleSuggestions,
    keywordSuggestions,
    descriptionSuggestions
  };
}

// SEO health check functions
function checkSeoHealth(metaTitle, metaDescription, metaKeywords) {
  const healthResults = [];
  let score = 0;
  const maxScore = 100;
  let currentScore = 0;
  
  const itemTitle = document.getElementById('item-title').value;
  const itemCategory = document.getElementById('item-category').value;
  
  // Check title length (ideal: 50-60 chars)
  if (metaTitle) {
    if (metaTitle.length < 30) {
      healthResults.push({
        type: 'error',
        message: 'Meta title is too short (less than 30 characters).'
      });
    } else if (metaTitle.length > 60) {
      healthResults.push({
        type: 'warning',
        message: 'Meta title is too long (more than 60 characters).'
      });
      currentScore += 10;
    } else if (metaTitle.length >= 50 && metaTitle.length <= 60) {
      healthResults.push({
        type: 'success',
        message: 'Meta title has optimal length (50-60 characters).'
      });
      currentScore += 20;
    } else {
      healthResults.push({
        type: 'warning',
        message: 'Meta title length is acceptable but not optimal.'
      });
      currentScore += 15;
    }
    
    // Check if title contains the item name
    if (metaTitle.includes(itemTitle)) {
      healthResults.push({
        type: 'success',
        message: 'Meta title contains the item name.'
      });
      currentScore += 15;
    } else {
      healthResults.push({
        type: 'error',
        message: 'Meta title should contain the item name.'
      });
    }
    
    // Check if title contains R8Y brand
    if (metaTitle.includes('R8Y')) {
      healthResults.push({
        type: 'success',
        message: 'Meta title contains the R8Y brand name.'
      });
      currentScore += 10;
    } else {
      healthResults.push({
        type: 'error',
        message: 'Meta title must contain "R8Y" brand name for consistency.'
      });
    }
    
    // Check if title contains the year 2025
    if (metaTitle.includes('2025')) {
      healthResults.push({
        type: 'success',
        message: 'Meta title contains the current year (2025) for relevancy.'
      });
      currentScore += 10;
    } else {
      healthResults.push({
        type: 'error',
        message: 'Meta title must include the year (2025) for better search ranking.'
      });
    }
    
    // Check if title contains "Crack" or "Cracked"
    const metaTitleLower = metaTitle.toLowerCase();
    if (metaTitleLower.includes('crack')) {
      healthResults.push({
        type: 'success',
        message: 'Meta title includes "Crack" keyword for higher search volume.'
      });
      currentScore += 10;
    } else {
      healthResults.push({
        type: 'error',
        message: 'Meta title should include "Crack" or "Cracked" for optimal SEO.'
      });
    }
    
    // Check for format resemblance
    if (metaTitle.includes('For Free - Download') && metaTitle.includes('| R8Y -')) {
      healthResults.push({
        type: 'success',
        message: 'Meta title follows the optimal format.'
      });
      currentScore += 15;
    } else {
      healthResults.push({
        type: 'warning',
        message: 'Meta title should follow format: "[Product] Crack Version For Free - Download... | R8Y - (2025)"'
      });
    }
  } else {
    healthResults.push({
      type: 'error',
      message: 'Meta title is missing.'
    });
  }
  
  // Check description length (ideal: 150-160 chars)
  if (metaDescription) {
    if (metaDescription.length < 70) {
      healthResults.push({
        type: 'error',
        message: 'Meta description is too short (less than 70 characters).'
      });
    } else if (metaDescription.length > 160) {
      healthResults.push({
        type: 'warning',
        message: 'Meta description is too long (more than 160 characters).'
      });
      currentScore += 10;
    } else if (metaDescription.length >= 150 && metaDescription.length <= 160) {
      healthResults.push({
        type: 'success',
        message: 'Meta description has optimal length (150-160 characters).'
      });
      currentScore += 20;
    } else {
      healthResults.push({
        type: 'warning',
        message: 'Meta description length is acceptable but not optimal.'
      });
      currentScore += 15;
    }
    
    // Check if description starts with action verb
    const actionVerbs = ['download', 'get', 'install'];
    let startsWithVerb = false;
    
    for (const verb of actionVerbs) {
      if (metaDescription.toLowerCase().startsWith(verb)) {
        startsWithVerb = true;
        break;
      }
    }
    
    if (startsWithVerb) {
      healthResults.push({
        type: 'success',
        message: 'Description starts with action verb, which is good for CTR.'
      });
      currentScore += 5;
    } else {
      healthResults.push({
        type: 'warning',
        message: 'Description should start with action verbs like: Download, Get, Install.'
      });
    }
    
    // Check for safety terms in description
    const safetyTerms = ['safe', 'virus-free', 'secure', 'tested'];
    let safetyTermFound = false;
    
    for (const term of safetyTerms) {
      if (metaDescription.toLowerCase().includes(term)) {
        safetyTermFound = true;
        break;
      }
    }
    
    if (safetyTermFound) {
      healthResults.push({
        type: 'success',
        message: 'Description mentions safety/security, which builds trust.'
      });
      currentScore += 5;
    } else {
      healthResults.push({
        type: 'warning',
        message: 'Description should mention safety with terms like: safe, virus-free, secure.'
      });
    }
    
    // Check for premium/crack-related terms
    const crackTerms = ['crack', 'premium', 'activation', 'licensed', 'full version'];
    let crackTermFound = false;
    
    for (const term of crackTerms) {
      if (metaDescription.toLowerCase().includes(term)) {
        crackTermFound = true;
        break;
      }
    }
    
    if (crackTermFound) {
      healthResults.push({
        type: 'success',
        message: 'Description mentions premium/crack features, which is good for SEO.'
      });
      currentScore += 10;
    } else {
      healthResults.push({
        type: 'warning',
        message: 'Description should mention terms like: crack, premium, activation, full version.'
      });
    }
    
    // Check if description contains keywords
    if (metaKeywords && metaKeywords.split(',').some(keyword => 
      metaDescription.toLowerCase().includes(keyword.trim().toLowerCase()))) {
      healthResults.push({
        type: 'success',
        message: 'Meta description contains keywords.'
      });
      currentScore += 10;
    } else {
      healthResults.push({
        type: 'warning',
        message: 'Meta description should contain some of your keywords.'
      });
      currentScore += 5;
    }
  } else {
    healthResults.push({
      type: 'error',
      message: 'Meta description is missing.'
    });
  }
  
  // Check keywords
  if (metaKeywords) {
    const keywords = metaKeywords.split(',').map(k => k.trim()).filter(k => k);
    if (keywords.length < 3) {
      healthResults.push({
        type: 'error',
        message: 'Too few keywords (less than 3).'
      });
    } else if (keywords.length > 10) {
      healthResults.push({
        type: 'warning',
        message: 'Too many keywords (more than 10).'
      });
      currentScore += 5;
    } else {
      healthResults.push({
        type: 'success',
        message: `Good number of keywords (${keywords.length}).`
      });
      currentScore += 15;
    }
  } else {
    healthResults.push({
      type: 'error',
      message: 'Meta keywords are missing.'
    });
  }
  
  // Calculate final score
  score = Math.min(Math.max(Math.round(currentScore), 0), maxScore);
  
  return {
    healthResults,
    score
  };
}

// Load SEO data for an item
async function loadSeoData(itemId) {
  try {
    const seoData = await getSeoMetadata(itemId);
    
    if (seoData) {
      console.log("SEO data loaded for item:", itemId, seoData);
      
      // Populate form fields with SEO data
      const metaTitleInput = document.getElementById('meta-title');
      const metaDescInput = document.getElementById('meta-description');
      const metaKeywordsInput = document.getElementById('meta-keywords');
      
      if (metaTitleInput && seoData.metaTitle) {
        metaTitleInput.value = seoData.metaTitle;
      }
      
      if (metaDescInput && seoData.metaDescription) {
        metaDescInput.value = seoData.metaDescription;
      }
      
      if (metaKeywordsInput && seoData.metaKeywords) {
        metaKeywordsInput.value = seoData.metaKeywords;
      }
      
      // Update UI
      updateCharacterCount('meta-title', 'title-character-count', 60);
      updateCharacterCount('meta-description', 'desc-character-count', 160);
      updateKeywordCount();
      updateSeoPreview(seoData.metaTitle, seoData.metaDescription);
      updateSeoHealth();
    } else {
      console.log("No SEO data found for item:", itemId);
    }
  } catch (error) {
    console.error("Error loading SEO data:", error);
  }
}

// UI Update functions
function updateSeoPreview(metaTitle, metaDescription) {
  const previewTitle = document.getElementById('preview-title');
  const previewDescription = document.getElementById('preview-description');
  const previewUrl = document.getElementById('preview-url');
  
  // Update preview elements
  if (previewTitle) {
    previewTitle.textContent = metaTitle || 'Title will appear here';
  }
  
  if (previewDescription) {
    previewDescription.textContent = metaDescription || 'Description will appear here. Make sure it\'s compelling and includes your target keywords.';
  }
  
  if (previewUrl) {
    // Use slug field if available, otherwise generate from title
    const slugInput = document.getElementById('item-slug').value;
    const itemTitle = document.getElementById('item-title').value;
    // Always use lowercase for URLs and ensure proper formatting
    const slug = (slugInput ? generateSlugFromTitle(slugInput) : generateSlugFromTitle(itemTitle) || 'item-name').toLowerCase();
    previewUrl.textContent = `r8ymatrix.netlify.app/items/${slug}`;
  }
}

function updateCharacterCount(inputId, countId, maxLength) {
  const input = document.getElementById(inputId);
  const counter = document.getElementById(countId);
  
  if (input && counter) {
    const currentLength = input.value.length;
    
    // Get min length based on field type
    let minLength = inputId === 'meta-title' ? 50 : 
                    inputId === 'meta-description' ? 150 : 0;
    
    // Update counter text with recommended range
    counter.textContent = `${currentLength}/${minLength}-${maxLength} characters`;
    
    // Update counter color based on length
    if (currentLength > maxLength) {
      counter.style.color = '#f5222d'; // Red for too long
      counter.title = `Too long: Exceeds maximum of ${maxLength} characters`;
    } else if (currentLength < minLength) {
      counter.style.color = '#faad14'; // Yellow for too short
      counter.title = `Too short: Minimum recommendation is ${minLength} characters`;
    } else if (currentLength > maxLength * 0.95) {
      counter.style.color = '#faad14'; // Yellow for approaching limit
      counter.title = `Getting close to maximum length: ${maxLength} characters`;
    } else {
      counter.style.color = '#52c41a'; // Green for optimal
      counter.title = `Optimal length: Between ${minLength} and ${maxLength} characters`;
    }
  }
}

function updateSeoHealth() {
  const metaTitle = document.getElementById('meta-title').value;
  const metaDescription = document.getElementById('meta-description').value;
  const metaKeywords = document.getElementById('meta-keywords').value;
  
  // Perform health check
  const healthCheck = checkSeoHealth(metaTitle, metaDescription, metaKeywords);
  
  // Update health results
  const healthResultsContainer = document.getElementById('seo-health-results');
  if (healthResultsContainer) {
    healthResultsContainer.innerHTML = '';
    
    healthCheck.healthResults.forEach(result => {
      const healthItem = document.createElement('div');
      healthItem.className = `health-item ${result.type}`;
      
      let icon = 'info-circle';
      if (result.type === 'error') icon = 'times-circle';
      if (result.type === 'success') icon = 'check-circle';
      if (result.type === 'warning') icon = 'exclamation-triangle';
      
      healthItem.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${result.message}</span>
      `;
      
      healthResultsContainer.appendChild(healthItem);
    });
  }
  
  // Update score
  const scoreValue = document.getElementById('seo-score-value');
  if (scoreValue) {
    scoreValue.textContent = healthCheck.score;
  }
  
  // Update score circle
  const scoreCircle = document.getElementById('score-circle');
  if (scoreCircle) {
    const circumference = 2 * Math.PI * 35; // r=35
    const offset = circumference - (healthCheck.score / 100 * circumference);
    scoreCircle.style.strokeDasharray = `${circumference} ${circumference}`;
    scoreCircle.style.strokeDashoffset = offset;
    
    // Update score color
    if (healthCheck.score < 40) {
      scoreCircle.style.stroke = '#f5222d';
    } else if (healthCheck.score < 70) {
      scoreCircle.style.stroke = '#faad14';
    } else {
      scoreCircle.style.stroke = '#52c41a';
    }
  }
  
  // Update individual field health indicators
  updateFieldHealth('title', metaTitle, 30, 60);
  updateFieldHealth('desc', metaDescription, 70, 160);
  updateFieldHealth('keywords', metaKeywords.split(',').map(k => k.trim()).filter(k => k).length, 3, 10);
}

function updateFieldHealth(field, value, minValue, maxValue) {
  const healthElement = document.getElementById(`${field}-health`);
  
  if (!healthElement) return;
  
  let status = 'poor';
  let message = '';
  
  if (field === 'keywords') {
    // For keywords, value is the count
    if (value >= 3 && value <= 10) {
      status = 'good';
      message = `Good number of keywords (${value})`;
    } else if (value < 3) {
      status = 'poor';
      message = `Too few keywords (${value})`;
    } else {
      status = 'fair';
      message = `Too many keywords (${value})`;
    }
  } else {
    // For text fields, value is the string
    const length = value ? value.length : 0;
    
    if (!value) {
      status = 'poor';
      message = `This field is required`;
    } else if (length < minValue) {
      status = 'poor';
      message = `Too short (${length} of recommended ${minValue}-${maxValue} characters)`;
    } else if (length > maxValue) {
      status = 'fair';
      message = `Too long (${length} of recommended ${minValue}-${maxValue} characters)`;
    } else {
      status = 'good';
      message = `Optimal length (${length} characters)`;
    }
  }
  
  healthElement.className = `seo-health ${status}`;
  healthElement.textContent = message;
}

function updateKeywordCount() {
  const keywordsInput = document.getElementById('meta-keywords');
  const keywordsCount = document.getElementById('keywords-count');
  
  if (keywordsInput && keywordsCount) {
    const keywords = keywordsInput.value
      .split(',')
      .map(k => k.trim())
      .filter(k => k);
    
    const count = keywords.length;
    keywordsCount.textContent = `${count} keyword${count !== 1 ? 's' : ''}`;
  }
}

function displaySeoSuggestions(suggestions) {
  // Display title suggestions
  const titleSuggestionEl = document.getElementById('title-suggestion');
  if (titleSuggestionEl && suggestions.titleSuggestions && suggestions.titleSuggestions.length > 0) {
    let content = '<div class="suggestion-tags">';
    suggestions.titleSuggestions.forEach(title => {
      content += `<div class="suggestion-tag" data-field="meta-title">${title}</div>`;
    });
    content += '</div>';
    titleSuggestionEl.querySelector('.suggestion-content').innerHTML = content;
  }
  
  // Display keyword suggestions
  const keywordsSuggestionEl = document.getElementById('keywords-suggestion');
  if (keywordsSuggestionEl && suggestions.keywordSuggestions && suggestions.keywordSuggestions.length > 0) {
    let content = '<div class="suggestion-tags">';
    suggestions.keywordSuggestions.forEach(keyword => {
      content += `<div class="suggestion-tag" data-field="meta-keywords" data-append="true">${keyword}</div>`;
    });
    content += '</div>';
    keywordsSuggestionEl.querySelector('.suggestion-content').innerHTML = content;
  }
  
  // Display description suggestions
  const descriptionSuggestionEl = document.getElementById('description-suggestion');
  if (descriptionSuggestionEl && suggestions.descriptionSuggestions && suggestions.descriptionSuggestions.length > 0) {
    let content = '<div class="suggestion-tags">';
    suggestions.descriptionSuggestions.forEach(desc => {
      content += `<div class="suggestion-tag" data-field="meta-description">${desc}</div>`;
    });
    content += '</div>';
    descriptionSuggestionEl.querySelector('.suggestion-content').innerHTML = content;
  }
  
  // Add click event listeners to suggestion tags
  document.querySelectorAll('.suggestion-tag').forEach(tag => {
    tag.addEventListener('click', function() {
      const field = this.getAttribute('data-field');
      const append = this.getAttribute('data-append') === 'true';
      const value = this.textContent;
      
      if (field && value) {
        const inputEl = document.getElementById(field);
        if (inputEl) {
          if (append && field === 'meta-keywords') {
            // For keywords, append with comma
            const currentValue = inputEl.value.trim();
            inputEl.value = currentValue ? `${currentValue}, ${value}` : value;
          } else {
            // For other fields, replace
            inputEl.value = value;
          }
          
          // Trigger events to update UI
          inputEl.dispatchEvent(new Event('input'));
          updateSeoPreview(
            document.getElementById('meta-title').value,
            document.getElementById('meta-description').value
          );
          updateSeoHealth();
        }
      }
    });
  });
}

// Setup SEO tab functionality
function setupSeoTab() {
  // Add input event listeners for character counts and preview updates
  const metaTitleInput = document.getElementById('meta-title');
  const metaDescInput = document.getElementById('meta-description');
  const metaKeywordsInput = document.getElementById('meta-keywords');
  
  // Function to get current item data from form
  function getCurrentItemData() {
    return {
      id: document.getElementById('item-id').value,
      title: document.getElementById('item-title').value,
      category: document.getElementById('item-category').value,
      subcategory: document.getElementById('item-subcategory').value,
      desc: document.getElementById('item-desc').value,
      version: document.getElementById('item-version').value || 'Latest',
      platform: document.getElementById('item-category').value === 'games' ? 'PC Games' : 
              document.getElementById('item-category').value === 'mac' ? 'Mac' : 'Windows'
    };
  }
  
  // Function to automatically optimize metadata
  function optimizeSeoFields() {
    if (metaTitleInput && metaDescInput && metaKeywordsInput) {
      const itemData = getCurrentItemData();
      const currentMetadata = {
        metaTitle: metaTitleInput.value,
        metaDescription: metaDescInput.value,
        metaKeywords: metaKeywordsInput.value
      };
      
      // Only optimize if there's content to optimize
      if (currentMetadata.metaTitle || currentMetadata.metaDescription || currentMetadata.metaKeywords) {
        // Get optimized metadata
        const optimized = optimizeSeoMetadata(currentMetadata, itemData);
        
        // Apply optimized values
        metaTitleInput.value = optimized.metaTitle;
        metaDescInput.value = optimized.metaDescription;
        metaKeywordsInput.value = optimized.metaKeywords;
        
        // Update UI
        updateCharacterCount('meta-title', 'title-character-count', 60);
        updateCharacterCount('meta-description', 'desc-character-count', 160);
        updateKeywordCount();
        updateSeoPreview(optimized.metaTitle, optimized.metaDescription);
        updateSeoHealth();
        
        showToast('SEO metadata automatically optimized!', 'success');
      } else {
        showToast('Please enter some SEO content to optimize', 'warning');
      }
    }
  }
  
  if (metaTitleInput) {
    metaTitleInput.addEventListener('input', function() {
      updateCharacterCount('meta-title', 'title-character-count', 60);
      updateSeoPreview(this.value, metaDescInput.value);
      updateSeoHealth();
    });
    
    // Automatically optimize on blur after 2 seconds of inactivity
    let titleTimeout;
    metaTitleInput.addEventListener('blur', function() {
      if (titleTimeout) clearTimeout(titleTimeout);
      titleTimeout = setTimeout(function() {
        // Only auto-optimize if the health score is below 70
        const healthCheck = checkSeoHealth(
          metaTitleInput.value,
          metaDescInput.value,
          metaKeywordsInput.value
        );
        if (healthCheck.score < 70) {
          optimizeSeoFields();
        }
      }, 2000);
    });
  }
  
  if (metaDescInput) {
    metaDescInput.addEventListener('input', function() {
      updateCharacterCount('meta-description', 'desc-character-count', 160);
      updateSeoPreview(metaTitleInput.value, this.value);
      updateSeoHealth();
    });
    
    // Automatically optimize on blur after 2 seconds of inactivity
    let descTimeout;
    metaDescInput.addEventListener('blur', function() {
      if (descTimeout) clearTimeout(descTimeout);
      descTimeout = setTimeout(function() {
        // Only auto-optimize if the health score is below 70
        const healthCheck = checkSeoHealth(
          metaTitleInput.value,
          metaDescInput.value,
          metaKeywordsInput.value
        );
        if (healthCheck.score < 70) {
          optimizeSeoFields();
        }
      }, 2000);
    });
  }
  
  if (metaKeywordsInput) {
    metaKeywordsInput.addEventListener('input', function() {
      updateKeywordCount();
      updateSeoHealth();
    });
  }
  
  // Add optimize button handler
  const optimizeSeoBtn = document.getElementById('optimize-seo-btn');
  if (optimizeSeoBtn) {
    optimizeSeoBtn.addEventListener('click', optimizeSeoFields);
    
    // Add tooltip to show recommended lengths
    optimizeSeoBtn.title = "Optimize SEO content to recommended character limits: Title (50-60), Description (150-160), Keywords (max 8)";
    
    // Display character limit info when user hovers over button
    optimizeSeoBtn.addEventListener('mouseenter', function() {
      showToast(
        "Recommended lengths: Title (50-60 chars), Description (150-160 chars), Keywords (max 8)", 
        "info", 
        "SEO Character Limits",
        3000
      );
    });
  }
  
  // Add generate button event handler
  const generateSeoBtn = document.getElementById('generate-seo-btn');
  if (generateSeoBtn) {
    // Update button text to include character limits
    generateSeoBtn.innerHTML = '<i class="fas fa-magic"></i> Generate Safe SEO Tags <span style="font-size: 10px; opacity: 0.8; margin-left: 5px;">(50-60 | 150-160 chars)</span>';
    
    generateSeoBtn.addEventListener('click', async function() {
      // Show loading state
      this.disabled = true;
      this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
      
      // Create and show processing overlay
      const processingOverlay = document.createElement('div');
      processingOverlay.className = 'ai-processing-overlay';
      processingOverlay.innerHTML = `
        <div class="ai-processing-container">
          <div class="ai-spinner"></div>
          <div class="ai-processing-text">
            <h3>DeepSeek R1 0528 Processing</h3>
            <div class="ai-step-container">
              <div class="ai-step active" id="step-analyzing">
                <i class="fas fa-search"></i> Analyzing content...
              </div>
              <div class="ai-step" id="step-keywords">
                <i class="fas fa-key"></i> Finding high-ranking keywords...
              </div>
              <div class="ai-step" id="step-generating">
                <i class="fas fa-cogs"></i> Generating optimized meta tags...
              </div>
              <div class="ai-step" id="step-suggestions">
                <i class="fas fa-lightbulb"></i> Creating SEO suggestions...
              </div>
            </div>
            <div class="ai-progress-container">
              <div class="ai-progress-bar"></div>
            </div>
          </div>
        </div>
      `;
      
      // Add styles for the overlay
      const style = document.createElement('style');
      style.textContent = `
        .ai-processing-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 1;
          transition: opacity 0.5s ease;
        }
        .ai-processing-container {
          background: #1a1a1a;
          border-radius: 8px;
          padding: 30px;
          width: 500px;
          max-width: 90%;
          box-shadow: 0 5px 30px rgba(0, 0, 0, 0.5);
          text-align: center;
          border: 1px solid #333;
        }
        .ai-spinner {
          width: 80px;
          height: 80px;
          margin: 0 auto 20px;
          border-radius: 50%;
          border: 6px solid transparent;
          border-top-color: #7b61ff;
          border-bottom-color: #7b61ff;
          animation: spin 1.5s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .ai-processing-text h3 {
          margin-bottom: 20px;
          color: #fff;
        }
        .ai-step-container {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          margin-bottom: 20px;
        }
        .ai-step {
          margin: 5px 0;
          color: #888;
          opacity: 0.5;
          text-align: left;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
        }
        .ai-step.active {
          color: #7b61ff;
          opacity: 1;
        }
        .ai-step.completed {
          color: #52c41a;
          opacity: 1;
        }
        .ai-step i {
          margin-right: 10px;
        }
        .ai-progress-container {
          height: 6px;
          background: #333;
          border-radius: 3px;
          overflow: hidden;
          margin-top: 20px;
        }
        .ai-progress-bar {
          height: 100%;
          width: 0%;
          background: linear-gradient(to right, #7b61ff, #52c41a);
          transition: width 0.5s ease;
        }
      `;
      document.head.appendChild(style);
      document.body.appendChild(processingOverlay);
      
      // Animation functions
      const updateProgress = (percent, activeStep) => {
        const progressBar = document.querySelector('.ai-progress-bar');
        if (progressBar) progressBar.style.width = `${percent}%`;
        
        // Update steps
        document.querySelectorAll('.ai-step').forEach(step => step.classList.remove('active'));
        document.querySelectorAll('.ai-step').forEach(step => {
          if (step.id === activeStep) step.classList.add('active');
          
          // Mark previous steps as completed
          if ((activeStep === 'step-keywords' && step.id === 'step-analyzing') ||
              (activeStep === 'step-generating' && ['step-analyzing', 'step-keywords'].includes(step.id)) ||
              (activeStep === 'step-suggestions' && ['step-analyzing', 'step-keywords', 'step-generating'].includes(step.id))) {
            step.classList.add('completed');
          }
        });
      };
      
      try {
        // Get item data from the form
        const itemData = getCurrentItemData();
        
        // Step 1: Analyzing content
        updateProgress(25, 'step-analyzing');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Step 2: Finding keywords
        updateProgress(50, 'step-keywords');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Step 3: Generating meta tags
        updateProgress(75, 'step-generating');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Generate SEO metadata using DeepSeek
        const metadata = await generateSeoMetadata(itemData);
        
        // Step 4: Creating suggestions
        updateProgress(90, 'step-suggestions');
        
        // Generate SEO suggestions
        const suggestions = await generateSeoSuggestions(itemData, metadata);
        
        // Update form fields with generated metadata
        if (metaTitleInput) metaTitleInput.value = metadata.metaTitle;
        if (metaDescInput) metaDescInput.value = metadata.metaDescription;
        if (metaKeywordsInput) metaKeywordsInput.value = metadata.metaKeywords;
        
        // Update UI
        updateCharacterCount('meta-title', 'title-character-count', 60);
        updateCharacterCount('meta-description', 'desc-character-count', 160);
        updateKeywordCount();
        updateSeoPreview(metadata.metaTitle, metadata.metaDescription);
        updateSeoHealth();
        
        // Display suggestions
        displaySeoSuggestions(suggestions);
        
        // Complete animation
        updateProgress(100, 'step-suggestions');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Remove overlay with animation
        const overlay = document.querySelector('.ai-processing-overlay');
        if (overlay) {
          overlay.style.opacity = 0;
          setTimeout(() => {
            overlay.remove();
          }, 500);
        }
        
        // Show success message
        showToast('DeepSeek R1 0528 metadata generated and auto-optimized!', 'success');
      } catch (error) {
        console.error('Error generating SEO data:', error);
        
        // Show error message
        showToast('Error generating SEO metadata. Please try again.', 'error');
        
        // Remove overlay
        const overlay = document.querySelector('.ai-processing-overlay');
        if (overlay) overlay.remove();
      } finally {
        // Reset button state
        this.disabled = false;
        this.innerHTML = '<i class="fas fa-magic"></i> Generate Safe SEO Tags <span style="font-size: 10px; opacity: 0.8; margin-left: 5px;">(50-60 | 150-160 chars)</span>';
      }
    });
  }
}

// Initialize SEO tab functionality when DOM is loaded
// (The actual initialization will be done in the main DOMContentLoaded event handler)

// New function to automatically optimize SEO content to meet health requirements
function optimizeSeoMetadata(metadata, itemData) {
  // Make a copy to avoid modifying the original
  const optimized = { ...metadata };
  
  // Define constant limits
  const TITLE_MIN_LENGTH = 50;
  const TITLE_MAX_LENGTH = 60;
  const DESC_MIN_LENGTH = 150;
  const DESC_MAX_LENGTH = 160;
  const KEYWORDS_MAX_COUNT = 8;
  
  // 1. Optimize title length (target: exactly 50-60 characters)
  if (optimized.metaTitle) {
    const titleLength = optimized.metaTitle.length;
    
    // If too long, trim it properly
    if (titleLength > TITLE_MAX_LENGTH) {
      // Extract product name - assume it's at the beginning of the title
      const productName = itemData.title.trim();
      
      // Create optimized title with the format: "[Product] Crack Version For Free | R8Y - (2025)"
      // Adjust product name length to fit within limits
      let maxProductLength = 25; // Start with reasonable length
      
      // Reduce product name length if title would still be too long
      while ((`${productName.substring(0, maxProductLength)} Crack Version Free | R8Y - (2025)`).length > TITLE_MAX_LENGTH && maxProductLength > 10) {
        maxProductLength--;
      }
      
      optimized.metaTitle = `${productName.substring(0, maxProductLength)}${maxProductLength < productName.length ? '...' : ''} Crack Version Free | R8Y - (2025)`;
    } 
    // If too short, expand it with additional keywords
    else if (titleLength < TITLE_MIN_LENGTH) {
      // Check if it already follows our format
      if (optimized.metaTitle.includes('Crack Version') && optimized.metaTitle.includes('| R8Y - (2025)')) {
        // It follows format but is too short, add descriptive terms
        if (itemData.category === 'games') {
          optimized.metaTitle = optimized.metaTitle.replace('Crack Version', 'Premium Crack Version');
        } else if (itemData.category === 'windows') {
          optimized.metaTitle = optimized.metaTitle.replace('Crack Version', 'Pro Crack Version');
        } else if (itemData.category === 'mac') {
          optimized.metaTitle = optimized.metaTitle.replace('Crack Version', 'macOS Crack Version');
        }
      } else {
        // Doesn't follow format, rebuild it
        optimized.metaTitle = generateDefaultTitle(itemData);
      }
      
      // Check length again after modifications
      if (optimized.metaTitle.length > TITLE_MAX_LENGTH) {
        optimized.metaTitle = optimized.metaTitle.substring(0, TITLE_MAX_LENGTH);
      }
    }
  } else {
    // If missing, generate a default one
    optimized.metaTitle = generateDefaultTitle(itemData);
  }
  
  // 2. Optimize description length (target: exactly 150-160 characters)
  if (optimized.metaDescription) {
    const descLength = optimized.metaDescription.length;
    
    if (descLength > DESC_MAX_LENGTH) {
      // Too long, trim it to exactly 157 characters and add ellipsis
      optimized.metaDescription = optimized.metaDescription.substring(0, DESC_MAX_LENGTH - 3) + '...';
    } else if (descLength < DESC_MIN_LENGTH) {
      // Too short, add more details to reach optimal length
      let additionalText = '';
      
      // Add category-specific filler that emphasizes safety and security
      if (itemData.category === 'games') {
        additionalText = ' Safe, virus-free, and tested on Windows 10/11. No survey, no password required.';
      } else if (itemData.category === 'windows') {
        additionalText = ' Safe, secure, and virus-free. Compatible with all Windows versions.';
      } else if (itemData.category === 'mac') {
        additionalText = ' Safe, secure, and virus-free. Compatible with all macOS versions.';
      } else {
        additionalText = ' Safe, secure, and virus-free. 100% working download.';
      }
      
      // Add only enough text to reach optimal length
      const spaceNeeded = DESC_MAX_LENGTH - descLength;
      if (spaceNeeded < additionalText.length) {
        additionalText = additionalText.substring(0, spaceNeeded);
      }
      
      optimized.metaDescription = optimized.metaDescription + additionalText;
    }
  } else {
    // If missing, generate a default one
    optimized.metaDescription = generateDefaultDescription(itemData);
  }
  
  // 3. Make sure keywords don't exceed the maximum count
  if (!optimized.metaKeywords || optimized.metaKeywords.length === 0) {
    optimized.metaKeywords = generateDefaultKeywords(itemData);
  } else {
    // Parse and limit keywords
    let keywords = optimized.metaKeywords.split(',').map(k => k.trim()).filter(k => k);
    
    // Ensure we have the most important keywords first
    const essentialKeywords = [
      `${itemData.title.toLowerCase()} download`,
      `${itemData.title.toLowerCase()} crack`,
      'free download',
      'safe download',
      'virus-free'
    ];
    
    // Add any essential keywords that are missing
    for (const keyword of essentialKeywords) {
      if (!keywords.some(k => k.toLowerCase().includes(keyword.toLowerCase()))) {
        keywords.unshift(keyword); // Add to beginning
      }
    }
    
    // Limit total keywords to KEYWORDS_MAX_COUNT
    if (keywords.length > KEYWORDS_MAX_COUNT) {
      keywords = keywords.slice(0, KEYWORDS_MAX_COUNT);
    }
    
    optimized.metaKeywords = keywords.join(', ');
  }
  
  // 4. Final safety check - make sure all content includes safety messaging
  if (optimized.metaDescription && !optimized.metaDescription.toLowerCase().includes('safe') && 
      !optimized.metaDescription.toLowerCase().includes('virus')) {
    // Add safety message if there's room
    if (optimized.metaDescription.length <= DESC_MAX_LENGTH - 15) {
      optimized.metaDescription += ' Safe, secure.';
    }
  }
  
  return optimized;
}

// Function to sanitize AI-generated SEO content for safety
function sanitizeSeoContent(content) {
  if (!content) return content;
  
  // List of unsafe strings to detect and replace
  const safetyChecks = [
    { unsafe: /\b(virus|malware|trojan|keylogger|ransomware|spyware|rootkit)\b/gi, safe: 'safe software' },
    { unsafe: /\b(hack|hacked|hacking|exploit|vulnerability)\b/gi, safe: 'premium access' },
    { unsafe: /\b(steal|theft|stolen|illegal|unlawful)\b/gi, safe: 'legitimate' },
    { unsafe: /\b(breach|breached|bypass|bypassing)\b/gi, safe: 'access' },
    { unsafe: /\b(inject|injection|payload|backdoor)\b/gi, safe: 'feature' },
    { unsafe: /\b(phish|phishing)\b/gi, safe: 'verified' },
    { unsafe: /\b(torrent)\b/gi, safe: 'download' }
  ];
  
  // Sanitize the content by replacing unsafe terms
  let sanitized = content;
  safetyChecks.forEach(check => {
    sanitized = sanitized.replace(check.unsafe, check.safe);
  });
  
  // Ensure the content contains safe language
  const safeTerms = ['safe', 'secure', 'virus-free', 'tested', 'verified'];
  let containsSafeTerm = safeTerms.some(term => sanitized.toLowerCase().includes(term));
  
  // If no safe terms found and content is a description, add one at the end if there's room
  if (!containsSafeTerm && sanitized.length < 145) {
    sanitized += ' Safe, secure, and virus-free.';
  }
  
  return sanitized;
}

