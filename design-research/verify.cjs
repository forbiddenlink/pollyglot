const { chromium } = require('/Users/elizabethstein/.local/share/mise/installs/node/22.23.1/lib/node_modules/@playwright/mcp/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
    const browser = await chromium.launch({ headless: true, channel: 'chrome' });
    const context = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const results = [];
    const check = (name, value) => { assert.ok(value, name); results.push(name); console.log(`PASS ${name}`); };
    const base = 'http://127.0.0.1:48731';
    let mode = 'success';
    await context.route('**/api/**', async route => {
        const endpoint = new URL(route.request().url()).pathname;
        if (endpoint.endsWith('/translate')) {
            if (mode === 'slow') await new Promise(resolve => setTimeout(resolve, 800));
            await route.fulfill({ status: mode === 'error' ? 503 : 200, contentType: 'application/json', body: JSON.stringify(mode === 'error' ? { error: 'Test service unavailable' } : { translation: 'Hola, ¿cómo estás?' }) });
        } else {
            await route.fulfill({ contentType: 'application/json', body: JSON.stringify(endpoint.endsWith('/alternatives') ? { alternatives: ['Hola, ¿qué tal?'] } : endpoint.endsWith('/detect') ? { language: 'English', languageCode: 'en' } : { phonetic: 'Test pronunciation' }) });
        }
    });
    try {
        await page.goto(base);
        await page.waitForSelector('.language-trigger');
        check('Default pair is English → Spanish', (await page.locator('.language-trigger').allTextContents()).join(' ').includes('Spanish'));
        await page.getByRole('button', { name: /choose target language/i }).click();
        await page.getByLabel('Search target languages').fill('not-a-language');
        check('Unmatched language search has an empty state', await page.locator('#target-language-menu .language-empty').isVisible());
        await page.getByLabel('Search target languages').fill('French');
        await page.locator('.target-lang [data-lang="fr"]').click();
        await page.reload();
        check('Chosen destination persists across reload', (await page.getByRole('button', { name: /choose target language/i }).textContent()).includes('French'));
        await page.locator('#source-text').fill('Hello, how are you?');
        await page.reload();
        check('Draft restores after reload', await page.locator('#source-text').inputValue() === 'Hello, how are you?');
        mode = 'error';
        await page.locator('.translate-btn').click();
        await page.waitForSelector('#translation-status[data-state="error"]');
        check('Failed translation offers persistent retry', await page.locator('#retry-translation').isVisible());
        await page.screenshot({ path: 'design-research/screenshots/after/home-error.png' });
        mode = 'success';
        await page.locator('#retry-translation').click();
        await page.waitForFunction(() => document.querySelector('.text-output').textContent.includes('Hola'));
        check('Retry recovers to a successful result', await page.locator('#translation-status').getAttribute('data-state') === 'success');
        await page.waitForSelector('.alternative-item');
        await page.locator('.alternative-item').first().focus();
        await page.keyboard.press('Enter');
        check('Alternative phrasing can be selected with the keyboard', await page.locator('.text-output').textContent() === 'Hola, ¿qué tal?');
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        await page.locator('.copy-btn').click();
        check('Copy puts the selected translation on the clipboard', await page.evaluate(() => navigator.clipboard.readText()) === 'Hola, ¿qué tal?');
        await page.locator('.swap-lang-btn').focus();
        await page.keyboard.press('Control+k');
        check('Swap shortcut exchanges source and result', await page.locator('#source-text').inputValue() === 'Hola, ¿qué tal?');
        await page.keyboard.press('Control+z');
        check('Undo shortcut restores the translation pair and text', await page.locator('#source-text').inputValue() === 'Hello, how are you?' && await page.locator('.text-output').textContent() === 'Hola, ¿qué tal?');
        await page.screenshot({ path: 'design-research/screenshots/after/home-success.png' });
        const download = page.waitForEvent('download');
        await page.locator('#download-text').click();
        check('Result exports as a text file', (await download).suggestedFilename() === 'pollyglot-fr.txt');
        await page.locator('.favorite-btn').click();
        await page.locator('.history-toggle').click();
        await page.waitForSelector('.history-sidebar.open');
        const csvDownload = page.waitForEvent('download');
        await page.locator('.export-history-btn').click();
        check('History exports a CSV file', (await csvDownload).suggestedFilename().endsWith('.csv'));
        await page.locator('#history-search').fill('how are');
        check('History search finds the full original text', await page.locator('.history-list .history-item:visible').count() === 1);
        await page.locator('#history-search').fill('no-match-xyz');
        check('History search shows a no-match state', await page.locator('#history-no-results').isVisible());
        await page.locator('.history-tab[data-tab="favorites"]').click();
        await page.locator('#history-search').fill('Hola');
        check('Favorites are searchable', await page.locator('.favorites-list .favorite-item:visible').count() === 1);
        await page.keyboard.press('Escape');
        check('Escape closes history without clearing source', !(await page.locator('.history-sidebar').isVisible()) && (await page.locator('#source-text').inputValue()).includes('Hello'));
        await page.locator('.settings-toggle').click();
        await page.waitForSelector('.settings-modal:not(.hidden)');
        await page.keyboard.press('Shift+Tab');
        check('Settings trap keyboard focus', await page.evaluate(() => document.querySelector('.settings-modal').contains(document.activeElement)));
        await page.keyboard.press('Escape');
        await page.locator('#shortcut-help').click();
        check('Shortcut reference opens an accessible dialog', await page.locator('#shortcut-dialog').evaluate(el => el.open));
        await page.keyboard.press('Escape');
        await page.locator('[data-category="travel"]').click();
        await page.locator('#phrase-list button').first().click();
        check('Phrase library fills source text', await page.locator('#source-text').inputValue() === 'Where is the nearest restaurant?');
        await page.locator('#text-file').setInputFiles({ name: 'phrase.txt', mimeType: 'text/plain', buffer: Buffer.from('Imported phrase') });
        await page.waitForFunction(() => document.getElementById('source-text').value === 'Imported phrase');
        check('Text import works without an upload service', await page.locator('#source-text').inputValue() === 'Imported phrase');
        await page.locator('#text-file').setInputFiles({ name: 'long.txt', mimeType: 'text/plain', buffer: Buffer.from('a'.repeat(5001)) });
        await page.waitForFunction(() => document.getElementById('translation-status').textContent.includes('exceeds'));
        check('Oversized import is rejected without replacing input', await page.locator('#source-text').inputValue() === 'Imported phrase' && await page.locator('#translation-status').getAttribute('data-state') === 'error');
        mode = 'slow';
        await page.locator('.translate-btn').click();
        check('Loading state is visible', await page.locator('#translation-status').getAttribute('data-state') === 'loading');
        await page.screenshot({ path: 'design-research/screenshots/after/home-loading.png' });
        await page.locator('#source-text').fill('Changed while translating');
        await page.waitForFunction(() => !document.querySelector('.translate-btn').disabled);
        check('Changed input discards outdated response', (await page.locator('#translation-status').textContent()).includes('changed'));
        for (const width of [320, 390, 768, 1440]) {
            await page.setViewportSize({ width, height: 900 });
            check(`No horizontal overflow at ${width}px`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        }
        await context.setOffline(true);
        check('Offline state explains the limitation', await page.locator('#connection-status').isVisible());
        await context.setOffline(false);
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator('.theme-toggle').click();
        check('Dark theme remains available', await page.locator('html').getAttribute('data-theme') === 'dark');
        await page.screenshot({ path: 'design-research/screenshots/after/home-dark-mobile.png', fullPage: true });
        await page.locator('.theme-toggle').click();
        for (const route of ['/about', '/contact', '/privacy-policy']) {
            await page.goto(base + route);
            check(`${route} loads with the shared navigation`, await page.locator('.site-header .brand').count() === 1);
            for (const width of [390, 1440]) {
                await page.setViewportSize({ width, height: 1000 });
                check(`${route} has no overflow at ${width}px`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            }
            const links = await page.locator('a[href^="/"]').evaluateAll(nodes => nodes.map(a => a.getAttribute('href')));
            for (const href of new Set(links)) {
                const response = await page.request.get(base + href.split('#')[0]);
                check(`${route} link ${href} resolves`, response.status() === 200);
            }
            if (route === '/about') {
                await page.locator('summary').first().click();
                check('About FAQ expands', await page.locator('details').first().evaluate(el => el.open));
                await page.getByRole('link', { name: 'Translate something' }).click();
                check('About call to action returns to translator', await page.locator('#translator').count() === 1);
            }
            if (route === '/contact') {
                await page.getByRole('button', { name: 'Prepare email' }).click();
                check('Empty contact form explains missing fields', (await page.locator('#contact-status').textContent()).includes('Add a summary'));
                await page.locator('#contact-subject').fill('Test issue');
                await page.locator('#contact-message').fill('Test report with enough detail.');
                await page.locator('#contact-browser').fill('Chrome test browser');
                await page.locator('#contact-topic').selectOption('feedback');
                await page.getByRole('button', { name: 'Prepare email' }).click();
                check('Contact prepares a correctly addressed email without sending', (await page.locator('#prepared-email').getAttribute('href')).startsWith('mailto:feedback@pollyglot.app?subject='));
                await page.screenshot({ path: 'design-research/screenshots/after/contact-success.png', fullPage: true });
                await page.locator('#contact-subject').fill('Edited issue');
                check('Editing contact details invalidates the prepared email', !(await page.locator('#prepared-email').isVisible()));
            }
            if (route === '/privacy-policy') {
                await page.getByRole('link', { name: 'Local storage and settings', exact: true }).click();
                check('Privacy contents navigate to the right section', page.url().endsWith('#local-storage'));
                check('Original privacy policy date is retained', (await page.locator('article').textContent()).includes('February 10, 2026'));
            }
        }
        check('No unhandled browser errors', errors.length === 0);
        fs.writeFileSync('design-research/browser-results.json', JSON.stringify({ passed: results, errors, note: 'API responses are mocked. No paid provider calls, real microphone recordings, or message delivery tested.' }, null, 2));
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
