// R8Y Database Export - Global Variables and Functions

// Firebase references
const db = firebase.firestore();
const itemsCollection = db.collection('items');
const settingsDoc = db.collection('settings').doc('siteSettings');
const ratingsCollection = db.collection('ratings');
const storage = firebase.storage();
const storageRef = storage.ref();

// Get exact item rating from ratings collection - same as items.html
async function getItemRating(itemId) {
  try {
    const ratingsRef = ratingsCollection.doc(itemId);
    const ratingsDoc = await ratingsRef.get();

    if (ratingsDoc.exists) {
      const ratingsData = ratingsDoc.data();
      return {
        average: ratingsData.total / ratingsData.count,
        count: ratingsData.count
      };
    }

    return { average: 0, count: 0 };
  } catch (error) {
    console.error("Error getting ratings:", error);
    return { average: 0, count: 0 };
  }
}

// Generate a slug from a string
function generateSlug(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')      // Replace spaces with -
    .replace(/&/g, '-and-')    // Replace & with 'and'
    .replace(/[^\w\-]+/g, '')  // Remove all non-word characters
    .replace(/\-\-+/g, '-')    // Replace multiple - with single -
    .replace(/^-+/, '')        // Trim - from start of text
    .replace(/-+$/, '');       // Trim - from end of text
}

// Check if slug exists and generate a unique one if needed
async function getUniqueSlug(title, existingId = null) {
  let slug = generateSlug(title);
  let isUnique = false;
  let counter = 0;
  
  while (!isUnique) {
    // Check if slug exists in database
    const testSlug = counter === 0 ? slug : `${slug}-${counter}`;
    
    // Query items with this slug
    const querySnapshot = await itemsCollection
      .where('slug', '==', testSlug)
      .get();
    
    // If no items with this slug, or the only item is the current one being updated
    if (querySnapshot.empty) {
      isUnique = true;
      slug = testSlug;
    } else if (existingId && querySnapshot.size === 1 && querySnapshot.docs[0].id === existingId) {
      // This is the same item being updated, keep the slug
      isUnique = true;
      slug = testSlug;
    } else {
      // Increment counter and try again
      counter++;
    }
  }
  
  return slug;
}

// Get items from Firebase
async function getItems() {
  try {
    const snapshot = await itemsCollection.get();
    console.log(`Fetched ${snapshot.docs.length} items from Firebase`);
    
    // For very large datasets, implement efficient processing
    if (snapshot.docs.length > 100) {
      console.log("Large dataset detected, using optimized loading");
      
      // First, return basic item data quickly without ratings
      const basicItems = snapshot.docs.map(doc => {
        const data = doc.data();
        // Add the ID field to the data
        data.id = doc.id;
        
        // Ensure each item has a slug
        if (!data.slug && data.title) {
          const slug = generateSlug(data.title);
          // Update in background
          setTimeout(() => {
            itemsCollection.doc(doc.id).update({ slug });
          }, 100);
          data.slug = slug;
        }
        
        // Use existing rating if available or default to 0
        data.rating = data.rating || 0;
        
        // Optimize by keeping only necessary fields
        return {
          id: data.id,
          title: data.title,
          desc: data.desc ? data.desc.substring(0, 100) : '',  // Truncate long descriptions
          image: data.image,
          category: data.category,
          subcategory: data.subcategory,
          platform: data.platform,
          downloads: data.downloads || 0,
          rating: data.rating || 0,
          size: data.size || 'N/A',
          slug: data.slug
        };
      });
      
      // In the background, start fetching ratings for the first 50 items
      // This allows the UI to show content quickly while ratings load gradually
      setTimeout(async () => {
        try {
          const firstBatch = basicItems.slice(0, 50);
          const updatedItems = await Promise.all(firstBatch.map(async (item) => {
            try {
              const ratingDoc = await ratingsCollection.doc(item.id).get();
              if (ratingDoc.exists) {
                const rd = ratingDoc.data();
                item.rating = rd.count ? Number(rd.total) / Number(rd.count) : 0;
              }
            } catch (err) {
              console.error(`Error updating rating for ${item.id}:`, err);
            }
            return item;
          }));
          
          // Dispatch event to notify UI of updated ratings
          const event = new CustomEvent('ratings-updated', { detail: { updatedItems } });
          window.dispatchEvent(event);
        } catch (err) {
          console.error("Error in background rating update:", err);
        }
      }, 1000);
      
      return { items: basicItems };
    } 
    
    // For smaller datasets, use the original approach with parallel rating lookups
    const fetchedItems = await Promise.all(snapshot.docs.map(async doc => {
      const data = doc.data();
      // Ensure each item has a slug
      if (!data.slug && data.title) {
        // Create a unique slug to avoid collisions
        const slug = await getUniqueSlug(data.title, doc.id);
        itemsCollection.doc(doc.id).update({ slug });
        data.slug = slug;
      } 
      // Verify slug format is correct
      else if (data.slug) {
        // Check if the slug is properly formatted
        const properlyFormattedSlug = generateSlug(data.slug);
        if (properlyFormattedSlug !== data.slug) {
          // Fix improperly formatted slugs
          const uniqueSlug = await getUniqueSlug(data.title, doc.id);
          itemsCollection.doc(doc.id).update({ slug: uniqueSlug });
          data.slug = uniqueSlug;
        }
      }
      // Add the ID field to the data
      data.id = doc.id;

      // ALWAYS get fresh rating data from ratings collection for accurate display
      try {
        const ratingDoc = await ratingsCollection.doc(doc.id).get();
        if (ratingDoc.exists) {
          const rd = ratingDoc.data();
          data.rating = rd.count ? Number(rd.total) / Number(rd.count) : 0;
          console.log(`Item ${data.title} rating: ${data.rating} (${rd.total}/${rd.count})`);
        } else {
          data.rating = 0;
        }
      } catch (ratingError) {
        console.error(`Error fetching rating for item ${doc.id}:`, ratingError);
        data.rating = 0;
      }
      
      return data;
    }));
    
    return { items: fetchedItems };
  } catch (error) {
    console.error("Error getting items:", error);
    // Return the default database export if Firebase fails
    console.log("Using default database export");
    return { items: DB_EXPORT };
  }
}

// Get subcategories from Firebase
async function getSubcategories(category) {
  try {
    const doc = await settingsDoc.get();
    if (doc.exists) {
      const settings = doc.data();
      return settings.subcategories ? settings.subcategories[category] || [] : [];
    }
    return [];
  } catch (error) {
    console.error("Error getting subcategories:", error);
    return [];
  }
}

// Get sort options - fixed list as requested
async function getSortOptions() {
  try {
    return [
      { value: 'default', label: 'Default' },
      { value: 'rating-low-to-high', label: 'Rating (Low To High)' },
      { value: 'rating-high-to-low', label: 'Rating (High To Low)' },
      { value: 'download-low-to-high', label: 'Download (Low To High)' },
      { value: 'download-high-to-low', label: 'Download (High To Low)' },
      { value: 'size-low-to-high', label: 'Size (Low To High)' },
      { value: 'size-high-to-low', label: 'Size (High To Low)' }
    ];
  } catch (error) {
    console.error("Error getting sort options:", error);
    return [];
  }
}

// Track visitor
function trackVisitor() {
  try {
    // Check if user ID exists, if not create one
    let userId = localStorage.getItem('r8y_user_id');
    if (!userId) {
      userId = 'user_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('r8y_user_id', userId);

      // Update visitor count
      settingsDoc.get().then(doc => {
        if (doc.exists) {
          const settings = doc.data();
          const totalVisitors = (settings.totalVisitors || 0) + 1;

          // Get today's date in format MM/DD/YYYY
          const today = new Date().toLocaleDateString('en-US', {
            month: 'numeric',
            day: 'numeric',
            year: 'numeric'
          });

          // Check if we have an entry for today
          let visitorHistory = settings.visitorHistory || [];
          let todayEntry = visitorHistory.find(entry => entry.date === today);

          if (todayEntry) {
            // Update today's count
            todayEntry.count = (todayEntry.count || 0) + 1;
          } else {
            // Add new entry for today
            visitorHistory.push({
              date: today,
              count: 1
            });
          }

          // Limit history to 30 days
          if (visitorHistory.length > 30) {
            visitorHistory = visitorHistory.slice(visitorHistory.length - 30);
          }

          // Update settings
          settingsDoc.update({
            totalVisitors: totalVisitors,
            visitorHistory: visitorHistory
          });
        }
      });
    }
    return userId;
  } catch (error) {
    console.error("Error tracking visitor:", error);
    return null;
  }
}

// Save rating to Firestore
async function saveRating(itemId, rating) {
  try {
    // Get user ID
    let userId = localStorage.getItem('r8y_user_id');
    if (!userId) {
      userId = 'user_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('r8y_user_id', userId);
    }

    // Get current ratings
    const ratingsRef = ratingsCollection.doc(itemId);
    const doc = await ratingsRef.get();

    let ratingsData;
    if (doc.exists) {
      ratingsData = doc.data();

      // Check if user has already rated
      const hasRated = ratingsData.userRatings && ratingsData.userRatings[userId];

      if (hasRated) {
        // Update existing rating
        const oldRating = Number(ratingsData.userRatings[userId]);
        ratingsData.total = Number(ratingsData.total) - oldRating + Number(rating);
      } else {
        // Add new rating
        ratingsData.total = Number(ratingsData.total || 0) + Number(rating);
        ratingsData.count = Number(ratingsData.count || 0) + 1;
      }

      // Update user ratings
      if (!ratingsData.userRatings) ratingsData.userRatings = {};
      ratingsData.userRatings[userId] = Number(rating);
    } else {
      // Create new ratings document
      ratingsData = {
        total: Number(rating),
        count: 1,
        userRatings: {
          [userId]: Number(rating)
        }
      };
    }

    // Save to Firestore
    await ratingsRef.set(ratingsData);

    // Update item document with average rating
    const average = Number(ratingsData.total) / Number(ratingsData.count);
    await itemsCollection.doc(itemId).update({ rating: average });

    return {
      average: average,
      count: ratingsData.count
    };
  } catch (error) {
    console.error("Error saving rating:", error);
    return { average: 0, count: 0 };
  }
}

// Update download count
async function updateDownloadCount(itemId) {
  try {
    const itemRef = itemsCollection.doc(itemId);
    const doc = await itemRef.get();

    if (doc.exists) {
      const item = doc.data();
      const downloads = (item.downloads || 0) + 1;

      // Update item
      await itemRef.update({ downloads });

      // Update settings for tracking
      const settingsDoc = db.collection('settings').doc('siteSettings');
      const settingsDoc2 = await settingsDoc.get();
      
      if (settingsDoc2.exists) {
        const settings = settingsDoc2.data();
        const totalDownloads = (settings.totalDownloads || 0) + 1;
        
        // Get today's date in format MM/DD/YYYY
        const today = new Date().toLocaleDateString('en-US', {
          month: 'numeric',
          day: 'numeric',
          year: 'numeric'
        });
        
        // Check if we have an entry for today
        let downloadHistory = settings.downloadHistory || [];
        let todayEntry = downloadHistory.find(entry => entry.date === today);
        
        if (todayEntry) {
          // Update today's count
          todayEntry.count = (todayEntry.count || 0) + 1;
        } else {
          // Add new entry for today
          downloadHistory.push({
            date: today,
            count: 1
          });
        }
        
        // Limit history to 30 days
        if (downloadHistory.length > 30) {
          downloadHistory = downloadHistory.slice(downloadHistory.length - 30);
        }
        
        // Update settings
        await settingsDoc.update({
          totalDownloads: totalDownloads,
          downloadHistory: downloadHistory
        });
      }
      
      return downloads;
    } else {
      return 0;
    }
  } catch (error) {
    console.error("Error updating download count:", error);
    return 0;
  }
} 