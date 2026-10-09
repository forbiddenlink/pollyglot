const { chromium } = require('/Users/elizabethstein/.local/share/mise/installs/node/22.23.1/lib/node_modules/@playwright/mcp/node_modules/playwright');
const fs = require('node:fs');
(async () => {
    const browser = await chromium.launch({ headless: true, channel: 'chrome' });
    const page = await browser.newPage({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
    const results = [];
    async function audit(name) {
        await page.waitForTimeout(600);
        await page.addScriptTag({ path: '/Users/elizabethstein/.local/share/mise/installs/node/22.23.1/lib/node_modules/axe-core/axe.min.js' });
        const result = await page.evaluate(async () => {
            const data = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
            return data.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) }));
        });
        results.push({ name, violations: result });
        console.log(name, JSON.stringify(result));
    }
    try {
        await page.goto('http://127.0.0.1:48731');
        await audit('home');
        await page.locator('.language-trigger').first().click();
        await audit('language menu');
        await page.keyboard.press('Escape');
        await page.locator('.settings-toggle').click();
        await audit('settings');
        await page.keyboard.press('Escape');
        await page.locator('.history-toggle').click();
        await audit('empty history');
        await page.keyboard.press('Escape');
        await page.locator('.theme-toggle').click();
        await audit('home dark');
        for (const route of ['about', 'contact', 'privacy-policy']) {
            await page.goto(`http://127.0.0.1:48731/${route}`);
            await audit(route + ' dark');
            await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
            await audit(route + ' light');
        }
        fs.writeFileSync('design-research/accessibility-results.json', JSON.stringify(results, null, 2));
        if (results.some(r => r.violations.length)) process.exitCode = 1;
    } finally { await browser.close(); }
})();
