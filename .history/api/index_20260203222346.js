require('dotenv').config();
const express = require('express');

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));

// CORS configuration
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Rate limiting (simple in-memory implementation)
const requestCounts = new Map();
const RATE_LIMIT = 50; // requests per minute
const RATE_WINDOW = 60000; // 1 minute
const CLEANUP_INTERVAL = 300000; // 5 minutes

function checkRateLimit(ip) {
    const now = Date.now();
    const userRequests = requestCounts.get(ip) || [];

    // Remove old requests outside the window
    const recentRequests = userRequests.filter(time => now - time < RATE_WINDOW);

    if (recentRequests.length >= RATE_LIMIT) {
        return false;
    }

    recentRequests.push(now);
    requestCounts.set(ip, recentRequests);
    return true;
}

// Periodically clean up old rate limit entries to prevent memory leak
setInterval(() => {
    const now = Date.now();
    for (const [ip, requests] of requestCounts.entries()) {
        const recentRequests = requests.filter(time => now - time < RATE_WINDOW);
        if (recentRequests.length === 0) {
            requestCounts.delete(ip);
        } else {
            requestCounts.set(ip, recentRequests);
        }
    }
}, CLEANUP_INTERVAL);

// Input validation
function validateTranslationInput(text, targetLang) {
    if (!text || typeof text !== 'string') {
        return { valid: false, error: 'Text is required' };
    }
    
    if (text.length > 5000) {
        return { valid: false, error: 'Text is too long (max 5000 characters)' };
    }
    
    if (!targetLang || typeof targetLang !== 'string') {
        return { valid: false, error: 'Target language is required' };
    }
    
    return { valid: true };
}

// Translation endpoint
app.post('/translate', async (req, res) => {
    try {
        const clientIp = req.ip || req.connection.remoteAddress;
        
        // Check rate limit
        if (!checkRateLimit(clientIp)) {
            return res.status(429).json({ 
                error: 'Too many requests. Please try again later.' 
            });
        }
        
        const { text, sourceLang, targetLang, formality } = req.body;

        // Validate input
        const validation = validateTranslationInput(text, targetLang);
        if (!validation.valid) {
            return res.status(400).json({ error: validation.error });
        }

        // Check API key
        if (!process.env.OPENAI_API_KEY) {
            console.error('OpenAI API key not configured');
            return res.status(500).json({
                error: 'Translation service is not configured properly'
            });
        }

        // Build formality instruction
        let formalityInstruction = '';
        if (formality === 'formal') {
            formalityInstruction = ' Use formal, polite, and professional language appropriate for business or official contexts.';
        } else if (formality === 'informal') {
            formalityInstruction = ' Use casual, friendly, and conversational language as you would with friends.';
        }

        const systemPrompt = sourceLang
            ? `You are a professional translator. Translate the following text from ${sourceLang} to ${targetLang}.${formalityInstruction} Provide ONLY the translation, with no additional explanations, quotes, or formatting.`
            : `You are a professional translator. Translate the following text to ${targetLang}.${formalityInstruction} Provide ONLY the translation, with no additional explanations, quotes, or formatting.`;
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: systemPrompt
                    },
                    {
                        role: "user",
                        content: text
                    }
                ],
                temperature: 0.3,
                max_tokens: 2000
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            const errorMessage = data.error?.message || 'Translation failed';
            console.error('OpenAI API error:', errorMessage);
            
            if (response.status === 401) {
                return res.status(500).json({ 
                    error: 'Translation service authentication failed' 
                });
            } else if (response.status === 429) {
                return res.status(429).json({ 
                    error: 'Translation service is busy. Please try again in a moment.' 
                });
            }
            
            return res.status(500).json({ error: errorMessage });
        }

        const translation = data.choices[0].message.content.trim();
        res.json({ translation });
        
    } catch (error) {
        console.error('Translation error:', error);
        res.status(500).json({ 
            error: 'An unexpected error occurred. Please try again.' 
        });
    }
});

// Language detection endpoint
app.post('/detect', async (req, res) => {
    try {
        const clientIp = req.ip || req.connection.remoteAddress;
        
        // Check rate limit
        if (!checkRateLimit(clientIp)) {
            return res.status(429).json({ 
                error: 'Too many requests. Please try again later.' 
            });
        }
        
        const { text } = req.body;
        
        // Validate input
        if (!text || typeof text !== 'string') {
            return res.status(400).json({ error: 'Text is required' });
        }
        
        if (text.length > 1000) {
            return res.status(400).json({ 
                error: 'Text is too long for detection (max 1000 characters)' 
            });
        }
        
        // Check API key
        if (!process.env.OPENAI_API_KEY) {
            console.error('OpenAI API key not configured');
            return res.status(500).json({ 
                error: 'Language detection service is not configured properly' 
            });
        }
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: "You are a language detection expert. Analyze the text and respond with ONLY the two-letter ISO 639-1 language code. Supported codes: en (English), es (Spanish), fr (French), de (German), it (Italian), pt (Portuguese), ru (Russian), zh (Chinese), ja (Japanese), ko (Korean), ar (Arabic), hi (Hindi), nl (Dutch), pl (Polish), tr (Turkish), vi (Vietnamese), th (Thai), sv (Swedish), el (Greek), he (Hebrew). Return only the code, nothing else."
                    },
                    {
                        role: "user",
                        content: text
                    }
                ],
                temperature: 0.1,
                max_tokens: 10
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            const errorMessage = data.error?.message || 'Language detection failed';
            console.error('OpenAI API error:', errorMessage);
            return res.status(500).json({ error: errorMessage });
        }

        const detectedLanguage = data.choices[0].message.content.trim().toLowerCase();
        res.json({ detectedLanguage });
        
    } catch (error) {
        console.error('Language detection error:', error);
        res.status(500).json({ 
            error: 'An unexpected error occurred during language detection.' 
        });
    }
});

// Pronunciation guide endpoint
app.post('/pronunciation', async (req, res) => {
    try {
        const clientIp = req.ip || req.connection.remoteAddress;

        if (!checkRateLimit(clientIp)) {
            return res.status(429).json({
                error: 'Too many requests. Please try again later.'
            });
        }

        const { text, targetLang } = req.body;

        if (!text || text.length > 500) {
            return res.status(400).json({
                error: 'Text must be under 500 characters'
            });
        }

        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({
                error: 'Service not configured'
            });
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: `Provide a phonetic pronunciation guide for the ${targetLang} text. Use simple English phonetics that an English speaker can read aloud. Return ONLY the phonetic spelling, nothing else. For example: "Bonjour" -> "bohn-ZHOOR"`
                    },
                    { role: "user", content: text }
                ],
                temperature: 0.3,
                max_tokens: 300
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(500).json({
                error: data.error?.message || 'Failed to get pronunciation'
            });
        }

        const phonetic = data.choices[0].message.content.trim();
        res.json({ phonetic });

    } catch (error) {
        console.error('Pronunciation error:', error);
        res.status(500).json({ error: 'Failed to get pronunciation guide' });
    }
});

// Alternative translations endpoint (for short phrases)
app.post('/api/alternatives', async (req, res) => {
    try {
        const clientIp = req.ip || req.connection.remoteAddress;

        if (!checkRateLimit(clientIp)) {
            return res.status(429).json({
                error: 'Too many requests. Please try again later.'
            });
        }

        const { text, sourceLang, targetLang } = req.body;

        if (!text || text.length > 200) {
            return res.status(400).json({
                error: 'Text must be under 200 characters for alternatives'
            });
        }

        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({
                error: 'Translation service is not configured properly'
            });
        }

        const sourceInfo = sourceLang ? `from ${sourceLang} ` : '';
        const prompt = `Translate the following text ${sourceInfo}to ${targetLang}. Provide exactly 3 alternative translations that convey the same meaning but with different wording or formality levels. Return ONLY a JSON array with 3 strings, no explanation. Example format: ["translation 1", "translation 2", "translation 3"]`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: prompt },
                    { role: "user", content: text }
                ],
                temperature: 0.7,
                max_tokens: 500
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(500).json({
                error: data.error?.message || 'Failed to get alternatives'
            });
        }

        try {
            const content = data.choices[0].message.content.trim();
            const alternatives = JSON.parse(content);
            res.json({ alternatives });
        } catch {
            res.json({ alternatives: [] });
        }

    } catch (error) {
        console.error('Alternatives error:', error);
        res.status(500).json({ error: 'Failed to get alternative translations' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        hasApiKey: !!process.env.OPENAI_API_KEY
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ 
        error: 'An unexpected error occurred' 
    });
});

// Start server (only in development)
if (process.env.NODE_ENV !== 'production') {
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
        console.log(`🦜 PollyGlot server running at http://localhost:${port}`);
        console.log(`📡 API Key configured: ${process.env.OPENAI_API_KEY ? 'Yes' : 'No'}`);
        if (!process.env.OPENAI_API_KEY) {
            console.warn('⚠️  Warning: OPENAI_API_KEY not found in environment variables');
        }
    });
}

// Export for Vercel
module.exports = app; 