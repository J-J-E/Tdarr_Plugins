"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findTextBox = exports.buildEndpointUrl = exports.tallyVotes = exports.parseModelAnswer = exports.toIso6392 = exports.plugin = exports.details = void 0;
var child_process_1 = require("child_process");
var crypto_1 = __importDefault(require("crypto"));
var fs_1 = __importDefault(require("fs"));
var os_1 = __importDefault(require("os"));
var path_1 = __importDefault(require("path"));
var flowUtils_1 = require("../../../../FlowHelpers/1.0.0/interfaces/flowUtils");
/* eslint no-plusplus: ["error", { "allowForLoopAfterthoughts": true }] */
var showWhen = function (name) { return ({
    logic: 'AND',
    sets: [{
            logic: 'AND',
            inputs: [{ name: name, value: 'true', condition: '===' }],
        }],
}); };
var showWhenOpenAiAudio = {
    logic: 'AND',
    sets: [{
            logic: 'AND',
            inputs: [
                { name: 'labelAudio', value: 'true', condition: '===' },
                { name: 'audioApiStyle', value: 'openai', condition: '===' },
            ],
        }],
};
var showWhenSubtitles = {
    logic: 'OR',
    sets: [
        {
            logic: 'AND',
            inputs: [{ name: 'labelPictureSubtitles', value: 'true', condition: '===' }],
        },
        {
            logic: 'AND',
            inputs: [{ name: 'labelTextSubtitles', value: 'true', condition: '===' }],
        },
    ],
};
var details = function () { return ({
    name: 'Label Languages',
    description: 'Find the language of audio and subtitle streams that have no language tag (missing, empty or und) '
        + 'and label them. Audio is sampled and sent to a speech-to-text API '
        + '(OpenAI compatible or whisper-asr-webservice), '
        + 'subtitles are sent to an OpenAI compatible chat completions API (a vision model for picture subtitles). '
        + 'The endpoints can be cloud, free or local services. A stream stays und when the answers do not agree '
        + 'or a service is unreachable, the file never fails because of a service. '
        + 'Use it before plugins that remove streams by language so old untagged rips can be trimmed. '
        + 'The tags are written by the '
        + 'Execute plugin, together with the other FFmpeg command changes.',
    style: {
        borderColor: '#6efefc',
    },
    tags: 'audio,subtitle,language',
    isStartPlugin: false,
    pType: '',
    requiresVersion: '2.11.01',
    sidebarPosition: -1,
    icon: 'faLanguage',
    inputs: [
        {
            label: 'Label Audio',
            name: 'labelAudio',
            type: 'boolean',
            defaultValue: 'true',
            inputUI: {
                type: 'switch',
            },
            tooltip: 'Find the language of untagged audio streams with a speech-to-text API.',
        },
        {
            label: 'Audio API Style',
            name: 'audioApiStyle',
            type: 'string',
            defaultValue: 'openai',
            inputUI: {
                type: 'dropdown',
                options: [
                    'openai',
                    'whisperAsrWebservice',
                ],
                displayConditions: showWhen('labelAudio'),
            },
            tooltip: "\n      openai: an OpenAI compatible POST /v1/audio/transcriptions endpoint\n      (OpenAI, Groq, speaches, faster-whisper-server...). verbose_json is requested to get the language.\n\n      whisperAsrWebservice: the POST /detect-language endpoint of whisper-asr-webservice,\n      which also returns a confidence.\n      ",
        },
        {
            label: 'Audio API URL',
            name: 'audioApiUrl',
            type: 'string',
            defaultValue: '',
            inputUI: {
                type: 'text',
                displayConditions: showWhen('labelAudio'),
            },
            tooltip: "\n      Base URL of the speech-to-text service. The endpoint path is added when missing,\n      a full endpoint URL is also accepted. Leave empty to skip audio.\n\n      Example:\n      https://api.openai.com\n      https://api.groq.com/openai/v1\n      http://192.168.1.10:8000\n      http://192.168.1.10:9000 (whisper-asr-webservice)\n      ",
        },
        {
            label: 'Audio Model',
            name: 'audioModel',
            type: 'string',
            defaultValue: 'whisper-1',
            inputUI: {
                type: 'text',
                displayConditions: showWhenOpenAiAudio,
            },
            tooltip: "\n      Model name sent to the OpenAI compatible endpoint.\n\n      Example:\n      whisper-1\n      whisper-large-v3-turbo\n      Systran/faster-whisper-small\n      ",
        },
        {
            label: 'Audio API Key',
            name: 'audioApiKey',
            type: 'string',
            defaultValue: '',
            inputUI: {
                type: 'text',
                displayConditions: showWhen('labelAudio'),
            },
            tooltip: "\n      Optional. Sent as a Bearer token. A flow variable can be used to avoid typing the key here.\n\n      Example:\n      {{{args.userVariables.global.openaiApiKey}}}\n      ",
        },
        {
            label: 'Audio Sample Count',
            name: 'audioSampleCount',
            type: 'number',
            defaultValue: '4',
            inputUI: {
                type: 'text',
                displayConditions: showWhen('labelAudio'),
            },
            tooltip: 'Number of audio clips cut per stream, spread across the runtime. Each clip gets one vote.',
        },
        {
            label: 'Audio Sample Seconds',
            name: 'audioSampleSeconds',
            type: 'number',
            defaultValue: '30',
            inputUI: {
                type: 'text',
                displayConditions: showWhen('labelAudio'),
            },
            tooltip: 'Length of each audio clip in seconds. Clips are sent as mono 16 kHz WAV.',
        },
        {
            label: 'Audio Minimum Confidence',
            name: 'audioMinConfidence',
            type: 'number',
            defaultValue: '0.5',
            inputUI: {
                type: 'text',
                displayConditions: showWhen('labelAudio'),
            },
            tooltip: "\n      Between 0 and 1. A clip whose reported confidence is below this does not vote.\n      Only used when the API returns a confidence (whisper-asr-webservice does, and some OpenAI compatible\n      servers return language_probability; OpenAI itself does not).\n      ",
        },
        {
            label: 'Label Picture Subtitles',
            name: 'labelPictureSubtitles',
            type: 'boolean',
            defaultValue: 'true',
            inputUI: {
                type: 'switch',
            },
            tooltip: "\n      Find the language of untagged PGS, VobSub and DVB subtitles. Subtitle frames are rendered,\n      cropped to the text and sent to a vision model. This is the slowest part (one model call per frame).\n      ",
        },
        {
            label: 'Label Text Subtitles',
            name: 'labelTextSubtitles',
            type: 'boolean',
            defaultValue: 'true',
            inputUI: {
                type: 'switch',
            },
            tooltip: 'Find the language of untagged SRT, ASS/SSA, WebVTT and mov_text subtitles by sending sample lines '
                + 'to the chat model.',
        },
        {
            label: 'Chat API URL',
            name: 'chatApiUrl',
            type: 'string',
            defaultValue: '',
            inputUI: {
                type: 'text',
                displayConditions: showWhenSubtitles,
            },
            tooltip: "\n      Base URL of an OpenAI compatible chat completions service (POST /v1/chat/completions).\n      The endpoint path is added when missing, a full endpoint URL is also accepted.\n      Picture subtitles need a model that accepts images. Leave empty to skip subtitles.\n\n      Example:\n      https://api.openai.com\n      http://192.168.1.10:8080 (llama.cpp server)\n      http://192.168.1.10:11434 (Ollama)\n      ",
        },
        {
            label: 'Chat Model',
            name: 'chatModel',
            type: 'string',
            defaultValue: '',
            inputUI: {
                type: 'text',
                displayConditions: showWhenSubtitles,
            },
            tooltip: "\n      Model name sent to the chat endpoint. Can be left empty for servers that serve a single model\n      (llama.cpp).\n\n      Example:\n      gpt-4o-mini\n      qwen2.5vl:3b\n      ",
        },
        {
            label: 'Chat API Key',
            name: 'chatApiKey',
            type: 'string',
            defaultValue: '',
            inputUI: {
                type: 'text',
                displayConditions: showWhenSubtitles,
            },
            tooltip: "\n      Optional. Sent as a Bearer token. A flow variable can be used to avoid typing the key here.\n\n      Example:\n      {{{args.userVariables.global.openaiApiKey}}}\n      ",
        },
        {
            label: 'Subtitle Sample Count',
            name: 'subtitleSampleCount',
            type: 'number',
            defaultValue: '5',
            inputUI: {
                type: 'text',
                displayConditions: showWhenSubtitles,
            },
            tooltip: 'Number of frames (picture subtitles) or groups of lines (text subtitles) checked per stream. '
                + 'Each sample gets one vote.',
        },
        {
            label: 'Subtitle Image Max Width',
            name: 'subtitleImageMaxWidth',
            type: 'number',
            defaultValue: '768',
            inputUI: {
                type: 'text',
                displayConditions: showWhen('labelPictureSubtitles'),
            },
            tooltip: 'The cropped subtitle image is downscaled to this width at most before it is sent. '
                + 'Smaller images are much faster on local vision models.',
        },
        {
            label: 'Minimum Agreeing Samples',
            name: 'minAgreement',
            type: 'number',
            defaultValue: '2',
            inputUI: {
                type: 'text',
            },
            tooltip: "\n      A language is only written when at least this many samples agree on it (capped at the sample count)\n      and it has more than half of the answered samples. Otherwise the stream stays und.\n      ",
        },
        {
            label: 'Request Timeout Seconds',
            name: 'requestTimeoutSeconds',
            type: 'number',
            defaultValue: '120',
            inputUI: {
                type: 'text',
            },
            tooltip: 'Timeout of each API request. A service that times out is treated as unreachable '
                + 'for the rest of the file.',
        },
        {
            label: 'FFprobe Path',
            name: 'ffprobePath',
            type: 'string',
            defaultValue: '',
            inputUI: {
                type: 'text',
                displayConditions: showWhen('labelPictureSubtitles'),
            },
            tooltip: 'Optional. FFprobe is used to find subtitle packets. When empty, the ffprobe next to the '
                + 'node\'s FFmpeg is used, or ffprobe from the PATH.',
        },
    ],
    outputs: [
        {
            number: 1,
            tooltip: 'Labelled at least one stream',
        },
        {
            number: 2,
            tooltip: 'Nothing to label, or no language could be found',
        },
    ],
}); };
exports.details = details;
// [iso639-2/B, iso639-2/T, iso639-1, English names separated by |]
var languageRows = [
    ['afr', 'afr', 'af', 'Afrikaans'], ['alb', 'sqi', 'sq', 'Albanian'], ['amh', 'amh', 'am', 'Amharic'],
    ['ara', 'ara', 'ar', 'Arabic'], ['arm', 'hye', 'hy', 'Armenian'], ['asm', 'asm', 'as', 'Assamese'],
    ['aze', 'aze', 'az', 'Azerbaijani'], ['bak', 'bak', 'ba', 'Bashkir'], ['baq', 'eus', 'eu', 'Basque'],
    ['bel', 'bel', 'be', 'Belarusian'], ['ben', 'ben', 'bn', 'Bengali'], ['bos', 'bos', 'bs', 'Bosnian'],
    ['bre', 'bre', 'br', 'Breton'], ['bul', 'bul', 'bg', 'Bulgarian'], ['bur', 'mya', 'my', 'Burmese'],
    ['cat', 'cat', 'ca', 'Catalan'], ['chi', 'zho', 'zh', 'Chinese|Mandarin'], ['cze', 'ces', 'cs', 'Czech'],
    ['dan', 'dan', 'da', 'Danish'], ['dut', 'nld', 'nl', 'Dutch|Flemish'], ['eng', 'eng', 'en', 'English'],
    ['est', 'est', 'et', 'Estonian'], ['fao', 'fao', 'fo', 'Faroese'], ['fil', 'fil', '', 'Filipino'],
    ['fin', 'fin', 'fi', 'Finnish'], ['fre', 'fra', 'fr', 'French'], ['geo', 'kat', 'ka', 'Georgian'],
    ['ger', 'deu', 'de', 'German'], ['gle', 'gle', 'ga', 'Irish'], ['glg', 'glg', 'gl', 'Galician'],
    ['gre', 'ell', 'el', 'Greek'], ['guj', 'guj', 'gu', 'Gujarati'], ['hat', 'hat', 'ht', 'Haitian Creole|Haitian'],
    ['hau', 'hau', 'ha', 'Hausa'], ['haw', 'haw', '', 'Hawaiian'], ['heb', 'heb', 'he', 'Hebrew'],
    ['hin', 'hin', 'hi', 'Hindi'], ['hrv', 'hrv', 'hr', 'Croatian'], ['hun', 'hun', 'hu', 'Hungarian'],
    ['ice', 'isl', 'is', 'Icelandic'], ['ind', 'ind', 'id', 'Indonesian'], ['ita', 'ita', 'it', 'Italian'],
    ['jav', 'jav', 'jv', 'Javanese'], ['jpn', 'jpn', 'ja', 'Japanese'], ['kan', 'kan', 'kn', 'Kannada'],
    ['kaz', 'kaz', 'kk', 'Kazakh'], ['khm', 'khm', 'km', 'Khmer'], ['kor', 'kor', 'ko', 'Korean'],
    ['lao', 'lao', 'lo', 'Lao'], ['lat', 'lat', 'la', 'Latin'], ['lav', 'lav', 'lv', 'Latvian'],
    ['lin', 'lin', 'ln', 'Lingala'], ['lit', 'lit', 'lt', 'Lithuanian'], ['ltz', 'ltz', 'lb', 'Luxembourgish'],
    ['mac', 'mkd', 'mk', 'Macedonian'], ['mal', 'mal', 'ml', 'Malayalam'], ['mao', 'mri', 'mi', 'Maori'],
    ['mar', 'mar', 'mr', 'Marathi'], ['may', 'msa', 'ms', 'Malay'], ['mlg', 'mlg', 'mg', 'Malagasy'],
    ['mlt', 'mlt', 'mt', 'Maltese'], ['mon', 'mon', 'mn', 'Mongolian'], ['nep', 'nep', 'ne', 'Nepali'],
    ['nor', 'nor', 'no', 'Norwegian|Norwegian Bokmal|Norwegian Nynorsk|Nynorsk'], ['oci', 'oci', 'oc', 'Occitan'],
    ['pan', 'pan', 'pa', 'Punjabi'], ['per', 'fas', 'fa', 'Persian'], ['pol', 'pol', 'pl', 'Polish'],
    ['por', 'por', 'pt', 'Portuguese'], ['pus', 'pus', 'ps', 'Pashto'], ['rum', 'ron', 'ro', 'Romanian'],
    ['roh', 'roh', 'rm', 'Romansh'], ['rus', 'rus', 'ru', 'Russian'], ['san', 'san', 'sa', 'Sanskrit'],
    ['sin', 'sin', 'si', 'Sinhala'], ['slo', 'slk', 'sk', 'Slovak'], ['slv', 'slv', 'sl', 'Slovenian'],
    ['sna', 'sna', 'sn', 'Shona'], ['snd', 'snd', 'sd', 'Sindhi'], ['som', 'som', 'so', 'Somali'],
    ['spa', 'spa', 'es', 'Spanish|Castilian'], ['srp', 'srp', 'sr', 'Serbian'], ['sun', 'sun', 'su', 'Sundanese'],
    ['swa', 'swa', 'sw', 'Swahili'], ['swe', 'swe', 'sv', 'Swedish'], ['tam', 'tam', 'ta', 'Tamil'],
    ['tat', 'tat', 'tt', 'Tatar'], ['tel', 'tel', 'te', 'Telugu'], ['tgk', 'tgk', 'tg', 'Tajik'],
    ['tgl', 'tgl', 'tl', 'Tagalog'], ['tha', 'tha', 'th', 'Thai'], ['tib', 'bod', 'bo', 'Tibetan'],
    ['tuk', 'tuk', 'tk', 'Turkmen'], ['tur', 'tur', 'tr', 'Turkish'], ['ukr', 'ukr', 'uk', 'Ukrainian'],
    ['urd', 'urd', 'ur', 'Urdu'], ['uzb', 'uzb', 'uz', 'Uzbek'], ['vie', 'vie', 'vi', 'Vietnamese'],
    ['wel', 'cym', 'cy', 'Welsh'], ['yid', 'yid', 'yi', 'Yiddish'], ['yor', 'yor', 'yo', 'Yoruba'],
    ['yue', 'yue', '', 'Cantonese'],
];
// extra codes seen in the wild (whisper uses "jw" for Javanese)
var languageExtras = {
    nob: 'nor',
    nno: 'nor',
    nb: 'nor',
    nn: 'nor',
    iw: 'heb',
    ji: 'yid',
    jw: 'jav',
};
var languageLookup = {};
languageRows.forEach(function (row) {
    var b = row[0], t = row[1], a2 = row[2], names = row[3];
    languageLookup[b] = b;
    languageLookup[t] = b;
    if (a2) {
        languageLookup[a2] = b;
    }
    names.split('|').forEach(function (name) {
        languageLookup[name.toLowerCase()] = b;
    });
});
Object.keys(languageExtras).forEach(function (key) {
    languageLookup[key] = languageExtras[key];
});
/**
 * Convert an ISO 639-1, 639-2/B, 639-2/T code or an English language name
 * (e.g. "Portuguese (Brazil)", "en-US") to the ISO 639-2/B code. Returns '' if unknown.
 */
var toIso6392 = function (value) {
    var raw = String(value === undefined || value === null ? '' : value).trim().toLowerCase();
    if (!raw) {
        return '';
    }
    var stripped = raw.replace(/\s*\(.*\)\s*$/, '').trim();
    return languageLookup[raw] || languageLookup[stripped] || languageLookup[stripped.split(/[-_]/)[0]] || '';
};
exports.toIso6392 = toIso6392;
// 3 letter language codes that are also common English words, ignored inside a sentence
var ambiguousWords = ['and', 'are', 'bel', 'can', 'est', 'fil', 'hat', 'ice', 'kan', 'lat', 'mal', 'mar',
    'may', 'pan', 'per', 'san', 'som', 'sun', 'tam', 'tat', 'the', 'tur'];
/**
 * Read the language out of a model answer. A one word answer may be any code or name.
 * In a longer answer only English names and unambiguous 3 letter codes count, and the answer
 * must name exactly one language. Returns '' when unknown or unsure.
 */
var parseModelAnswer = function (answer) {
    var text = String(answer || '').replace(/<think>[\s\S]*?<\/think>/gi, '').toLowerCase();
    var tokens = text.match(/[a-z]+/g) || [];
    if (tokens.length === 0 || tokens.includes('und')) {
        return '';
    }
    if (tokens.length === 1) {
        return toIso6392(tokens[0]);
    }
    var found = [];
    tokens.forEach(function (token, i) {
        var code = '';
        if (token.length > 3) {
            // two word names such as "haitian creole"
            code = toIso6392("".concat(token, " ").concat(tokens[i + 1] || '')) || toIso6392(token);
        }
        else if (token.length === 3 && !ambiguousWords.includes(token)) {
            code = toIso6392(token);
        }
        if (code && !found.includes(code)) {
            found.push(code);
        }
    });
    return found.length === 1 ? found[0] : '';
};
exports.parseModelAnswer = parseModelAnswer;
/**
 * The winner needs more than half of the answered votes and at least minAgreement votes
 * (capped at the number of samples taken). Ties never win.
 */
var tallyVotes = function (votes, minAgreement, sampleCount) {
    var counts = {};
    votes.filter(function (vote) { return vote; }).forEach(function (vote) {
        counts[vote] = (counts[vote] || 0) + 1;
    });
    var total = Object.keys(counts).reduce(function (sum, key) { return sum + counts[key]; }, 0);
    var best = '';
    var bestVotes = 0;
    var tie = false;
    Object.keys(counts).forEach(function (key) {
        if (counts[key] > bestVotes) {
            best = key;
            bestVotes = counts[key];
            tie = false;
        }
        else if (counts[key] === bestVotes) {
            tie = true;
        }
    });
    var needed = Math.max(1, Math.min(minAgreement, sampleCount));
    var lang = best && !tie && bestVotes >= needed && bestVotes * 2 > total ? best : '';
    return {
        lang: lang,
        votes: bestVotes,
        total: total,
        counts: counts,
    };
};
exports.tallyVotes = tallyVotes;
/** Positions (seconds) of n windows of length len spread evenly across the runtime. */
var spreadPositions = function (duration, n, len) {
    var positions = [];
    for (var i = 0; i < n; i++) {
        var pos = (duration * (i + 1)) / (n + 1) - len / 2;
        positions.push(Math.max(0, Math.round(pos * 100) / 100));
    }
    return positions;
};
/** Add the endpoint path to a base URL unless the URL already ends with it. */
var buildEndpointUrl = function (baseUrl, endpointPath) {
    var base = baseUrl.trim().replace(/\/+$/, '');
    var withoutV1 = endpointPath.replace(/^\/v1/, '');
    if (base.endsWith(withoutV1)) {
        return base;
    }
    if (/\/v1$/.test(base) && endpointPath.startsWith('/v1/')) {
        return "".concat(base).concat(withoutV1);
    }
    return "".concat(base).concat(endpointPath);
};
exports.buildEndpointUrl = buildEndpointUrl;
/** Error from an API call. down is true when the service should not be called again for this file. */
var ApiError = /** @class */ (function (_super) {
    __extends(ApiError, _super);
    function ApiError(message, down) {
        var _this = _super.call(this, message) || this;
        _this.down = down;
        Object.setPrototypeOf(_this, ApiError.prototype);
        return _this;
    }
    return ApiError;
}(Error));
var downStatuses = [401, 403, 404, 405, 408, 429];
var toApiError = function (err, name) {
    var _a;
    var e = err;
    var status = (_a = e === null || e === void 0 ? void 0 : e.response) === null || _a === void 0 ? void 0 : _a.status;
    if (!status) {
        return new ApiError("".concat(name, " unreachable: ").concat((e === null || e === void 0 ? void 0 : e.code) || '', " ").concat((e === null || e === void 0 ? void 0 : e.message) || '').trim(), true);
    }
    return new ApiError("".concat(name, " returned HTTP ").concat(status), status >= 500 || downStatuses.includes(status));
};
var authHeaders = function (apiKey) { return (apiKey ? { Authorization: "Bearer ".concat(apiKey) } : {}); };
/** multipart/form-data body built by hand so it works with any axios version. */
var buildMultipart = function (fields, file) {
    var boundary = "----TdarrLabelLanguages".concat(crypto_1.default.randomBytes(12).toString('hex'));
    var parts = [];
    Object.keys(fields).forEach(function (key) {
        parts.push(Buffer.from("--".concat(boundary, "\r\nContent-Disposition: form-data; name=\"").concat(key, "\"\r\n\r\n")
            + "".concat(fields[key], "\r\n")));
    });
    parts.push(Buffer.from("--".concat(boundary, "\r\nContent-Disposition: form-data; name=\"").concat(file.field, "\"; ")
        + "filename=\"".concat(file.name, "\"\r\nContent-Type: ").concat(file.type, "\r\n\r\n")));
    parts.push(file.data);
    parts.push(Buffer.from("\r\n--".concat(boundary, "--\r\n")));
    return { body: Buffer.concat(parts), contentType: "multipart/form-data; boundary=".concat(boundary) };
};
var commandTimeoutMs = 300000;
/** Run a command and collect its output. Never throws, a failure gives a non zero code. */
var runCommand = function (cmd, cmdArgs, timeoutMs) {
    if (timeoutMs === void 0) { timeoutMs = commandTimeoutMs; }
    return (new Promise(function (resolve) {
        var _a, _b;
        var out = [];
        var err = '';
        var done = false;
        var timer;
        var finish = function (code) {
            if (done) {
                return;
            }
            done = true;
            if (timer) {
                clearTimeout(timer);
            }
            resolve({ code: code, stdout: Buffer.concat(out), stderr: err });
        };
        try {
            var child_1 = (0, child_process_1.spawn)(cmd, cmdArgs, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
            (_a = child_1.stdout) === null || _a === void 0 ? void 0 : _a.on('data', function (data) { return out.push(data); });
            (_b = child_1.stderr) === null || _b === void 0 ? void 0 : _b.on('data', function (data) {
                err = "".concat(err).concat(data.toString()).slice(-2000);
            });
            child_1.on('error', function (e) {
                err += String(e);
                finish(-1);
            });
            child_1.on('close', function (code) { return finish(code === null ? -1 : code); });
            timer = setTimeout(function () {
                child_1.kill('SIGKILL');
                err += "timed out after ".concat(timeoutMs / 1000, "s");
                finish(-2);
            }, timeoutMs);
        }
        catch (e) {
            err = String(e);
            finish(-1);
        }
    }));
};
var removeFile = function (filePath) {
    try {
        fs_1.default.unlinkSync(filePath);
    }
    catch (_a) {
        // already gone
    }
};
var fileSize = function (filePath) {
    try {
        return fs_1.default.statSync(filePath).size;
    }
    catch (_a) {
        return 0;
    }
};
var getTag = function (stream, name) {
    var _a;
    var tags = (stream.tags || {});
    var key = Object.keys(tags).find(function (k) { return k.toLowerCase() === name; });
    return key === undefined ? '' : String((_a = tags[key]) !== null && _a !== void 0 ? _a : '');
};
var unknownLanguageTags = ['', 'und', 'unk', 'unknown', 'undetermined'];
var pictureSubtitleCodecs = ['hdmv_pgs_subtitle', 'pgssub', 'dvd_subtitle', 'dvdsub', 'dvb_subtitle',
    'dvbsub', 'xsub'];
var textSubtitleCodecs = ['subrip', 'srt', 'ass', 'ssa', 'webvtt', 'mov_text', 'text', 'subviewer',
    'microdvd'];
var getFfprobePath = function (ffmpegPath, override) {
    if (override) {
        return override;
    }
    var dir = path_1.default.dirname(ffmpegPath);
    var base = path_1.default.basename(ffmpegPath);
    if (/ffmpeg/i.test(base)) {
        var candidate = path_1.default.join(dir, base.replace(/ffmpeg/i, 'ffprobe'));
        if (dir !== '.' && fs_1.default.existsSync(candidate)) {
            return candidate;
        }
    }
    return 'ffprobe';
};
var detectAudioLanguage = function (ctx, wav) { return __awaiter(void 0, void 0, void 0, function () {
    var cfg, args, whisperAsr, url, fields, multipart, data, res, err_1, apiError, raw, confidence;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                cfg = ctx.cfg, args = ctx.args;
                whisperAsr = cfg.audioApiStyle === 'whisperAsrWebservice';
                url = whisperAsr
                    ? "".concat(buildEndpointUrl(cfg.audioApiUrl, '/detect-language'), "?encode=true")
                    : buildEndpointUrl(cfg.audioApiUrl, '/v1/audio/transcriptions');
                fields = whisperAsr ? {} : {
                    model: cfg.audioModel,
                    response_format: 'verbose_json',
                };
                multipart = buildMultipart(fields, {
                    field: whisperAsr ? 'audio_file' : 'file', name: 'sample.wav', type: 'audio/wav', data: wav,
                });
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                return [4 /*yield*/, args.deps.axios({
                        method: 'post',
                        url: url,
                        data: multipart.body,
                        headers: __assign({ 'Content-Type': multipart.contentType, Accept: 'application/json' }, authHeaders(cfg.audioApiKey)),
                        timeout: cfg.requestTimeoutMs,
                        maxBodyLength: Infinity,
                        maxContentLength: Infinity,
                    })];
            case 2:
                res = _a.sent();
                data = ((res === null || res === void 0 ? void 0 : res.data) || {});
                return [3 /*break*/, 4];
            case 3:
                err_1 = _a.sent();
                apiError = toApiError(err_1, 'Audio API');
                if (apiError.down) {
                    throw apiError;
                }
                // a rejected sample (e.g. HTTP 400) only loses its vote
                return [2 /*return*/, { lang: '', raw: apiError.message, confidence: null }];
            case 4:
                raw = String(data.language_code || data.detected_language || data.language || '');
                confidence = null;
                if (typeof data.confidence === 'number') {
                    confidence = data.confidence;
                }
                else if (typeof data.language_probability === 'number') {
                    confidence = data.language_probability;
                }
                return [2 /*return*/, { lang: toIso6392(raw), raw: raw, confidence: confidence }];
        }
    });
}); };
var identifyAudio = function (ctx, stream) { return __awaiter(void 0, void 0, void 0, function () {
    var cfg, log, count, len, votes, positions, i, wavPath, cut, wav, answer, confText, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                cfg = ctx.cfg, log = ctx.log;
                count = cfg.audioSampleCount;
                len = cfg.audioSampleSeconds;
                if (ctx.duration < count * len) {
                    len = Math.floor(ctx.duration / count);
                }
                if (len < 5) {
                    log("  Audio stream ".concat(stream.index, ": file too short to sample, stays und\n"));
                    return [2 /*return*/, ''];
                }
                votes = [];
                positions = spreadPositions(ctx.duration, count, len);
                i = 0;
                _a.label = 1;
            case 1:
                if (!(i < positions.length)) return [3 /*break*/, 6];
                wavPath = path_1.default.join(ctx.tmpDir, "audio_".concat(stream.index, "_").concat(i, ".wav"));
                return [4 /*yield*/, runCommand(ctx.ffmpeg, ['-hide_banner', '-v', 'error', '-y', '-ss', String(positions[i]),
                        '-t', String(len), '-i', ctx.file, '-map', "0:".concat(stream.index), '-vn', '-sn', '-dn',
                        '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wavPath])];
            case 2:
                cut = _a.sent();
                if (!(cut.code !== 0 || fileSize(wavPath) < 8000)) return [3 /*break*/, 3];
                log("  Audio stream ".concat(stream.index, " sample ").concat(i + 1, " at ").concat(positions[i], "s: could not cut a clip ")
                    + "".concat(cut.stderr.trim().slice(-200), "\n"));
                removeFile(wavPath);
                return [3 /*break*/, 5];
            case 3:
                wav = fs_1.default.readFileSync(wavPath);
                removeFile(wavPath);
                return [4 /*yield*/, detectAudioLanguage(ctx, wav)];
            case 4:
                answer = _a.sent();
                confText = answer.confidence === null ? '' : " (confidence ".concat(answer.confidence.toFixed(2), ")");
                if (!answer.lang) {
                    log("  Audio stream ".concat(stream.index, " sample ").concat(i + 1, " at ").concat(positions[i], "s: '").concat(answer.raw, "' not recognised\n"));
                }
                else if (answer.confidence !== null && answer.confidence < cfg.audioMinConfidence) {
                    log("  Audio stream ".concat(stream.index, " sample ").concat(i + 1, " at ").concat(positions[i], "s: ").concat(answer.lang).concat(confText, " ")
                        + "below minimum confidence ".concat(cfg.audioMinConfidence, ", ignored\n"));
                }
                else {
                    log("  Audio stream ".concat(stream.index, " sample ").concat(i + 1, " at ").concat(positions[i], "s: ").concat(answer.lang).concat(confText, "\n"));
                    votes.push(answer.lang);
                }
                _a.label = 5;
            case 5:
                i++;
                return [3 /*break*/, 1];
            case 6:
                result = tallyVotes(votes, cfg.minAgreement, count);
                if (!result.lang) {
                    log("  Audio stream ".concat(stream.index, ": no agreement ").concat(JSON.stringify(result.counts), ", stays und\n"));
                    return [2 /*return*/, ''];
                }
                log("  Audio stream ".concat(stream.index, ": ").concat(result.lang, " (").concat(result.votes, " of ").concat(count, " samples)\n"));
                return [2 /*return*/, result.lang];
        }
    });
}); };
// ---------- chat completions ----------
var askChat = function (ctx, prompt, imageDataUri) { return __awaiter(void 0, void 0, void 0, function () {
    var cfg, args, content, body, data, res, err_2, apiError, raw;
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                cfg = ctx.cfg, args = ctx.args;
                content = [];
                if (imageDataUri) {
                    content.push({ type: 'image_url', image_url: { url: imageDataUri } });
                }
                content.push({ type: 'text', text: prompt });
                body = {
                    temperature: 0,
                    max_tokens: 32,
                    messages: [{ role: 'user', content: content }],
                };
                if (cfg.chatModel) {
                    body.model = cfg.chatModel;
                }
                _e.label = 1;
            case 1:
                _e.trys.push([1, 3, , 4]);
                return [4 /*yield*/, args.deps.axios({
                        method: 'post',
                        url: buildEndpointUrl(cfg.chatApiUrl, '/v1/chat/completions'),
                        data: body,
                        headers: __assign({ 'Content-Type': 'application/json', Accept: 'application/json' }, authHeaders(cfg.chatApiKey)),
                        timeout: cfg.requestTimeoutMs,
                        maxBodyLength: Infinity,
                        maxContentLength: Infinity,
                    })];
            case 2:
                res = _e.sent();
                data = (res === null || res === void 0 ? void 0 : res.data) || {};
                return [3 /*break*/, 4];
            case 3:
                err_2 = _e.sent();
                apiError = toApiError(err_2, 'Chat API');
                if (apiError.down) {
                    throw apiError;
                }
                // a rejected sample (e.g. HTTP 400) only loses its vote
                return [2 /*return*/, { lang: '', raw: apiError.message }];
            case 4:
                raw = String((_d = (_c = (_b = (_a = data === null || data === void 0 ? void 0 : data.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content) !== null && _d !== void 0 ? _d : '').trim();
                return [2 /*return*/, { lang: parseModelAnswer(raw), raw: raw }];
        }
    });
}); };
var imagePrompt = 'The image shows subtitle text from a film on a dark background. '
    + 'What language is the text written in? Answer with only the ISO 639-2 three-letter code '
    + '(for example eng, fre, spa, ger, jpn, chi, kor, rus). If no text is readable, answer und.';
var textPrompt = function (lines) { return "Subtitle lines from a film:\n".concat(lines, "\n\n")
    + 'What language are these lines written in? Answer with only the ISO 639-2 three-letter code '
    + '(for example eng, fre, spa, ger, jpn, chi, kor, rus). If you cannot tell, answer und.'; };
// ---------- picture subtitles ----------
var findSubtitleTimes = function (ctx, stream, count) { return __awaiter(void 0, void 0, void 0, function () {
    var windowLength, times, starts, _loop_1, i;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                windowLength = Math.max(60, Math.min(300, ctx.duration / (count + 1)));
                times = [];
                starts = spreadPositions(ctx.duration, count, 0);
                _loop_1 = function (i) {
                    var res, time;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0: return [4 /*yield*/, runCommand(ctx.ffprobe, ['-v', 'error', '-select_streams', String(stream.index),
                                    '-read_intervals', "".concat(starts[i], "%+").concat(Math.round(windowLength)), '-show_entries', 'packet=pts_time,size',
                                    '-of', 'csv=p=0', ctx.file])];
                            case 1:
                                res = _b.sent();
                                if (res.code !== 0) {
                                    ctx.log("  Subtitle stream ".concat(stream.index, ": ffprobe failed ").concat(res.stderr.trim().slice(-200), "\n"));
                                }
                                else {
                                    time = res.stdout.toString().split(/\r?\n/)
                                        .map(function (line) { return line.split(','); })
                                        .filter(function (parts) { return parts.length >= 2 && parseInt(parts[1], 10) > 400; })
                                        .map(function (parts) { return parseFloat(parts[0]); })
                                        .find(function (t) { return !Number.isNaN(t) && t >= starts[i]; });
                                    if (time !== undefined && !times.includes(time)) {
                                        times.push(time);
                                    }
                                }
                                return [2 /*return*/];
                        }
                    });
                };
                i = 0;
                _a.label = 1;
            case 1:
                if (!(i < starts.length)) return [3 /*break*/, 4];
                return [5 /*yield**/, _loop_1(i)];
            case 2:
                _a.sent();
                _a.label = 3;
            case 3:
                i++;
                return [3 /*break*/, 1];
            case 4: return [2 /*return*/, times];
        }
    });
}); };
var even = function (n) { return Math.max(2, Math.round(n / 2) * 2); };
/** Bounding box of the pixels brighter than threshold in an 8 bit gray frame, or null when blank. */
var findTextBox = function (gray, width, height, threshold) {
    if (threshold === void 0) { threshold = 48; }
    var minX = width;
    var minY = height;
    var maxX = -1;
    var maxY = -1;
    var lit = 0;
    for (var y_1 = 0; y_1 < height; y_1++) {
        var row = y_1 * width;
        for (var x_1 = 0; x_1 < width; x_1++) {
            if (gray[row + x_1] > threshold) {
                lit += 1;
                if (x_1 < minX)
                    minX = x_1;
                if (x_1 > maxX)
                    maxX = x_1;
                if (y_1 < minY)
                    minY = y_1;
                if (y_1 > maxY)
                    maxY = y_1;
            }
        }
    }
    if (lit < 50) {
        return null;
    }
    var pad = 12;
    var x = Math.max(0, minX - pad);
    var y = Math.max(0, minY - pad);
    var w = Math.min(width - x, maxX - minX + 1 + 2 * pad);
    var h = Math.min(height - y, maxY - minY + 1 + 2 * pad);
    return {
        x: x,
        y: y,
        w: Math.max(2, w - (w % 2)), h: Math.max(2, h - (h % 2)),
    };
};
exports.findTextBox = findTextBox;
var getCanvasSize = function (ctx, stream) {
    if (Number(stream.width) > 0 && Number(stream.height) > 0) {
        return { w: Number(stream.width), h: Number(stream.height) };
    }
    var video = ctx.args.variables.ffmpegCommand.streams.find(function (s) { return s.codec_type === 'video'
        && Number(s.width) > 0 && Number(s.height) > 0; });
    return video ? { w: Number(video.width), h: Number(video.height) } : { w: 1920, h: 1080 };
};
/** Render the subtitle at the given time over black, crop it to the text and return a PNG data URI. */
var renderSubtitleImage = function (ctx, stream, time, sample) { return __awaiter(void 0, void 0, void 0, function () {
    var canvas, renderW, renderH, seek, offset, framePath, filter, render, png, box, outW, outH, crop;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                canvas = getCanvasSize(ctx, stream);
                renderW = even(Math.min(1280, canvas.w));
                renderH = even((canvas.h * renderW) / canvas.w);
                seek = Math.max(0, time - 0.3);
                offset = time - seek + 0.15;
                framePath = path_1.default.join(ctx.tmpDir, "subtitle_".concat(stream.index, "_").concat(sample, ".png"));
                filter = "[0:v:0]scale=".concat(canvas.w, ":").concat(canvas.h, ",drawbox=x=0:y=0:w=iw:h=ih:color=black:t=fill[bg];")
                    + "[bg][0:".concat(stream.index, "]overlay,select=gte(t\\,").concat(offset.toFixed(2), "),scale=").concat(renderW, ":").concat(renderH, ",")
                    + 'split[png][raw]';
                return [4 /*yield*/, runCommand(ctx.ffmpeg, ['-hide_banner', '-v', 'error', '-y', '-ss', seek.toFixed(2),
                        '-t', '1.5', '-i', ctx.file, '-filter_complex', filter,
                        '-map', '[png]', '-frames:v', '1', framePath,
                        '-map', '[raw]', '-frames:v', '1', '-pix_fmt', 'gray', '-f', 'rawvideo', 'pipe:1'])];
            case 1:
                render = _a.sent();
                if (render.code !== 0 || fileSize(framePath) === 0) {
                    removeFile(framePath);
                    throw new Error("render failed ".concat(render.stderr.trim().slice(-200)));
                }
                _a.label = 2;
            case 2:
                _a.trys.push([2, , 6, 7]);
                png = void 0;
                if (!(render.stdout.length === renderW * renderH)) return [3 /*break*/, 4];
                box = findTextBox(render.stdout, renderW, renderH);
                if (!box) {
                    return [2 /*return*/, ''];
                }
                outW = even(Math.min(box.w, ctx.cfg.subtitleImageMaxWidth));
                outH = even((box.h * outW) / box.w);
                return [4 /*yield*/, runCommand(ctx.ffmpeg, ['-hide_banner', '-v', 'error', '-i', framePath,
                        '-vf', "crop=".concat(box.w, ":").concat(box.h, ":").concat(box.x, ":").concat(box.y, ",scale=").concat(outW, ":").concat(outH), '-frames:v', '1', '-c:v', 'png', '-f', 'image2pipe', 'pipe:1'])];
            case 3:
                crop = _a.sent();
                if (crop.code !== 0 || crop.stdout.length === 0) {
                    throw new Error("crop failed ".concat(crop.stderr.trim().slice(-200)));
                }
                png = crop.stdout;
                return [3 /*break*/, 5];
            case 4:
                // unexpected frame size, send the whole frame
                png = fs_1.default.readFileSync(framePath);
                _a.label = 5;
            case 5: return [2 /*return*/, "data:image/png;base64,".concat(png.toString('base64'))];
            case 6:
                removeFile(framePath);
                return [7 /*endfinally*/];
            case 7: return [2 /*return*/];
        }
    });
}); };
var identifyPictureSubtitle = function (ctx, stream) { return __awaiter(void 0, void 0, void 0, function () {
    var cfg, log, times, votes, i, at, image, err_3, answer, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                cfg = ctx.cfg, log = ctx.log;
                if (!ctx.args.variables.ffmpegCommand.streams.some(function (s) { return s.codec_type === 'video'; })) {
                    log("  Subtitle stream ".concat(stream.index, ": no video stream to render on, stays und\n"));
                    return [2 /*return*/, ''];
                }
                return [4 /*yield*/, findSubtitleTimes(ctx, stream, cfg.subtitleSampleCount)];
            case 1:
                times = _a.sent();
                if (times.length === 0) {
                    log("  Subtitle stream ".concat(stream.index, ": no subtitle packets found, stays und\n"));
                    return [2 /*return*/, ''];
                }
                votes = [];
                i = 0;
                _a.label = 2;
            case 2:
                if (!(i < times.length)) return [3 /*break*/, 10];
                at = "".concat(times[i].toFixed(1), "s");
                image = '';
                _a.label = 3;
            case 3:
                _a.trys.push([3, 5, , 6]);
                return [4 /*yield*/, renderSubtitleImage(ctx, stream, times[i], i)];
            case 4:
                // eslint-disable-next-line no-await-in-loop
                image = _a.sent();
                return [3 /*break*/, 6];
            case 5:
                err_3 = _a.sent();
                log("  Subtitle stream ".concat(stream.index, " frame ").concat(i + 1, " at ").concat(at, ": ").concat(err_3.message, "\n"));
                return [3 /*break*/, 6];
            case 6:
                if (!!image) return [3 /*break*/, 7];
                log("  Subtitle stream ".concat(stream.index, " frame ").concat(i + 1, " at ").concat(at, ": no text rendered\n"));
                return [3 /*break*/, 9];
            case 7: return [4 /*yield*/, askChat(ctx, imagePrompt, image)];
            case 8:
                answer = _a.sent();
                log("  Subtitle stream ".concat(stream.index, " frame ").concat(i + 1, " at ").concat(at, ": model said '").concat(answer.raw.slice(0, 60), "'")
                    + " -> ".concat(answer.lang || 'und', "\n"));
                votes.push(answer.lang);
                _a.label = 9;
            case 9:
                i++;
                return [3 /*break*/, 2];
            case 10:
                result = tallyVotes(votes, cfg.minAgreement, cfg.subtitleSampleCount);
                if (!result.lang) {
                    log("  Subtitle stream ".concat(stream.index, ": no agreement ").concat(JSON.stringify(result.counts), ", stays und\n"));
                    return [2 /*return*/, ''];
                }
                log("  Subtitle stream ".concat(stream.index, ": ").concat(result.lang, " (").concat(result.votes, " of ").concat(times.length, " frames)\n"));
                return [2 /*return*/, result.lang];
        }
    });
}); };
// ---------- text subtitles ----------
/** Dialogue lines from SRT text, without numbers, timings and formatting tags. */
var cleanSubtitleLines = function (srt) { return srt.split(/\r?\n/)
    .map(function (line) { return line.replace(/<[^>]+>/g, '').replace(/\{[^}]*\}/g, '').replace(/\\N/gi, ' ')
    .trim(); })
    .filter(function (line) { return line.length >= 4 && !/^\d+$/.test(line) && !line.includes('-->'); }); };
var identifyTextSubtitle = function (ctx, stream) { return __awaiter(void 0, void 0, void 0, function () {
    var cfg, log, count, starts, votes, seen, i, res, lines, sample, answer, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                cfg = ctx.cfg, log = ctx.log;
                count = cfg.subtitleSampleCount;
                starts = spreadPositions(ctx.duration, count, 0);
                votes = [];
                seen = [];
                i = 0;
                _a.label = 1;
            case 1:
                if (!(i < starts.length)) return [3 /*break*/, 6];
                return [4 /*yield*/, runCommand(ctx.ffmpeg, ['-hide_banner', '-v', 'error', '-ss', String(starts[i]),
                        '-t', '300', '-i', ctx.file, '-map', "0:".concat(stream.index), '-f', 'srt', 'pipe:1'])];
            case 2:
                res = _a.sent();
                lines = res.code === 0 ? cleanSubtitleLines(res.stdout.toString('utf8')) : [];
                sample = lines.slice(0, 10).join('\n').slice(0, 1000);
                if (!(lines.length < 3 || seen.includes(sample))) return [3 /*break*/, 3];
                log("  Subtitle stream ".concat(stream.index, " sample ").concat(i + 1, " at ").concat(starts[i], "s: not enough new text\n"));
                return [3 /*break*/, 5];
            case 3:
                seen.push(sample);
                return [4 /*yield*/, askChat(ctx, textPrompt(sample))];
            case 4:
                answer = _a.sent();
                log("  Subtitle stream ".concat(stream.index, " sample ").concat(i + 1, " at ").concat(starts[i], "s: model said ")
                    + "'".concat(answer.raw.slice(0, 60), "' -> ").concat(answer.lang || 'und', "\n"));
                votes.push(answer.lang);
                _a.label = 5;
            case 5:
                i++;
                return [3 /*break*/, 1];
            case 6:
                result = tallyVotes(votes, cfg.minAgreement, count);
                if (!result.lang) {
                    log("  Subtitle stream ".concat(stream.index, ": no agreement ").concat(JSON.stringify(result.counts), ", stays und\n"));
                    return [2 /*return*/, ''];
                }
                log("  Subtitle stream ".concat(stream.index, ": ").concat(result.lang, " (").concat(result.votes, " of ").concat(result.total, " samples)\n"));
                return [2 /*return*/, result.lang];
        }
    });
}); };
// ---------- plugin ----------
var getDuration = function (args) {
    var _a, _b, _c, _d, _e;
    var fromProbe = Number((_c = (_b = (_a = args.inputFileObj) === null || _a === void 0 ? void 0 : _a.ffProbeData) === null || _b === void 0 ? void 0 : _b.format) === null || _c === void 0 ? void 0 : _c.duration);
    if (fromProbe > 0) {
        return fromProbe;
    }
    var fromMeta = Number((_e = (_d = args.inputFileObj) === null || _d === void 0 ? void 0 : _d.meta) === null || _e === void 0 ? void 0 : _e.Duration);
    return fromMeta > 0 ? fromMeta : 0;
};
var plugin = function (args) { return __awaiter(void 0, void 0, void 0, function () {
    var lib, asBool, str, num, ffmpegPath, cfg, log, result, candidates, duration, tmpDir, down, labelled, ctx, i, _a, stream, kind, service, lang, err_4, tags, key, err_5;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                lib = require('../../../../../methods/lib')();
                // eslint-disable-next-line @typescript-eslint/no-unused-vars,no-param-reassign
                args.inputs = lib.loadDefaultValues(args.inputs, details);
                (0, flowUtils_1.checkFfmpegCommandInit)(args);
                asBool = function (value) { return value === true || String(value).trim().toLowerCase() === 'true'; };
                str = function (value) { return String(value === undefined || value === null ? '' : value).trim(); };
                num = function (value, fallback, min) {
                    var n = Number(value);
                    return Number.isFinite(n) && n >= min ? n : fallback;
                };
                ffmpegPath = args.ffmpegPath || 'ffmpeg';
                cfg = {
                    labelAudio: asBool(args.inputs.labelAudio),
                    audioApiStyle: str(args.inputs.audioApiStyle),
                    audioApiUrl: str(args.inputs.audioApiUrl),
                    audioModel: str(args.inputs.audioModel),
                    audioApiKey: str(args.inputs.audioApiKey),
                    audioSampleCount: Math.round(num(args.inputs.audioSampleCount, 4, 1)),
                    audioSampleSeconds: num(args.inputs.audioSampleSeconds, 30, 5),
                    audioMinConfidence: num(args.inputs.audioMinConfidence, 0.5, 0),
                    labelPictureSubtitles: asBool(args.inputs.labelPictureSubtitles),
                    labelTextSubtitles: asBool(args.inputs.labelTextSubtitles),
                    chatApiUrl: str(args.inputs.chatApiUrl),
                    chatModel: str(args.inputs.chatModel),
                    chatApiKey: str(args.inputs.chatApiKey),
                    subtitleSampleCount: Math.round(num(args.inputs.subtitleSampleCount, 5, 1)),
                    subtitleImageMaxWidth: Math.round(num(args.inputs.subtitleImageMaxWidth, 768, 64)),
                    minAgreement: Math.round(num(args.inputs.minAgreement, 2, 1)),
                    requestTimeoutMs: num(args.inputs.requestTimeoutSeconds, 120, 1) * 1000,
                    ffprobePath: getFfprobePath(ffmpegPath, str(args.inputs.ffprobePath)),
                };
                log = function (text) { return args.jobLog(text); };
                result = {
                    outputFileObj: args.inputFileObj,
                    outputNumber: 2,
                    variables: args.variables,
                };
                candidates = [];
                args.variables.ffmpegCommand.streams
                    .filter(function (stream) { return !stream.removed && ['audio', 'subtitle'].includes(stream.codec_type)
                    && unknownLanguageTags.includes(getTag(stream, 'language').trim().toLowerCase()); })
                    .forEach(function (stream) {
                    var codec = String(stream.codec_name || '').toLowerCase();
                    if (stream.codec_type === 'audio') {
                        if (!cfg.labelAudio) {
                            return;
                        }
                        if (!cfg.audioApiUrl) {
                            log("Audio stream ".concat(stream.index, " has no language but Audio API URL is empty, skipping\n"));
                            return;
                        }
                        candidates.push({ stream: stream, kind: 'audio' });
                        return;
                    }
                    var kind = (pictureSubtitleCodecs.includes(codec) && 'picture')
                        || (textSubtitleCodecs.includes(codec) && 'text') || '';
                    if (!kind) {
                        log("Subtitle stream ".concat(stream.index, " has no language but codec ").concat(codec, " is not supported, skipping\n"));
                    }
                    else if ((kind === 'picture' && cfg.labelPictureSubtitles) || (kind === 'text' && cfg.labelTextSubtitles)) {
                        if (cfg.chatApiUrl) {
                            candidates.push({ stream: stream, kind: kind });
                        }
                        else {
                            log("Subtitle stream ".concat(stream.index, " has no language but Chat API URL is empty, skipping\n"));
                        }
                    }
                });
                if (candidates.length === 0) {
                    log('Nothing to label\n');
                    return [2 /*return*/, result];
                }
                duration = getDuration(args);
                if (!duration) {
                    log('File duration unknown, cannot take samples, nothing labelled\n');
                    return [2 /*return*/, result];
                }
                tmpDir = '';
                down = { audio: false, chat: false };
                labelled = 0;
                _b.label = 1;
            case 1:
                _b.trys.push([1, 14, 15, 16]);
                tmpDir = fs_1.default.mkdtempSync(path_1.default.join(args.workDir || os_1.default.tmpdir(), 'labelLanguages-'));
                ctx = {
                    args: args,
                    cfg: cfg,
                    file: args.inputFileObj._id,
                    tmpDir: tmpDir,
                    duration: duration,
                    ffmpeg: ffmpegPath,
                    ffprobe: cfg.ffprobePath,
                    log: log,
                };
                i = 0;
                _b.label = 2;
            case 2:
                if (!(i < candidates.length)) return [3 /*break*/, 13];
                _a = candidates[i], stream = _a.stream, kind = _a.kind;
                service = kind === 'audio' ? 'audio' : 'chat';
                log("".concat(stream.codec_type === 'audio' ? 'Audio' : 'Subtitle', " stream ").concat(stream.index, " (").concat(stream.codec_name)
                    + "".concat(getTag(stream, 'title') ? ", '".concat(getTag(stream, 'title'), "'") : '', ") has no language\n"));
                lang = '';
                if (!down[service]) return [3 /*break*/, 3];
                log("  ".concat(service === 'audio' ? 'Audio' : 'Chat', " API unreachable earlier, stays und\n"));
                return [3 /*break*/, 11];
            case 3:
                _b.trys.push([3, 10, , 11]);
                if (!(kind === 'audio')) return [3 /*break*/, 5];
                return [4 /*yield*/, identifyAudio(ctx, stream)];
            case 4:
                // eslint-disable-next-line no-await-in-loop
                lang = _b.sent();
                return [3 /*break*/, 9];
            case 5:
                if (!(kind === 'picture')) return [3 /*break*/, 7];
                return [4 /*yield*/, identifyPictureSubtitle(ctx, stream)];
            case 6:
                // eslint-disable-next-line no-await-in-loop
                lang = _b.sent();
                return [3 /*break*/, 9];
            case 7: return [4 /*yield*/, identifyTextSubtitle(ctx, stream)];
            case 8:
                // eslint-disable-next-line no-await-in-loop
                lang = _b.sent();
                _b.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                err_4 = _b.sent();
                lang = '';
                if (err_4 instanceof ApiError && err_4.down) {
                    down[service] = true;
                    log("  ".concat(err_4.message, "; leaving this and later ").concat(service === 'audio' ? 'audio' : 'subtitle', " ")
                        + 'streams und and continuing\n');
                }
                else {
                    log("  Error while identifying stream ".concat(stream.index, ": ").concat(err_4 === null || err_4 === void 0 ? void 0 : err_4.message, "; stays und\n"));
                }
                return [3 /*break*/, 11];
            case 11:
                if (lang) {
                    tags = (stream.tags || {});
                    key = Object.keys(tags).find(function (k) { return k.toLowerCase() === 'language'; }) || 'language';
                    tags[key] = lang;
                    // eslint-disable-next-line no-param-reassign
                    stream.tags = tags;
                    // {outputIndex} is replaced with the stream index in the output file by the Execute plugin
                    stream.outputArgs.push('-metadata:s:{outputIndex}', "language=".concat(lang));
                    labelled += 1;
                    log("  Labelling stream ".concat(stream.index, " as ").concat(lang, "\n"));
                }
                _b.label = 12;
            case 12:
                i++;
                return [3 /*break*/, 2];
            case 13: return [3 /*break*/, 16];
            case 14:
                err_5 = _b.sent();
                // labelling is best effort, never fail the file
                log("Label Languages: unexpected error, continuing: ".concat(err_5 === null || err_5 === void 0 ? void 0 : err_5.message, "\n"));
                return [3 /*break*/, 16];
            case 15:
                if (tmpDir) {
                    try {
                        fs_1.default.rmSync(tmpDir, { recursive: true, force: true });
                    }
                    catch (_c) {
                        // ignore
                    }
                }
                return [7 /*endfinally*/];
            case 16:
                if (labelled > 0) {
                    // eslint-disable-next-line no-param-reassign
                    args.variables.ffmpegCommand.shouldProcess = true;
                    result.outputNumber = 1;
                    log("Labelled ".concat(labelled, " stream(s), use the Execute plugin to write the tags\n"));
                }
                else {
                    log('No language could be identified, nothing labelled\n');
                }
                return [2 /*return*/, result];
        }
    });
}); };
exports.plugin = plugin;
