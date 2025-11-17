const {Configuration, OpenAIApi} = require('openai');
const axios = require('axios');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());
app.use(cors());

// Simple request logger
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

const config = new Configuration({
    apiKey: process.env.API_TOKEN
});

const openai = new OpenAIApi(config);

app.get('/', (req, res) => {
    res.send('Welcome to the Coding Nexus API')
})

// Handle CORS preflight explicitly for /message
app.options('/message', cors());

app.post('/message', async (req, res) => {
    const userMessage = req.body.message;

    // Mock mode for local testing without OpenAI quota
    if (process.env.MOCK_MODE === '1' || process.env.MOCK_MODE === 'true') {
        return res.json({ message: `MOCK: ${userMessage}` });
    }

    try {
        // Hugging Face Inference API path
        if (process.env.USE_HF === '1' || process.env.USE_HF === 'true') {
            const preferred = process.env.HF_MODEL || 'Qwen/Qwen2.5-1.5B-Instruct';
            const candidates = [
                'mistralai/Mistral-7B-Instruct-v0.2',
                'Qwen/Qwen2.5-1.5B-Instruct',
                'google/gemma-2-2b-it',
                preferred,
                'TinyLlama/TinyLlama-1.1B-Chat-v1.0',
                'google/flan-t5-small',
                'google/flan-t5-base'
            ];
            const hfToken = process.env.HUGGINGFACE_TOKEN || '';
            let lastErr;
            for (const model of candidates) {
                try {
                    const url = `https://router.huggingface.co/v1/chat/completions`;
                    let resp;
                    for (let attempt = 0; attempt < 2; attempt++) {
                        try {
                            resp = await axios.post(
                                url,
                                {
                                    model,
                                    messages: [
                                        { role: 'system', content: 'You are a helpful assistant.' },
                                        { role: 'user', content: userMessage }
                                    ],
                                    max_tokens: 256,
                                    temperature: 0
                                },
                                {
                                    headers: {
                                        Authorization: hfToken ? `Bearer ${hfToken}` : undefined,
                                        'Content-Type': 'application/json',
                                        'Accept': 'application/json'
                                    },
                                    timeout: 30000
                                }
                            );
                            break;
                        } catch (er) {
                            const st = er?.response?.status;
                            if (st === 503 || st === 524 || st === 504 || st === 408) {
                                await new Promise(r => setTimeout(r, 1200));
                                if (attempt === 1) throw er;
                                continue;
                            }
                            throw er;
                        }
                    }
                    let text = '';
                    const data = resp.data;
                    if (Array.isArray(data?.choices) && data.choices.length > 0) {
                        text = data.choices[0]?.message?.content || data.choices[0]?.text || '';
                    }
                    if (!text) text = 'No response from Hugging Face model.';
                    return res.json({ message: text });
                } catch (e) {
                    const status = e?.response?.status;
                    console.error('HF chat error', status, e?.response?.data || e?.message);
                    if (status === 410 || status === 503 || status === 404) { lastErr = e; continue; }
                    if (status === 400) { lastErr = e; continue; }
                    throw e;
                }
            }
            if (lastErr) {
                const fallbackText = `Je suis opérationnel mais le modèle distant est momentanément indisponible. Voici une réponse locale basée sur votre message:\n\n> ${userMessage}\n\nRéponse: Merci pour votre message. Pouvez-vous préciser votre question ou le résultat attendu ?`;
                return res.status(200).json({ message: fallbackText });
            }
        }

        // Default: OpenAI Chat Completions
        const response = await openai.createChatCompletion({
            model: 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: 'You are a helpful assistant.' },
                { role: 'user', content: userMessage }
            ],
            temperature: 0,
            max_tokens: 256
        });

        const message = { message: response.data.choices[0].message.content };
        res.json(message);
    } catch (err) {
        console.error('OpenAI/HF final error', err?.response?.status, err?.response?.data || err?.message);
        const status = err?.response?.status || 500;
        const payload = err?.response?.data || { error: err?.message || 'Unknown error' };

        if (status === 429 || payload?.error?.code === 'insufficient_quota') {
            return res.status(200).json({
                message: 'Votre quota OpenAI est dépassé. Configurez une clé valide avec du crédit dans api/.env (API_TOKEN) ou activez MOCK_MODE=1 pour tester sans OpenAI.'
            });
        }

        res.status(status).json(payload);
    }
});

app.listen(3000, () => console.log('Listening on port 3000'));