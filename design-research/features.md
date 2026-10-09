# Feature research

October 9, 2026. Discovery used web search for category leaders, followed by live Chrome/Playwright inspection. Inventory covers features visible on the inspected public pages, including explicitly advertised app features; it cannot establish every authenticated, paid or platform-specific capability. No competitor translation requests, accounts, payments or uploads were submitted. Advertised availability is not a quality endorsement.

| Peer and inspected page | Observed / advertised feature inventory | Evidence |
|---|---|---|
| [Google Translate](https://translate.google.com/) | Text, image, document and website modes; detection; language selection; 5,000-character counter; voice input/listen controls; history; saved entries; account sign-in; feedback | [Screenshot](screenshots/competitors/google-translate-desktop.png), `competitors-captures.json` |
| [DeepL](https://www.deepl.com/en/translator) | Text/files/speech; detection; document drag/drop; formality; style profiles; glossaries; style rules; dictionary; API/apps integrations; login/trial; enterprise solutions | [Screenshot](screenshots/competitors/deepl-desktop.png) |
| [Yandex](https://translate.yandex.com/) | Text and website link input; photo upload/paste; AI questions/grammar explanations; pronunciation and usage examples advertised; popular language-pair shortcuts; mobile/help/developer links | [Screenshot](screenshots/competitors/yandex-desktop.png) |
| [iTranslate](https://itranslate.com/) | Text/autocomplete/alternatives; voice; camera; offline translation; keyboard extension; voice output/dialects; history; favorites; fullscreen; iPad multitasking; conjugations; Siri shortcuts; transliteration; themes; share extension; phrasebook; widget; web app/mobile/watch apps | [Screenshot](screenshots/competitors/itranslate-desktop.png), full visible-text record in `competitors-captures.json` |
| [Linguee](https://www.linguee.com/) | Bilingual dictionary search; language pair; special-character keyboard; links to text/file translation and writing assistance; desktop app; locale selection | [Screenshot](screenshots/competitors/linguee-desktop.png) |
| [PONS](https://en.pons.com/text-translation) | Redirects to dictionary home; multilingual search; usage/pronunciation; conjugation tables; vocabulary trainer; school/offline dictionary apps; learning materials; subscriptions and enterprise/API links. Consent wall overlays page; no paid subscription entered. | [Screenshot](screenshots/peers/pons-desktop.png), `peers-captures.json` |
| [Bing Translator](https://www.bing.com/translator) | Detection; source/target selectors; standard/casual/formal modes; phrase library with basics/social/travel/dining/emergency/numbers/technology categories; conversation/app/business/help links | [Screenshot](screenshots/peers/bing-desktop.png) |
| [Translate.com](https://www.translate.com/) | Machine text/DOCX; native-speaker translation; proofreading/review; certified document requests; JSON translation; API; Zendesk/Zapier; website localization; formats/language directory and FAQ. These are advertised services, not verified transactions. | [Screenshot](screenshots/more-peers/translate-com-desktop.png), `more-peers-captures.json` |
| [ImTranslator](https://imtranslator.net/translation/) | Language detection; text translation; provider comparison; virtual keyboard; back translation; dictionary; text-to-speech; browser extension links; language-pair directory | [Screenshot](screenshots/more-peers/imtranslator-desktop.png) |

## Blocked candidates

Reverso: HTTP 403 security challenge, [capture](screenshots/competitors/reverso-desktop.png). Papago: page returns 200 but displays an application load error, [capture](screenshots/competitors/papago-desktop.png). WordReference: HTTP 403, [capture](screenshots/peers/wordreference-desktop.png). SpanishDictionary: screenshot timed out; SYSTRAN: navigation timed out. No feature claims are derived from those failed pages.

## Gaps that fit PollyGlot

Highest impact: compact accessible language chooser; reliable default pair; text visible immediately; stable persistent loading/error/success feedback with retry; correct mobile layout; persistent draft; searchable history/favorites; practical categorized phrase starters. Next: local `.txt` import and result download; explicit offline state; keyboard help and accessible dialogs; privacy-page contents and contact issue composer using existing mail links.

Already present: tone, history, favorites, speech, detection, alternatives, pronunciation and settings. Improve their access and states rather than claiming them as newly invented. Do not copy the peers' ads, enterprise navigation, paid gates or large language-count claims.

Deferred: OCR/camera, PDF/DOCX translation, additional engines, professional translation, account sync, provider-backed dictionary and offline translation. These require new infrastructure, services or materially expanded scope; listed in `needs-approval.md` where applicable.
