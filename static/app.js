// Global state
let currentModule = null;
let allVideos = [];
let moduleVideos = {};
let searchTimeout = null;
let searchCache = new Map(); // Cache for search results
const DEBOUNCE_DELAY = 400; // Increased debounce delay
const MIN_SEARCH_LENGTH = 2; // Minimum characters before searching

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const resultsDiv = document.getElementById('results');
const searchResults = document.getElementById('searchResults');
const moduleContent = document.getElementById('moduleContent');
const moduleList = document.getElementById('moduleList');
const videoGrid = document.getElementById('videoGrid');

// Initialize the application
async function initializeApp() {
    try {
        // Load all videos first
        const response = await fetch('/search?q= ');  // Empty query to get all videos
        const data = await response.json();
        allVideos = data.hits;

        // Organize videos by module
        organizeVideosByModule();

        // Render the module list
        renderModuleList();

        // Show the first module by default
        const firstModule = Object.keys(moduleVideos)[0];
        if (firstModule) {
            showModule(firstModule);
        }
    } catch (error) {
        console.error('Error initializing app:', error);
    }
}

// Organize videos into modules
function organizeVideosByModule() {
    moduleVideos = {};
    allVideos.forEach(video => {
        // Try to match both Mod1 and Module1 patterns
        const moduleMatch = video.video_id.match(/(?:Mod|Module)(\d+)/i);
        if (moduleMatch) {
            const moduleNum = parseInt(moduleMatch[1]);
            const moduleName = `Module ${moduleNum}`;
            if (!moduleVideos[moduleName]) {
                moduleVideos[moduleName] = [];
            }
            moduleVideos[moduleName].push(video);
        } else {
            // For videos without a module number, put them in "Other"
            if (!moduleVideos['Other']) {
                moduleVideos['Other'] = [];
            }
            moduleVideos['Other'].push(video);
        }
    });

    // Sort videos within each module by section number and then by name
    Object.keys(moduleVideos).forEach(module => {
        moduleVideos[module].sort((a, b) => {
            // Extract section numbers if they exist
            const sectionA = a.video_id.match(/Sect(\d+)/i);
            const sectionB = b.video_id.match(/Sect(\d+)/i);
            
            if (sectionA && sectionB) {
                const numA = parseInt(sectionA[1]);
                const numB = parseInt(sectionB[1]);
                if (numA !== numB) return numA - numB;
            }
            
            // If no section numbers or they're equal, sort by video_id
            return a.video_id.localeCompare(b.video_id);
        });
    });

    // Log the organized modules for debugging
    console.log('Organized modules:', Object.keys(moduleVideos));
}

// Render the module list in the sidebar
function renderModuleList() {
    const sortedModules = Object.keys(moduleVideos)
        .sort((a, b) => {
            if (a === 'Other') return 1;
            if (b === 'Other') return -1;
            const numA = parseInt(a.match(/\d+/) || [0]);
            const numB = parseInt(b.match(/\d+/) || [0]);
            return numA - numB;
        });

    moduleList.innerHTML = sortedModules
        .map(module => `
            <div class="module-item" onclick="showModule('${module}')">
                <div class="module-name">${module}</div>
                <div class="video-count">${moduleVideos[module].length} videos</div>
            </div>
        `).join('');
}

// Show videos for a specific module
function showModule(moduleName) {
    currentModule = moduleName;
    searchResults.classList.add('hidden');
    moduleContent.classList.remove('hidden');
    
    // Update active module in sidebar
    document.querySelectorAll('.module-item').forEach(item => {
        if (item.textContent.includes(moduleName)) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Update content title
    const contentTitle = document.querySelector('#moduleContent h2');
    contentTitle.textContent = `${moduleName} Content`;

    // Render videos for this module
    renderVideos(moduleVideos[moduleName], videoGrid);
}

// Render videos in a grid
function renderVideos(videos, container) {
    if (!videos || videos.length === 0) {
        container.innerHTML = `
            <div class="no-results">
                <i class="fas fa-search fa-3x" style="color: #ccc; margin-bottom: 1rem;"></i>
                <p>No videos found</p>
            </div>
        `;
        return;
    }

    container.innerHTML = videos.map(video => {
        // Generate screenshot path from video_id
        const screenshotPath = `/static/screenshots/${video.video_id}.jpeg`;
        
        // Get module and section information
        const moduleTag = getModuleFromVideoId(video.video_id);
        const sectionTag = getSectionFromVideoId(video.video_id);
        
        // Format video number from video_id
        const videoNumber = video.video_id
            .replace(/_/g, ' ')
            .replace(/\.mp4$/, '')
            .trim();
        
        return `
        <div class="video-card" onclick="window.location.href='/video/${encodeURIComponent(video.video_id)}'">
            <div class="video-header">
                <img 
                    src="${screenshotPath}" 
                    alt="${video.video_title || videoNumber}" 
                    class="video-thumbnail"
                    onerror="this.src='/static/placeholder.jpeg'"
                >
            </div>
            <div class="video-info">
                <div class="video-metadata">
                    ${moduleTag ? `<span class="module-tag">${moduleTag}</span>` : ''}
                    ${sectionTag ? `<span class="section-tag">${sectionTag}</span>` : ''}
                </div>
                <h3 class="video-title">${video.video_title || videoNumber}</h3>
                <p class="video-description">${truncateText(video.transcription || 'No description available', 150)}</p>
                ${video.keywords ? `
                    <div class="keyword-container">
                        <div class="keyword-tags">
                            ${video.keywords.slice(0, 5).map(keyword => 
                                `<span class="keyword-tag">${keyword}</span>`
                            ).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        </div>
    `}).join('');
}

// Toggle video preview
function toggleVideoPreview(thumbnailElement, videoUrl) {
    const videoElement = thumbnailElement.querySelector('.video-preview');
    const overlayElement = thumbnailElement.querySelector('.thumbnail-overlay');
    
    // Get all other videos and pause them
    document.querySelectorAll('.video-preview').forEach(video => {
        if (video !== videoElement) {
            video.style.display = 'none';
            video.pause();
            video.closest('.video-thumbnail').querySelector('.thumbnail-overlay').style.display = 'flex';
        }
    });

    if (videoElement.style.display === 'none') {
        videoElement.style.display = 'block';
        overlayElement.style.display = 'none';
        videoElement.play();
    } else {
        videoElement.style.display = 'none';
        overlayElement.style.display = 'flex';
        videoElement.pause();
    }
}

// Get module name from video ID
function getModuleFromVideoId(videoId) {
    const match = videoId.match(/(?:Mod|Module)(\d+)/i);
    return match ? `Module ${match[1]}` : '';
}

// Get section from video ID
function getSectionFromVideoId(videoId) {
    const match = videoId.match(/Sect(\d+)/i);
    return match ? `Section ${match[1]}` : '';
}

// Format video title for display
function formatVideoTitle(videoId) {
    return videoId
        .replace(/_/g, ' ')
        .replace(/(?:Mod|Module)\d+/i, '')
        .replace(/Sect/i, 'Section')
        .replace(/part/i, 'Part')
        .trim();
}

// Truncate text to a specific length
function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength) + '...';
}

// Optimized search functionality
async function performSearch() {
    const query = searchInput.value.trim();

    // Show loading state
    const searchTitle = document.querySelector('#searchResults h2');
    searchTitle.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Searching...`;
    
    // Show all videos in module view if search is empty or too short
    if (!query || query.length < MIN_SEARCH_LENGTH) {
        searchResults.classList.add('hidden');
        moduleContent.classList.remove('hidden');
        return;
    }

    try {
        let data;
        
        // Check cache first
        if (searchCache.has(query)) {
            data = searchCache.get(query);
            console.log('Retrieved from cache:', query);
        } else {
            // Fetch from server if not in cache
            const response = await fetch(`/search?q=${encodeURIComponent(query)}`);
            data = await response.json();
            
            // Cache the results
            searchCache.set(query, data);
            
            // Limit cache size to prevent memory issues
            if (searchCache.size > 100) {
                const firstKey = searchCache.keys().next().value;
                searchCache.delete(firstKey);
            }
        }

        // Show search results
        searchResults.classList.remove('hidden');
        moduleContent.classList.add('hidden');
        
        // Update search results title
        searchTitle.textContent = `Search Results for "${query}"`;
        
        renderVideos(data.hits, resultsDiv);
    } catch (error) {
        console.error('Error performing search:', error);
        searchTitle.textContent = `Error performing search`;
        resultsDiv.innerHTML = `
            <div class="no-results">
                <i class="fas fa-exclamation-circle fa-3x" style="color: #dc3545; margin-bottom: 1rem;"></i>
                <p>An error occurred while searching. Please try again.</p>
            </div>
        `;
    }
}

// Improved debounced search function
function debounceSearch(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        // Show loading indicator in search input
        searchInput.style.backgroundImage = 'url("/static/loading.gif")';
        searchInput.style.backgroundRepeat = 'no-repeat';
        searchInput.style.backgroundPosition = 'right 10px center';
        searchInput.style.backgroundSize = '20px 20px';

        const later = () => {
            clearTimeout(timeout);
            // Remove loading indicator
            searchInput.style.backgroundImage = 'none';
            func.apply(this, args);
        };

        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Create debounced search with increased delay
const debouncedSearch = debounceSearch(performSearch, DEBOUNCE_DELAY);

// Event listeners
searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    
    // Clear results if query is empty
    if (!query) {
        searchResults.classList.add('hidden');
        moduleContent.classList.remove('hidden');
        return;
    }
    
    // Only search if query is long enough
    if (query.length >= MIN_SEARCH_LENGTH) {
        debouncedSearch();
    }
});

searchButton.addEventListener('click', () => {
    const query = searchInput.value.trim();
    if (query.length >= MIN_SEARCH_LENGTH) {
        performSearch();
    }
});

searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const query = searchInput.value.trim();
        if (query.length >= MIN_SEARCH_LENGTH) {
            performSearch();
        }
    }
});

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    
    // Handle clicking outside video to close it
    document.addEventListener('click', (event) => {
        if (!event.target.closest('.video-thumbnail')) {
            document.querySelectorAll('.video-preview').forEach(video => {
                video.style.display = 'none';
                video.pause();
                video.closest('.video-thumbnail').querySelector('.thumbnail-overlay').style.display = 'flex';
            });
        }
    });
});