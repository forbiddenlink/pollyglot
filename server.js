require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Translation endpoint
app.post('/api/translate', async (req, res) => {
    try {
        const { text, sourceLang, targetLang } = req.body;
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: `You are a professional translator. Translate the following text from ${sourceLang || 'the detected language'} to ${targetLang}. Provide only the translation, no explanations.`
                    },
                    {
                        role: "user",
                        content: text
                    }
                ]
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error?.message || 'Translation failed');
        }

        res.json({ translation: data.choices[0].message.content.trim() });
    } catch (error) {
        console.error('Translation error:', error);
        res.status(500).json({ error: 'Translation failed' });
    }
});

// Language detection endpoint
app.post('/api/detect', async (req, res) => {
    try {
        const { text } = req.body;
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: "You are a language detection expert. Analyze the following text and respond only with the language code ('fr' for French, 'es' for Spanish, 'ja' for Japanese). If the language is not one of these, respond with the closest match."
                    },
                    {
                        role: "user",
                        content: text
                    }
                ]
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error?.message || 'Language detection failed');
        }

        res.json({ detectedLanguage: data.choices[0].message.content.trim().toLowerCase() });
    } catch (error) {
        console.error('Language detection error:', error);
        res.status(500).json({ error: 'Language detection failed' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 