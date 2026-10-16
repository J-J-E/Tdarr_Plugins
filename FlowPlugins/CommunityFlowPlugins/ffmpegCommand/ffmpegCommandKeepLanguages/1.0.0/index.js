"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.plugin = exports.details = void 0;
var flowUtils_1 = require("../../../../FlowHelpers/1.0.0/interfaces/flowUtils");
/* eslint no-plusplus: ["error", { "allowForLoopAfterthoughts": true }] */
var originalLanguageDisplayConditions = {
    logic: 'AND',
    sets: [
        {
            logic: 'AND',
            inputs: [
                {
                    name: 'keepOriginalLanguage',
                    value: 'true',
                    condition: '===',
                },
            ],
        },
    ],
};
var details = function () { return ({
    name: 'Keep Languages',
    description: 'Remove audio and/or subtitle streams whose language is not in the keep list. '
        + 'Optionally also keeps the original language of the title, looked up in Radarr, Sonarr and/or TMDB. '
        + 'Forced subtitles and streams with no language are kept by default, and the last audio stream is never removed. '
        + 'Streams are only marked as removed, use the Execute plugin afterwards to apply the change.',
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
            label: 'Languages To Keep',
            name: 'languagesToKeep',
            type: 'string',
            defaultValue: 'eng',
            inputUI: {
                type: 'text',
            },
            tooltip: "\n      Comma separated list of languages to keep, as ISO 639-2 codes. ISO 639-1 codes and English\n      language names are also understood, and equivalent codes are treated as the same language\n      (fre and fra, ger and deu, chi and zho...).\n\n      Example:\n      eng,spa,jpn\n      ",
        },
        {
            label: 'Keep Original Language',
            name: 'keepOriginalLanguage',
            type: 'boolean',
            defaultValue: 'false',
            inputUI: {
                type: 'switch',
            },
            tooltip: "\n      Also keep the original language of the movie or series.\n\n      The original language is looked up using the Radarr, Sonarr and/or TMDB settings below.\n      All of them are optional. If the original language cannot be determined (nothing is set,\n      no instance knows the title, or a lookup fails), the \"If Original Language Unknown\" option\n      decides what happens to the audio streams.\n\n      The title is found by the TMDB id in the path ([tmdbid-123] or {tmdb-123}).\n      If there is none, Radarr and Sonarr are asked to parse the file name instead.\n      ",
        },
        {
            label: 'Radarr URL',
            name: 'radarrUrl',
            type: 'string',
            defaultValue: '',
            inputUI: {
                type: 'text',
                displayConditions: originalLanguageDisplayConditions,
            },
            tooltip: "\n      Optional. Radarr base URL, used to look up the original language of movies.\n      Several instances can be given as a comma separated list, paired by position with the\n      API keys below. They are tried in order until one knows the title.\n\n      Example:\n      http://192.168.1.1:7878\n      http://192.168.1.1:7878,http://192.168.1.1:7879\n      ",
        },
        {
            label: 'Radarr API Key',
            name: 'radarrApiKey',
            type: 'string',
            defaultValue: '',
            inputUI: {
                type: 'text',
                displayConditions: originalLanguageDisplayConditions,
            },
            tooltip: "\n      Optional. Radarr API key. A flow variable can be used to avoid typing the key here.\n      For several instances give one key per URL, comma separated, in the same order.\n\n      Example:\n      {{{args.userVariables.global.radarrApiKey}}}\n      ",
        },
        {
            label: 'Sonarr URL',
            name: 'sonarrUrl',
            type: 'string',
            defaultValue: '',
            inputUI: {
                type: 'text',
                displayConditions: originalLanguageDisplayConditions,
            },
            tooltip: "\n      Optional. Sonarr base URL, used to look up the original language of series.\n      Several instances can be given as a comma separated list, paired by position with the\n      API keys below. They are tried in order until one knows the title.\n\n      Example:\n      http://192.168.1.1:8989\n      http://192.168.1.1:8989,http://192.168.1.1:8990\n      ",
        },
        {
            label: 'Sonarr API Key',
            name: 'sonarrApiKey',
            type: 'string',
            defaultValue: '',
            inputUI: {
                type: 'text',
                displayConditions: originalLanguageDisplayConditions,
            },
            tooltip: "\n      Optional. Sonarr API key. A flow variable can be used to avoid typing the key here.\n      For several instances give one key per URL, comma separated, in the same order.\n\n      Example:\n      {{{args.userVariables.global.sonarrApiKey}}}\n      ",
        },
        {
            label: 'TMDB API Key',
            name: 'tmdbApiKey',
            type: 'string',
            defaultValue: '',
            inputUI: {
                type: 'text',
                displayConditions: originalLanguageDisplayConditions,
            },
            tooltip: "\n      Optional. TMDB API key (v3 key or v4 read access token), used when Radarr and Sonarr are\n      not set or do not know the title. Needs a TMDB id in the path.\n      ",
        },
        {
            label: 'If Original Language Unknown',
            name: 'ifOriginalLanguageUnknown',
            type: 'string',
            defaultValue: 'keepAllAudio',
            inputUI: {
                type: 'dropdown',
                options: [
                    'keepAllAudio',
                    'keepListOnly',
                ],
                displayConditions: originalLanguageDisplayConditions,
            },
            tooltip: "\n      What to do with audio streams when \"Keep Original Language\" is on but the original language\n      could not be determined (no usable service, no service knows the title, or a lookup failed).\n\n      keepAllAudio: keep every audio stream (safe, the original language track cannot be lost).\n      Subtitles are still filtered by the keep list, forced and undefined options.\n\n      keepListOnly: only keep the languages in \"Languages To Keep\" (plus the other keep options).\n      The original language track is removed if it is not in the list.\n      ",
        },
        {
            label: 'Keep Forced Subtitles',
            name: 'keepForcedSubtitles',
            type: 'boolean',
            defaultValue: 'true',
            inputUI: {
                type: 'switch',
            },
            tooltip: "\n      Keep subtitle streams that are flagged as forced (or have \"forced\" in the title),\n      whatever their language.\n      ",
        },
        {
            label: 'Keep Undefined',
            name: 'keepUndefined',
            type: 'boolean',
            defaultValue: 'true',
            inputUI: {
                type: 'switch',
            },
            tooltip: "\n      Keep streams with no language tag, or with an undetermined language (und, mis, mul, zxx).\n      Streams with a language tag that cannot be recognised are always kept.\n      ",
        },
        {
            label: 'Stream Types',
            name: 'streamTypes',
            type: 'string',
            defaultValue: 'both',
            inputUI: {
                type: 'dropdown',
                options: [
                    'audio',
                    'subtitle',
                    'both',
                ],
            },
            tooltip: "\n      Which streams to filter. Video, attachments, data streams and chapters are never touched.\n      ",
        },
    ],
    outputs: [
        {
            number: 1,
            tooltip: 'Streams removed',
        },
        {
            number: 2,
            tooltip: 'Nothing to remove',
        },
    ],
}); };
exports.details = details;
// [iso639-2/B, iso639-2/T, iso639-1, English names separated by |]
var languageRows = [
    ['afr', 'afr', 'af', 'Afrikaans'], ['alb', 'sqi', 'sq', 'Albanian'], ['amh', 'amh', 'am', 'Amharic'],
    ['ara', 'ara', 'ar', 'Arabic'], ['arm', 'hye', 'hy', 'Armenian'], ['asm', 'asm', 'as', 'Assamese'],
    ['aze', 'aze', 'az', 'Azerbaijani'], ['baq', 'eus', 'eu', 'Basque'], ['bel', 'bel', 'be', 'Belarusian'],
    ['ben', 'ben', 'bn', 'Bengali'], ['bos', 'bos', 'bs', 'Bosnian'], ['bre', 'bre', 'br', 'Breton'],
    ['bul', 'bul', 'bg', 'Bulgarian'], ['bur', 'mya', 'my', 'Burmese'], ['cat', 'cat', 'ca', 'Catalan'],
    ['chi', 'zho', 'zh', 'Chinese|Mandarin'], ['cze', 'ces', 'cs', 'Czech'], ['dan', 'dan', 'da', 'Danish'],
    ['dut', 'nld', 'nl', 'Dutch|Flemish'], ['eng', 'eng', 'en', 'English'], ['est', 'est', 'et', 'Estonian'],
    ['fao', 'fao', 'fo', 'Faroese'], ['fil', 'fil', '', 'Filipino'], ['fin', 'fin', 'fi', 'Finnish'],
    ['fre', 'fra', 'fr', 'French'], ['geo', 'kat', 'ka', 'Georgian'], ['ger', 'deu', 'de', 'German'],
    ['gle', 'gle', 'ga', 'Irish'], ['glg', 'glg', 'gl', 'Galician'], ['gre', 'ell', 'el', 'Greek'],
    ['guj', 'guj', 'gu', 'Gujarati'], ['hat', 'hat', 'ht', 'Haitian Creole'], ['hau', 'hau', 'ha', 'Hausa'],
    ['heb', 'heb', 'he', 'Hebrew'], ['hin', 'hin', 'hi', 'Hindi'], ['hrv', 'hrv', 'hr', 'Croatian'],
    ['hun', 'hun', 'hu', 'Hungarian'], ['ice', 'isl', 'is', 'Icelandic'], ['ind', 'ind', 'id', 'Indonesian'],
    ['ita', 'ita', 'it', 'Italian'], ['jav', 'jav', 'jv', 'Javanese'], ['jpn', 'jpn', 'ja', 'Japanese'],
    ['kan', 'kan', 'kn', 'Kannada'], ['kaz', 'kaz', 'kk', 'Kazakh'], ['khm', 'khm', 'km', 'Khmer'],
    ['kor', 'kor', 'ko', 'Korean'], ['lao', 'lao', 'lo', 'Lao'], ['lat', 'lat', 'la', 'Latin'],
    ['lav', 'lav', 'lv', 'Latvian'], ['lit', 'lit', 'lt', 'Lithuanian'], ['ltz', 'ltz', 'lb', 'Luxembourgish'],
    ['mac', 'mkd', 'mk', 'Macedonian'], ['mal', 'mal', 'ml', 'Malayalam'], ['mao', 'mri', 'mi', 'Maori'],
    ['mar', 'mar', 'mr', 'Marathi'], ['may', 'msa', 'ms', 'Malay'], ['mlt', 'mlt', 'mt', 'Maltese'],
    ['mon', 'mon', 'mn', 'Mongolian'], ['nep', 'nep', 'ne', 'Nepali'],
    ['nor', 'nor', 'no', 'Norwegian|Norwegian Bokmal|Norwegian Nynorsk'], ['oci', 'oci', 'oc', 'Occitan'],
    ['pan', 'pan', 'pa', 'Punjabi'], ['per', 'fas', 'fa', 'Persian'], ['pol', 'pol', 'pl', 'Polish'],
    ['por', 'por', 'pt', 'Portuguese'], ['pus', 'pus', 'ps', 'Pashto'], ['rum', 'ron', 'ro', 'Romanian'],
    ['roh', 'roh', 'rm', 'Romansh'], ['rus', 'rus', 'ru', 'Russian'], ['san', 'san', 'sa', 'Sanskrit'],
    ['sin', 'sin', 'si', 'Sinhala'], ['slo', 'slk', 'sk', 'Slovak'], ['slv', 'slv', 'sl', 'Slovenian'],
    ['som', 'som', 'so', 'Somali'], ['spa', 'spa', 'es', 'Spanish|Castilian'], ['srp', 'srp', 'sr', 'Serbian'],
    ['swa', 'swa', 'sw', 'Swahili'], ['swe', 'swe', 'sv', 'Swedish'], ['tam', 'tam', 'ta', 'Tamil'],
    ['tat', 'tat', 'tt', 'Tatar'], ['tel', 'tel', 'te', 'Telugu'], ['tgl', 'tgl', 'tl', 'Tagalog'],
    ['tha', 'tha', 'th', 'Thai'], ['tib', 'bod', 'bo', 'Tibetan'], ['tur', 'tur', 'tr', 'Turkish'],
    ['ukr', 'ukr', 'uk', 'Ukrainian'], ['urd', 'urd', 'ur', 'Urdu'], ['uzb', 'uzb', 'uz', 'Uzbek'],
    ['vie', 'vie', 'vi', 'Vietnamese'], ['wel', 'cym', 'cy', 'Welsh'], ['yid', 'yid', 'yi', 'Yiddish'],
    ['yor', 'yor', 'yo', 'Yoruba'], ['yue', 'yue', '', 'Cantonese'],
];
// extra codes seen in the wild that map onto one of the languages above
var languageExtras = {
    nob: 'nor',
    nno: 'nor',
    nb: 'nor',
    nn: 'nor',
    cn: 'yue', // TMDB uses "cn" for Cantonese
    iw: 'heb',
    ji: 'yid',
};
// Languages that are treated as one when matching, e.g. a Chinese track for a Cantonese film.
var languageGroups = {
    yue: 'chi',
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
    languageLookup[key] = languageLookup[languageExtras[key]] || languageExtras[key];
});
/**
 * Convert an ISO 639-1, 639-2/B, 639-2/T code or an English language name
 * (e.g. "Portuguese (Brazil)") to the ISO 639-2/B code. Returns '' if unknown.
 */
var toIso6392 = function (value) {
    var raw = String(value === undefined || value === null ? '' : value).trim().toLowerCase();
    if (!raw) {
        return '';
    }
    var stripped = raw.replace(/\s*\(.*\)\s*$/, '').trim();
    return languageLookup[raw] || languageLookup[stripped] || languageLookup[stripped.split(/[-_]/)[0]] || '';
};
var matchKey = function (code) { return languageGroups[code] || code; };
// language tags meaning "not known" or "no spoken language"
var undefinedTags = ['', 'und', 'mis', 'mul', 'zxx', 'unk', 'undetermined', 'unknown'];
var getTag = function (stream, name) {
    var _a;
    var tags = (stream.tags || {});
    var key = Object.keys(tags).find(function (k) { return k.toLowerCase() === name; });
    return key === undefined ? '' : String((_a = tags[key]) !== null && _a !== void 0 ? _a : '');
};
var isForced = function (stream) {
    var _a;
    return (Number((_a = stream.disposition) === null || _a === void 0 ? void 0 : _a.forced) === 1 || getTag(stream, 'title').toLowerCase().includes('forced'));
};
/** TMDB id from "[tmdbid-123]", "[tmdb-123]" or "{tmdb-123}", the deepest folder or file name wins. */
var getTmdbIdFromPath = function (filePath) {
    var parts = String(filePath || '').split(/[\\/]+/);
    for (var i = parts.length - 1; i >= 0; i -= 1) {
        var match = /[[{]tmdb(?:id)?-(\d+)[\]}]/i.exec(parts[i]);
        if (match) {
            return match[1];
        }
    }
    return '';
};
var getArrKind = function (filePath) {
    var p = String(filePath || '').replace(/\\/g, '/').toLowerCase();
    if (/\/(tv|series|shows)\//.test(p) || /\/season[ _]?\d+\//.test(p)) {
        return 'sonarr';
    }
    if (/\/movies?\//.test(p)) {
        return 'radarr';
    }
    return '';
};
var requestTimeoutMs = 15000;
/**
 * Resolves a `{{{args.userVariables.global.NAME}}}` (or `.library.NAME`) placeholder that Tdarr left
 * unreplaced, e.g. because several placeholders share one comma separated input. Other values pass through.
 */
var resolveVariable = function (value, args) {
    var _a;
    var match = /^\{\{\{\s*args\.userVariables\.(global|library)\.([A-Za-z0-9_]+)\s*\}\}\}$/.exec(value);
    if (!match) {
        return value;
    }
    var scope = (_a = args.userVariables) === null || _a === void 0 ? void 0 : _a[match[1]];
    var resolved = scope === null || scope === void 0 ? void 0 : scope[match[2]];
    return resolved === undefined || resolved === null ? '' : String(resolved);
};
/** Pairs comma separated URLs and API keys by position. Entries missing a URL or a key are skipped. */
var parseInstances = function (urls, apiKeys, args) {
    var urlList = urls.split(',').map(function (item) { return resolveVariable(item.trim(), args); });
    var keyList = apiKeys.split(',').map(function (item) { return resolveVariable(item.trim(), args); });
    var instances = [];
    urlList.forEach(function (url, i) {
        if (url && keyList[i]) {
            instances.push({ url: url, apiKey: keyList[i] });
        }
    });
    return instances;
};
var arrGet = function (args, baseUrl, apiKey, apiPath, params) { return __awaiter(void 0, void 0, void 0, function () {
    var res;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, args.deps.axios({
                    method: 'get',
                    url: "".concat(baseUrl.replace(/\/+$/, '')).concat(apiPath),
                    params: params,
                    headers: {
                        'X-Api-Key': apiKey,
                        Accept: 'application/json',
                    },
                    timeout: requestTimeoutMs,
                })];
            case 1:
                res = _a.sent();
                return [2 /*return*/, res === null || res === void 0 ? void 0 : res.data];
        }
    });
}); };
// Ignore results for a different title in case the server ignores the tmdbId filter
var findByTmdbId = function (data, tmdbId) { return (Array.isArray(data) ? data : [data]).find(function (item) { return item && String(item.tmdbId) === tmdbId && item.originalLanguage; }); };
var lookupArr = function (args, kind, instance, tmdbId, libraryPath) { return __awaiter(void 0, void 0, void 0, function () {
    var baseUrl, apiKey, apiPath, name, title, _a, fileName, parsed, languageName, code;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                baseUrl = instance.url;
                apiKey = instance.apiKey;
                apiPath = kind === 'radarr' ? '/api/v3/movie' : '/api/v3/series';
                name = kind === 'radarr' ? 'Radarr' : 'Sonarr';
                if (!tmdbId) return [3 /*break*/, 2];
                _a = findByTmdbId;
                return [4 /*yield*/, arrGet(args, baseUrl, apiKey, apiPath, { tmdbId: tmdbId })];
            case 1:
                title = _a.apply(void 0, [_c.sent(), tmdbId]);
                if (!title) {
                    args.jobLog("".concat(name, " has no title with TMDB id ").concat(tmdbId, "\n"));
                }
                _c.label = 2;
            case 2:
                if (!!title) return [3 /*break*/, 4];
                fileName = libraryPath.split(/[\\/]+/).pop() || '';
                return [4 /*yield*/, arrGet(args, baseUrl, apiKey, '/api/v3/parse', { title: fileName })];
            case 3:
                parsed = _c.sent();
                title = kind === 'radarr' ? parsed === null || parsed === void 0 ? void 0 : parsed.movie : parsed === null || parsed === void 0 ? void 0 : parsed.series;
                if (!title) {
                    args.jobLog("".concat(name, " could not identify '").concat(fileName, "'\n"));
                }
                _c.label = 4;
            case 4:
                languageName = (_b = title === null || title === void 0 ? void 0 : title.originalLanguage) === null || _b === void 0 ? void 0 : _b.name;
                if (!languageName) {
                    return [2 /*return*/, ''];
                }
                code = toIso6392(languageName);
                args.jobLog("".concat(name, " original language: ").concat(languageName, " -> ").concat(code || 'not recognised', "\n"));
                return [2 /*return*/, code];
        }
    });
}); };
var lookupTmdb = function (args, cfg, tmdbId, kind) { return __awaiter(void 0, void 0, void 0, function () {
    var types, isToken, i, res, lang, code, err_1;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                types = ['movie', 'tv'];
                if (kind === 'sonarr') {
                    types = ['tv'];
                }
                else if (kind === 'radarr') {
                    types = ['movie'];
                }
                isToken = cfg.tmdbApiKey.length > 40;
                i = 0;
                _b.label = 1;
            case 1:
                if (!(i < types.length)) return [3 /*break*/, 6];
                _b.label = 2;
            case 2:
                _b.trys.push([2, 4, , 5]);
                return [4 /*yield*/, args.deps.axios({
                        method: 'get',
                        url: "https://api.themoviedb.org/3/".concat(types[i], "/").concat(tmdbId),
                        params: isToken ? {} : { api_key: cfg.tmdbApiKey },
                        headers: isToken
                            ? { Authorization: "Bearer ".concat(cfg.tmdbApiKey), Accept: 'application/json' }
                            : { Accept: 'application/json' },
                        timeout: requestTimeoutMs,
                    })];
            case 3:
                res = _b.sent();
                lang = (_a = res === null || res === void 0 ? void 0 : res.data) === null || _a === void 0 ? void 0 : _a.original_language;
                if (lang) {
                    code = toIso6392(lang);
                    args.jobLog("TMDB original language: ".concat(lang, " -> ").concat(code || 'not recognised', "\n"));
                    if (code) {
                        return [2 /*return*/, code];
                    }
                }
                return [3 /*break*/, 5];
            case 4:
                err_1 = _b.sent();
                args.jobLog("TMDB ".concat(types[i], " lookup failed: ").concat(err_1 === null || err_1 === void 0 ? void 0 : err_1.message, "\n"));
                return [3 /*break*/, 5];
            case 5:
                i += 1;
                return [3 /*break*/, 1];
            case 6: return [2 /*return*/, ''];
        }
    });
}); };
/** Returns the ISO 639-2/B code of the original language, or '' if it could not be found. */
var getOriginalLanguage = function (args, cfg) { return __awaiter(void 0, void 0, void 0, function () {
    var libraryPath, tmdbId, kind, arrs, i, code, err_2;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                libraryPath = ((_a = args.originalLibraryFile) === null || _a === void 0 ? void 0 : _a._id) || args.inputFileObj._id;
                tmdbId = getTmdbIdFromPath(libraryPath) || getTmdbIdFromPath(args.inputFileObj._id);
                kind = getArrKind(libraryPath);
                arrs = [];
                if (kind !== 'sonarr') {
                    cfg.radarr.forEach(function (instance, i) { return arrs.push({ kind: 'radarr', instance: instance, label: "Radarr #".concat(i + 1) }); });
                }
                if (kind !== 'radarr') {
                    cfg.sonarr.forEach(function (instance, i) { return arrs.push({ kind: 'sonarr', instance: instance, label: "Sonarr #".concat(i + 1) }); });
                }
                i = 0;
                _b.label = 1;
            case 1:
                if (!(i < arrs.length)) return [3 /*break*/, 6];
                _b.label = 2;
            case 2:
                _b.trys.push([2, 4, , 5]);
                return [4 /*yield*/, lookupArr(args, arrs[i].kind, arrs[i].instance, tmdbId, libraryPath)];
            case 3:
                code = _b.sent();
                if (code) {
                    return [2 /*return*/, code];
                }
                return [3 /*break*/, 5];
            case 4:
                err_2 = _b.sent();
                // a failing instance is treated like one that does not know the title
                args.jobLog("".concat(arrs[i].label, " lookup failed: ").concat(err_2 === null || err_2 === void 0 ? void 0 : err_2.message, "\n"));
                return [3 /*break*/, 5];
            case 5:
                i += 1;
                return [3 /*break*/, 1];
            case 6:
                if (cfg.tmdbApiKey && tmdbId) {
                    return [2 /*return*/, lookupTmdb(args, cfg, tmdbId, kind)];
                }
                if (arrs.length === 0 && !cfg.tmdbApiKey) {
                    args.jobLog('No Radarr, Sonarr or TMDB settings usable for this file, cannot look up original language\n');
                }
                else if (!tmdbId && arrs.length === 0) {
                    args.jobLog('No TMDB id found in the path, cannot look up original language\n');
                }
                return [2 /*return*/, ''];
        }
    });
}); };
var plugin = function (args) { return __awaiter(void 0, void 0, void 0, function () {
    var lib, asBool, str, streamTypes, filtered, keepForced, keepUndefined, keepSet, keepAllAudio, original, err_3, streams, decisions, audioDecisions, removedCount, removedDefaultAudio, keptAudio;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                lib = require('../../../../../methods/lib')();
                // eslint-disable-next-line @typescript-eslint/no-unused-vars,no-param-reassign
                args.inputs = lib.loadDefaultValues(args.inputs, details);
                (0, flowUtils_1.checkFfmpegCommandInit)(args);
                asBool = function (value) { return value === true || String(value).trim().toLowerCase() === 'true'; };
                str = function (value) { return String(value === undefined || value === null ? '' : value).trim(); };
                streamTypes = str(args.inputs.streamTypes);
                filtered = ['audio', 'subtitle'];
                if (streamTypes === 'audio') {
                    filtered = ['audio'];
                }
                else if (streamTypes === 'subtitle') {
                    filtered = ['subtitle'];
                }
                keepForced = asBool(args.inputs.keepForcedSubtitles);
                keepUndefined = asBool(args.inputs.keepUndefined);
                keepSet = [];
                str(args.inputs.languagesToKeep).split(',').map(function (item) { return item.trim(); }).filter(function (item) { return item.length > 0; })
                    .forEach(function (item) {
                    var code = toIso6392(item);
                    if (code) {
                        keepSet.push(matchKey(code));
                    }
                    else {
                        args.jobLog("Ignoring unrecognised language '".concat(item, "' in Languages To Keep\n"));
                    }
                });
                keepAllAudio = false;
                if (!asBool(args.inputs.keepOriginalLanguage)) return [3 /*break*/, 5];
                original = '';
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                return [4 /*yield*/, getOriginalLanguage(args, {
                        radarr: parseInstances(str(args.inputs.radarrUrl), str(args.inputs.radarrApiKey), args),
                        sonarr: parseInstances(str(args.inputs.sonarrUrl), str(args.inputs.sonarrApiKey), args),
                        tmdbApiKey: str(args.inputs.tmdbApiKey),
                    })];
            case 2:
                original = _a.sent();
                return [3 /*break*/, 4];
            case 3:
                err_3 = _a.sent();
                args.jobLog("Original language lookup failed: ".concat(err_3 === null || err_3 === void 0 ? void 0 : err_3.message, "\n"));
                return [3 /*break*/, 4];
            case 4:
                if (original) {
                    keepSet.push(matchKey(original));
                    args.jobLog("Keeping original language ".concat(original, "\n"));
                }
                else if (str(args.inputs.ifOriginalLanguageUnknown) === 'keepListOnly') {
                    args.jobLog('Original language unknown, ifOriginalLanguageUnknown=keepListOnly applied: '
                        + 'only keeping the configured languages\n');
                }
                else {
                    keepAllAudio = true;
                    args.jobLog('Original language unknown, ifOriginalLanguageUnknown=keepAllAudio applied: '
                        + 'keeping all audio streams, subtitles are still filtered\n');
                }
                _a.label = 5;
            case 5:
                streams = args.variables.ffmpegCommand.streams;
                decisions = streams
                    .filter(function (stream) { return filtered.includes(stream.codec_type) && !stream.removed; })
                    .map(function (stream) {
                    var tag = getTag(stream, 'language').trim().toLowerCase();
                    var code = toIso6392(tag);
                    var keep = true;
                    var reason = '';
                    if (keepAllAudio && stream.codec_type === 'audio') {
                        reason = 'original language unknown, all audio kept';
                    }
                    else if (undefinedTags.includes(tag)) {
                        keep = keepUndefined;
                        reason = keep ? 'undefined language kept' : 'undefined language not kept';
                    }
                    else if (stream.codec_type === 'subtitle' && keepForced && isForced(stream)) {
                        reason = 'forced subtitle kept';
                    }
                    else if (!code) {
                        reason = "unrecognised language tag '".concat(tag, "' kept");
                    }
                    else if (keepSet.includes(matchKey(code))) {
                        reason = "language ".concat(code, " is in the keep list");
                    }
                    else {
                        keep = false;
                        reason = "language ".concat(code, " is not in the keep list");
                    }
                    return {
                        stream: stream,
                        keep: keep,
                        reason: reason,
                        code: code || tag || 'und',
                    };
                });
                audioDecisions = decisions.filter(function (d) { return d.stream.codec_type === 'audio'; });
                if (audioDecisions.length > 0 && audioDecisions.every(function (d) { return !d.keep; })) {
                    args.jobLog('No audio stream matches the keep list, keeping all audio streams\n');
                    audioDecisions.forEach(function (d) {
                        // eslint-disable-next-line no-param-reassign
                        d.keep = true;
                        // eslint-disable-next-line no-param-reassign
                        d.reason = 'kept so the file still has audio';
                    });
                }
                removedCount = 0;
                decisions.forEach(function (d) {
                    args.jobLog("".concat(d.keep ? 'Keep' : 'Removing', " ").concat(d.stream.codec_type, " stream index ").concat(d.stream.index)
                        + " (".concat(d.code, "): ").concat(d.reason, "\n"));
                    if (!d.keep) {
                        // eslint-disable-next-line no-param-reassign
                        d.stream.removed = true;
                        removedCount += 1;
                    }
                });
                removedDefaultAudio = decisions.some(function (d) {
                    var _a;
                    return d.stream.codec_type === 'audio' && !d.keep
                        && Number((_a = d.stream.disposition) === null || _a === void 0 ? void 0 : _a.default) === 1;
                });
                keptAudio = streams.filter(function (stream) { return stream.codec_type === 'audio' && !stream.removed; });
                if (removedDefaultAudio && keptAudio.length > 0
                    && !keptAudio.some(function (stream) { var _a; return Number((_a = stream.disposition) === null || _a === void 0 ? void 0 : _a.default) === 1; })) {
                    args.jobLog("Default audio stream was removed, setting audio stream index ".concat(keptAudio[0].index, " as default\n"));
                    // {outputTypeIndex} is replaced with the audio index in the output file by the Execute plugin
                    keptAudio[0].outputArgs.push('-disposition:a:{outputTypeIndex}', 'default');
                }
                if (removedCount === 0) {
                    args.jobLog('Nothing to remove\n');
                }
                return [2 /*return*/, {
                        outputFileObj: args.inputFileObj,
                        outputNumber: removedCount > 0 ? 1 : 2,
                        variables: args.variables,
                    }];
        }
    });
}); };
exports.plugin = plugin;
