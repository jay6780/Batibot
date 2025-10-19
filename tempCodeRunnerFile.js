const puppeteer = require('puppeteer');

async function simpleVideoScraper() {
    const browser = await puppeteer.launch({
        headless: false
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        const url = 'https://batibot.org/load_more_random.php?start=0&limit=20';
        console.log('Navigating to:', url);
        
        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });

        // Wait using page evaluate
        await page.evaluate(() => {
            return new Promise(resolve => setTimeout(resolve, 3000));
        });

        // Extract video data
        const videoData = await page.evaluate(() => {
            const videos = [];

            // Look for video elements
            const videoElements = document.querySelectorAll('video, iframe');
            videoElements.forEach(video => {
                // Get title from multiple possible sources
                let title = video.getAttribute('title') || 
                           video.getAttribute('alt') ||
                           video.getAttribute('data-title') ||
                           video.closest('div')?.getAttribute('data-title') ||
                           video.closest('article')?.querySelector('h1, h2, h3, h4, h5, h6')?.innerText?.trim() ||
                           video.closest('div')?.querySelector('h1, h2, h3, h4, h5, h6')?.innerText?.trim();

                const videoUrl = video.src || video.getAttribute('src');
                const thumbnail = video.poster || video.getAttribute('poster');

                // Only add if ALL three fields are not empty
                if (videoUrl && thumbnail && title) {
                    videos.push({
                        type: video.tagName,
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

                // Enhanced title extraction from containers
                let title = container.getAttribute('data-title') ||
                          container.getAttribute('title') ||
                          container.getAttribute('aria-label') ||
                          container.querySelector('h1, h2, h3, h4, h5, h6')?.innerText?.trim() ||
                          container.querySelector('[class*="title"], [class*="name"], [class*="heading"]')?.innerText?.trim() ||
                          container.querySelector('img')?.getAttribute('alt') ||
                          container.querySelector('a')?.getAttribute('title');

                // Only add if ALL three fields are not empty
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

        console.log('Found videos:', JSON.stringify(videoData, null, 2));
        
        // Filter to only include items with all three fields (already done above, but keeping as backup)
        const filteredVideos = videoData.filter(item => item.videoUrl && item.thumbnail && item.title);
        console.log('Filtered videos with all three fields:', filteredVideos.length);
        
        return filteredVideos;

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
}

// Run the simple version
simpleVideoScraper().then(videos => {
    console.log('Scraping completed! Found', videos.length, 'videos with all three fields (videoUrl, thumbnail, and title)');
    
    // Save results
    const fs = require('fs');
    fs.writeFileSync('simple_videos.json', JSON.stringify(videos, null, 2));
    console.log('Results saved to simple_videos.json');
});