document.getElementById('exportBtn').addEventListener('click', async () => {
  const statusDiv = document.getElementById('status');
  
  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Check if we're on Google
    if (!tab.url.includes('google.com/search') && !tab.url.includes('google.co.uk/search')) {
      statusDiv.textContent = '⚠️ Please run this on a Google search results page.';
      statusDiv.className = 'error';
      return;
    }
    
    // Inject and execute the extraction script
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: extractSearchResults
    });
    
    const data = results[0].result;
    
    if (data.length === 0) {
      statusDiv.textContent = '⚠️ No results found on this page.';
      statusDiv.className = 'error';
      return;
    }
    
    // Convert to CSV
    const csv = convertToCSV(data);
    
    // Download the CSV
    downloadCSV(csv, 'google_search_results.csv');
    
    statusDiv.textContent = `✅ Exported ${data.length} results!`;
    statusDiv.className = 'success';
    
  } catch (error) {
    statusDiv.textContent = '❌ Error: ' + error.message;
    statusDiv.className = 'error';
  }
});

// This function runs in the context of the Google page
function extractSearchResults() {
  const results = [];
  const seenUrls = new Set();
  
  // Get the current page number from URL
  // Google uses 'start' parameter: page 1 = 0 or absent, page 2 = 10, page 3 = 20, etc.
  const urlParams = new URLSearchParams(window.location.search);
  const startParam = parseInt(urlParams.get('start')) || 0;
  const pageNumber = Math.floor(startParam / 10) + 1;
  
  // Helper function to format position as "page.position" (e.g., 1.1, 1.2, 2.1)
  function formatPosition(resultIndex) {
    return `${pageNumber}.${resultIndex}`;
  }
  
  // Helper function to check if URL should be skipped
  function shouldSkipUrl(url) {
    if (!url) return true;
    const skipPatterns = [
      'google.com/search',
      'google.co.uk/search',
      'google.com/preferences',
      'google.com/webhp',
      'google.com/advanced_search',
      'accounts.google',
      'support.google',
      'policies.google',
      'maps.google',
      'translate.google',
      'webcache.googleusercontent',
      '/search?'
    ];
    return skipPatterns.some(pattern => url.includes(pattern));
  }
  
  // Helper function to check if element is an ad
  function isAdElement(element) {
    if (!element) return false;
    
    // Check for ad indicators
    const adSelectors = [
      '[data-text-ad]',
      '[data-hveid] [data-dtld]',
      '.commercial-unit-desktop-top',
      '.ads-ad',
      '[data-sokoban-feature="ad"]'
    ];
    
    for (const selector of adSelectors) {
      if (element.closest(selector)) return true;
    }
    
    // Check text content for "Sponsored" or "Ad" labels
    const textContent = element.textContent || '';
    const firstFewChars = textContent.substring(0, 50).toLowerCase();
    if (firstFewChars.includes('sponsored') || /^ad\s*[·•]/i.test(firstFewChars)) {
      return true;
    }
    
    return false;
  }
  
  // Helper to extract snippet from a result container
  function extractSnippet(container) {
    if (!container) return '';
    
    // Multiple selectors for snippets (Google changes these frequently)
    const snippetSelectors = [
      '[data-sncf="1"]',
      '[data-sncf="2"]',
      'div[style*="-webkit-line-clamp"]',
      'span[style*="-webkit-line-clamp"]',
      '.VwiC3b',
      '[data-snf]',
      'div.IsZvec',
      'span.aCOpRe',
      'div.s'
    ];
    
    for (const selector of snippetSelectors) {
      const el = container.querySelector(selector);
      if (el && el.textContent.trim().length > 20) {
        return el.textContent.trim();
      }
    }
    
    return '';
  }
  
  // Method 1: Target the main search results container (#rso or #search)
  const mainContainer = document.querySelector('#rso') || document.querySelector('#search');
  
  if (mainContainer) {
    // Find all organic result blocks - these typically have data-hveid or are div.g
    // Also look for the newer structure with [jscontroller][jsname][jsaction]
    const resultBlocks = mainContainer.querySelectorAll([
      'div.g:not(.g-blk)',                    // Classic organic results
      'div[data-hveid]:not([data-hveid=""])', // Results with view ID
      'div[data-sokoban-container]',          // Newer container format
      '[jscontroller][data-hveid]'            // JS-controlled results
    ].join(','));
    
    resultBlocks.forEach(block => {
      try {
        // Skip if this is part of "People also ask", "Related searches", etc.
        if (block.closest('[data-initq]') || 
            block.closest('.related-question-pair') ||
            block.closest('[data-rf]')) {
          return;
        }
        
        // Find the h3 title element
        const h3 = block.querySelector('h3');
        if (!h3) return;
        
        const title = h3.textContent.trim();
        if (!title) return;
        
        // Find the link - look for anchor containing or near the h3
        let linkEl = h3.closest('a');
        if (!linkEl) {
          // Try finding the main link in the block
          linkEl = block.querySelector('a[href^="http"][data-ved]') ||
                   block.querySelector('a[href^="http"]:not([href*="google.com"])') ||
                   block.querySelector('a[ping]');
        }
        
        if (!linkEl) return;
        
        const url = linkEl.href;
        if (shouldSkipUrl(url) || seenUrls.has(url)) return;
        
        seenUrls.add(url);
        
        const isSponsored = isAdElement(block);
        const snippet = extractSnippet(block);
        
        results.push({
          position: formatPosition(results.length + 1),
          title: title,
          url: url,
          snippet: snippet.substring(0, 500),
          sponsored: isSponsored ? 'Yes' : 'No'
        });
      } catch (e) {
        console.log('Error extracting result block:', e);
      }
    });
  }
  
  // Method 2: Direct h3 approach if Method 1 found few results
  if (results.length < 5) {
    const allH3s = document.querySelectorAll('#search h3, #rso h3, #main h3');
    
    allH3s.forEach(h3 => {
      try {
        const title = h3.textContent.trim();
        if (!title) return;
        
        // Find parent anchor or nearby anchor
        let linkEl = h3.closest('a');
        if (!linkEl) {
          const parent = h3.parentElement;
          if (parent) {
            linkEl = parent.querySelector('a[href^="http"]') || 
                     parent.closest('a') ||
                     parent.parentElement?.querySelector('a[href^="http"]');
          }
        }
        
        if (!linkEl) return;
        
        const url = linkEl.href;
        if (shouldSkipUrl(url) || seenUrls.has(url)) return;
        
        seenUrls.add(url);
        
        // Find container for snippet and ad detection
        const container = h3.closest('div[data-hveid]') || 
                         h3.closest('div.g') ||
                         h3.closest('[jscontroller]');
        
        const isSponsored = isAdElement(container || h3);
        const snippet = extractSnippet(container);
        
        results.push({
          position: formatPosition(results.length + 1),
          title: title,
          url: url,
          snippet: snippet.substring(0, 500),
          sponsored: isSponsored ? 'Yes' : 'No'
        });
      } catch (e) {
        console.log('Error in h3 extraction:', e);
      }
    });
  }
  
  // Method 3: Fallback - find all links with data-ved (Google's tracking attribute)
  if (results.length < 3) {
    const dataVedLinks = document.querySelectorAll('#search a[data-ved][href^="http"], #rso a[data-ved][href^="http"]');
    
    dataVedLinks.forEach(link => {
      try {
        const url = link.href;
        if (shouldSkipUrl(url) || seenUrls.has(url)) return;
        
        // Look for h3 inside or meaningful text
        const h3 = link.querySelector('h3');
        const title = h3 ? h3.textContent.trim() : link.textContent.trim();
        
        if (!title || title.length < 5 || title.length > 300) return;
        
        seenUrls.add(url);
        
        results.push({
          position: formatPosition(results.length + 1),
          title: title.substring(0, 200),
          url: url,
          snippet: '',
          sponsored: 'Unknown'
        });
      } catch (e) {
        // Skip
      }
    });
  }
  
  return results;
}

function convertToCSV(data) {
  if (data.length === 0) return '';
  
  const headers = ['Position', 'Title', 'URL', 'Snippet', 'Sponsored'];
  const rows = data.map(item => [
    item.position,
    `"${(item.title || '').replace(/"/g, '""')}"`,
    `"${(item.url || '').replace(/"/g, '""')}"`,
    `"${(item.snippet || '').replace(/"/g, '""')}"`,
    item.sponsored
  ]);
  
  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  chrome.downloads.download({
    url: url,
    filename: filename,
    saveAs: true
  });
}
