const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

module.exports = async (req, res) => {
	const { url, method } = req;

	// Normalize path for Vercel Node function
	const path = req.url.split('?')[0] || '/';

	if (method === 'GET' && (path === '/' || path === '')) {
		return res.status(200).json({
			message: 'Video Scraper API is running!',
			endpoints: {
				scrape: '/api/scrape-videos',
				health: '/health'
			},
			usage: '/api/scrape-videos?start=0&limit=20'
		});
	}

	if (method === 'GET' && path === '/health') {
		return res.status(200).json({
			status: 'OK',
			timestamp: new Date().toISOString(),
			service: 'Video Scraper API'
		});
	}

	if (method === 'GET' && (path === '/api/scrape-videos' || path === '/api/scrape.js')) {
		const { start = 0, limit = 20 } = req.query || {};

		let browser;
		try {
			// Configure chromium for serverless environments (Vercel, AWS Lambda, etc.)
			const executablePath = await chromium.executablePath();
			browser = await puppeteer.launch({
				headless: chromium.headless,
				executablePath,
				args: chromium.args
			});

			const page = await browser.newPage();
			await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

			const targetUrl = `https://batibot.org/load_more_random.php?start=${start}&limit=${limit}`;
			await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

			await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 3000)));

			const videoData = await page.evaluate(() => {
				const videos = [];
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
							videoUrl,
							thumbnail,
							title
						});
					}
				});

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
							videoUrl,
							thumbnail,
							title
						});
					}
				});

				return videos;
			});

			const filteredVideos = videoData.filter(item => item.videoUrl && item.thumbnail && item.title);

			return res.status(200).json({
				success: true,
				count: filteredVideos.length,
				data: filteredVideos,
				timestamp: new Date().toISOString()
			});
		} catch (error) {
			return res.status(500).json({
				success: false,
				error: error.message,
				timestamp: new Date().toISOString()
			});
		} finally {
			try { if (browser) await browser.close(); } catch (_) {}
		}
	}

	return res.status(404).json({ error: 'Not found' });
};


