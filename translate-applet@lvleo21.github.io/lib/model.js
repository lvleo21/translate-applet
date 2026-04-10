'use strict';

const Soup = imports.gi.Soup;

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.1-8b-instant';

const DIRECTIONS = {
    EN_TO_PTBR: {
        source: 'English',
        target: 'Brazilian Portuguese',
        label: 'EN → PT-BR'
    },
    PTBR_TO_EN: {
        source: 'Brazilian Portuguese',
        target: 'English',
        label: 'PT-BR → EN'
    }
};

var TranslationModel = class TranslationModel {
    constructor(apiKey, groqModel) {
        this._direction = 'EN_TO_PTBR';
        this._session = new Soup.Session();
        this.updateSettings(apiKey, groqModel);
    }

    get directionLabel() {
        return DIRECTIONS[this._direction].label;
    }

    get directionSource() {
        return DIRECTIONS[this._direction].source;
    }

    get directionTarget() {
        return DIRECTIONS[this._direction].target;
    }

    toggleDirection() {
        this._direction = this._direction === 'EN_TO_PTBR' ? 'PTBR_TO_EN' : 'EN_TO_PTBR';
    }

    updateSettings(apiKey, groqModel) {
        this._apiKey = apiKey;
        this._groqModel = groqModel || DEFAULT_MODEL;
    }

    translate(text, callback) {
        if (!this._apiKey) {
            callback(new Error('API key not configured. Open applet settings to set your Groq API key.'), null);
            return;
        }

        const lang = DIRECTIONS[this._direction];
        const body = JSON.stringify({
            model: this._groqModel,
            messages: [{ role: 'user', content: this._buildPrompt(lang, text) }],
            temperature: 0.1
        });

        const message = Soup.Message.new('POST', GROQ_API_URL);
        message.request_headers.append('Content-Type', 'application/json');
        message.request_headers.append('Authorization', `Bearer ${this._apiKey}`);
        message.request_body.append(body);

        this._session.queue_message(message, (_session, response) => {
            this._handleResponse(response, callback);
        });
    }

    _buildPrompt(lang, text) {
        return `Translate the following text from ${lang.source} to ${lang.target}. ` +
               `Return only the translated text and nothing else; ` +
               `if translation is not possible, respond with "The text could not be translated.":\n\n${text}`;
    }

    _handleResponse(response, callback) {
        try {
            const data = JSON.parse(response.response_body.data);
            if (response.status_code === 200) {
                callback(null, data.choices[0].message.content.trim());
            } else {
                const msg = (data.error && data.error.message) || `API error: HTTP ${response.status_code}`;
                callback(new Error(msg), null);
            }
        } catch (e) {
            callback(new Error(`Failed to parse response: ${e.message}`), null);
        }
    }
};
