// Provider-boundary tests use fake credentials and intercept every upstream call.
const { spawnSync } = require('node:child_process');
if (!process.argv.includes('--isolated')) {
    const result = spawnSync(process.execPath, [__filename, '--isolated'], {
        stdio: 'inherit', env: { PATH: process.env.PATH, NODE_ENV: 'production', MINIMAX_API_KEY: 'test-key-not-real' }
    });
    process.exitCode = result.status ?? 1;
} else {
    const assert = require('node:assert/strict');
    const path = require('node:path');
    require.cache[require.resolve('dotenv', { paths: [path.resolve('api')] })] = { exports: { config: () => ({ parsed: {} }) } };
    const networkFetch = global.fetch;
    const bytes = Buffer.from([0xff, 0xfb, 0x90, 0x64]);
    let upstreamCalls = 0;
    let providerStatus = 200;
    global.fetch = async (url, options) => {
        upstreamCalls++;
        assert.equal(url, 'https://api.minimax.io/v1/t2a_v2', 'Use the documented MiniMax endpoint');
        assert.equal(options.method, 'POST');
        assert.equal(options.headers.Authorization, 'Bearer test-key-not-real');
        const body = JSON.parse(options.body);
        assert.equal(body.model, 'speech-02-hd');
        assert.equal(body.voice_setting.voice_id, 'Calm_Woman');
        assert.equal(body.text, 'Hello.');
        return new Response(JSON.stringify(providerStatus === 200 ? { data: { audio: bytes.toString('hex') } } : { error: 'Test provider unavailable' }), { status: providerStatus, headers: { 'Content-Type': 'application/json' } });
    };
    const app = require('../api/index.js');
    const server = app.listen(0, '127.0.0.1', async () => {
        try {
            const base = `http://127.0.0.1:${server.address().port}`;
            const options = { method: 'POST', headers: { Origin: 'https://pollyglot-topaz.vercel.app', 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'Hello.', language: 'en' }) };
            const response = await networkFetch(base + '/api/tts', options);
            assert.equal(response.status, 200);
            assert.match(response.headers.get('content-type'), /audio\/mpeg/);
            assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
            assert.equal(upstreamCalls, 1);
            console.log('PASS official MiniMax endpoint, existing model/voice and binary audio passthrough');
            providerStatus = 401;
            const failed = await networkFetch(base + '/api/tts', options);
            assert.equal(failed.status, 500);
            assert.equal((await failed.json()).error, 'TTS service not configured');
            assert.equal(upstreamCalls, 2);
            console.log('PASS provider rejection reaches existing missing-fallback configuration state');
        } catch (error) { console.error(error.message); process.exitCode = 1; }
        finally { global.fetch = networkFetch; server.close(); }
    });
}
