/* Progressive enhancements shared by the static pages. */
(() => {
    'use strict';

    const storage = {
        get(key) { try { return localStorage.getItem(key); } catch { return null; } },
        set(key, value) { try { localStorage.setItem(key, value); return true; } catch { return false; } }
    };

    if (!document.querySelector('.translation-grid')) {
        const theme = storage.get('theme');
        if (theme === 'dark') document.documentElement.dataset.theme = 'dark';
        const composer = document.getElementById('contact-composer');
        if (composer) {
            const status = document.getElementById('contact-status');
            const prepared = document.getElementById('prepared-email');
            composer.addEventListener('invalid', () => {
                status.textContent = 'Add a summary and at least 10 characters describing what happened.';
                prepared.hidden = true;
            }, true);
            composer.addEventListener('input', () => {
                prepared.hidden = true;
                status.textContent = '';
            });
            composer.addEventListener('submit', event => {
                event.preventDefault();
                const subject = document.getElementById('contact-subject').value.trim();
                const message = document.getElementById('contact-message').value.trim();
                if (!subject || message.length < 10) {
                    status.textContent = 'Add a summary and at least 10 characters describing what happened.';
                    prepared.hidden = true;
                    return;
                }
                const recipients = { support: 'support@pollyglot.app', feedback: 'feedback@pollyglot.app', security: 'security@pollyglot.app' };
                const recipient = recipients[document.getElementById('contact-topic').value];
                const browser = document.getElementById('contact-browser').value.trim();
                prepared.href = `mailto:${recipient}?subject=${encodeURIComponent(`PollyGlot: ${subject}`)}&body=${encodeURIComponent(message + (browser ? `\n\nBrowser and device: ${browser}` : ''))}`;
                prepared.hidden = false;
                status.textContent = 'Your email is ready to open. Review it in your email app before sending.';
            });
        }
        return;
    }

    const input = document.getElementById('source-text');
    const pickerButtons = [];
    function syncPickers() {
        pickerButtons.forEach(({ button, type, options }) => {
            const selected = options.querySelector('.selected');
            button.firstElementChild.textContent = selected ? selected.querySelector('.lang-label').textContent : 'Detect language';
            button.setAttribute('aria-label', `${button.firstElementChild.textContent}: choose ${type} language`);
            options.querySelectorAll('.lang-option').forEach(option => {
                option.setAttribute('aria-pressed', String(option.classList.contains('selected')));
            });
            const code = type === 'source' ? selectedSourceLang : selectedTargetLang;
            (type === 'source' ? input : textOutput).lang = code || '';
        });
    }

    ['source', 'target'].forEach(type => {
        const options = document.querySelector(`.${type}-lang`);
        const searchWrap = options.previousElementSibling;
        const search = searchWrap.querySelector('input');
        const picker = document.createElement('div');
        picker.className = 'language-picker';
        options.before(picker);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'language-trigger';
        button.setAttribute('aria-label', `Choose ${type} language`);
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-controls', `${type}-language-menu`);
        button.innerHTML = '<span></span><span aria-hidden="true">⌄</span>';
        const menu = document.createElement('div');
        menu.className = 'language-menu';
        menu.id = `${type}-language-menu`;
        menu.hidden = true;
        picker.append(button, menu);
        menu.append(searchWrap, options);
        const empty = document.createElement('p');
        empty.className = 'language-empty';
        empty.textContent = 'No languages found. Try another search.';
        empty.hidden = true;
        empty.setAttribute('role', 'status');
        menu.append(empty);
        function closePicker() {
            menu.hidden = true;
            button.setAttribute('aria-expanded', 'false');
        }
        button.addEventListener('click', () => {
            const open = menu.hidden;
            document.querySelectorAll('.language-menu').forEach(other => { other.hidden = true; });
            pickerButtons.forEach(item => item.button.setAttribute('aria-expanded', 'false'));
            menu.hidden = !open;
            button.setAttribute('aria-expanded', String(open));
            if (open) search.focus();
        });
        options.addEventListener('click', event => {
            if (event.target.closest('.lang-option')) { closePicker(); button.focus(); }
        });
        options.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') { closePicker(); button.focus(); }
        });
        picker.addEventListener('keydown', event => {
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closePicker(); button.focus(); }
        });
        document.addEventListener('click', event => { if (!picker.contains(event.target)) closePicker(); });
        search.addEventListener('input', () => {
            filterLanguages(search.value, type);
            empty.hidden = [...options.children].some(option => option.style.display !== 'none');
        });
        new MutationObserver(syncPickers).observe(options, { subtree: true, attributes: true, attributeFilter: ['class'] });
        pickerButtons.push({ button, type, options });
    });
    syncPickers();

    const note = document.getElementById('draft-note');
    const shared = new URLSearchParams(location.search);
    const draft = shared.get('text') || storage.get('pollyglotDraft');
    if (draft && !input.value) {
        input.value = draft.slice(0, 5000);
        updateCharCounter();
        note.textContent = shared.has('text') ? 'Shared text ready to translate' : 'Your draft has been restored';
    }
    function saveDraft() {
        note.textContent = storage.set('pollyglotDraft', input.value) ? 'Draft saved in this browser' : 'Browser storage unavailable — keep this page open';
    }
    document.addEventListener('pollyglot:workspace-change', saveDraft);
    input.addEventListener('input', saveDraft);
    document.querySelector('.clear-text-btn').addEventListener('click', saveDraft);
    document.querySelector('.swap-lang-btn').addEventListener('click', saveDraft);
    document.querySelectorAll('.example-btn').forEach(button => button.addEventListener('click', saveDraft));

    const phrases = {
        everyday: ['Hello, how are you today?', 'Thank you very much for your help!', 'Could you say that a little more slowly?', 'It is lovely to meet you.'],
        travel: ['Where is the nearest restaurant?', 'I would like to book a room for two nights.', 'Which platform does the train leave from?', 'Could you help me find this address?'],
        dining: ['May I see the menu, please?', 'I have a food allergy. Does this contain nuts?', 'Could we have the bill, please?', 'A table for two, please.'],
        work: ['Thank you for getting back to me.', 'Could we schedule a meeting next week?', 'Please let me know if you have any questions.', 'I look forward to working with you.']
    };
    function showPhrases(category) {
        document.querySelectorAll('.phrase-tab').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === category)));
        const list = document.getElementById('phrase-list');
        list.replaceChildren();
        phrases[category].forEach(text => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = text;
            button.addEventListener('click', () => {
                saveStateForUndo();
                input.value = text;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.focus();
                input.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
            });
            list.append(button);
        });
    }
    document.querySelectorAll('.phrase-tab').forEach(button => button.addEventListener('click', () => showPhrases(button.dataset.category)));
    showPhrases('everyday');

    document.getElementById('import-text').addEventListener('click', () => document.getElementById('text-file').click());
    document.getElementById('text-file').addEventListener('change', async event => {
        const file = event.target.files[0];
        if (!file) return;
        try {
            if (!/\.txt$/i.test(file.name) || file.size > 20000) throw new Error('Choose a .txt file with at most 5,000 characters.');
            const text = await file.text();
            if (text.length > 5000) throw new Error('This file exceeds 5,000 characters. Shorten it and try again.');
            saveStateForUndo();
            input.value = text;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.focus();
            showToast('Text imported. Choose a language and translate.');
        } catch (error) { setTranslationStatus('error', error.message, false); }
        event.target.value = '';
    });
    document.getElementById('download-text').addEventListener('click', () => {
        if (!refreshTranslationActions()) return;
        const text = textOutput.textContent.trim();
        if (!text) { showToast('Translate some text first, then download it.', 'warning'); return; }
        const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `pollyglot-${selectedTargetLang}.txt`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    document.getElementById('retry-translation').addEventListener('click', handleTranslation);
    document.getElementById('shortcut-help').addEventListener('click', () => document.getElementById('shortcut-dialog').showModal());
    function updateConnection() { document.getElementById('connection-status').hidden = navigator.onLine; }
    window.addEventListener('online', updateConnection);
    window.addEventListener('offline', updateConnection);
    updateConnection();

    const historySearch = document.getElementById('history-search');
    function searchHistory() {
        const query = historySearch.value.toLocaleLowerCase().trim();
        const favorites = document.querySelector('.history-tab.active')?.dataset.tab === 'favorites';
        const list = favorites ? favoritesList : historyList;
        const entries = favorites ? favoriteTranslations : translationHistory;
        const items = list.querySelectorAll('.history-item, .favorite-item');
        let matches = 0;
        items.forEach((item, index) => {
            const entry = entries[index];
            const content = entry ? `${entry.sourceText} ${entry.targetText} ${languageNames[entry.sourceLang]} ${languageNames[entry.targetLang]}` : item.textContent;
            const visible = content.toLocaleLowerCase().includes(query);
            item.hidden = !visible;
            if (visible) matches++;
        });
        document.getElementById('history-no-results').hidden = !query || matches > 0;
    }
    historySearch.addEventListener('input', searchHistory);
    new MutationObserver(searchHistory).observe(historyList, { childList: true });
    new MutationObserver(searchHistory).observe(favoritesList, { childList: true });
    document.querySelectorAll('.history-tab').forEach(button => button.addEventListener('click', searchHistory));

    const sidebar = document.querySelector('.history-sidebar');
    const settings = document.querySelector('.settings-modal');
    let previousFocus = null;
    let activePanel = null;
    function syncPanels() {
        const panel = !settings.classList.contains('hidden') ? settings : sidebar.classList.contains('open') ? sidebar : null;
        sidebar.inert = !sidebar.classList.contains('open');
        if (panel !== activePanel) {
            if (panel) {
                previousFocus = document.activeElement;
                activePanel = panel;
                (panel.querySelector('button') || panel).focus();
            } else {
                activePanel = null;
                previousFocus?.focus();
            }
        }
    }
    new MutationObserver(syncPanels).observe(sidebar, { attributes: true, attributeFilter: ['class'] });
    new MutationObserver(syncPanels).observe(settings, { attributes: true, attributeFilter: ['class'] });
    document.addEventListener('keydown', event => {
        if (!activePanel) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopImmediatePropagation();
            if (activePanel === settings) closeSettingsModal();
            else sidebar.classList.remove('open');
        }
        if (event.key === 'Tab') {
            const focusable = [...activePanel.querySelectorAll('button, input, select, [tabindex="0"], a[href]')].filter(el => !el.disabled && el.getClientRects().length);
            const first = focusable[0];
            const last = focusable.at(-1);
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
    }, true);
})();
