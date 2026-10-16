'use strict';
/* Local flow plugin: Label languages
 *
 * Finds audio / subtitle streams whose language tag is missing, "und" or empty and
 * identifies the language with the GPU helpers on the PC:
 *   audio          -> N x 30 s mono 16 kHz samples -> whisper /detect-language -> vote
 *   picture subs   -> ~5 rendered subtitle frames -> vision model -> vote
 *   text subs      -> sampled lines -> vision model (text only) -> vote
 * Tags are written as ISO 639-2 (B) codes with mkvpropedit. Anything unsure stays "und".
 * An unreachable helper never fails the file.
 */
Object.defineProperty(exports, '__esModule', { value: true });
exports.plugin = exports.details = void 0;

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var childProcess = require('child_process');

// iso2B|iso1|English name(s, separated by /)
var LANG_ROWS = [
  'afr|af|Afrikaans', 'alb|sq|Albanian', 'amh|am|Amharic', 'ara|ar|Arabic', 'arm|hy|Armenian',
  'asm|as|Assamese', 'aze|az|Azerbaijani', 'bak|ba|Bashkir', 'baq|eu|Basque', 'bel|be|Belarusian',
  'ben|bn|Bengali', 'bos|bs|Bosnian', 'bre|br|Breton', 'bul|bg|Bulgarian', 'bur|my|Burmese',
  'cat|ca|Catalan', 'chi|zh|Chinese/Mandarin', 'cze|cs|Czech', 'dan|da|Danish', 'dut|nl|Dutch/Flemish',
  'eng|en|English', 'est|et|Estonian', 'fao|fo|Faroese', 'fil|-|Filipino', 'fin|fi|Finnish',
  'fre|fr|French', 'geo|ka|Georgian', 'ger|de|German', 'gle|ga|Irish', 'glg|gl|Galician',
  'gre|el|Greek', 'guj|gu|Gujarati', 'hat|ht|Haitian Creole', 'hau|ha|Hausa', 'haw|-|Hawaiian',
  'heb|he|Hebrew', 'hin|hi|Hindi', 'hrv|hr|Croatian', 'hun|hu|Hungarian', 'ice|is|Icelandic',
  'ind|id|Indonesian', 'ita|it|Italian', 'jav|jv|Javanese', 'jpn|ja|Japanese', 'kan|kn|Kannada',
  'kaz|kk|Kazakh', 'khm|km|Khmer', 'kor|ko|Korean', 'lao|lo|Lao', 'lat|la|Latin', 'lav|lv|Latvian',
  'lin|ln|Lingala', 'lit|lt|Lithuanian', 'ltz|lb|Luxembourgish', 'mac|mk|Macedonian',
  'mal|ml|Malayalam', 'mao|mi|Maori', 'mar|mr|Marathi', 'may|ms|Malay', 'mlg|mg|Malagasy',
  'mlt|mt|Maltese', 'mon|mn|Mongolian', 'nep|ne|Nepali', 'nor|no|Norwegian', 'oci|oc|Occitan',
  'pan|pa|Punjabi', 'per|fa|Persian', 'pol|pl|Polish', 'por|pt|Portuguese', 'pus|ps|Pashto',
  'rum|ro|Romanian', 'rus|ru|Russian', 'san|sa|Sanskrit', 'sin|si|Sinhala', 'slo|sk|Slovak',
  'slv|sl|Slovenian', 'sna|sn|Shona', 'snd|sd|Sindhi', 'som|so|Somali', 'spa|es|Spanish',
  'srp|sr|Serbian', 'sun|su|Sundanese', 'swa|sw|Swahili', 'swe|sv|Swedish', 'tam|ta|Tamil',
  'tat|tt|Tatar', 'tel|te|Telugu', 'tgk|tg|Tajik', 'tgl|tl|Tagalog', 'tha|th|Thai', 'tib|bo|Tibetan',
  'tuk|tk|Turkmen', 'tur|tr|Turkish', 'ukr|uk|Ukrainian', 'urd|ur|Urdu', 'uzb|uz|Uzbek',
  'vie|vi|Vietnamese', 'wel|cy|Welsh', 'yid|yi|Yiddish', 'yor|yo|Yoruba', 'yue|-|Cantonese',
];
// ISO 639-2/T and other aliases -> B code
var LANG_ALIASES = {
  sqi: 'alb', hye: 'arm', eus: 'baq', mya: 'bur', zho: 'chi', ces: 'cze', nld: 'dut', kat: 'geo',
  deu: 'ger', ell: 'gre', isl: 'ice', mkd: 'mac', mri: 'mao', msa: 'may', fas: 'per', ron: 'rum',
  slk: 'slo', bod: 'tib', cym: 'wel', fra: 'fre', nob: 'nor', nno: 'nor', jw: 'jav',
};
var BY_CODE = {};
var BY_NAME = {};
LANG_ROWS.forEach(function (row) {
  var p = row.split('|');
  BY_CODE[p[0]] = p[0];
  if (p[1] !== '-') BY_CODE[p[1]] = p[0];
  p[2].split('/').forEach(function (n) { BY_NAME[n.toLowerCase()] = p[0]; });
});
Object.keys(LANG_ALIASES).forEach(function (k) { BY_CODE[k] = LANG_ALIASES[k]; });

/** Any 2/3 letter code or English name -> ISO 639-2 B code, or '' if unknown. */
function toIso2(value) {
  var v = String(value === undefined || value === null ? '' : value).trim().toLowerCase();
  if (!v || v === 'und') return '';
  if (BY_CODE[v]) return BY_CODE[v];
  if (BY_NAME[v]) return BY_NAME[v];
  return '';
}

function isUnknownLang(tag) {
  var v = String(tag === undefined || tag === null ? '' : tag).trim().toLowerCase();
  return v === '' || v === 'und';
}

function parseBool(v, dflt) {
  if (v === undefined || v === null || v === '') return dflt;
  if (typeof v === 'boolean') return v;
  return String(v).toLowerCase() === 'true';
}

function getTag(stream, name) {
  var tags = (stream && stream.tags) || {};
  var keys = Object.keys(tags);
  for (var i = 0; i < keys.length; i += 1) {
    if (keys[i].toLowerCase() === name) return tags[keys[i]];
  }
  return undefined;
}

/** votes: array of ISO2 codes (null/'' ignored). Strict majority of the answers and >= minVotes. */
function majority(votes, minVotes) {
  var counts = {};
  var total = 0;
  votes.forEach(function (v) {
    if (!v) return;
    total += 1;
    counts[v] = (counts[v] || 0) + 1;
  });
  var best = '';
  var bestN = 0;
  var tie = false;
  Object.keys(counts).forEach(function (k) {
    if (counts[k] > bestN) { best = k; bestN = counts[k]; tie = false; } else if (counts[k] === bestN) { tie = true; }
  });
  var need = Math.min(minVotes, total);
  if (!best || tie || bestN < need || bestN * 2 <= total) return { lang: '', votes: bestN, total: total, counts: counts };
  return { lang: best, votes: bestN, total: total, counts: counts };
}

function run(cmd, cmdArgs, opts) {
  var o = opts || {};
  return new Promise(function (resolve) {
    var out = [];
    var err = [];
    var done = false;
    var p;
    var timer;
    function finish(code) {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      resolve({ code: code, stdout: Buffer.concat(out), stderr: Buffer.concat(err).toString() });
    }
    try {
      p = childProcess.spawn(cmd, cmdArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      resolve({ code: -1, stdout: Buffer.alloc(0), stderr: String(e) });
      return;
    }
    p.stdout.on('data', function (d) { out.push(d); });
    p.stderr.on('data', function (d) { err.push(d); if (err.length > 200) err.shift(); });
    p.on('error', function (e) { err.push(Buffer.from(String(e))); finish(-1); });
    p.on('close', function (c) { finish(c === null ? -1 : c); });
    timer = setTimeout(function () { try { p.kill('SIGKILL'); } catch (e) { /* ignore */ } finish(-2); }, o.timeoutMs || 300000);
  });
}

function ffprobePathFrom(args) {
  var f = String(args.ffmpegPath || 'ffmpeg');
  if (/ffmpeg(\.exe)?$/i.test(f)) return f.replace(/ffmpeg(\.exe)?$/i, function (m) { return m.replace(/ffmpeg/i, 'ffprobe'); });
  return 'ffprobe';
}

function isUnreachable(e) {
  return !!(e && e.helperDown);
}

function newId() {
  return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
}

function helperHeaders(extra) {
  var h = { 'x-caller': 'tdarr', 'x-request-id': newId() };
  if (extra) Object.keys(extra).forEach(function (k) { h[k] = extra[k]; });
  return h;
}

/** POST a wav to whisper. Returns {code, confidence}. Throws {helperDown:true} when unreachable. */
async function whisperDetect(baseUrl, wavPath, timeoutMs) {
  if (typeof fetch !== 'function' || typeof FormData === 'undefined' || typeof Blob === 'undefined') {
    throw Object.assign(new Error('fetch/FormData not available in this Node runtime'), { helperDown: true });
  }
  var form = new FormData();
  form.append('audio_file', new Blob([fs.readFileSync(wavPath)], { type: 'audio/wav' }), 'sample.wav');
  var res;
  try {
    res = await fetch(baseUrl.replace(/\/+$/, '') + '/detect-language?encode=true', {
      method: 'POST', body: form, headers: helperHeaders(), signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    throw Object.assign(new Error('whisper unreachable: ' + (e && e.message)), { helperDown: true });
  }
  if (!res.ok) {
    if (res.status >= 500 || res.status === 404) throw Object.assign(new Error('whisper HTTP ' + res.status), { helperDown: true });
    throw new Error('whisper HTTP ' + res.status);
  }
  var j = await res.json();
  var conf = (typeof j.confidence === 'number') ? j.confidence : (typeof j.language_probability === 'number' ? j.language_probability : null);
  return { code: toIso2(j.language_code) || toIso2(j.detected_language), raw: j.language_code || j.detected_language, confidence: conf };
}

/** Ask the vision model. imagePath optional (text-only when omitted). Returns ISO2 B code or ''. */
async function visionAsk(baseUrl, prompt, imagePath, timeoutMs) {
  if (typeof fetch !== 'function') {
    throw Object.assign(new Error('fetch not available in this Node runtime'), { helperDown: true });
  }
  var content = [];
  if (imagePath) {
    content.push({ type: 'image_url', image_url: { url: 'data:image/png;base64,' + fs.readFileSync(imagePath).toString('base64') } });
  }
  content.push({ type: 'text', text: prompt });
  var body = JSON.stringify({ model: 'local-vision-small', temperature: 0, max_tokens: 16, messages: [{ role: 'user', content: content }] });
  var res;
  try {
    res = await fetch(baseUrl.replace(/\/+$/, '') + '/v1/chat/completions', {
      method: 'POST', body: body, headers: helperHeaders({ 'content-type': 'application/json' }), signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    throw Object.assign(new Error('vision unreachable: ' + (e && e.message)), { helperDown: true });
  }
  if (!res.ok) {
    if (res.status >= 500 || res.status === 404) throw Object.assign(new Error('vision HTTP ' + res.status), { helperDown: true });
    throw new Error('vision HTTP ' + res.status);
  }
  var j = await res.json();
  var text = String((((j.choices || [])[0] || {}).message || {}).content || '').trim().toLowerCase();
  var tokens = text.match(/[a-z]+/g) || [];
  for (var i = 0; i < tokens.length; i += 1) {
    var c = toIso2(tokens[i]);
    if (c) return { lang: c, raw: text };
  }
  return { lang: '', raw: text };
}

var LANG_PROMPT_IMG = 'The image shows movie subtitle text on a dark background. What language is the text written in? '
  + 'Answer with only the ISO 639-2 three-letter code (for example eng, fre, spa, ger, jpn, chi, kor, rus). '
  + 'If no text is readable, answer und.';
var LANG_PROMPT_TXT = 'Subtitle lines:\n{LINES}\n\n'
  + 'Which language is this text written in? Reply with only the ISO 639-2 three-letter language code, '
  + 'such as eng, fre, spa, ger, ita, jpn, chi, kor, rus.';

var PICTURE_SUB_CODECS = ['hdmv_pgs_subtitle', 'dvd_subtitle', 'dvb_subtitle', 'xsub'];
var TEXT_SUB_CODECS = ['subrip', 'srt', 'ass', 'ssa', 'webvtt', 'mov_text', 'text', 'subviewer', 'microdvd'];

var details = function () {
  return {
    name: 'Label languages',
    description: 'Identify the language of audio and subtitle streams tagged und / missing, using the whisper and vision '
      + 'helpers on the PC, and write ISO 639-2 tags (mkvpropedit in place for MKV; other containers are remuxed to MKV first). '
      + 'Unsure streams stay und. An unreachable helper never fails the file.',
    style: { borderColor: 'green' },
    tags: 'language,audio,subtitle',
    isStartPlugin: false,
    pType: '',
    requiresVersion: '2.11.01',
    sidebarPosition: -1,
    icon: 'faLanguage',
    inputs: [
      {
        label: 'Whisper URL', name: 'whisperUrl', type: 'string', defaultValue: 'http://whisper-host:9000',
        inputUI: { type: 'text' }, tooltip: 'Whisper ASR webservice base URL (POST /detect-language).',
      },
      {
        label: 'Vision URL', name: 'visionUrl', type: 'string', defaultValue: 'http://vision-host:8080',
        inputUI: { type: 'text' }, tooltip: 'llama.cpp server base URL (/v1/chat/completions), model local-vision-small.',
      },
      {
        label: 'Label audio', name: 'labelAudio', type: 'boolean', defaultValue: 'true',
        inputUI: { type: 'switch' }, tooltip: 'Identify untagged audio streams with whisper.',
      },
      {
        label: 'Label subtitles', name: 'labelSubtitles', type: 'boolean', defaultValue: 'true',
        inputUI: { type: 'switch' }, tooltip: 'Identify untagged subtitle streams with the vision model.',
      },
      {
        label: 'Audio samples', name: 'audioSamples', type: 'number', defaultValue: '4',
        inputUI: { type: 'text' }, tooltip: 'Number of audio samples cut per stream, spread through the runtime.',
      },
      {
        label: 'Audio sample seconds', name: 'audioSampleSeconds', type: 'number', defaultValue: '30',
        inputUI: { type: 'text' }, tooltip: 'Length of each audio sample in seconds.',
      },
      {
        label: 'Minimum whisper confidence', name: 'minConfidence', type: 'number', defaultValue: '0.6',
        inputUI: { type: 'text' },
        tooltip: 'Accept the winning language only when its mean confidence is at least this. '
          + 'If whisper returns no confidence, at least "Minimum agreeing samples" must agree instead.',
      },
      {
        label: 'Minimum agreeing samples', name: 'minAgree', type: 'number', defaultValue: '3',
        inputUI: { type: 'text' }, tooltip: 'Agreeing audio samples needed when no confidence is available (3 of 4).',
      },
      {
        label: 'Subtitle samples', name: 'subtitleSamples', type: 'number', defaultValue: '5',
        inputUI: { type: 'text' }, tooltip: 'Frames (picture subs) or line groups (text subs) sampled per subtitle stream.',
      },
      {
        label: 'Helper timeout seconds', name: 'timeoutSeconds', type: 'number', defaultValue: '120',
        inputUI: { type: 'text' }, tooltip: 'Per-request timeout for whisper / vision calls.',
      },
    ],
    outputs: [{ number: 1, tooltip: 'Continue to next plugin' }],
  };
};
exports.details = details;

function loadInputs(args) {
  var d = details();
  var inputs = Object.assign({}, args.inputs || {});
  d.inputs.forEach(function (i) {
    if (inputs[i.name] === undefined || inputs[i.name] === null || inputs[i.name] === '') inputs[i.name] = i.defaultValue;
  });
  return inputs;
}

async function probe(args, file) {
  var r = await run(ffprobePathFrom(args), ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file], { timeoutMs: 120000 });
  if (r.code !== 0) throw new Error('ffprobe failed: ' + r.stderr.slice(-300));
  return JSON.parse(r.stdout.toString());
}

function spreadPositions(duration, n, len) {
  var out = [];
  for (var i = 0; i < n; i += 1) {
    var pos = duration * ((i + 1) / (n + 1)) - len / 2;
    out.push(Math.max(0, Math.round(pos * 100) / 100));
  }
  return out;
}

async function identifyAudio(ctx, stream) {
  var cfg = ctx.cfg;
  var dur = ctx.duration;
  var len = cfg.audioSampleSeconds;
  if (dur > 0 && dur < cfg.audioSamples * len) len = Math.floor(dur / cfg.audioSamples);
  if (!(len >= 5)) { ctx.log('  audio #' + stream.index + ': file too short to sample, stays und'); return ''; }
  var positions = spreadPositions(dur, cfg.audioSamples, len);
  var votes = [];
  var confs = {};
  var haveConf = true;
  for (var i = 0; i < positions.length; i += 1) {
    var wav = path.join(ctx.tmpDir, 'a' + stream.index + '_' + i + '.wav');
    var r = await run(ctx.ffmpeg, ['-v', 'error', '-y', '-ss', String(positions[i]), '-t', String(len), '-i', ctx.file,
      '-map', '0:' + stream.index, '-vn', '-sn', '-dn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav], { timeoutMs: 180000 });
    if (r.code !== 0 || !fs.existsSync(wav) || fs.statSync(wav).size < 10000) {
      ctx.log('  audio #' + stream.index + ' sample ' + (i + 1) + ' @' + positions[i] + 's: could not cut (' + r.stderr.slice(-120).trim() + ')');
      continue;
    }
    var det = await whisperDetect(cfg.whisperUrl, wav, cfg.timeoutMs);
    try { fs.unlinkSync(wav); } catch (e) { /* ignore */ }
    ctx.log('  audio #' + stream.index + ' sample ' + (i + 1) + ' @' + positions[i] + 's: whisper says '
      + det.raw + ' -> ' + (det.code || '?') + ' confidence ' + (det.confidence === null ? 'n/a' : det.confidence.toFixed(3)));
    if (det.code) {
      votes.push(det.code);
      if (det.confidence === null) haveConf = false;
      else (confs[det.code] = confs[det.code] || []).push(det.confidence);
    }
  }
  var m = majority(votes, 1);
  if (!m.lang) { ctx.log('  audio #' + stream.index + ': no majority (' + JSON.stringify(m.counts) + '), stays und'); return ''; }
  if (haveConf) {
    var arr = confs[m.lang] || [];
    var mean = arr.reduce(function (a, b) { return a + b; }, 0) / (arr.length || 1);
    if (mean < cfg.minConfidence || m.votes < 2) {
      ctx.log('  audio #' + stream.index + ': ' + m.lang + ' won ' + m.votes + '/' + m.total + ' but mean confidence ' + mean.toFixed(3)
        + ' < ' + cfg.minConfidence + ' (or only one vote), stays und');
      return '';
    }
  } else if (m.votes < cfg.minAgree) {
    ctx.log('  audio #' + stream.index + ': ' + m.lang + ' only ' + m.votes + ' of ' + m.total + ' samples agree (need ' + cfg.minAgree + '), stays und');
    return '';
  }
  ctx.log('  audio #' + stream.index + ': decided ' + m.lang + ' (' + m.votes + '/' + m.total + ' samples)');
  return m.lang;
}

async function findSubtitleTimes(ctx, stream, count) {
  var dur = ctx.duration;
  var winLen = Math.max(60, Math.min(300, dur / (count + 1)));
  var times = [];
  var starts = spreadPositions(dur, count, 0);
  for (var i = 0; i < starts.length; i += 1) {
    var s = starts[i];
    var r = await run(ctx.ffprobe, ['-v', 'error', '-select_streams', String(stream.index), '-read_intervals', s + '%' + (s + winLen),
      '-show_entries', 'packet=pts_time,size', '-of', 'csv=p=0', ctx.file], { timeoutMs: 180000 });
    if (r.code !== 0) continue;
    var lines = r.stdout.toString().split(/\r?\n/);
    for (var j = 0; j < lines.length; j += 1) {
      var parts = lines[j].split(',');
      var t = parseFloat(parts[0]);
      var size = parseInt(parts[1], 10);
      // skip the tiny "clear" packets; keep real subtitle content
      if (!isNaN(t) && t >= s && size > 400) { times.push(t); break; }
    }
  }
  return times;
}

async function identifyPictureSub(ctx, stream) {
  var cfg = ctx.cfg;
  var times = await findSubtitleTimes(ctx, stream, cfg.subtitleSamples);
  if (!times.length) { ctx.log('  subtitle #' + stream.index + ': no subtitle packets found, stays und'); return ''; }
  var votes = [];
  for (var i = 0; i < times.length; i += 1) {
    var png = path.join(ctx.tmpDir, 's' + stream.index + '_' + i + '.png');
    var seek = Math.max(0, times[i] - 0.3);
    var offset = times[i] - seek + 0.15;
    var fg = '[0:v:0]drawbox=x=0:y=0:w=iw:h=ih:color=black:t=fill[bg];[bg][0:' + stream.index + ']overlay,scale=960:-2,'
      + 'select=gte(t\\,' + offset.toFixed(2) + ')';
    var r = await run(ctx.ffmpeg, ['-v', 'error', '-y', '-ss', String(seek), '-t', '1.2', '-i', ctx.file, '-filter_complex', fg,
      '-frames:v', '1', png], { timeoutMs: 180000 });
    if (r.code !== 0 || !fs.existsSync(png) || fs.statSync(png).size < 3500) {
      ctx.log('  subtitle #' + stream.index + ' frame ' + (i + 1) + ' @' + times[i].toFixed(1) + 's: render failed or blank');
      continue;
    }
    var ans = await visionAsk(cfg.visionUrl, LANG_PROMPT_IMG, png, cfg.timeoutMs);
    try { fs.unlinkSync(png); } catch (e) { /* ignore */ }
    ctx.log('  subtitle #' + stream.index + ' frame ' + (i + 1) + ' @' + times[i].toFixed(1) + 's: vision says "' + ans.raw + '" -> ' + (ans.lang || 'und'));
    if (ans.lang) votes.push(ans.lang);
  }
  var m = majority(votes, 2);
  if (!m.lang) { ctx.log('  subtitle #' + stream.index + ': no majority (' + JSON.stringify(m.counts) + '), stays und'); return ''; }
  ctx.log('  subtitle #' + stream.index + ': decided ' + m.lang + ' (' + m.votes + '/' + m.total + ' frames)');
  return m.lang;
}

function cleanSubLines(text) {
  var out = [];
  text.split(/\r?\n/).forEach(function (l) {
    var s = l.replace(/<[^>]+>/g, '').replace(/\{\\[^}]*\}/g, '').replace(/\\N/g, ' ').trim();
    if (!s || /^\d+$/.test(s) || /-->/.test(s)) return;
    if (s.length < 6) return;
    out.push(s);
  });
  return out;
}

async function identifyTextSub(ctx, stream) {
  var cfg = ctx.cfg;
  var dur = ctx.duration;
  var starts = spreadPositions(dur, cfg.subtitleSamples, 0);
  var votes = [];
  for (var i = 0; i < starts.length; i += 1) {
    var r = await run(ctx.ffmpeg, ['-v', 'error', '-ss', String(starts[i]), '-t', '180', '-i', ctx.file, '-map', '0:' + stream.index,
      '-f', 'srt', '-'], { timeoutMs: 180000 });
    if (r.code !== 0) continue;
    var lines = cleanSubLines(r.stdout.toString('utf8'));
    if (lines.length < 3) continue;
    var pick = lines.slice(0, 8).join('\n').slice(0, 800);
    var ans = await visionAsk(cfg.visionUrl, LANG_PROMPT_TXT.replace('{LINES}', pick), null, cfg.timeoutMs);
    ctx.log('  subtitle #' + stream.index + ' text sample ' + (i + 1) + ' @' + starts[i] + 's (' + lines.length + ' lines): model says "' + ans.raw + '" -> ' + (ans.lang || 'und'));
    if (ans.lang) votes.push(ans.lang);
  }
  var m = majority(votes, 2);
  if (!m.lang) { ctx.log('  subtitle #' + stream.index + ': no majority (' + JSON.stringify(m.counts) + '), stays und'); return ''; }
  ctx.log('  subtitle #' + stream.index + ': decided ' + m.lang + ' (' + m.votes + '/' + m.total + ' samples)');
  return m.lang;
}

function trackSelector(streams, stream) {
  // mkvpropedit track:aN / track:sN are 1-based among tracks of that type, in file order
  var n = 0;
  for (var i = 0; i < streams.length; i += 1) {
    if (streams[i].codec_type === stream.codec_type) n += 1;
    if (streams[i].index === stream.index) break;
  }
  return 'track:' + (stream.codec_type === 'audio' ? 'a' : 's') + n;
}

var plugin = async function (args) {
  var log = function (m) { args.jobLog(m); };
  var inputs = loadInputs(args);
  var cfg = {
    whisperUrl: String(inputs.whisperUrl).trim(),
    visionUrl: String(inputs.visionUrl).trim(),
    labelAudio: parseBool(inputs.labelAudio, true),
    labelSubtitles: parseBool(inputs.labelSubtitles, true),
    audioSamples: Math.max(1, parseInt(inputs.audioSamples, 10) || 4),
    audioSampleSeconds: Math.max(5, parseInt(inputs.audioSampleSeconds, 10) || 30),
    minConfidence: parseFloat(inputs.minConfidence),
    minAgree: Math.max(1, parseInt(inputs.minAgree, 10) || 3),
    subtitleSamples: Math.max(1, parseInt(inputs.subtitleSamples, 10) || 5),
    timeoutMs: Math.max(5, parseInt(inputs.timeoutSeconds, 10) || 120) * 1000,
  };
  if (isNaN(cfg.minConfidence)) cfg.minConfidence = 0.6;

  var result = { outputFileObj: args.inputFileObj, outputNumber: 1, variables: args.variables };
  var file = args.inputFileObj._id;
  var tmpDir = '';
  try {
    var info = await probe(args, file);
    var streams = info.streams || [];
    var wanted = streams.filter(function (s) {
      if (!isUnknownLang(getTag(s, 'language'))) return false;
      if (s.codec_type === 'audio') return cfg.labelAudio;
      if (s.codec_type === 'subtitle') return cfg.labelSubtitles;
      return false;
    });
    log('Label languages: ' + wanted.length + ' stream(s) with missing/und language in ' + path.basename(file));
    if (!wanted.length) return result;

    var base = args.workDir || path.dirname(file);
    tmpDir = path.join(base, 'labelLanguages_' + Date.now());
    fs.mkdirSync(tmpDir, { recursive: true });
    var ctx = {
      cfg: cfg, log: log, file: file, tmpDir: tmpDir, duration: parseFloat((info.format || {}).duration) || 0,
      ffmpeg: String(args.ffmpegPath || 'ffmpeg'), ffprobe: ffprobePathFrom(args),
    };
    var audioDown = false;
    var visionDown = false;
    var decisions = [];
    for (var i = 0; i < wanted.length; i += 1) {
      var s = wanted[i];
      var kind = s.codec_type;
      var lang = '';
      var codec = String(s.codec_name || '').toLowerCase();
      log('Stream #' + s.index + ' (' + kind + ', ' + codec + ', title "' + (getTag(s, 'title') || '') + '") has no language');
      try {
        if (!ctx.duration) {
          log('  duration unknown, stays und');
        } else if (kind === 'audio') {
          if (audioDown) log('  whisper unreachable earlier, stays und');
          else lang = await identifyAudio(ctx, s);
        } else if (visionDown) {
          log('  vision model unreachable earlier, stays und');
        } else if (PICTURE_SUB_CODECS.indexOf(codec) >= 0) {
          lang = await identifyPictureSub(ctx, s);
        } else if (TEXT_SUB_CODECS.indexOf(codec) >= 0) {
          lang = await identifyTextSub(ctx, s);
        } else {
          log('  unsupported subtitle codec ' + codec + ', stays und');
        }
      } catch (e) {
        if (isUnreachable(e)) {
          if (kind === 'audio') audioDown = true; else visionDown = true;
          log('  HELPER UNREACHABLE (' + e.message + '); leaving ' + (kind === 'audio' ? 'all audio' : 'all subtitles') + ' as und and continuing');
        } else {
          log('  error identifying stream #' + s.index + ': ' + (e && e.message) + '; stays und');
        }
        lang = '';
      }
      if (lang) decisions.push({ stream: s, lang: lang });
    }

    if (!decisions.length) { log('Label languages: nothing identified, no tags written'); return result; }

    // pick the file mkvpropedit will edit
    var target = file;
    var isMkv = /\.(mkv|mka|mks|webm)$/i.test(file) && String((info.format || {}).format_name || '').indexOf('matroska') >= 0;
    if (!isMkv) {
      var out = path.join(tmpDir, path.basename(file).replace(/\.[^.]+$/, '') + '.mkv');
      log('Container is not MKV; remuxing to ' + out + ' before tagging');
      var rargs = ['-v', 'error', '-y', '-i', file, '-map', '0:v', '-map', '0:a?', '-map', '0:s?', '-map', '0:t?',
        '-map_chapters', '0', '-c', 'copy'];
      streams.forEach(function (st, idx) {
        if (st.codec_type === 'subtitle' && String(st.codec_name).toLowerCase() === 'mov_text') rargs.push('-c:s:' + streams.filter(function (x, k) { return k < idx && x.codec_type === 'subtitle'; }).length, 'srt');
      });
      rargs.push(out);
      var rr = await run(ctx.ffmpeg, rargs, { timeoutMs: 3600000 });
      if (rr.code !== 0) { log('Remux failed (' + rr.stderr.slice(-300) + '); leaving tags unchanged'); return result; }
      target = out;
      result.outputFileObj = { _id: out };
      tmpDir = tmpDir + '|keep'; // keep the remuxed file
    }
    var origId = args.originalLibraryFile && args.originalLibraryFile._id;
    if (isMkv && origId && path.resolve(origId) === path.resolve(file)) {
      // never edit the original library file: tag a copy in the cache instead
      var copy = path.join(tmpDir, path.basename(file));
      log('Working file is the original library file; copying to ' + copy + ' before tagging');
      try {
        fs.copyFileSync(file, copy);
      } catch (e) {
        log('Copy to cache failed (' + (e && e.message) + '); leaving tags unchanged');
        try { fs.unlinkSync(copy); } catch (e2) { /* ignore */ }
        return result;
      }
      target = copy;
      result.outputFileObj = { _id: copy };
      tmpDir = tmpDir + '|keep';
    }
    var pe = [target];
    decisions.forEach(function (d) {
      pe.push('--edit', trackSelector(streams, d.stream), '--set', 'language=' + d.lang);
      log('Tagging stream #' + d.stream.index + ' (' + d.stream.codec_type + ') as ' + d.lang);
    });
    var mr = await run(String(args.mkvpropeditPath || 'mkvpropedit'), pe, { timeoutMs: 600000 });
    if (mr.code > 1) {
      log('mkvpropedit failed (exit ' + mr.code + '): ' + (mr.stderr || mr.stdout.toString()).slice(-300));
      if (target !== file) result.outputFileObj = args.inputFileObj;
    } else {
      log('mkvpropedit done (exit ' + mr.code + '): ' + decisions.length + ' stream(s) labelled');
    }
  } catch (e) {
    // never fail the file because of language labelling
    log('Label languages: unexpected error, continuing unchanged: ' + (e && e.stack || e));
    result.outputFileObj = args.inputFileObj;
  } finally {
    if (tmpDir && tmpDir.indexOf('|keep') < 0) {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
    } else if (tmpDir) {
      // remove only the sample leftovers, keep the remuxed MKV
      try {
        var d = tmpDir.replace('|keep', '');
        fs.readdirSync(d).forEach(function (f) { if (/\.(wav|png)$/.test(f)) fs.unlinkSync(path.join(d, f)); });
      } catch (e) { /* ignore */ }
    }
  }
  return result;
};
exports.plugin = plugin;
exports.__test = { toIso2: toIso2, majority: majority };
