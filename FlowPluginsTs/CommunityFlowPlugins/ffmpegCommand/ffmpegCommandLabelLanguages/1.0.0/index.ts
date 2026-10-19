import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { checkFfmpegCommandInit } from '../../../../FlowHelpers/1.0.0/interfaces/flowUtils';
import {
  IffmpegCommandStream,
  IpluginDetails,
  IpluginInputArgs,
  IpluginOutputArgs,
} from '../../../../FlowHelpers/1.0.0/interfaces/interfaces';

/* eslint no-plusplus: ["error", { "allowForLoopAfterthoughts": true }] */

const showWhen = (name: string) => ({
  logic: 'AND' as const,
  sets: [{
    logic: 'AND' as const,
    inputs: [{ name, value: 'true', condition: '===' as const }],
  }],
});

const showWhenOpenAiAudio = {
  logic: 'AND' as const,
  sets: [{
    logic: 'AND' as const,
    inputs: [
      { name: 'labelAudio', value: 'true', condition: '===' as const },
      { name: 'audioApiStyle', value: 'openai', condition: '===' as const },
    ],
  }],
};

const showWhenSubtitles = {
  logic: 'OR' as const,
  sets: [
    {
      logic: 'AND' as const,
      inputs: [{ name: 'labelPictureSubtitles', value: 'true', condition: '===' as const }],
    },
    {
      logic: 'AND' as const,
      inputs: [{ name: 'labelTextSubtitles', value: 'true', condition: '===' as const }],
    },
  ],
};

const details = (): IpluginDetails => ({
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
      tooltip: `
      openai: an OpenAI compatible POST /v1/audio/transcriptions endpoint
      (OpenAI, Groq, speaches, faster-whisper-server...). verbose_json is requested to get the language.

      whisperAsrWebservice: the POST /detect-language endpoint of whisper-asr-webservice,
      which also returns a confidence.
      `,
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
      tooltip: `
      Base URL of the speech-to-text service. The endpoint path is added when missing,
      a full endpoint URL is also accepted. Leave empty to skip audio.

      Example:
      https://api.openai.com
      https://api.groq.com/openai/v1
      http://192.168.1.10:8000
      http://192.168.1.10:9000 (whisper-asr-webservice)
      `,
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
      tooltip: `
      Model name sent to the OpenAI compatible endpoint.

      Example:
      whisper-1
      whisper-large-v3-turbo
      Systran/faster-whisper-small
      `,
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
      tooltip: `
      Optional. Sent as a Bearer token. A flow variable can be used to avoid typing the key here.

      Example:
      {{{args.userVariables.global.openaiApiKey}}}
      `,
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
      tooltip: `
      Between 0 and 1. A clip whose reported confidence is below this does not vote.
      Only used when the API returns a confidence (whisper-asr-webservice does, and some OpenAI compatible
      servers return language_probability; OpenAI itself does not).
      `,
    },
    {
      label: 'Label Picture Subtitles',
      name: 'labelPictureSubtitles',
      type: 'boolean',
      defaultValue: 'true',
      inputUI: {
        type: 'switch',
      },
      tooltip: `
      Find the language of untagged PGS, VobSub and DVB subtitles. Subtitle frames are rendered,
      cropped to the text and sent to a vision model. This is the slowest part (one model call per frame).
      `,
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
      tooltip: `
      Base URL of an OpenAI compatible chat completions service (POST /v1/chat/completions).
      The endpoint path is added when missing, a full endpoint URL is also accepted.
      Picture subtitles need a model that accepts images. Leave empty to skip subtitles.

      Example:
      https://api.openai.com
      http://192.168.1.10:8080 (llama.cpp server)
      http://192.168.1.10:11434 (Ollama)
      `,
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
      tooltip: `
      Model name sent to the chat endpoint. Can be left empty for servers that serve a single model
      (llama.cpp).

      Example:
      gpt-4o-mini
      qwen2.5vl:3b
      `,
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
      tooltip: `
      Optional. Sent as a Bearer token. A flow variable can be used to avoid typing the key here.

      Example:
      {{{args.userVariables.global.openaiApiKey}}}
      `,
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
      tooltip: `
      A language is only written when at least this many samples agree on it (capped at the sample count)
      and it has more than half of the answered samples. Otherwise the stream stays und.
      `,
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
});

// [iso639-2/B, iso639-2/T, iso639-1, English names separated by |]
const languageRows: string[][] = [
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
const languageExtras: Record<string, string> = {
  nob: 'nor',
  nno: 'nor',
  nb: 'nor',
  nn: 'nor',
  iw: 'heb',
  ji: 'yid',
  jw: 'jav',
};

const languageLookup: Record<string, string> = {};
languageRows.forEach((row) => {
  const [b, t, a2, names] = row;
  languageLookup[b] = b;
  languageLookup[t] = b;
  if (a2) {
    languageLookup[a2] = b;
  }
  names.split('|').forEach((name) => {
    languageLookup[name.toLowerCase()] = b;
  });
});
Object.keys(languageExtras).forEach((key) => {
  languageLookup[key] = languageExtras[key];
});

/**
 * Convert an ISO 639-1, 639-2/B, 639-2/T code or an English language name
 * (e.g. "Portuguese (Brazil)", "en-US") to the ISO 639-2/B code. Returns '' if unknown.
 */
const toIso6392 = (value: unknown): string => {
  const raw = String(value === undefined || value === null ? '' : value).trim().toLowerCase();
  if (!raw) {
    return '';
  }
  const stripped = raw.replace(/\s*\(.*\)\s*$/, '').trim();
  return languageLookup[raw] || languageLookup[stripped] || languageLookup[stripped.split(/[-_]/)[0]] || '';
};

// 3 letter language codes that are also common English words, ignored inside a sentence
const ambiguousWords = ['and', 'are', 'bel', 'can', 'est', 'fil', 'hat', 'ice', 'kan', 'lat', 'mal', 'mar',
  'may', 'pan', 'per', 'san', 'som', 'sun', 'tam', 'tat', 'the', 'tur'];

/**
 * Read the language out of a model answer. A one word answer may be any code or name.
 * In a longer answer only English names and unambiguous 3 letter codes count, and the answer
 * must name exactly one language. Returns '' when unknown or unsure.
 */
const parseModelAnswer = (answer: string): string => {
  const text = String(answer || '').replace(/<think>[\s\S]*?<\/think>/gi, '').toLowerCase();
  const tokens: string[] = text.match(/[a-z]+/g) || [];
  if (tokens.length === 0 || tokens.includes('und')) {
    return '';
  }
  if (tokens.length === 1) {
    return toIso6392(tokens[0]);
  }
  const found: string[] = [];
  tokens.forEach((token, i) => {
    let code = '';
    if (token.length > 3) {
      // two word names such as "haitian creole"
      code = toIso6392(`${token} ${tokens[i + 1] || ''}`) || toIso6392(token);
    } else if (token.length === 3 && !ambiguousWords.includes(token)) {
      code = toIso6392(token);
    }
    if (code && !found.includes(code)) {
      found.push(code);
    }
  });
  return found.length === 1 ? found[0] : '';
};

interface IvoteResult {
  lang: string,
  votes: number,
  total: number,
  counts: Record<string, number>,
}

/**
 * The winner needs more than half of the answered votes and at least minAgreement votes
 * (capped at the number of samples taken). Ties never win.
 */
const tallyVotes = (votes: string[], minAgreement: number, sampleCount: number): IvoteResult => {
  const counts: Record<string, number> = {};
  votes.filter((vote) => vote).forEach((vote) => {
    counts[vote] = (counts[vote] || 0) + 1;
  });
  const total = Object.keys(counts).reduce((sum, key) => sum + counts[key], 0);
  let best = '';
  let bestVotes = 0;
  let tie = false;
  Object.keys(counts).forEach((key) => {
    if (counts[key] > bestVotes) {
      best = key;
      bestVotes = counts[key];
      tie = false;
    } else if (counts[key] === bestVotes) {
      tie = true;
    }
  });
  const needed = Math.max(1, Math.min(minAgreement, sampleCount));
  const lang = best && !tie && bestVotes >= needed && bestVotes * 2 > total ? best : '';
  return {
    lang, votes: bestVotes, total, counts,
  };
};

/** Positions (seconds) of n windows of length len spread evenly across the runtime. */
const spreadPositions = (duration: number, n: number, len: number): number[] => {
  const positions: number[] = [];
  for (let i = 0; i < n; i++) {
    const pos = (duration * (i + 1)) / (n + 1) - len / 2;
    positions.push(Math.max(0, Math.round(pos * 100) / 100));
  }
  return positions;
};

/** Add the endpoint path to a base URL unless the URL already ends with it. */
const buildEndpointUrl = (baseUrl: string, endpointPath: string): string => {
  const base = baseUrl.trim().replace(/\/+$/, '');
  const withoutV1 = endpointPath.replace(/^\/v1/, '');
  if (base.endsWith(withoutV1)) {
    return base;
  }
  if (/\/v1$/.test(base) && endpointPath.startsWith('/v1/')) {
    return `${base}${withoutV1}`;
  }
  return `${base}${endpointPath}`;
};

/** Error from an API call. down is true when the service should not be called again for this file. */
class ApiError extends Error {
  down: boolean;

  constructor(message: string, down: boolean) {
    super(message);
    this.down = down;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

const downStatuses = [401, 403, 404, 405, 408, 429];

const toApiError = (err: unknown, name: string): ApiError => {
  const e = err as { response?: { status?: number }, code?: string, message?: string };
  const status = e?.response?.status;
  if (!status) {
    return new ApiError(`${name} unreachable: ${e?.code || ''} ${e?.message || ''}`.trim(), true);
  }
  return new ApiError(`${name} returned HTTP ${status}`, status >= 500 || downStatuses.includes(status));
};

const authHeaders = (apiKey: string): Record<string, string> => (apiKey ? { Authorization: `Bearer ${apiKey}` } : {});

/** multipart/form-data body built by hand so it works with any axios version. */
const buildMultipart = (
  fields: Record<string, string>,
  file: { field: string, name: string, type: string, data: Buffer },
): { body: Buffer, contentType: string } => {
  const boundary = `----TdarrLabelLanguages${crypto.randomBytes(12).toString('hex')}`;
  const parts: Buffer[] = [];
  Object.keys(fields).forEach((key) => {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n`
      + `${fields[key]}\r\n`));
  });
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${file.field}"; `
    + `filename="${file.name}"\r\nContent-Type: ${file.type}\r\n\r\n`));
  parts.push(file.data);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  return { body: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` };
};

interface Iconfig {
  labelAudio: boolean,
  audioApiStyle: string,
  audioApiUrl: string,
  audioModel: string,
  audioApiKey: string,
  audioSampleCount: number,
  audioSampleSeconds: number,
  audioMinConfidence: number,
  labelPictureSubtitles: boolean,
  labelTextSubtitles: boolean,
  chatApiUrl: string,
  chatModel: string,
  chatApiKey: string,
  subtitleSampleCount: number,
  subtitleImageMaxWidth: number,
  minAgreement: number,
  requestTimeoutMs: number,
  ffprobePath: string,
}

interface IcommandResult {
  code: number,
  stdout: Buffer,
  stderr: string,
}

interface Icontext {
  args: IpluginInputArgs,
  cfg: Iconfig,
  file: string,
  tmpDir: string,
  duration: number,
  ffmpeg: string,
  ffprobe: string,
  log: (text: string) => void,
}

const commandTimeoutMs = 300000;

/** Run a command and collect its output. Never throws, a failure gives a non zero code. */
const runCommand = (cmd: string, cmdArgs: string[], timeoutMs = commandTimeoutMs): Promise<IcommandResult> => (
  new Promise((resolve) => {
    const out: Buffer[] = [];
    let err = '';
    let done = false;
    let timer: NodeJS.Timeout | undefined;
    const finish = (code: number) => {
      if (done) {
        return;
      }
      done = true;
      if (timer) {
        clearTimeout(timer);
      }
      resolve({ code, stdout: Buffer.concat(out), stderr: err });
    };
    try {
      const child = spawn(cmd, cmdArgs, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
      child.stdout?.on('data', (data: Buffer) => out.push(data));
      child.stderr?.on('data', (data: Buffer) => {
        err = `${err}${data.toString()}`.slice(-2000);
      });
      child.on('error', (e: Error) => {
        err += String(e);
        finish(-1);
      });
      child.on('close', (code: number | null) => finish(code === null ? -1 : code));
      timer = setTimeout(() => {
        child.kill('SIGKILL');
        err += `timed out after ${timeoutMs / 1000}s`;
        finish(-2);
      }, timeoutMs);
    } catch (e) {
      err = String(e);
      finish(-1);
    }
  })
);

const removeFile = (filePath: string): void => {
  try {
    fs.unlinkSync(filePath);
  } catch {
    // already gone
  }
};

const fileSize = (filePath: string): number => {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
};

const getTag = (stream: IffmpegCommandStream, name: string): string => {
  const tags = (stream.tags || {}) as Record<string, unknown>;
  const key = Object.keys(tags).find((k) => k.toLowerCase() === name);
  return key === undefined ? '' : String(tags[key] ?? '');
};

const unknownLanguageTags = ['', 'und', 'unk', 'unknown', 'undetermined'];

const pictureSubtitleCodecs = ['hdmv_pgs_subtitle', 'pgssub', 'dvd_subtitle', 'dvdsub', 'dvb_subtitle',
  'dvbsub', 'xsub'];
const textSubtitleCodecs = ['subrip', 'srt', 'ass', 'ssa', 'webvtt', 'mov_text', 'text', 'subviewer',
  'microdvd'];

const getFfprobePath = (ffmpegPath: string, override: string): string => {
  if (override) {
    return override;
  }
  const dir = path.dirname(ffmpegPath);
  const base = path.basename(ffmpegPath);
  if (/ffmpeg/i.test(base)) {
    const candidate = path.join(dir, base.replace(/ffmpeg/i, 'ffprobe'));
    if (dir !== '.' && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return 'ffprobe';
};

// ---------- audio ----------

interface IaudioAnswer {
  lang: string,
  raw: string,
  confidence: number | null,
}

const detectAudioLanguage = async (ctx: Icontext, wav: Buffer): Promise<IaudioAnswer> => {
  const { cfg, args } = ctx;
  const whisperAsr = cfg.audioApiStyle === 'whisperAsrWebservice';
  const url = whisperAsr
    ? `${buildEndpointUrl(cfg.audioApiUrl, '/detect-language')}?encode=true`
    : buildEndpointUrl(cfg.audioApiUrl, '/v1/audio/transcriptions');
  const fields: Record<string, string> = whisperAsr ? {} : {
    model: cfg.audioModel,
    response_format: 'verbose_json',
  };
  const multipart = buildMultipart(fields, {
    field: whisperAsr ? 'audio_file' : 'file', name: 'sample.wav', type: 'audio/wav', data: wav,
  });

  let data: Record<string, unknown>;
  try {
    const res = await args.deps.axios({
      method: 'post',
      url,
      data: multipart.body,
      headers: {
        'Content-Type': multipart.contentType,
        Accept: 'application/json',
        ...authHeaders(cfg.audioApiKey),
      },
      timeout: cfg.requestTimeoutMs,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    data = (res?.data || {}) as Record<string, unknown>;
  } catch (err) {
    const apiError = toApiError(err, 'Audio API');
    if (apiError.down) {
      throw apiError;
    }
    // a rejected sample (e.g. HTTP 400) only loses its vote
    return { lang: '', raw: apiError.message, confidence: null };
  }

  const raw = String(data.language_code || data.detected_language || data.language || '');
  let confidence: number | null = null;
  if (typeof data.confidence === 'number') {
    confidence = data.confidence;
  } else if (typeof data.language_probability === 'number') {
    confidence = data.language_probability;
  }
  return { lang: toIso6392(raw), raw, confidence };
};

const identifyAudio = async (ctx: Icontext, stream: IffmpegCommandStream): Promise<string> => {
  const { cfg, log } = ctx;
  const count = cfg.audioSampleCount;
  let len = cfg.audioSampleSeconds;
  if (ctx.duration < count * len) {
    len = Math.floor(ctx.duration / count);
  }
  if (len < 5) {
    log(`  Audio stream ${stream.index}: file too short to sample, stays und\n`);
    return '';
  }

  const votes: string[] = [];
  const positions = spreadPositions(ctx.duration, count, len);
  for (let i = 0; i < positions.length; i++) {
    const wavPath = path.join(ctx.tmpDir, `audio_${stream.index}_${i}.wav`);
    // eslint-disable-next-line no-await-in-loop
    const cut = await runCommand(ctx.ffmpeg, ['-hide_banner', '-v', 'error', '-y', '-ss', String(positions[i]),
      '-t', String(len), '-i', ctx.file, '-map', `0:${stream.index}`, '-vn', '-sn', '-dn',
      '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wavPath]);
    if (cut.code !== 0 || fileSize(wavPath) < 8000) {
      log(`  Audio stream ${stream.index} sample ${i + 1} at ${positions[i]}s: could not cut a clip `
        + `${cut.stderr.trim().slice(-200)}\n`);
      removeFile(wavPath);
    } else {
      const wav = fs.readFileSync(wavPath);
      removeFile(wavPath);
      // eslint-disable-next-line no-await-in-loop
      const answer = await detectAudioLanguage(ctx, wav);
      const confText = answer.confidence === null ? '' : ` (confidence ${answer.confidence.toFixed(2)})`;
      if (!answer.lang) {
        log(`  Audio stream ${stream.index} sample ${i + 1} at ${positions[i]}s: '${answer.raw}' not recognised\n`);
      } else if (answer.confidence !== null && answer.confidence < cfg.audioMinConfidence) {
        log(`  Audio stream ${stream.index} sample ${i + 1} at ${positions[i]}s: ${answer.lang}${confText} `
          + `below minimum confidence ${cfg.audioMinConfidence}, ignored\n`);
      } else {
        log(`  Audio stream ${stream.index} sample ${i + 1} at ${positions[i]}s: ${answer.lang}${confText}\n`);
        votes.push(answer.lang);
      }
    }
  }

  const result = tallyVotes(votes, cfg.minAgreement, count);
  if (!result.lang) {
    log(`  Audio stream ${stream.index}: no agreement ${JSON.stringify(result.counts)}, stays und\n`);
    return '';
  }
  log(`  Audio stream ${stream.index}: ${result.lang} (${result.votes} of ${count} samples)\n`);
  return result.lang;
};

// ---------- chat completions ----------

const askChat = async (
  ctx: Icontext,
  prompt: string,
  imageDataUri?: string,
): Promise<{ lang: string, raw: string }> => {
  const { cfg, args } = ctx;
  const content: Record<string, unknown>[] = [];
  if (imageDataUri) {
    content.push({ type: 'image_url', image_url: { url: imageDataUri } });
  }
  content.push({ type: 'text', text: prompt });
  const body: Record<string, unknown> = {
    temperature: 0,
    max_tokens: 32,
    messages: [{ role: 'user', content }],
  };
  if (cfg.chatModel) {
    body.model = cfg.chatModel;
  }

  let data: { choices?: { message?: { content?: unknown } }[] };
  try {
    const res = await args.deps.axios({
      method: 'post',
      url: buildEndpointUrl(cfg.chatApiUrl, '/v1/chat/completions'),
      data: body,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...authHeaders(cfg.chatApiKey),
      },
      timeout: cfg.requestTimeoutMs,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    data = res?.data || {};
  } catch (err) {
    const apiError = toApiError(err, 'Chat API');
    if (apiError.down) {
      throw apiError;
    }
    // a rejected sample (e.g. HTTP 400) only loses its vote
    return { lang: '', raw: apiError.message };
  }
  const raw = String(data?.choices?.[0]?.message?.content ?? '').trim();
  return { lang: parseModelAnswer(raw), raw };
};

const imagePrompt = 'The image shows subtitle text from a film on a dark background. '
  + 'What language is the text written in? Answer with only the ISO 639-2 three-letter code '
  + '(for example eng, fre, spa, ger, jpn, chi, kor, rus). If no text is readable, answer und.';

const textPrompt = (lines: string): string => `Subtitle lines from a film:\n${lines}\n\n`
  // ask for the name, not a code, with no 'und' escape: a 2B model otherwise answers und for clear English text
  + 'What language are these lines written in? Answer with only the language name in English, one word.';

// ---------- picture subtitles ----------

const findSubtitleTimes = async (ctx: Icontext, stream: IffmpegCommandStream, count: number): Promise<number[]> => {
  const windowLength = Math.max(60, Math.min(300, ctx.duration / (count + 1)));
  const times: number[] = [];
  const starts = spreadPositions(ctx.duration, count, 0);
  for (let i = 0; i < starts.length; i++) {
    // eslint-disable-next-line no-await-in-loop
    const res = await runCommand(ctx.ffprobe, ['-v', 'error', '-select_streams', String(stream.index),
      '-read_intervals', `${starts[i]}%+${Math.round(windowLength)}`, '-show_entries', 'packet=pts_time,size',
      '-of', 'csv=p=0', ctx.file]);
    if (res.code !== 0) {
      ctx.log(`  Subtitle stream ${stream.index}: ffprobe failed ${res.stderr.trim().slice(-200)}\n`);
    } else {
      // the first packet with real content; tiny packets only clear the screen
      const time = res.stdout.toString().split(/\r?\n/)
        .map((line) => line.split(','))
        .filter((parts) => parts.length >= 2 && parseInt(parts[1], 10) > 400)
        .map((parts) => parseFloat(parts[0]))
        .find((t) => !Number.isNaN(t) && t >= starts[i]);
      if (time !== undefined && !times.includes(time)) {
        times.push(time);
      }
    }
  }
  return times;
};

const even = (n: number): number => Math.max(2, Math.round(n / 2) * 2);

/** Bounding box of the pixels brighter than threshold in an 8 bit gray frame, or null when blank. */
const findTextBox = (
  gray: Buffer,
  width: number,
  height: number,
  threshold = 48,
): { x: number, y: number, w: number, h: number } | null => {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let lit = 0;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (gray[row + x] > threshold) {
        lit += 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (lit < 50) {
    return null;
  }
  const pad = 12;
  const x = Math.max(0, minX - pad);
  const y = Math.max(0, minY - pad);
  const w = Math.min(width - x, maxX - minX + 1 + 2 * pad);
  const h = Math.min(height - y, maxY - minY + 1 + 2 * pad);
  return {
    x, y, w: Math.max(2, w - (w % 2)), h: Math.max(2, h - (h % 2)),
  };
};

const getCanvasSize = (ctx: Icontext, stream: IffmpegCommandStream): { w: number, h: number } => {
  if (Number(stream.width) > 0 && Number(stream.height) > 0) {
    return { w: Number(stream.width), h: Number(stream.height) };
  }
  const video = ctx.args.variables.ffmpegCommand.streams.find((s) => s.codec_type === 'video'
    && Number(s.width) > 0 && Number(s.height) > 0);
  return video ? { w: Number(video.width), h: Number(video.height) } : { w: 1920, h: 1080 };
};

/** Render the subtitle at the given time over black, crop it to the text and return a PNG data URI. */
const renderSubtitleImage = async (
  ctx: Icontext,
  stream: IffmpegCommandStream,
  time: number,
  sample: number,
): Promise<string> => {
  const canvas = getCanvasSize(ctx, stream);
  const renderW = even(Math.min(1280, canvas.w));
  const renderH = even((canvas.h * renderW) / canvas.w);
  const seek = Math.max(0, time - 0.3);
  const offset = time - seek + 0.15;
  const framePath = path.join(ctx.tmpDir, `subtitle_${stream.index}_${sample}.png`);
  const filter = `[0:v:0]scale=${canvas.w}:${canvas.h},drawbox=x=0:y=0:w=iw:h=ih:color=black:t=fill[bg];`
    + `[bg][0:${stream.index}]overlay,select=gte(t\\,${offset.toFixed(2)}),scale=${renderW}:${renderH},`
    + 'split[png][raw]';
  const render = await runCommand(ctx.ffmpeg, ['-hide_banner', '-v', 'error', '-y', '-ss', seek.toFixed(2),
    '-t', '1.5', '-i', ctx.file, '-filter_complex', filter,
    '-map', '[png]', '-frames:v', '1', framePath,
    '-map', '[raw]', '-frames:v', '1', '-pix_fmt', 'gray', '-f', 'rawvideo', 'pipe:1']);
  if (render.code !== 0 || fileSize(framePath) === 0) {
    removeFile(framePath);
    throw new Error(`render failed ${render.stderr.trim().slice(-200)}`);
  }

  try {
    let png: Buffer;
    if (render.stdout.length === renderW * renderH) {
      const box = findTextBox(render.stdout, renderW, renderH);
      if (!box) {
        return '';
      }
      const outW = even(Math.min(box.w, ctx.cfg.subtitleImageMaxWidth));
      const outH = even((box.h * outW) / box.w);
      const crop = await runCommand(ctx.ffmpeg, ['-hide_banner', '-v', 'error', '-i', framePath,
        '-vf', `crop=${box.w}:${box.h}:${box.x}:${box.y},scale=${outW}:${outH}`,
        '-frames:v', '1', '-c:v', 'png', '-f', 'image2pipe', 'pipe:1']);
      if (crop.code !== 0 || crop.stdout.length === 0) {
        throw new Error(`crop failed ${crop.stderr.trim().slice(-200)}`);
      }
      png = crop.stdout;
    } else {
      // unexpected frame size, send the whole frame
      png = fs.readFileSync(framePath);
    }
    return `data:image/png;base64,${png.toString('base64')}`;
  } finally {
    removeFile(framePath);
  }
};

const identifyPictureSubtitle = async (ctx: Icontext, stream: IffmpegCommandStream): Promise<string> => {
  const { cfg, log } = ctx;
  if (!ctx.args.variables.ffmpegCommand.streams.some((s) => s.codec_type === 'video')) {
    log(`  Subtitle stream ${stream.index}: no video stream to render on, stays und\n`);
    return '';
  }
  const times = await findSubtitleTimes(ctx, stream, cfg.subtitleSampleCount);
  if (times.length === 0) {
    log(`  Subtitle stream ${stream.index}: no subtitle packets found, stays und\n`);
    return '';
  }
  const votes: string[] = [];
  for (let i = 0; i < times.length; i++) {
    const at = `${times[i].toFixed(1)}s`;
    let image = '';
    try {
      // eslint-disable-next-line no-await-in-loop
      image = await renderSubtitleImage(ctx, stream, times[i], i);
    } catch (err) {
      log(`  Subtitle stream ${stream.index} frame ${i + 1} at ${at}: ${(err as Error).message}\n`);
    }
    if (!image) {
      log(`  Subtitle stream ${stream.index} frame ${i + 1} at ${at}: no text rendered\n`);
    } else {
      // eslint-disable-next-line no-await-in-loop
      const answer = await askChat(ctx, imagePrompt, image);
      log(`  Subtitle stream ${stream.index} frame ${i + 1} at ${at}: model said '${answer.raw.slice(0, 60)}'`
        + ` -> ${answer.lang || 'und'}\n`);
      votes.push(answer.lang);
    }
  }
  const result = tallyVotes(votes, cfg.minAgreement, cfg.subtitleSampleCount);
  if (!result.lang) {
    log(`  Subtitle stream ${stream.index}: no agreement ${JSON.stringify(result.counts)}, stays und\n`);
    return '';
  }
  log(`  Subtitle stream ${stream.index}: ${result.lang} (${result.votes} of ${times.length} frames)\n`);
  return result.lang;
};

// ---------- text subtitles ----------

/** Dialogue lines from SRT text, without numbers, timings and formatting tags. */
const cleanSubtitleLines = (srt: string): string[] => srt.split(/\r?\n/)
  .map((line) => line.replace(/<[^>]+>/g, '').replace(/\{[^}]*\}/g, '').replace(/\\N/gi, ' ')
    .trim())
  .filter((line) => line.length >= 4 && !/^\d+$/.test(line) && !line.includes('-->'));

const identifyTextSubtitle = async (ctx: Icontext, stream: IffmpegCommandStream): Promise<string> => {
  const { cfg, log } = ctx;
  const count = cfg.subtitleSampleCount;
  const starts = spreadPositions(ctx.duration, count, 0);
  const votes: string[] = [];
  const seen: string[] = [];
  for (let i = 0; i < starts.length; i++) {
    // eslint-disable-next-line no-await-in-loop
    const res = await runCommand(ctx.ffmpeg, ['-hide_banner', '-v', 'error', '-ss', String(starts[i]),
      '-t', '300', '-i', ctx.file, '-map', `0:${stream.index}`, '-f', 'srt', 'pipe:1']);
    const lines = res.code === 0 ? cleanSubtitleLines(res.stdout.toString('utf8')) : [];
    const sample = lines.slice(0, 10).join('\n').slice(0, 1000);
    if (lines.length < 3 || seen.includes(sample)) {
      log(`  Subtitle stream ${stream.index} sample ${i + 1} at ${starts[i]}s: not enough new text\n`);
    } else {
      seen.push(sample);
      // eslint-disable-next-line no-await-in-loop
      const answer = await askChat(ctx, textPrompt(sample));
      log(`  Subtitle stream ${stream.index} sample ${i + 1} at ${starts[i]}s: model said `
        + `'${answer.raw.slice(0, 60)}' -> ${answer.lang || 'und'}\n`);
      votes.push(answer.lang);
    }
  }
  const result = tallyVotes(votes, cfg.minAgreement, count);
  if (!result.lang) {
    log(`  Subtitle stream ${stream.index}: no agreement ${JSON.stringify(result.counts)}, stays und\n`);
    return '';
  }
  log(`  Subtitle stream ${stream.index}: ${result.lang} (${result.votes} of ${result.total} samples)\n`);
  return result.lang;
};

// ---------- plugin ----------

const getDuration = (args: IpluginInputArgs): number => {
  const fromProbe = Number(args.inputFileObj?.ffProbeData?.format?.duration);
  if (fromProbe > 0) {
    return fromProbe;
  }
  const fromMeta = Number(args.inputFileObj?.meta?.Duration);
  return fromMeta > 0 ? fromMeta : 0;
};

const plugin = async (args: IpluginInputArgs): Promise<IpluginOutputArgs> => {
  const lib = require('../../../../../methods/lib')();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars,no-param-reassign
  args.inputs = lib.loadDefaultValues(args.inputs, details);

  checkFfmpegCommandInit(args);

  const asBool = (value: unknown): boolean => value === true || String(value).trim().toLowerCase() === 'true';
  const str = (value: unknown): string => String(value === undefined || value === null ? '' : value).trim();
  const num = (value: unknown, fallback: number, min: number): number => {
    const n = Number(value);
    return Number.isFinite(n) && n >= min ? n : fallback;
  };

  const ffmpegPath = args.ffmpegPath || 'ffmpeg';
  const cfg: Iconfig = {
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

  const log = (text: string) => args.jobLog(text);
  const result: IpluginOutputArgs = {
    outputFileObj: args.inputFileObj,
    outputNumber: 2,
    variables: args.variables,
  };

  type Ikind = 'audio' | 'picture' | 'text';
  const candidates: { stream: IffmpegCommandStream, kind: Ikind }[] = [];
  args.variables.ffmpegCommand.streams
    .filter((stream) => !stream.removed && ['audio', 'subtitle'].includes(stream.codec_type)
      && unknownLanguageTags.includes(getTag(stream, 'language').trim().toLowerCase()))
    .forEach((stream) => {
      const codec = String(stream.codec_name || '').toLowerCase();
      if (stream.codec_type === 'audio') {
        if (!cfg.labelAudio) {
          return;
        }
        if (!cfg.audioApiUrl) {
          log(`Audio stream ${stream.index} has no language but Audio API URL is empty, skipping\n`);
          return;
        }
        candidates.push({ stream, kind: 'audio' });
        return;
      }
      const kind: Ikind | '' = (pictureSubtitleCodecs.includes(codec) && 'picture')
        || (textSubtitleCodecs.includes(codec) && 'text') || '';
      if (!kind) {
        log(`Subtitle stream ${stream.index} has no language but codec ${codec} is not supported, skipping\n`);
      } else if ((kind === 'picture' && cfg.labelPictureSubtitles) || (kind === 'text' && cfg.labelTextSubtitles)) {
        if (cfg.chatApiUrl) {
          candidates.push({ stream, kind });
        } else {
          log(`Subtitle stream ${stream.index} has no language but Chat API URL is empty, skipping\n`);
        }
      }
    });

  if (candidates.length === 0) {
    log('Nothing to label\n');
    return result;
  }

  const duration = getDuration(args);
  if (!duration) {
    log('File duration unknown, cannot take samples, nothing labelled\n');
    return result;
  }

  let tmpDir = '';
  const down = { audio: false, chat: false };
  let labelled = 0;
  try {
    tmpDir = fs.mkdtempSync(path.join(args.workDir || os.tmpdir(), 'labelLanguages-'));
    const ctx: Icontext = {
      args,
      cfg,
      file: args.inputFileObj._id,
      tmpDir,
      duration,
      ffmpeg: ffmpegPath,
      ffprobe: cfg.ffprobePath,
      log,
    };

    for (let i = 0; i < candidates.length; i++) {
      const { stream, kind } = candidates[i];
      const service: 'audio' | 'chat' = kind === 'audio' ? 'audio' : 'chat';
      log(`${stream.codec_type === 'audio' ? 'Audio' : 'Subtitle'} stream ${stream.index} (${stream.codec_name}`
        + `${getTag(stream, 'title') ? `, '${getTag(stream, 'title')}'` : ''}) has no language\n`);
      let lang = '';
      if (down[service]) {
        log(`  ${service === 'audio' ? 'Audio' : 'Chat'} API unreachable earlier, stays und\n`);
      } else {
        try {
          if (kind === 'audio') {
            // eslint-disable-next-line no-await-in-loop
            lang = await identifyAudio(ctx, stream);
          } else if (kind === 'picture') {
            // eslint-disable-next-line no-await-in-loop
            lang = await identifyPictureSubtitle(ctx, stream);
          } else {
            // eslint-disable-next-line no-await-in-loop
            lang = await identifyTextSubtitle(ctx, stream);
          }
        } catch (err) {
          lang = '';
          if (err instanceof ApiError && err.down) {
            down[service] = true;
            log(`  ${err.message}; leaving this and later ${service === 'audio' ? 'audio' : 'subtitle'} `
              + 'streams und and continuing\n');
          } else {
            log(`  Error while identifying stream ${stream.index}: ${(err as Error)?.message}; stays und\n`);
          }
        }
      }

      if (lang) {
        const tags = (stream.tags || {}) as Record<string, string>;
        const key = Object.keys(tags).find((k) => k.toLowerCase() === 'language') || 'language';
        tags[key] = lang;
        // eslint-disable-next-line no-param-reassign
        stream.tags = tags;
        // {outputIndex} is replaced with the stream index in the output file by the Execute plugin
        stream.outputArgs.push('-metadata:s:{outputIndex}', `language=${lang}`);
        labelled += 1;
        log(`  Labelling stream ${stream.index} as ${lang}\n`);
      }
    }
  } catch (err) {
    // labelling is best effort, never fail the file
    log(`Label Languages: unexpected error, continuing: ${(err as Error)?.message}\n`);
  } finally {
    if (tmpDir) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  }

  if (labelled > 0) {
    // eslint-disable-next-line no-param-reassign
    args.variables.ffmpegCommand.shouldProcess = true;
    result.outputNumber = 1;
    log(`Labelled ${labelled} stream(s), use the Execute plugin to write the tags\n`);
  } else {
    log('No language could be identified, nothing labelled\n');
  }
  return result;
};

export {
  details,
  plugin,
  toIso6392,
  parseModelAnswer,
  tallyVotes,
  buildEndpointUrl,
  findTextBox,
};
