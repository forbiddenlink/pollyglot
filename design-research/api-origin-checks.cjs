// Integration tests use a child with a curated, credential-free environment.
const { spawnSync } = require('node:child_process');
if (!process.argv.includes('--isolated')) {
    const result = spawnSync(process.execPath, [__filename, '--isolated'], {
        stdio: 'inherit',
        env: { PATH: process.env.PATH, NODE_ENV: 'production', ALLOWED_ORIGINS: 'https://partner.example', VERCEL_URL: 'pollyglot-test-preview.vercel.app', VERCEL_BRANCH_URL: 'pollyglot-git-review.vercel.app', VERCEL_PROJECT_PRODUCTION_URL: 'pollyglot.example' }
    });
    process.exitCode = result.status ?? 1;
} else {
    const assert = require('node:assert/strict');
    const path = require('node:path');
    // Avoid loading any local environment file; all configuration is above.
    require.cache[require.resolve('dotenv', { paths: [path.resolve('api')] })] = { exports: { config: () => ({ parsed: {} }) } };
    const app = require('../api/index.js');
    const server = app.listen(0, '127.0.0.1', async () => {
        try {
            const base = `http://127.0.0.1:${server.address().port}`;
            const origin = 'https://pollyglot-topaz.vercel.app';
            const response = await fetch(base + '/translate', { method: 'OPTIONS', headers: { Origin: origin } });
            assert.equal(response.status, 204, 'The deployed site must reach its own API');
            assert.equal(response.headers.get('access-control-allow-origin'), origin);
            console.log('PASS deployed site can access its own API');
            for (const allowed of ['https://pollyglot-elizabeth-emersons-projects.vercel.app', 'https://pollyglot-git-main-elizabeth-emersons-projects.vercel.app', 'https://pollyglot-test-preview.vercel.app', 'https://pollyglot-git-review.vercel.app', 'https://pollyglot.example', 'https://partner.example']) {
                const res = await fetch(base + '/translate', { method: 'OPTIONS', headers: { Origin: allowed } });
                assert.equal(res.status, 204, allowed);
                assert.equal(res.headers.get('access-control-allow-origin'), allowed);
            }
            console.log('PASS exact application, deployment and configured partner origins');
            for (const denied of ['https://pollyglot-topaz.vercel.app.attacker.example', 'https://unrelated.vercel.app', 'https://unrelated.example', 'null', 'http://localhost:3000']) {
                const res = await fetch(base + '/translate', { method: 'OPTIONS', headers: { Origin: denied } });
                assert.equal(res.status, 403, denied);
                assert.equal(res.headers.get('access-control-allow-origin'), null);
            }
            console.log('PASS unrelated origins and configured localhost restriction');
            const invalid = await fetch(base + '/api/translate', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{}' });
            assert.equal(invalid.status, 400, 'Public API prefix must reach translation validation');
            assert.match((await invalid.json()).error, /text/i);
            console.log('PASS public API prefix reaches validation');
            for (const endpoint of ['/translate', '/tts', '/api/tts']) {
                const res = await fetch(base + endpoint, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{}' });
                assert.equal(res.status, 400, endpoint);
                assert.match((await res.json()).error, /text/i);
            }
            const unknown = await fetch(base + '/api-translate', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{}' });
            assert.equal(unknown.status, 404, 'Only the exact function prefix is normalized');
            const deniedPost = await fetch(base + '/api/translate', { method: 'POST', headers: { Origin: 'https://unrelated.example', 'Content-Type': 'application/json' }, body: '{}' });
            assert.equal(deniedPost.status, 403);
            console.log('PASS local API compatibility, TTS validation, unknown prefix and denied POST');
        } catch (error) { console.error(error.message); process.exitCode = 1; }
        finally { server.close(); }
    });
}
