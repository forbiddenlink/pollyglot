const { chromium } = require('/Users/elizabethstein/.local/share/mise/installs/node/22.23.1/lib/node_modules/@playwright/mcp/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
    const browser = await chromium.launch({ headless: true, channel: 'chrome' });
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    const mode = process.argv[2] || 'before';
    const targets = mode === 'before' ? [
        ['home', 'http://127.0.0.1:4173/'],
        ['about', 'http://127.0.0.1:4173/about.html'],
        ['contact', 'http://127.0.0.1:4173/contact.html'],
        ['privacy-policy', 'http://127.0.0.1:4173/privacy-policy.html']
    ] : JSON.parse(fs.readFileSync(`design-research/${mode}-targets.json`, 'utf8'));
    const log = [];
    for (const [name, url] of targets) {
        for (const [device, width, height] of mode === 'before' ? [['desktop', 1440, 1000], ['mobile', 390, 844]] : [['desktop', 1440, 1000]]) {
            try {
                await page.setViewportSize({ width, height });
                const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
                await page.waitForTimeout(mode === 'before' ? 1800 : 6000);
                await page.evaluate(() => document.fonts.ready);
                const file = `design-research/screenshots/${mode}/${name}-${device}.png`;
                fs.mkdirSync(path.dirname(file), { recursive: true });
                await page.screenshot({ path: file, fullPage: mode === 'before', timeout: 15000 });
                const content = await page.locator('body').innerText();
                const links = await page.locator('a[href]').evaluateAll(nodes => nodes.map(a => ({ text: a.innerText, href: a.href })));
                const entry = { name, device, url, finalUrl: page.url(), status: response?.status(), title: await page.title(), screenshot: file, content: content.slice(0, 22000), links };
                log.push(entry);
                console.log(JSON.stringify({ name, device, status: entry.status, title: entry.title, screenshot: file }));
            } catch (error) {
                log.push({ name, device, url, blocked: error.message });
                console.log(JSON.stringify({ name, device, blocked: error.message }));
            }
            fs.writeFileSync(`design-research/${mode}-captures.json`, JSON.stringify(log, null, 2));
        }
    }
    await browser.close();
})();
