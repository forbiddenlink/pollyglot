/* Home hero route map: one word shown in three languages. Where the browser has a
   matching voice, each language row gets a button that reads it aloud with
   speechSynthesis. The words are in the markup, so the object works without JS. */
(() => {
    'use strict';

    // One greeting per language, approved by the owner for these three common words only.
    // None of it has been checked by a native speaker. The repo carries no region information
    // for them, so each row names the language only.
    const PHRASES = [
        { lang: 'es', name: 'Spanish', text: 'Hola' },
        { lang: 'fr', name: 'French', text: 'Bonjour' },
        { lang: 'ja', name: 'Japanese', text: 'こんにちは' }
    ];

    function pickVoice(voices, lang) {
        return voices.find(voice => String(voice.lang).toLowerCase().split(/[-_]/)[0] === lang) || null;
    }

    function init(card, win = window) {
        const synth = win.speechSynthesis || null;
        const rows = PHRASES.map(phrase => {
            const row = card.querySelector(`[data-hero-lang="${phrase.lang}"]`);
            return row ? { phrase, row, play: row.querySelector('.hero-play') } : null;
        }).filter(Boolean);
        let active = null;

        function canSpeak(phrase) {
            return Boolean(synth && win.SpeechSynthesisUtterance && pickVoice(synth.getVoices(), phrase.lang));
        }

        function label(entry, verb) {
            entry.play.setAttribute('aria-label', `${verb} the ${entry.phrase.name} phrase`);
        }

        function stop() {
            if (!active) return;
            const { entry } = active;
            active = null;
            if (synth) synth.cancel();
            entry.row.removeAttribute('data-speaking');
            label(entry, 'Hear');
        }

        function refresh() {
            rows.forEach(entry => {
                entry.play.hidden = !canSpeak(entry.phrase);
                if (!entry.row.hasAttribute('data-speaking')) label(entry, 'Hear');
            });
        }

        function speak(entry) {
            const wasActive = active && active.entry === entry;
            stop();
            if (wasActive) return;
            const utterance = new win.SpeechSynthesisUtterance(entry.phrase.text);
            utterance.lang = entry.phrase.lang;
            utterance.voice = pickVoice(synth.getVoices(), entry.phrase.lang);
            const done = () => { if (active && active.utterance === utterance) stop(); };
            utterance.onend = done;
            utterance.onerror = done;
            active = { entry, utterance };
            entry.row.setAttribute('data-speaking', '');
            label(entry, 'Stop');
            synth.speak(utterance);
        }

        rows.forEach(entry => entry.play.addEventListener('click', () => speak(entry)));
        if (synth && synth.addEventListener) synth.addEventListener('voiceschanged', refresh);
        refresh();
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { PHRASES, pickVoice, init };
    } else {
        const card = document.querySelector('.route');
        if (card) init(card);
    }
})();
