// Browser-side helper for server speech-to-text (POST /api/transcribe).
// Used when window.SpeechRecognition is missing (Safari, Firefox) or fails.
// Classic script: attaches window.ServerStt; also CommonJS-exportable for tests.
(function (root) {
  var MAX_SECONDS = 60;
  var MAX_BYTES = 4 * 1024 * 1024; // matches api/stt.js (Vercel body cap is 4.5MB)
  var MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

  function isSupported(env) {
    env = env || root;
    return !!(env.MediaRecorder && env.navigator && env.navigator.mediaDevices &&
      typeof env.navigator.mediaDevices.getUserMedia === 'function');
  }

  function pickMimeType(MediaRecorderImpl) {
    if (!MediaRecorderImpl || typeof MediaRecorderImpl.isTypeSupported !== 'function') return '';
    for (var i = 0; i < MIME_CANDIDATES.length; i++) {
      if (MediaRecorderImpl.isTypeSupported(MIME_CANDIDATES[i])) return MIME_CANDIDATES[i];
    }
    return '';
  }

  // Starts recording; returns { stop(): Promise<Blob> }. Auto-stops at MAX_SECONDS.
  async function startRecording(env) {
    env = env || root;
    var stream = await env.navigator.mediaDevices.getUserMedia({ audio: true });
    var mimeType = pickMimeType(env.MediaRecorder);
    var recorder = mimeType ? new env.MediaRecorder(stream, { mimeType: mimeType }) : new env.MediaRecorder(stream);
    var chunks = [];
    recorder.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    var done = new Promise(function (resolve) {
      recorder.onstop = function () {
        stream.getTracks().forEach(function (t) { t.stop(); });
        resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' }));
      };
    });
    recorder.start();
    var timer = setTimeout(function () { if (recorder.state === 'recording') recorder.stop(); }, MAX_SECONDS * 1000);
    return {
      stop: function () {
        clearTimeout(timer);
        if (recorder.state === 'recording') recorder.stop();
        return done;
      },
    };
  }

  async function transcribe(blob, langCode, fetchImpl) {
    fetchImpl = fetchImpl || root.fetch.bind(root);
    if (!blob || !blob.size) throw new Error('No audio recorded');
    if (blob.size > MAX_BYTES) throw new Error('Recording too large');
    var url = '/api/transcribe' + (langCode ? '?lang=' + encodeURIComponent(langCode) : '');
    var res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': (blob.type || 'audio/webm').split(';')[0] },
      body: blob,
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || 'Transcription failed');
    return data.text || '';
  }

  var api = { isSupported: isSupported, pickMimeType: pickMimeType, startRecording: startRecording, transcribe: transcribe, MAX_SECONDS: MAX_SECONDS, MAX_BYTES: MAX_BYTES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ServerStt = api;
})(typeof window !== 'undefined' ? window : globalThis);
