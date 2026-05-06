// Apify SDK - toolkit for building Apify Actors (Read more at https://docs.apify.com/sdk/js/)
import { Actor } from 'apify';
// Crawlee - web scraping and browser automation library (Read more at https://crawlee.dev)
import { CheerioCrawler, Dataset } from 'crawlee';

// The init() call configures the Actor for its environment. It's recommended to start every Actor with an init()
await Actor.init();

// Structure of input is defined in input_schema.json
// Defaults tuned for Freelancer Portfolio Scraper
const { startUrls = ['https://dribbble.com'], maxRequestsPerCrawl = 100 } = (await Actor.getInput()) ?? {};

// Proxy configuration to rotate IP addresses and prevent blocking (https://docs.apify.com/platform/proxy)
const proxyConfiguration = await Actor.createProxyConfiguration();

const crawler = new CheerioCrawler({
    proxyConfiguration,
    maxRequestsPerCrawl,
    async requestHandler({ enqueueLinks, request, $, log }) {
        log.info('enqueueing new URLs');
        // Enqueue linked portfolio/project pages found on the current page.
        // This uses the default link-finding behavior; adjust selectors for better scope.
        await enqueueLinks();

        // Extract basic metadata for portfolio items. Selectors below are common but may need tuning per site.
        // Title fallbacks
        const title = $('meta[property="og:title"]').attr('content') || $('h1').first().text().trim() || $('title').text().trim();

        // Prefer canonical/project URL if available
        const url = $('link[rel="canonical"]').attr('href') || request.loadedUrl;

        // Thumbnail / preview image
        const thumbnail = $('meta[property="og:image"]').attr('content') || $('img').first().attr('src') || null;

        // Tags or categories (site-specific; selector may be changed in input or configuration)
        const tags = [];
        $('meta[name="keywords"]').each((i, el) => {
            const content = $(el).attr('content');
            if (content) {
                tags.push(...content.split(',').map(s => s.trim()).filter(Boolean));
            }
        });
        // Attempt common tag selectors for portfolio sites
        $('.tags a, .project-tags a, .chips .tag').each((i, el) => {
            const t = $(el).text().trim();
            if (t) tags.push(t);
        });

        // Deduplicate small tag list
        const uniqueTags = [...new Set(tags)].filter(Boolean);

        log.info(`Found item: ${title}`, { url });

        // Save a structured item to Dataset.
        await Dataset.pushData({
            url,
            title,
            thumbnail,
            tags: uniqueTags,
            crawledAt: new Date().toISOString()
        });
    },
});

await crawler.run(startUrls);

// Gracefully exit the Actor process. It's recommended to quit all Actors with an exit()
await Actor.exit();