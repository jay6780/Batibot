const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint (important for Railway)
app.get('/', (req, res) => {
  res.json({ 
    message: 'Video Scraper API is running!',
    endpoints: {
      scrape: '/api/scrape-videos',
      health: '/health'
    },
    usage: '/api/scrape-videos?start=0&limit=20'
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Video Scraper API'
  });
});

// Scraping endpoint
app.get('/api/scrape-videos', async (req, res) => {
  const { start = 0, limit = 20 } = req.query;
  
  console.log('Starting scraping session...');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    const url = `https://batibot.org/load_more_random.php?start=${start}&limit=${limit}`;
    console.log('Navigating to:', url);
    
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await page.evaluate(() => {
      return new Promise(resolve => setTimeout(resolve, 3000));
    });

    const videoData = await page.evaluate(() => {
      const videos = [];

      // Look for video elements
      const videoElements = document.querySelectorAll('video, iframe');
      videoElements.forEach(video => {
        let title = video.getAttribute('title') || 
                   video.getAttribute('alt') ||
                   video.getAttribute('data-title') ||
                   video.closest('div')?.getAttribute('data-title') ||
                   video.closest('article')?.querySelector('h1, h2, h3, h4, h5, h6')?.innerText?.trim() ||
                   video.closest('div')?.querySelector('h1, h2, h3, h4, h5, h6')?.innerText?.trim();

        const videoUrl = video.src || video.getAttribute('src');
        const thumbnail = video.poster || video.getAttribute('poster');

        if (videoUrl && thumbnail && title) {
          videos.push({
            type: video.tagName.toLowerCase(),
            videoUrl: videoUrl,
            thumbnail: thumbnail,
            title: title
          });
        }
      });

      // Look for containers with video data
      const containers = document.querySelectorAll('div, article, section');
      containers.forEach(container => {
        const videoUrl = container.getAttribute('data-video-url') || 
                       container.getAttribute('data-video') ||
                       container.querySelector('a')?.href;
        
        const thumbnail = container.getAttribute('data-thumbnail') ||
                        container.getAttribute('data-poster') ||
                        container.querySelector('img')?.src;

        let title = container.getAttribute('data-title') ||
                  container.getAttribute('title') ||
                  container.getAttribute('aria-label') ||
                  container.querySelector('h1, h2, h3, h4, h5, h6')?.innerText?.trim() ||
                  container.querySelector('[class*="title"], [class*="name"], [class*="heading"]')?.innerText?.trim() ||
                  container.querySelector('img')?.getAttribute('alt') ||
                  container.querySelector('a')?.getAttribute('title');

        if (videoUrl && thumbnail && title) {
          videos.push({
            type: 'container',
            videoUrl: videoUrl,
            thumbnail: thumbnail,
            title: title
          });
        }
      });

      return videos;
    });

    const filteredVideos = videoData.filter(item => item.videoUrl && item.thumbnail && item.title);
    
    console.log(`Scraping completed! Found ${filteredVideos.length} videos`);
    
    res.json({
      success: true,
      count: filteredVideos.length,
      data: filteredVideos,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    await browser.close();
    console.log('Browser closed');
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});