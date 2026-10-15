import { checkFfmpegCommandInit } from '../../../../FlowHelpers/1.0.0/interfaces/flowUtils';
import {
  IffmpegCommandStream,
  IpluginDetails,
  IpluginInputArgs,
  IpluginOutputArgs,
} from '../../../../FlowHelpers/1.0.0/interfaces/interfaces';

/* eslint no-plusplus: ["error", { "allowForLoopAfterthoughts": true }] */

const originalLanguageDisplayConditions = {
  logic: 'AND' as const,
  sets: [
    {
      logic: 'AND' as const,
      inputs: [
        {
          name: 'keepOriginalLanguage',
          value: 'true',
          condition: '===' as const,
        },
      ],
    },
  ],
};

const details = (): IpluginDetails => ({
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
      tooltip: `
      Comma separated list of languages to keep, as ISO 639-2 codes. ISO 639-1 codes and English
      language names are also understood, and equivalent codes are treated as the same language
      (fre and fra, ger and deu, chi and zho...).

      Example:
      eng,spa,jpn
      `,
    },
    {
      label: 'Keep Original Language',
      name: 'keepOriginalLanguage',
      type: 'boolean',
      defaultValue: 'false',
      inputUI: {
        type: 'switch',
      },
      tooltip: `
      Also keep the original language of the movie or series.

      The original language is looked up using the Radarr, Sonarr and/or TMDB settings below.
      All of them are optional. If none is set, or the lookup fails, only the languages in
      "Languages To Keep" (plus the other keep options) are used.

      The title is found by the TMDB id in the path ([tmdbid-123] or {tmdb-123}).
      If there is none, Radarr and Sonarr are asked to parse the file name instead.
      `,
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
      tooltip: `
      Optional. Radarr base URL, used to look up the original language of movies.

      Example:
      http://192.168.1.1:7878
      `,
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
      tooltip: `
      Optional. Radarr API key. A flow variable can be used to avoid typing the key here.

      Example:
      {{{args.userVariables.global.radarrApiKey}}}
      `,
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
      tooltip: `
      Optional. Sonarr base URL, used to look up the original language of series.

      Example:
      http://192.168.1.1:8989
      `,
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
      tooltip: `
      Optional. Sonarr API key. A flow variable can be used to avoid typing the key here.

      Example:
      {{{args.userVariables.global.sonarrApiKey}}}
      `,
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
      tooltip: `
      Optional. TMDB API key (v3 key or v4 read access token), used when Radarr and Sonarr are
      not set or do not know the title. Needs a TMDB id in the path.
      `,
    },
    {
      label: 'Keep Forced Subtitles',
      name: 'keepForcedSubtitles',
      type: 'boolean',
      defaultValue: 'true',
      inputUI: {
        type: 'switch',
      },
      tooltip: `
      Keep subtitle streams that are flagged as forced (or have "forced" in the title),
      whatever their language.
      `,
    },
    {
      label: 'Keep Undefined',
      name: 'keepUndefined',
      type: 'boolean',
      defaultValue: 'true',
      inputUI: {
        type: 'switch',
      },
      tooltip: `
      Keep streams with no language tag, or with an undetermined language (und, mis, mul, zxx).
      Streams with a language tag that cannot be recognised are always kept.
      `,
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
      tooltip: `
      Which streams to filter. Video, attachments, data streams and chapters are never touched.
      `,
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
});

// [iso639-2/B, iso639-2/T, iso639-1, English names separated by |]
const languageRows: string[][] = [
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
const languageExtras: Record<string, string> = {
  nob: 'nor',
  nno: 'nor',
  nb: 'nor',
  nn: 'nor',
  cn: 'yue', // TMDB uses "cn" for Cantonese
  iw: 'heb',
  ji: 'yid',
};

// Languages that are treated as one when matching, e.g. a Chinese track for a Cantonese film.
const languageGroups: Record<string, string> = {
  yue: 'chi',
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
  languageLookup[key] = languageLookup[languageExtras[key]] || languageExtras[key];
});

/**
 * Convert an ISO 639-1, 639-2/B, 639-2/T code or an English language name
 * (e.g. "Portuguese (Brazil)") to the ISO 639-2/B code. Returns '' if unknown.
 */
const toIso6392 = (value: unknown): string => {
  const raw = String(value === undefined || value === null ? '' : value).trim().toLowerCase();
  if (!raw) {
    return '';
  }
  const stripped = raw.replace(/\s*\(.*\)\s*$/, '').trim();
  return languageLookup[raw] || languageLookup[stripped] || languageLookup[stripped.split(/[-_]/)[0]] || '';
};

const matchKey = (code: string): string => languageGroups[code] || code;

// language tags meaning "not known" or "no spoken language"
const undefinedTags = ['', 'und', 'mis', 'mul', 'zxx', 'unk', 'undetermined', 'unknown'];

const getTag = (stream: IffmpegCommandStream, name: string): string => {
  const tags = (stream.tags || {}) as Record<string, unknown>;
  const key = Object.keys(tags).find((k) => k.toLowerCase() === name);
  return key === undefined ? '' : String(tags[key] ?? '');
};

const isForced = (stream: IffmpegCommandStream): boolean => (
  Number(stream.disposition?.forced) === 1 || getTag(stream, 'title').toLowerCase().includes('forced')
);

/** TMDB id from "[tmdbid-123]", "[tmdb-123]" or "{tmdb-123}", the deepest folder or file name wins. */
const getTmdbIdFromPath = (filePath: string): string => {
  const parts = String(filePath || '').split(/[\\/]+/);
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const match = /[[{]tmdb(?:id)?-(\d+)[\]}]/i.exec(parts[i]);
    if (match) {
      return match[1];
    }
  }
  return '';
};

const getArrKind = (filePath: string): 'radarr' | 'sonarr' | '' => {
  const p = String(filePath || '').replace(/\\/g, '/').toLowerCase();
  if (/\/(tv|series|shows)\//.test(p) || /\/season[ _]?\d+\//.test(p)) {
    return 'sonarr';
  }
  if (/\/movies?\//.test(p)) {
    return 'radarr';
  }
  return '';
};

const requestTimeoutMs = 15000;

interface IOriginalLanguageConfig {
  radarrUrl: string,
  radarrApiKey: string,
  sonarrUrl: string,
  sonarrApiKey: string,
  tmdbApiKey: string,
}

interface IArrTitle {
  tmdbId?: number,
  originalLanguage?: { name?: string },
}

const arrGet = async (
  args: IpluginInputArgs,
  baseUrl: string,
  apiKey: string,
  apiPath: string,
  params: Record<string, string>,
): Promise<unknown> => {
  const res = await args.deps.axios({
    method: 'get',
    url: `${baseUrl.replace(/\/+$/, '')}${apiPath}`,
    params,
    headers: {
      'X-Api-Key': apiKey,
      Accept: 'application/json',
    },
    timeout: requestTimeoutMs,
  });
  return res?.data;
};

// Ignore results for a different title in case the server ignores the tmdbId filter
const findByTmdbId = (data: unknown, tmdbId: string): IArrTitle | undefined => (
  (Array.isArray(data) ? data : [data]) as IArrTitle[]
).find((item) => item && String(item.tmdbId) === tmdbId && item.originalLanguage);

const lookupArr = async (
  args: IpluginInputArgs,
  kind: 'radarr' | 'sonarr',
  cfg: IOriginalLanguageConfig,
  tmdbId: string,
  libraryPath: string,
): Promise<string> => {
  const baseUrl = kind === 'radarr' ? cfg.radarrUrl : cfg.sonarrUrl;
  const apiKey = kind === 'radarr' ? cfg.radarrApiKey : cfg.sonarrApiKey;
  const apiPath = kind === 'radarr' ? '/api/v3/movie' : '/api/v3/series';
  const name = kind === 'radarr' ? 'Radarr' : 'Sonarr';

  let title: IArrTitle | undefined;
  if (tmdbId) {
    title = findByTmdbId(await arrGet(args, baseUrl, apiKey, apiPath, { tmdbId }), tmdbId);
    if (!title) {
      args.jobLog(`${name} has no title with TMDB id ${tmdbId}\n`);
    }
  }
  if (!title) {
    const fileName = libraryPath.split(/[\\/]+/).pop() || '';
    const parsed = await arrGet(args, baseUrl, apiKey, '/api/v3/parse', { title: fileName }) as
      { movie?: IArrTitle, series?: IArrTitle } | undefined;
    title = kind === 'radarr' ? parsed?.movie : parsed?.series;
    if (!title) {
      args.jobLog(`${name} could not identify '${fileName}'\n`);
    }
  }

  const languageName = title?.originalLanguage?.name;
  if (!languageName) {
    return '';
  }
  const code = toIso6392(languageName);
  args.jobLog(`${name} original language: ${languageName} -> ${code || 'not recognised'}\n`);
  return code;
};

const lookupTmdb = async (
  args: IpluginInputArgs,
  cfg: IOriginalLanguageConfig,
  tmdbId: string,
  kind: 'radarr' | 'sonarr' | '',
): Promise<string> => {
  let types = ['movie', 'tv'];
  if (kind === 'sonarr') {
    types = ['tv'];
  } else if (kind === 'radarr') {
    types = ['movie'];
  }
  const isToken = cfg.tmdbApiKey.length > 40;
  for (let i = 0; i < types.length; i += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const res = await args.deps.axios({
        method: 'get',
        url: `https://api.themoviedb.org/3/${types[i]}/${tmdbId}`,
        params: isToken ? {} : { api_key: cfg.tmdbApiKey },
        headers: isToken
          ? { Authorization: `Bearer ${cfg.tmdbApiKey}`, Accept: 'application/json' }
          : { Accept: 'application/json' },
        timeout: requestTimeoutMs,
      });
      const lang = res?.data?.original_language;
      if (lang) {
        const code = toIso6392(lang);
        args.jobLog(`TMDB original language: ${lang} -> ${code || 'not recognised'}\n`);
        if (code) {
          return code;
        }
      }
    } catch (err) {
      args.jobLog(`TMDB ${types[i]} lookup failed: ${(err as Error)?.message}\n`);
    }
  }
  return '';
};

/** Returns the ISO 639-2/B code of the original language, or '' if it could not be found. */
const getOriginalLanguage = async (args: IpluginInputArgs, cfg: IOriginalLanguageConfig): Promise<string> => {
  const libraryPath = args.originalLibraryFile?._id || args.inputFileObj._id;
  const tmdbId = getTmdbIdFromPath(libraryPath) || getTmdbIdFromPath(args.inputFileObj._id);
  const kind = getArrKind(libraryPath);

  const arrs: ('radarr' | 'sonarr')[] = [];
  if (cfg.radarrUrl && cfg.radarrApiKey && kind !== 'sonarr') {
    arrs.push('radarr');
  }
  if (cfg.sonarrUrl && cfg.sonarrApiKey && kind !== 'radarr') {
    arrs.push('sonarr');
  }

  for (let i = 0; i < arrs.length; i += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const code = await lookupArr(args, arrs[i], cfg, tmdbId, libraryPath);
      if (code) {
        return code;
      }
    } catch (err) {
      args.jobLog(`${arrs[i]} lookup failed: ${(err as Error)?.message}\n`);
    }
  }

  if (cfg.tmdbApiKey && tmdbId) {
    return lookupTmdb(args, cfg, tmdbId, kind);
  }
  if (arrs.length === 0 && !cfg.tmdbApiKey) {
    args.jobLog('No Radarr, Sonarr or TMDB settings usable for this file, cannot look up original language\n');
  } else if (!tmdbId && arrs.length === 0) {
    args.jobLog('No TMDB id found in the path, cannot look up original language\n');
  }
  return '';
};

const plugin = async (args: IpluginInputArgs): Promise<IpluginOutputArgs> => {
  const lib = require('../../../../../methods/lib')();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars,no-param-reassign
  args.inputs = lib.loadDefaultValues(args.inputs, details);

  checkFfmpegCommandInit(args);

  const asBool = (value: unknown): boolean => value === true || String(value).trim().toLowerCase() === 'true';
  const str = (value: unknown): string => String(value === undefined || value === null ? '' : value).trim();

  const streamTypes = str(args.inputs.streamTypes);
  let filtered = ['audio', 'subtitle'];
  if (streamTypes === 'audio') {
    filtered = ['audio'];
  } else if (streamTypes === 'subtitle') {
    filtered = ['subtitle'];
  }
  const keepForced = asBool(args.inputs.keepForcedSubtitles);
  const keepUndefined = asBool(args.inputs.keepUndefined);

  const keepSet: string[] = [];
  str(args.inputs.languagesToKeep).split(',').map((item) => item.trim()).filter((item) => item.length > 0)
    .forEach((item) => {
      const code = toIso6392(item);
      if (code) {
        keepSet.push(matchKey(code));
      } else {
        args.jobLog(`Ignoring unrecognised language '${item}' in Languages To Keep\n`);
      }
    });

  if (asBool(args.inputs.keepOriginalLanguage)) {
    let original = '';
    try {
      original = await getOriginalLanguage(args, {
        radarrUrl: str(args.inputs.radarrUrl),
        radarrApiKey: str(args.inputs.radarrApiKey),
        sonarrUrl: str(args.inputs.sonarrUrl),
        sonarrApiKey: str(args.inputs.sonarrApiKey),
        tmdbApiKey: str(args.inputs.tmdbApiKey),
      });
    } catch (err) {
      args.jobLog(`Original language lookup failed: ${(err as Error)?.message}\n`);
    }
    if (original) {
      keepSet.push(matchKey(original));
      args.jobLog(`Keeping original language ${original}\n`);
    } else {
      args.jobLog('Original language unknown, only keeping the configured languages\n');
    }
  }

  const { streams } = args.variables.ffmpegCommand;

  const decisions = streams
    .filter((stream) => filtered.includes(stream.codec_type) && !stream.removed)
    .map((stream) => {
      const tag = getTag(stream, 'language').trim().toLowerCase();
      const code = toIso6392(tag);
      let keep = true;
      let reason = '';
      if (undefinedTags.includes(tag)) {
        keep = keepUndefined;
        reason = keep ? 'undefined language kept' : 'undefined language not kept';
      } else if (stream.codec_type === 'subtitle' && keepForced && isForced(stream)) {
        reason = 'forced subtitle kept';
      } else if (!code) {
        reason = `unrecognised language tag '${tag}' kept`;
      } else if (keepSet.includes(matchKey(code))) {
        reason = `language ${code} is in the keep list`;
      } else {
        keep = false;
        reason = `language ${code} is not in the keep list`;
      }
      return {
        stream, keep, reason, code: code || tag || 'und',
      };
    });

  // Guard: never remove the last audio stream
  const audioDecisions = decisions.filter((d) => d.stream.codec_type === 'audio');
  if (audioDecisions.length > 0 && audioDecisions.every((d) => !d.keep)) {
    args.jobLog('No audio stream matches the keep list, keeping all audio streams\n');
    audioDecisions.forEach((d) => {
      // eslint-disable-next-line no-param-reassign
      d.keep = true;
      // eslint-disable-next-line no-param-reassign
      d.reason = 'kept so the file still has audio';
    });
  }

  let removedCount = 0;
  decisions.forEach((d) => {
    args.jobLog(`${d.keep ? 'Keep' : 'Removing'} ${d.stream.codec_type} stream index ${d.stream.index}`
      + ` (${d.code}): ${d.reason}\n`);
    if (!d.keep) {
      // eslint-disable-next-line no-param-reassign
      d.stream.removed = true;
      removedCount += 1;
    }
  });

  // Guard: keep a default audio stream if the default one was removed
  const removedDefaultAudio = decisions.some((d) => d.stream.codec_type === 'audio' && !d.keep
    && Number(d.stream.disposition?.default) === 1);
  const keptAudio = streams.filter((stream) => stream.codec_type === 'audio' && !stream.removed);
  if (removedDefaultAudio && keptAudio.length > 0
    && !keptAudio.some((stream) => Number(stream.disposition?.default) === 1)) {
    args.jobLog(`Default audio stream was removed, setting audio stream index ${keptAudio[0].index} as default\n`);
    // {outputTypeIndex} is replaced with the audio index in the output file by the Execute plugin
    keptAudio[0].outputArgs.push('-disposition:a:{outputTypeIndex}', 'default');
  }

  if (removedCount === 0) {
    args.jobLog('Nothing to remove\n');
  }

  return {
    outputFileObj: args.inputFileObj,
    outputNumber: removedCount > 0 ? 1 : 2,
    variables: args.variables,
  };
};

export {
  details,
  plugin,
};
