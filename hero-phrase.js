/* Home hero phrase card: swaps one phrase between languages and, where the
   browser has a matching voice, reads it aloud with speechSynthesis. */
(() => {
    'use strict';

    // One greeting per language, approved by the owner for these three common words only.
    // None of it has been checked by a native speaker. The repo carries no region information
    // for them, so the chip names the language only.
    const MEANING = 'Hello';
    const PHRASES = [
        { lang: 'es', name: 'Spanish', text: 'Hola' },
        { lang: 'fr', name: 'French', text: 'Bonjour' },
        { lang: 'ja', name: 'Japanese', text: 'こんにちは' }
    ];
    const NARROW = '(max-width: 760px)';

    function pickVoice(voices, lang) {
        return voices.find(voice => String(voice.lang).toLowerCase().split(/[-_]/)[0] === lang) || null;
    }

    // Narrow screens put the card below the translator (before the phrase library) so the main action stays first.
    function place(card, narrow) {
        const home = card.heroHome;
        if (narrow) {
            const library = document.querySelector('.phrase-library');
            const translator = document.getElementById('translator');
            if (library) library.before(card);
            else if (translator) translator.after(card);
        } else if (home) {
            home.append(card);
        }
    }

    function init(card, win = window) {
        const synth = win.speechSynthesis || null;
        const play = card.querySelector('.hero-play');
        const text = card.querySelector('.hero-phrase');
        const meaning = card.querySelector('.hero-meaning');
        const chipName = card.querySelector('.hero-chip-name');
        const buttons = [...card.querySelectorAll('[data-hero-lang]')];
        let current = PHRASES[0];
        let utterance = null;

        function canSpeak() {
            return Boolean(synth && win.SpeechSynthesisUtterance && pickVoice(synth.getVoices(), current.lang));
        }

        function stop() {
            if (utterance && synth) synth.cancel();
            utterance = null;
            card.removeAttribute('data-speaking');
            play.setAttribute('aria-label', `Hear the ${current.name} phrase`);
        }

        function refresh() {
            play.hidden = !canSpeak();
            play.setAttribute('aria-label', `Hear the ${current.name} phrase`);
        }

        function show(lang) {
            stop();
            current = PHRASES.find(item => item.lang === lang) || PHRASES[0];
            text.textContent = current.text;
            text.setAttribute('lang', current.lang);
            meaning.textContent = MEANING;
            chipName.textContent = current.name;
            buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.heroLang === current.lang)));
            refresh();
        }

        function speak() {
            if (utterance) { stop(); return; }
            const next = new win.SpeechSynthesisUtterance(current.text);
            next.lang = current.lang;
            next.voice = pickVoice(synth.getVoices(), current.lang);
            const done = () => { if (utterance === next) stop(); };
            next.onend = done;
            next.onerror = done;
            utterance = next;
            card.setAttribute('data-speaking', '');
            play.setAttribute('aria-label', `Stop the ${current.name} phrase`);
            synth.speak(next);
        }

        buttons.forEach(button => button.addEventListener('click', () => show(button.dataset.heroLang)));
        play.addEventListener('click', speak);
        if (synth && synth.addEventListener) synth.addEventListener('voiceschanged', refresh);
        show(current.lang);

        card.heroHome = card.parentElement;
        if (win.matchMedia) {
            const query = win.matchMedia(NARROW);
            place(card, query.matches);
            query.addEventListener('change', event => place(card, event.matches));
        }
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { PHRASES, pickVoice, place, init };
    } else {
        const card = document.querySelector('.hero-card');
        if (card) init(card);
    }
})();
