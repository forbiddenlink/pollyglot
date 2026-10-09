const { chromium } = require('/Users/elizabethstein/.local/share/mise/installs/node/22.23.1/lib/node_modules/@playwright/mcp/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
    const browser = await chromium.launch({ headless: true, channel: 'chrome' });
    const results = [];
    fs.mkdirSync('design-research/screenshots/functionality', { recursive: true });
    async function test(name, run, options = {}) {
        const context = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 }, ...options });
        const page = await context.newPage();
        try {
            await context.route('**/api/**', async route => {
                const path = new URL(route.request().url()).pathname;
                if (path.endsWith('/translate')) await route.fulfill({ json: { translation: 'Hola, amigo.' } });
                else if (path.endsWith('/detect')) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    await route.fulfill({ json: { detectedLanguage: 'fr' } });
                } else {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    await route.fulfill({ json: path.endsWith('/alternatives') ? { alternatives: ['Buenas, amigo.'] } : { phonetic: 'Old pronunciation' } });
                }
            });
            await page.goto('http://127.0.0.1:48731');
            await run(page, context);
            results.push({ name, passed: true });
            console.log('PASS', name);
        } catch (error) {
            results.push({ name, passed: false, error: error.message });
            console.log('FAIL', name, error.message);
        } finally { await context.close(); }
    }
    async function translate(page) {
        await page.locator('#source-text').fill('Hello, friend.');
        await page.locator('.translate-btn').click();
        await page.waitForFunction(() => document.querySelector('.text-output').textContent === 'Hola, amigo.');
    }
    await test('Edited source cannot be saved against a previous result', async page => {
        await translate(page);
        await page.locator('#source-text').fill('A different sentence.');
        assert.ok(await page.locator('.save-translation-btn').isDisabled());
        assert.ok(await page.locator('.favorite-btn').isDisabled());
        assert.ok(await page.locator('#download-text').isDisabled());
        await page.screenshot({ path: 'design-research/screenshots/functionality/outdated-result-desktop.png', fullPage: true });
    });
    await test('Undo after clear restores a usable completed translation', async page => {
        await translate(page);
        await page.locator('.clear-text-btn').click();
        await page.locator('.swap-lang-btn').focus();
        await page.keyboard.press('Control+z');
        assert.equal(await page.locator('#source-text').inputValue(), 'Hello, friend.');
        assert.equal(await page.locator('.text-output').textContent(), 'Hola, amigo.');
        assert.equal(await page.locator('.copy-btn').isDisabled(), false);
        assert.equal(await page.locator('.save-translation-btn').isDisabled(), false);
    });
    await test('Late alternatives do not return after clear', async page => {
        await translate(page);
        await page.locator('.clear-text-btn').click();
        await page.waitForTimeout(700);
        assert.equal(await page.locator('.alternatives-section').isVisible(), false);
    });
    await test('Late detection does not replace the language of edited text', async page => {
        await page.locator('#source-text').fill('Bonjour.');
        await page.locator('.detect-lang').click();
        await page.locator('#source-text').fill('Hello instead.');
        await page.waitForTimeout(700);
        assert.ok((await page.locator('.language-trigger').first().textContent()).includes('English'));
    });
    await test('Clear stops an in-progress typing animation', async page => {
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.locator('#source-text').fill('Hello, friend.');
        await page.locator('.translate-btn').click();
        await page.waitForSelector('.text-output.typing');
        await page.locator('.clear-text-btn').click();
        await page.waitForTimeout(700);
        assert.equal(await page.locator('.text-output').textContent(), '');
    });
    await test('Swap and undo persist the actual workspace draft and pair', async page => {
        await translate(page);
        await page.locator('.swap-lang-btn').click();
        await page.reload();
        assert.equal(await page.locator('#source-text').inputValue(), 'Hola, amigo.');
        assert.ok((await page.locator('.language-trigger').first().textContent()).includes('Spanish'));
        assert.ok((await page.locator('.language-trigger').nth(1).textContent()).includes('English'));
        await page.locator('.clear-text-btn').click();
        await page.locator('.swap-lang-btn').focus();
        await page.keyboard.press('Control+z');
        await page.reload();
        assert.equal(await page.locator('#source-text').inputValue(), 'Hola, amigo.');
    });
    await test('Slow translation can be cancelled and retried', async (page, context) => {
        await context.route('**/api/translate', async route => {
            await new Promise(resolve => setTimeout(resolve, 5000));
            try { await route.fulfill({ json: { translation: 'Too late' } }); } catch {}
        });
        await page.locator('#source-text').fill('Hello, friend.');
        await page.locator('.translate-btn').click();
        assert.ok(await page.locator('#cancel-translation').isVisible());
        await page.screenshot({ path: 'design-research/screenshots/functionality/pending-desktop.png', fullPage: true });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({ path: 'design-research/screenshots/functionality/pending-mobile.png', fullPage: true });
        await page.addScriptTag({ path: '/Users/elizabethstein/.local/share/mise/installs/node/22.23.1/lib/node_modules/axe-core/axe.min.js' });
        const violations = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(v => v.id));
        assert.deepEqual(violations, []);
        await page.locator('#cancel-translation').click();
        await page.waitForFunction(() => !document.querySelector('.translate-btn').disabled);
        assert.equal(await page.locator('.text-output').textContent(), '');
        assert.equal(await page.locator('#cancel-translation').isVisible(), false);
        await context.unroute('**/api/translate');
        await page.locator('.translate-btn').click();
        await page.waitForFunction(() => document.querySelector('.text-output').textContent === 'Hola, amigo.');
        await page.waitForTimeout(1700);
        assert.equal(await page.locator('.text-output').textContent(), 'Hola, amigo.');
    });
    await test('Failed replacement translation keeps retry available', async (page, context) => {
        await translate(page);
        await context.route('**/api/translate', route => route.fulfill({ status: 503, json: { error: 'Service unavailable' } }));
        await page.locator('.translate-btn').click();
        await page.waitForFunction(() => !document.querySelector('.translate-btn').disabled);
        assert.equal(await page.locator('#translation-status').getAttribute('data-state'), 'error');
        assert.ok(await page.locator('#retry-translation').isVisible());
    });
    await test('Clearing during a slow request immediately releases the translator', async (page, context) => {
        await context.route('**/api/translate', async route => {
            await new Promise(resolve => setTimeout(resolve, 1500));
            try { await route.fulfill({ json: { translation: 'Too late' } }); } catch {}
        });
        await page.locator('#source-text').fill('Hello, friend.');
        await page.locator('.translate-btn').click();
        await page.locator('.clear-text-btn').click();
        await page.waitForTimeout(100);
        assert.equal(await page.locator('.translate-btn').isDisabled(), false);
        assert.equal(await page.locator('#source-text').inputValue(), '');
    });
    await test('Translation timeout restores controls and offers retry', async (page, context) => {
        await context.route('**/api/translate', async route => {
            await new Promise(resolve => setTimeout(resolve, 1500));
            try { await route.fulfill({ json: { translation: 'Too late' } }); } catch {}
        });
        await page.clock.install();
        await page.locator('#source-text').fill('Hello, friend.');
        await page.locator('.translate-btn').click();
        await page.clock.fastForward(45001);
        await page.waitForFunction(() => !document.querySelector('.translate-btn').disabled);
        assert.equal(await page.locator('#translation-status').getAttribute('data-state'), 'error');
        assert.ok(await page.locator('#retry-translation').isVisible());
        assert.equal(await page.locator('#source-text').inputValue(), 'Hello, friend.');
    });
    await test('Swap before translation preserves source text', async page => {
        await page.locator('#source-text').fill('Keep this unfinished draft.');
        await page.locator('.swap-lang-btn').click();
        assert.equal(await page.locator('#source-text').inputValue(), 'Keep this unfinished draft.');
    });
    await test('Undo does not turn an outdated result into a valid saved pair', async page => {
        await translate(page);
        await page.locator('#source-text').fill('Different text.');
        await page.locator('.clear-text-btn').click();
        await page.locator('.swap-lang-btn').focus();
        await page.keyboard.press('Control+z');
        assert.equal(await page.locator('#source-text').inputValue(), 'Different text.');
        assert.ok(await page.locator('.save-translation-btn').isDisabled());
    });
    await test('Reusing history with auto-translate enabled does not request another translation', async (page, context) => {
        let requests = 0;
        await context.route('**/api/translate', route => {
            requests++;
            return route.fulfill({ json: { translation: 'Hola, amigo.' } });
        });
        await translate(page);
        await page.locator('.settings-toggle').click();
        await page.locator('#auto-translate').check();
        await page.keyboard.press('Escape');
        await page.locator('#source-text').fill('Different draft.');
        await page.locator('.history-toggle').click();
        await page.locator('.history-list .use-btn').first().click();
        await page.waitForTimeout(100);
        assert.equal(requests, 1);
        assert.equal(await page.locator('#source-text').inputValue(), 'Hello, friend.');
    });
    await test('History with an automatic source restores its language correctly', async page => {
        await page.evaluate(() => localStorage.setItem('translationHistory', JSON.stringify([{ sourceText: 'Bonjour', targetText: 'Hello', sourceLang: 'auto', targetLang: 'en', timestamp: 1000 }])));
        await page.reload();
        await page.locator('.history-toggle').click();
        await page.locator('.history-list .use-btn').first().click();
        assert.ok((await page.locator('.language-trigger').first().textContent()).includes('Detect language'));
        assert.equal(await page.locator('#source-text').inputValue(), 'Bonjour');
        assert.equal(await page.locator('.copy-btn').isDisabled(), false);
    });
    await test('Spanish browser starts with a different destination language', async page => {
        assert.ok((await page.locator('.language-trigger').first().textContent()).includes('Spanish'));
        assert.ok((await page.locator('.language-trigger').nth(1).textContent()).includes('English'));
    }, { locale: 'es-ES' });
    fs.writeFileSync(`design-research/functionality-${process.argv[2] || 'results'}.json`, JSON.stringify(results, null, 2));
    await browser.close();
    if (results.some(r => !r.passed)) process.exitCode = 1;
})();
