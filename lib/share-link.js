// Share links: /?t=<text>&from=<code>&to=<code>. The page reads these on load,
// fills the input and runs the translation, so a shared link shows its result.
(function () {
    const MAX_TEXT = 5000; // same cap the translate button enforces
    const MAX_LINK_TEXT = 1000; // longer text makes links too long to paste around

    function buildShareUrl(origin, { text, from, to }) {
        if (!text || text.length > MAX_LINK_TEXT) return null;
        const url = new URL('/', origin);
        url.searchParams.set('t', text);
        if (from) url.searchParams.set('from', from);
        if (to) url.searchParams.set('to', to);
        return url.toString();
    }

    // Returns { text, from, to } or null. Language codes are only accepted when
    // they are in validLangs, so a crafted link cannot inject anything else.
    function parseShareParams(search, validLangs) {
        const params = new URLSearchParams(search);
        const text = params.get('t');
        if (!text || !text.trim() || text.length > MAX_TEXT) return null;
        const pick = (code) => (code && validLangs.includes(code) ? code : null);
        return { text, from: pick(params.get('from')), to: pick(params.get('to')) };
    }

    const api = { buildShareUrl, parseShareParams };
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        window.ShareLink = api;
    }
})();
