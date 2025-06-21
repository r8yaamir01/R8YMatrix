// Items.js - Handles slug-based URL routing for item pages

document.addEventListener('DOMContentLoaded', function() {
  // Extract slug from URL path if available
  const slug = getSlugFromUrl();
  
  if (slug) {
    console.log(`Loading item with slug: ${slug}`);
    loadItemBySlug(slug);
  } else {
    // Check for item ID in query parameter (legacy support)
    const urlParams = new URLSearchParams(window.location.search);
    const itemId = urlParams.get('id');
    
    if (itemId) {
      console.log(`Loading item with ID: ${itemId}`);
      loadItemById(itemId);
      
      // Update URL to use slug-based format if possible
      updateUrlToSlugFormat(itemId);
    } else {
      // No slug or ID provided, show error or redirect to home
      showError("Item not found");
    }
  }
});

// Extract slug from URL path: /items/game-name -> "game-name"
function getSlugFromUrl() {
  const path = window.location.pathname;
  
  // Check if path matches /items/something pattern
  if (path.startsWith('/items/')) {
    // Extract the slug part (everything after /items/)
    return path.substring('/items/'.length);
  } else if (path.endsWith('/items.html')) {
    // Handle old URL format before the rewrite
    const urlParams = new URLSearchParams(window.location.search);
    const itemId = urlParams.get('id');
    if (itemId) {
      return itemId;
    }
  }
  
  return null;
}

// Load item using its slug
async function loadItemBySlug(slug) {
  try {
    const item = await getItemBySlug(slug);
    
    if (item) {
      console.log("Item found by slug:", item);
      renderItem(item);
      
      // Update all SEO tags based on item content
      updateSeoTags(item);
    } else {
      // If no item found by slug, show error or redirect
      showError("Item not found");
    }
  } catch (error) {
    console.error("Error loading item by slug:", error);
    showError("Error loading item");
  }
}

// Load item using its ID (legacy support)
async function loadItemById(id) {
  try {
    const item = await getItemById(id);
    
    if (item) {
      console.log("Item found by ID:", item);
      renderItem(item);
    } else {
      showError("Item not found");
    }
  } catch (error) {
    console.error("Error loading item by ID:", error);
    showError("Error loading item");
  }
}

// Query Firestore for item with matching slug
async function getItemBySlug(slug) {
  const db = firebase.firestore();
  
  // Query items collection where slug matches
  const querySnapshot = await db.collection('items')
    .where('slug', '==', slug)
    .limit(1)
    .get();
  
  if (!querySnapshot.empty) {
    // Return the first matching item
    return querySnapshot.docs[0].data();
  }
  
  return null;
}

// Get item by ID from Firestore
async function getItemById(id) {
  const db = firebase.firestore();
  
  // Get document directly by ID
  const docSnapshot = await db.collection('items').doc(id).get();
  
  if (docSnapshot.exists) {
    return docSnapshot.data();
  }
  
  return null;
}

// Update URL to use slug-based format instead of query parameters
async function updateUrlToSlugFormat(itemId) {
  try {
    const item = await getItemById(itemId);
    
    if (item && item.slug) {
      // Change URL without reloading the page
      const newUrl = `/items/${item.slug}`;
      window.history.replaceState({}, document.title, newUrl);
      
      // Add canonical URL meta tag with absolute URL
      const canonicalUrl = `${window.location.origin}${newUrl}`;
      addCanonicalUrl(canonicalUrl);
      
      // Update all SEO tags based on item content
      updateSeoTags(item);
    }
  } catch (error) {
    console.error("Error updating URL format:", error);
  }
}

// Update all SEO meta tags for better search engine indexing
function updateSeoTags(item) {
  if (!item) return;
  
  // Check if we have SEO data from Firestore
  getSeoDataForItem(item.id).then(seoData => {
    // Use SEO data if available, otherwise generate from item data
    const metaTitle = (seoData && seoData.metaTitle) ? 
      seoData.metaTitle : 
      `${item.title} - R8Y Matrix Download`;
      
    const metaDesc = (seoData && seoData.metaDescription) ? 
      seoData.metaDescription : 
      `Download ${item.title} for free. ${item.desc ? item.desc.substring(0, 100) + '...' : ''}`;
      
    const metaKeywords = (seoData && seoData.metaKeywords) ?
      seoData.metaKeywords :
      `${item.title}, download, free download, r8ymatrix`;
    
    // Update page title
    document.title = metaTitle;
    
    // Update meta description
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.name = 'description';
      document.head.appendChild(metaDescription);
    }
    metaDescription.content = metaDesc;
    
    // Update meta keywords
    let metaKeywordsTag = document.querySelector('meta[name="keywords"]');
    if (!metaKeywordsTag) {
      metaKeywordsTag = document.createElement('meta');
      metaKeywordsTag.name = 'keywords';
      document.head.appendChild(metaKeywordsTag);
    }
    metaKeywordsTag.content = metaKeywords;
    
    // Update Open Graph tags
    updateOpenGraphTags(item, metaTitle, metaDesc);
  }).catch(err => {
    console.error('Error getting SEO data:', err);
  });
}

// Update Open Graph meta tags for social sharing
function updateOpenGraphTags(item, title, description) {
  const ogTags = {
    'og:title': title,
    'og:description': description,
    'og:type': 'website',
    'og:url': window.location.href,
    'og:image': item.image || '',
    'og:site_name': 'R8Y Matrix'
  };
  
  // Update or create each Open Graph tag
  for (const [property, content] of Object.entries(ogTags)) {
    let ogTag = document.querySelector(`meta[property="${property}"]`);
    if (!ogTag) {
      ogTag = document.createElement('meta');
      ogTag.setAttribute('property', property);
      document.head.appendChild(ogTag);
    }
    ogTag.setAttribute('content', content);
  }
}

// Helper function to get SEO data from Firestore
async function getSeoDataForItem(itemId) {
  try {
    const db = firebase.firestore();
    const seoRef = db.collection('seo').doc(itemId);
    const seoSnap = await seoRef.get();
    
    if (seoSnap.exists) {
      return seoSnap.data();
    }
    return null;
  } catch (error) {
    console.error('Error fetching SEO data:', error);
    return null;
  }
}

// Add canonical URL meta tag for SEO
function addCanonicalUrl(url) {
  // Remove any existing canonical tags
  document.querySelectorAll('link[rel="canonical"]').forEach(tag => tag.remove());
  
  // Create and add new canonical tag
  const canonicalTag = document.createElement('link');
  canonicalTag.rel = 'canonical';
  canonicalTag.href = `${window.location.origin}${url}`;
  document.head.appendChild(canonicalTag);
}

// Add meta description tag for SEO
function addMetaDescription(description) {
  // Remove any existing meta description
  document.querySelectorAll('meta[name="description"]').forEach(tag => tag.remove());
  
  // Create and add new meta description
  const metaTag = document.createElement('meta');
  metaTag.name = 'description';
  metaTag.content = description;
  document.head.appendChild(metaTag);
  
  // Update Open Graph description too
  updateOgTag('description', description);
}

// Update Open Graph and Twitter tags
function updateOgTag(property, content) {
  // Update Open Graph tag
  let ogTag = document.querySelector(`meta[property="og:${property}"]`);
  if (ogTag) {
    ogTag.content = content;
  } else {
    ogTag = document.createElement('meta');
    ogTag.setAttribute('property', `og:${property}`);
    ogTag.content = content;
    document.head.appendChild(ogTag);
  }
  
  // Update Twitter tag too
  let twitterTag = document.querySelector(`meta[property="twitter:${property}"]`);
  if (twitterTag) {
    twitterTag.content = content;
  } else {
    twitterTag = document.createElement('meta');
    twitterTag.setAttribute('property', `twitter:${property}`);
    twitterTag.content = content;
    document.head.appendChild(twitterTag);
  }
}

// Update all SEO tags for an item
function updateSeoTags(item) {
  // Update page title
  document.title = `${item.title} - R8YMatrix Download`;
  
  // Update meta description
  const description = item.description ? 
    truncate(item.description, 160) : 
    `Download ${item.title} for ${item.category}. Safe and free from R8YMatrix.`;
  addMetaDescription(description);
  
  // Update canonical URL
  addCanonicalUrl(`/items/${item.slug}`);
  
  // Update OG title
  updateOgTag('title', `${item.title} - R8YMatrix Download`);
  
  // Update OG URL
  updateOgTag('url', `${window.location.origin}/items/${item.slug}`);
  
  // Update OG image if item has thumbnail
  if (item.thumbnail) {
    updateOgTag('image', item.thumbnail);
  }
}

// Helper: Truncate text to max length
function truncate(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substr(0, maxLength - 3) + '...';
}

// Render item data on the page
function renderItem(item) {
  // Your existing rendering code goes here
  // This should populate the page with item details
}

// Show error message on page
function showError(message) {
  const contentArea = document.querySelector('.item-content') || document.body;
  contentArea.innerHTML = `
    <div class="error-message">
      <h2>Oops! ${message}</h2>
      <p>The item you're looking for could not be found.</p>
      <a href="/" class="btn">Return to Home</a>
    </div>
  `;
}
