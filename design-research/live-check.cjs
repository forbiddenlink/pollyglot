// Opt-in live QA: one translation request and one TTS request per run.
const { chromium } = require('/Users/elizabethstein/.local/share/mise/installs/node/22.23.1/lib/node_modules/@playwright/mcp/node_modules/playwright');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const exec = promisify(execFile);
const base = process.env.POLLYGLOT_LIVE_URL || 'https://pollyglot-topaz.vercel.app';
const host = new URL(base);
assert.equal(host.protocol, 'https:');
assert.equal(host.origin, base);
assert.ok(host.hostname === 'pollyglot-topaz.vercel.app' || /^pollyglot-[a-z0-9]+-elizabeth-emersons-projects\.vercel\.app$/.test(host.hostname));
const stage = process.argv[2] || 'production';
assert.ok(['preview', 'production'].includes(stage));
const output = `design-research/live/${stage}`;
const results = { base, requests: [], auxiliaryRequests: 'Blocked to limit paid usage', providerIdentity: 'Not exposed by the existing API' };
const counts = new Map();
const cache = new Map();
async function request(path, method = 'GET', body) {
    assert.ok(path.startsWith('/') && !path.startsWith('//'));
    const args = ['curl', path, '--deployment', base, '--scope', 'elizabeth-emersons-projects', '--', '--silent', '--show-error', '--include', '--max-time', '65'];
    if (method === 'POST') args.push('--request', 'POST', '--header', 'Content-Type: application/json', '--header', 'Origin: ' + base, '--data', body);
    const start = Date.now();
    const { stdout } = await exec('vercel', args, { encoding: 'buffer', maxBuffer: 8 * 1024 * 1024, timeout: 70000 });
    const end = stdout.indexOf('\r\n\r\n');
    assert.ok(end > 0);
    const headers = stdout.subarray(0, end).toString();
    return { status: Number(headers.match(/^HTTP\/\S+ (\d+)/)[1]), contentType: headers.match(/^content-type:\s*(.+)$/im)?.[1].trim() || 'application/octet-stream', body: stdout.subarray(end + 4), elapsedMs: Date.now() - start };
}
(async () => {
    fs.mkdirSync(output, { recursive: true });
    const browser = await chromium.launch({ headless: true, channel: 'chrome' });
    const context = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.addInitScript(() => {
        window.liveAudio = { started: false, ended: false, error: null };
        const play = HTMLMediaElement.prototype.play;
        HTMLMediaElement.prototype.play = function () {
            this.addEventListener('playing', () => { window.liveAudio.started = true; });
            this.addEventListener('ended', () => { window.liveAudio.ended = true; });
            this.addEventListener('error', () => { window.liveAudio.error = this.error?.code; });
            return play.call(this);
        };
    });
    await context.route(base + '/**', async route => {
        const req = route.request();
        const url = new URL(req.url());
        assert.equal(url.origin, base);
        const path = url.pathname;
        if (path.startsWith('/api/')) {
            if (!['/api/translate', '/api/tts'].includes(path) || req.method() !== 'POST') return route.fulfill({ status: 503, json: { error: 'Auxiliary requests excluded from bounded live QA' } });
            counts.set(path, (counts.get(path) || 0) + 1);
            if (counts.get(path) > 1) return route.abort();
            const response = await request(path, 'POST', req.postData());
            const entry = { path, status: response.status, contentType: response.contentType, bytes: response.body.length, elapsedMs: response.elapsedMs };
            if (response.contentType.includes('json')) entry.response = JSON.parse(response.body.toString());
            else if (!response.contentType.startsWith('audio/')) entry.response = response.body.toString().slice(0, 250);
            if (path === '/api/tts' && response.contentType.startsWith('audio/')) fs.writeFileSync(`${output}/speech.mp3`, response.body);
            results.requests.push(entry);
            console.log(JSON.stringify(entry));
            return route.fulfill({ status: response.status, contentType: response.contentType, body: response.body });
        }
        if (req.method() !== 'GET') return route.abort();
        if (!cache.has(path)) cache.set(path, request(path));
        const response = await cache.get(path);
        return route.fulfill({ status: response.status, contentType: response.contentType, body: response.body });
    });
    try {
        await page.goto(base, { waitUntil: 'networkidle' });
        await page.locator('#source-text').fill('Hello, how are you?');
        await page.locator('.translate-btn').click();
        await page.waitForFunction(() => !document.querySelector('.translate-btn').disabled, null, { timeout: 55000 });
        results.translation = { text: await page.locator('.text-output').textContent(), state: await page.locator('#translation-status').getAttribute('data-state') };
        await page.screenshot({ path: `${output}/translation-desktop.png`, fullPage: true });
        if (results.translation.state === 'success') await page.locator('.output-speak').click();
        else await page.locator('.input-speak').click();
        await page.waitForFunction(() => window.liveAudio.started || !document.querySelector('.speak-btn.speaking'), null, { timeout: 70000 });
        await page.waitForTimeout(3500);
        results.playback = await page.evaluate(() => window.liveAudio);
        if (results.requests.some(entry => entry.path === '/api/tts' && entry.contentType.startsWith('audio/'))) {
            const encoded = fs.readFileSync(`${output}/speech.mp3`).toString('base64');
            results.audio = await page.evaluate(async encoded => {
                const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
                const context = new AudioContext();
                try {
                    const buffer = await context.decodeAudioData(bytes.buffer);
                    const channel = buffer.getChannelData(0);
                    let sum = 0;
                    for (const sample of channel) sum += sample * sample;
                    return { durationSeconds: buffer.duration, sampleRate: buffer.sampleRate, channels: buffer.numberOfChannels, rms: Math.sqrt(sum / channel.length) };
                } finally { await context.close(); }
            }, encoded);
        }
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({ path: `${output}/translation-mobile.png`, fullPage: true });
        results.passed = results.translation.state === 'success' && /hola/i.test(results.translation.text) && results.playback.started && results.audio?.durationSeconds > 0 && results.audio.rms > 0;
        console.log(JSON.stringify({ translation: results.translation, playback: results.playback, audio: results.audio, passed: results.passed }));
        if (!results.passed) process.exitCode = 1;
    } finally {
        fs.writeFileSync(`${output}/results.json`, JSON.stringify(results, null, 2));
        await browser.close();
    }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
