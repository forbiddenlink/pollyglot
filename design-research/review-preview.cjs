// Authenticate preview GETs through the Vercel CLI; never retrieve environment values.
const { chromium } = require('/Users/elizabethstein/.local/share/mise/installs/node/22.23.1/lib/node_modules/@playwright/mcp/node_modules/playwright');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const fs = require('node:fs');
const Module = require('node:module');
const assert = require('node:assert/strict');
const exec = promisify(execFile);
const base = 'https://pollyglot-bep3q6pgt-elizabeth-emersons-projects.vercel.app';
const cache = new Map();
async function fetchPreview(path) {
    assert.ok(path.startsWith('/') && !path.startsWith('//'));
    assert.ok(!path.startsWith('/api/'), 'Live provider requests are excluded');
    if (!cache.has(path)) cache.set(path, (async () => {
        const { stdout } = await exec('vercel', ['curl', path, '--deployment', base, '--scope', 'elizabeth-emersons-projects', '--', '--silent', '--show-error', '--include'], { encoding: 'buffer', maxBuffer: 8 * 1024 * 1024 });
        const end = stdout.indexOf('\r\n\r\n');
        assert.ok(end > 0, 'HTTP response headers required');
        const header = stdout.subarray(0, end).toString();
        const status = Number(header.match(/^HTTP\/\S+ (\d+)/)[1]);
        const type = header.match(/^content-type:\s*(.+)$/im)?.[1].trim() || 'application/octet-stream';
        return { status, contentType: type, body: stdout.subarray(end + 4) };
    })());
    return cache.get(path);
}
const launch = chromium.launch.bind(chromium);
chromium.launch = async (...args) => {
    const browser = await launch(...args);
    const createContext = browser.newContext.bind(browser);
    browser.newContext = async (...options) => {
        const context = await createContext(...options);
        await context.route(base + '/**', async route => {
            const url = new URL(route.request().url());
            if (url.pathname.startsWith('/api/') || route.request().method() !== 'GET') return route.abort();
            await route.fulfill(await fetchPreview(url.pathname + url.search));
        });
        const get = context.request.get.bind(context.request);
        context.request.get = async (url, ...options) => {
            const parsed = new URL(url);
            if (parsed.origin !== base) return get(url, ...options);
            const response = await fetchPreview(parsed.pathname);
            return { status: () => response.status };
        };
        return context;
    };
    browser.newPage = async options => (await browser.newContext(options)).newPage();
    return browser;
};
fs.mkdirSync('design-research/preview/screenshots/after', { recursive: true });
fs.mkdirSync('design-research/preview/screenshots/functionality', { recursive: true });
const mode = process.argv[2] || 'screenshots';
if (['verify', 'functionality', 'accessibility'].includes(mode)) {
    const file = mode === 'functionality' ? 'functionality-checks.cjs' : mode + '.cjs';
    const source = fs.readFileSync('design-research/' + file, 'utf8')
        .replaceAll('http://127.0.0.1:48731', base)
        .replaceAll('design-research/', 'design-research/preview/');
    const module = new Module(__filename);
    module.filename = __filename;
    module.paths = Module._nodeModulePaths(__dirname);
    module._compile(source, __filename);
} else (async () => {
    const browser = await chromium.launch({ headless: true, channel: 'chrome' });
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    const results = [];
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
        for (const file of ['index.html', 'about.html', 'contact.html', 'privacy-policy.html', 'script.js', 'site.js', 'site.css', 'index.css', 'sw.js']) {
            const response = await fetchPreview('/' + file);
            assert.equal(response.status, 200);
            assert.deepEqual(response.body, fs.readFileSync(file), file + ' must match the reviewed source');
        }
        console.log('PASS deployed application assets match local source');
        for (const [name, path] of [['home', '/'], ['about', '/about'], ['contact', '/contact'], ['privacy-policy', '/privacy-policy']]) {
            for (const [device, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
                await page.setViewportSize({ width, height });
                const response = await page.goto(base + path, { waitUntil: 'networkidle' });
                assert.equal(response.status(), 200);
                await page.evaluate(() => document.fonts.ready);
                assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
                const screenshot = `design-research/preview/screenshots/${name}-${device}.png`;
                await page.screenshot({ path: screenshot, fullPage: true });
                results.push({ name, device, status: response.status(), title: await page.title(), screenshot });
                console.log('PASS', name, device);
            }
        }
        for (const path of ['/design-research/report.md', '/.env.example', '/.claude/settings.local.json']) {
            const response = await fetchPreview(path);
            assert.equal(response.status, 404, path + ' must not be deployed');
        }
        assert.deepEqual(errors, []);
        fs.writeFileSync('design-research/preview/captures.json', JSON.stringify({ base, results, errors, excludedPaths: 'research, environment and local tooling paths return 404', access: 'Authenticated GET proxy via vercel curl; real Chrome rendering. API calls blocked.' }, null, 2));
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
