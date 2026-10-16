import { EventEmitter } from 'events';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import {
  details,
  plugin,
  toIso6392,
  parseModelAnswer,
  tallyVotes,
  buildEndpointUrl,
  findTextBox,
} from '../../../../../../FlowPluginsTs/CommunityFlowPlugins/ffmpegCommand/ffmpegCommandLabelLanguages/1.0.0/index';
import {
  IffmpegCommandStream,
  IpluginInputArgs,
} from '../../../../../../FlowPluginsTs/FlowHelpers/1.0.0/interfaces/interfaces';

jest.mock('child_process', () => ({ spawn: jest.fn() }));

const mockSpawn = spawn as unknown as jest.Mock;

interface IfakeResult {
  code?: number,
  stdout?: Buffer | string,
  stderr?: string,
}

type IfakeTool = (cmd: string, cmdArgs: string[]) => IfakeResult;

/** Default behaviour of the fake ffmpeg / ffprobe. */
const fakeTools: IfakeTool = (cmd, cmdArgs) => {
  const last = cmdArgs[cmdArgs.length - 1];
  if (cmd.includes('ffprobe')) {
    const interval = cmdArgs[cmdArgs.indexOf('-read_intervals') + 1];
    const start = parseFloat(interval.split('%')[0]);
    // a small "clear" packet first, then a real one
    return { stdout: `${start + 0.5},30\n${start + 1.5},2400\n` };
  }
  if (last.endsWith('.wav')) {
    fs.writeFileSync(last, Buffer.alloc(20000));
    return {};
  }
  if (cmdArgs.includes('-filter_complex')) {
    const filter = cmdArgs[cmdArgs.indexOf('-filter_complex') + 1];
    const [, w, h] = /scale=(\d+):(\d+),split/.exec(filter) || [];
    const width = Number(w);
    const height = Number(h);
    const pngPath = cmdArgs[cmdArgs.indexOf('[png]') + 3];
    fs.writeFileSync(pngPath, 'FULLFRAME');
    const gray = Buffer.alloc(width * height);
    // a bright "text" block near the bottom
    for (let y = height - 80; y < height - 40; y += 1) {
      for (let x = 200; x < width - 200; x += 1) {
        gray[y * width + x] = 255;
      }
    }
    return { stdout: gray };
  }
  if (cmdArgs.includes('-vf')) {
    return { stdout: 'CROPPEDPNG' };
  }
  if (cmdArgs.includes('srt')) {
    const at = cmdArgs[cmdArgs.indexOf('-ss') + 1];
    return {
      stdout: '1\n00:00:01,000 --> 00:00:02,000\n<i>¿Dónde está mi coche?</i>\n\n'
        + '2\n00:00:03,000 --> 00:00:04,000\nNo lo sé, amigo.\n\n'
        + `3\n00:00:05,000 --> 00:00:06,000\nVamos a buscarlo ahora (${at}).\n\n`,
    };
  }
  return { code: 1, stderr: 'unexpected command' };
};

let tool: IfakeTool = fakeTools;

const makeStream = (
  index: number,
  codecType: string,
  codecName: string,
  extra: Partial<IffmpegCommandStream> = {},
): IffmpegCommandStream => ({
  index,
  codec_type: codecType,
  codec_name: codecName,
  removed: false,
  forceEncoding: false,
  inputArgs: [],
  outputArgs: [],
  mapArgs: ['-map', `0:${index}`],
  tags: {},
  ...extra,
});

const okResponse = (data: unknown) => Promise.resolve({ status: 200, data });

const refused = () => Promise.reject(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }));

describe('ffmpegCommandLabelLanguages Plugin', () => {
  let baseArgs: IpluginInputArgs;
  let workDir: string;
  let axios: jest.Mock;

  const streams = () => baseArgs.variables.ffmpegCommand.streams;
  const logText = () => (baseArgs.jobLog as jest.Mock).mock.calls.map((c) => c[0]).join('');
  const spawnCalls = () => mockSpawn.mock.calls.map((c) => ({ cmd: c[0] as string, args: c[1] as string[] }));

  beforeEach(() => {
    jest.clearAllMocks();
    tool = fakeTools;
    mockSpawn.mockImplementation((cmd: string, cmdArgs: string[]) => {
      const child = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter, stderr: EventEmitter, kill: jest.Mock,
      };
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.kill = jest.fn();
      setImmediate(() => {
        const res = tool(cmd, cmdArgs);
        if (res.stdout) child.stdout.emit('data', Buffer.from(res.stdout));
        if (res.stderr) child.stderr.emit('data', Buffer.from(res.stderr));
        child.emit('close', res.code ?? 0);
      });
      return child;
    });

    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'labelLanguagesTest-'));
    axios = jest.fn();

    baseArgs = {
      inputs: {
        audioApiUrl: 'http://stt.example:8000',
        chatApiUrl: 'http://chat.example:8080',
      },
      variables: {
        ffmpegCommand: {
          init: true,
          inputFiles: [],
          streams: [
            makeStream(0, 'video', 'h264', { width: 1920, height: 1080 }),
          ],
          container: 'mkv',
          hardwareDecoding: false,
          shouldProcess: false,
          overallInputArguments: [],
          overallOuputArguments: [],
        },
        flowFailed: false,
        user: {},
      } as IpluginInputArgs['variables'],
      inputFileObj: {
        _id: '/media/Movies/Film (1999)/Film.mkv',
        ffProbeData: { format: { duration: '3600.0' } },
      } as unknown as IpluginInputArgs['inputFileObj'],
      originalLibraryFile: { _id: '/media/Movies/Film (1999)/Film.mkv' } as IpluginInputArgs['originalLibraryFile'],
      ffmpegPath: '/usr/bin/ffmpeg',
      workDir,
      jobLog: jest.fn(),
      deps: { axios } as unknown as IpluginInputArgs['deps'],
    } as Partial<IpluginInputArgs> as IpluginInputArgs;
  });

  afterEach(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  describe('details', () => {
    it('should have two outputs and no personal endpoint defaults', () => {
      const d = details();
      expect(d.outputs.map((o) => o.number)).toEqual([1, 2]);
      const defaults = Object.fromEntries(d.inputs.map((i) => [i.name, i.defaultValue]));
      expect(defaults.audioApiUrl).toBe('');
      expect(defaults.chatApiUrl).toBe('');
      expect(defaults.audioApiKey).toBe('');
      expect(defaults.chatApiKey).toBe('');
    });
  });

  describe('language helpers', () => {
    it('should convert codes and names to ISO 639-2/B', () => {
      expect(toIso6392('en')).toBe('eng');
      expect(toIso6392('fra')).toBe('fre');
      expect(toIso6392('deu')).toBe('ger');
      expect(toIso6392('Chinese')).toBe('chi');
      expect(toIso6392('pt-BR')).toBe('por');
      expect(toIso6392('jw')).toBe('jav');
      expect(toIso6392('und')).toBe('');
      expect(toIso6392('klingon')).toBe('');
    });

    it('should read the language out of model answers', () => {
      expect(parseModelAnswer('eng')).toBe('eng');
      expect(parseModelAnswer(' FRE. ')).toBe('fre');
      expect(parseModelAnswer('de')).toBe('ger');
      expect(parseModelAnswer('The text is in Spanish.')).toBe('spa');
      expect(parseModelAnswer('The language is English, code eng.')).toBe('eng');
      expect(parseModelAnswer('<think>could be ita or spa</think>ita')).toBe('ita');
      expect(parseModelAnswer('Haitian Creole')).toBe('hat');
      // two languages named, unsure
      expect(parseModelAnswer('Either French or Italian')).toBe('');
      expect(parseModelAnswer('und')).toBe('');
      expect(parseModelAnswer('No text is readable, und')).toBe('');
      expect(parseModelAnswer('')).toBe('');
      // "is" and "may" must not be read as Icelandic or Malay inside a sentence
      expect(parseModelAnswer('It may be English')).toBe('eng');
    });
  });

  describe('majority and threshold logic', () => {
    it('should need a strict majority', () => {
      expect(tallyVotes(['eng', 'eng', 'eng', 'fre'], 2, 4).lang).toBe('eng');
      expect(tallyVotes(['eng', 'eng', 'fre', 'fre'], 2, 4).lang).toBe('');
      expect(tallyVotes(['eng', 'eng', 'fre', 'ger', 'spa'], 2, 5).lang).toBe('');
    });

    it('should need the minimum agreement', () => {
      expect(tallyVotes(['eng'], 2, 4).lang).toBe('');
      expect(tallyVotes(['eng', 'eng'], 3, 4).lang).toBe('');
      expect(tallyVotes(['eng', 'eng', 'eng'], 3, 4).lang).toBe('eng');
    });

    it('should cap the minimum agreement at the sample count and ignore empty votes', () => {
      expect(tallyVotes(['eng'], 3, 1).lang).toBe('eng');
      expect(tallyVotes(['', '', 'eng', 'eng'], 2, 4)).toEqual({
        lang: 'eng', votes: 2, total: 2, counts: { eng: 2 },
      });
    });
  });

  describe('endpoint URLs', () => {
    it('should add the endpoint path only when missing', () => {
      expect(buildEndpointUrl('http://h:8000', '/v1/audio/transcriptions'))
        .toBe('http://h:8000/v1/audio/transcriptions');
      expect(buildEndpointUrl('https://api.groq.com/openai/v1/', '/v1/audio/transcriptions'))
        .toBe('https://api.groq.com/openai/v1/audio/transcriptions');
      expect(buildEndpointUrl('http://h:8080/v1/chat/completions', '/v1/chat/completions'))
        .toBe('http://h:8080/v1/chat/completions');
      expect(buildEndpointUrl('http://h:9000', '/detect-language')).toBe('http://h:9000/detect-language');
    });
  });

  describe('text box detection', () => {
    it('should find the lit area with padding and return null for a blank frame', () => {
      const width = 100;
      const height = 50;
      const gray = Buffer.alloc(width * height);
      expect(findTextBox(gray, width, height)).toBeNull();
      for (let y = 30; y < 40; y += 1) {
        for (let x = 20; x < 80; x += 1) {
          gray[y * width + x] = 230;
        }
      }
      expect(findTextBox(gray, width, height)).toEqual({
        x: 8, y: 18, w: 84, h: 32,
      });
    });
  });

  describe('audio, OpenAI compatible', () => {
    it('should label an untagged audio stream and chain with Execute', async () => {
      streams().push(makeStream(1, 'audio', 'ac3', { tags: { language: 'und', title: 'Main' } }));
      baseArgs.inputs.audioApiKey = 'sk-test';
      baseArgs.inputs.audioModel = 'whisper-large-v3';
      axios.mockImplementation(() => okResponse({ language: 'english', text: 'hello' }));

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(1);
      expect(result.outputFileObj).toBe(baseArgs.inputFileObj);
      const audio = streams()[1];
      expect(audio.tags?.language).toBe('eng');
      expect(audio.outputArgs).toEqual(['-metadata:s:{outputIndex}', 'language=eng']);
      expect(baseArgs.variables.ffmpegCommand.shouldProcess).toBe(true);

      expect(axios).toHaveBeenCalledTimes(4);
      const req = axios.mock.calls[0][0];
      expect(req.method).toBe('post');
      expect(req.url).toBe('http://stt.example:8000/v1/audio/transcriptions');
      expect(req.headers.Authorization).toBe('Bearer sk-test');
      expect(req.headers['Content-Type']).toMatch(/^multipart\/form-data; boundary=/);
      const body = (req.data as Buffer).toString('latin1');
      expect(body).toContain('name="model"\r\n\r\nwhisper-large-v3\r\n');
      expect(body).toContain('name="response_format"\r\n\r\nverbose_json\r\n');
      expect(body).toContain('name="file"; filename="sample.wav"');

      // 4 clips of 30 s, mono 16 kHz, spread across the runtime
      const cuts = spawnCalls().filter((c) => c.args[c.args.length - 1].endsWith('.wav'));
      expect(cuts).toHaveLength(4);
      expect(cuts.map((c) => c.args[c.args.indexOf('-ss') + 1])).toEqual(['705', '1425', '2145', '2865']);
      expect(cuts[0].args).toEqual(expect.arrayContaining(['-t', '30', '-ac', '1', '-ar', '16000', '-map', '0:1']));
    });

    it('should not send an Authorization header without a key', async () => {
      streams().push(makeStream(1, 'audio', 'aac'));
      axios.mockImplementation(() => okResponse({ language: 'en' }));

      await plugin(baseArgs);

      expect(axios.mock.calls[0][0].headers.Authorization).toBeUndefined();
    });

    it('should leave the stream und when the samples disagree', async () => {
      streams().push(makeStream(1, 'audio', 'aac'));
      const answers = ['english', 'french', 'english', 'french'];
      axios.mockImplementation(() => okResponse({ language: answers.shift() }));

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(2);
      expect(streams()[1].outputArgs).toEqual([]);
      expect(streams()[1].tags?.language).toBeUndefined();
      expect(baseArgs.variables.ffmpegCommand.shouldProcess).toBe(false);
      expect(logText()).toContain('no agreement');
    });
  });

  describe('audio, whisper-asr-webservice', () => {
    beforeEach(() => {
      baseArgs.inputs.audioApiStyle = 'whisperAsrWebservice';
      baseArgs.inputs.audioApiUrl = 'http://whisper.example:9000/';
    });

    it('should use /detect-language and the confidence', async () => {
      streams().push(makeStream(1, 'audio', 'dts'));
      const answers = [
        { language_code: 'ja', detected_language: 'japanese', confidence: 0.95 },
        { language_code: 'ja', detected_language: 'japanese', confidence: 0.91 },
        { language_code: 'en', detected_language: 'english', confidence: 0.2 },
        { language_code: 'ja', detected_language: 'japanese', confidence: 0.88 },
      ];
      axios.mockImplementation(() => okResponse(answers.shift()));

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(1);
      expect(streams()[1].tags?.language).toBe('jpn');
      const req = axios.mock.calls[0][0];
      expect(req.url).toBe('http://whisper.example:9000/detect-language?encode=true');
      const body = (req.data as Buffer).toString('latin1');
      expect(body).toContain('name="audio_file"; filename="sample.wav"');
      expect(body).not.toContain('name="model"');
      expect(logText()).toContain('below minimum confidence');
    });

    it('should ignore samples below the minimum confidence', async () => {
      streams().push(makeStream(1, 'audio', 'dts'));
      axios.mockImplementation(() => okResponse({ language_code: 'en', confidence: 0.3 }));

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(2);
      expect(streams()[1].outputArgs).toEqual([]);
    });

    it('should follow a lower confidence threshold', async () => {
      streams().push(makeStream(1, 'audio', 'dts'));
      baseArgs.inputs.audioMinConfidence = '0.25';
      axios.mockImplementation(() => okResponse({ language_code: 'en', confidence: 0.3 }));

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(1);
      expect(streams()[1].tags?.language).toBe('eng');
    });
  });

  describe('picture subtitles (vision)', () => {
    it('should render, crop and ask the vision model', async () => {
      streams().push(makeStream(2, 'subtitle', 'hdmv_pgs_subtitle', { width: 1920, height: 1080 }));
      baseArgs.inputs.chatModel = 'qwen-vl';
      baseArgs.inputs.chatApiKey = 'chat-key';
      axios.mockImplementation(() => okResponse({ choices: [{ message: { content: 'fre' } }] }));

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(1);
      expect(streams()[1].tags?.language).toBe('fre');
      expect(streams()[1].outputArgs).toEqual(['-metadata:s:{outputIndex}', 'language=fre']);

      // timestamps come from ffprobe -read_intervals, not a full scan
      const probes = spawnCalls().filter((c) => c.cmd.includes('ffprobe'));
      expect(probes).toHaveLength(5);
      expect(probes[0].args).toEqual(expect.arrayContaining(['-select_streams', '2', '-read_intervals']));

      // the frame is cropped to the text and downscaled to the max width
      const crops = spawnCalls().filter((c) => c.args.includes('-vf'));
      expect(crops).toHaveLength(5);
      const vf = crops[0].args[crops[0].args.indexOf('-vf') + 1];
      expect(vf).toBe('crop=904:64:188:628,scale=768:54');

      expect(axios).toHaveBeenCalledTimes(5);
      const req = axios.mock.calls[0][0];
      expect(req.url).toBe('http://chat.example:8080/v1/chat/completions');
      expect(req.headers.Authorization).toBe('Bearer chat-key');
      expect(req.data.model).toBe('qwen-vl');
      expect(req.data.temperature).toBe(0);
      const [image, text] = req.data.messages[0].content;
      expect(image.type).toBe('image_url');
      expect(image.image_url.url).toBe(`data:image/png;base64,${Buffer.from('CROPPEDPNG').toString('base64')}`);
      expect(text.text).toContain('ISO 639-2');
    });

    it('should skip blank frames and stay und without enough votes', async () => {
      streams().push(makeStream(2, 'subtitle', 'dvd_subtitle'));
      tool = (cmd, cmdArgs) => {
        if (cmdArgs.includes('-filter_complex')) {
          const res = fakeTools(cmd, cmdArgs);
          return { stdout: Buffer.alloc((res.stdout as Buffer).length) };
        }
        return fakeTools(cmd, cmdArgs);
      };

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(2);
      expect(axios).not.toHaveBeenCalled();
      expect(logText()).toContain('no text rendered');
    });

    it('should not send a model when none is set', async () => {
      streams().push(makeStream(2, 'subtitle', 'hdmv_pgs_subtitle'));
      axios.mockImplementation(() => okResponse({ choices: [{ message: { content: 'It is German.' } }] }));

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(1);
      expect(streams()[1].tags?.language).toBe('ger');
      expect(axios.mock.calls[0][0].data.model).toBeUndefined();
      expect(axios.mock.calls[0][0].headers.Authorization).toBeUndefined();
    });
  });

  describe('text subtitles', () => {
    it('should send sample lines to the chat model', async () => {
      streams().push(makeStream(3, 'subtitle', 'subrip', { tags: { title: 'Full' } }));
      axios.mockImplementation(() => okResponse({ choices: [{ message: { content: 'spa' } }] }));

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(1);
      expect(streams()[1].tags?.language).toBe('spa');
      expect(axios).toHaveBeenCalledTimes(5);
      const { content } = axios.mock.calls[0][0].data.messages[0];
      expect(content).toHaveLength(1);
      expect(content[0].type).toBe('text');
      expect(content[0].text).toContain('¿Dónde está mi coche?');
      expect(content[0].text).not.toContain('-->');
      expect(content[0].text).not.toContain('<i>');
      const extracts = spawnCalls().filter((c) => c.args.includes('srt'));
      expect(extracts[0].args).toEqual(expect.arrayContaining(['-map', '0:3', '-f', 'srt', 'pipe:1']));
    });

    it('should only ask once for identical samples, which then need a lower agreement', async () => {
      streams().push(makeStream(3, 'subtitle', 'ass'));
      tool = (cmd, cmdArgs) => (cmdArgs.includes('srt')
        ? { stdout: 'Same line one\nSame line two\nSame line three\n' }
        : fakeTools(cmd, cmdArgs));
      axios.mockImplementation(() => okResponse({ choices: [{ message: { content: 'eng' } }] }));

      let result = await plugin(baseArgs);

      expect(axios).toHaveBeenCalledTimes(1);
      expect(result.outputNumber).toBe(2);
      expect(logText()).toContain('not enough new text');

      baseArgs.inputs.minAgreement = '1';
      result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(1);
      expect(streams()[1].tags?.language).toBe('eng');
    });
  });

  describe('unreachable endpoints', () => {
    it('should not fail the file when the audio API is down', async () => {
      streams().push(makeStream(1, 'audio', 'aac'));
      streams().push(makeStream(2, 'audio', 'aac'));
      axios.mockImplementation(refused);

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(2);
      expect(result.outputFileObj).toBe(baseArgs.inputFileObj);
      // the service is not called again after it was found down
      expect(axios).toHaveBeenCalledTimes(1);
      expect(streams()[1].outputArgs).toEqual([]);
      expect(streams()[2].outputArgs).toEqual([]);
      expect(logText()).toContain('Audio API unreachable');
    });

    it('should keep labelling audio when only the chat API is down', async () => {
      streams().push(makeStream(1, 'audio', 'aac'));
      streams().push(makeStream(2, 'subtitle', 'subrip'));
      streams().push(makeStream(3, 'subtitle', 'hdmv_pgs_subtitle'));
      axios.mockImplementation((req: { url: string }) => {
        if (req.url.includes('chat')) {
          return Promise.reject(Object.assign(new Error('Request failed'), { response: { status: 503 } }));
        }
        return okResponse({ language: 'en' });
      });

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(1);
      expect(streams()[1].tags?.language).toBe('eng');
      expect(streams()[2].outputArgs).toEqual([]);
      expect(streams()[3].outputArgs).toEqual([]);
      expect(logText()).toContain('Chat API returned HTTP 503');
      expect(logText()).toContain('Chat API unreachable earlier');
      expect(axios.mock.calls.filter((c) => c[0].url.includes('chat'))).toHaveLength(1);
    });

    it('should only drop the vote of a rejected sample (HTTP 400) and keep calling the service', async () => {
      streams().push(makeStream(1, 'audio', 'aac'));
      let n = 0;
      axios.mockImplementation(() => {
        n += 1;
        return n === 2
          ? Promise.reject(Object.assign(new Error('Bad Request'), { response: { status: 400 } }))
          : okResponse({ language: 'en' });
      });

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(1);
      expect(axios).toHaveBeenCalledTimes(4);
      expect(streams()[1].tags?.language).toBe('eng');
      expect(logText()).toContain('Audio API returned HTTP 400');
    });

    it('should keep going when ffmpeg cannot cut a sample', async () => {
      streams().push(makeStream(1, 'audio', 'aac'));
      tool = () => ({ code: 1, stderr: 'boom' });

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(2);
      expect(axios).not.toHaveBeenCalled();
      expect(logText()).toContain('could not cut a clip');
    });
  });

  describe('non-MKV input', () => {
    it('should label MP4 streams through the FFmpeg command without remuxing or mkvpropedit', async () => {
      baseArgs.inputFileObj._id = '/media/Movies/Film/Film.mp4';
      baseArgs.originalLibraryFile._id = '/media/Movies/Film/Film.mp4';
      baseArgs.variables.ffmpegCommand.container = 'mp4';
      streams().push(makeStream(1, 'audio', 'aac', { tags: { language: '' } }));
      streams().push(makeStream(2, 'subtitle', 'mov_text', { tags: { language: 'und' } }));
      axios.mockImplementation((req: { url: string }) => (req.url.includes('chat')
        ? okResponse({ choices: [{ message: { content: 'ita' } }] })
        : okResponse({ language: 'italian' })));

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(1);
      expect(result.outputFileObj).toBe(baseArgs.inputFileObj);
      expect(baseArgs.variables.ffmpegCommand.container).toBe('mp4');
      expect(streams()[1].outputArgs).toEqual(['-metadata:s:{outputIndex}', 'language=ita']);
      expect(streams()[2].outputArgs).toEqual(['-metadata:s:{outputIndex}', 'language=ita']);
      const commands = spawnCalls();
      expect(commands.every((c) => !c.cmd.includes('mkvpropedit'))).toBe(true);
      // every ffmpeg call only reads the input file, nothing is written next to it
      commands.forEach((c) => {
        expect(c.args.filter((a) => a.startsWith('/media/'))).toEqual(['/media/Movies/Film/Film.mp4']);
        expect(c.args[c.args.indexOf('-i') + 1]).not.toBe(c.args[c.args.length - 1]);
      });
    });
  });

  describe('stream selection', () => {
    it('should do nothing when every stream already has a language', async () => {
      streams().push(makeStream(1, 'audio', 'aac', { tags: { language: 'eng' } }));
      streams().push(makeStream(2, 'subtitle', 'subrip', { tags: { LANGUAGE: 'fre' } }));

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(2);
      expect(mockSpawn).not.toHaveBeenCalled();
      expect(axios).not.toHaveBeenCalled();
      expect(logText()).toContain('Nothing to label');
    });

    it('should skip removed streams, disabled types, empty URLs and unsupported codecs', async () => {
      streams().push(makeStream(1, 'audio', 'aac', { removed: true }));
      streams().push(makeStream(2, 'subtitle', 'hdmv_pgs_subtitle'));
      streams().push(makeStream(3, 'subtitle', 'eia_608'));
      streams().push(makeStream(4, 'audio', 'aac'));
      baseArgs.inputs.labelPictureSubtitles = 'false';
      baseArgs.inputs.audioApiUrl = '';

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(2);
      expect(mockSpawn).not.toHaveBeenCalled();
      expect(logText()).toContain('codec eia_608 is not supported');
      expect(logText()).toContain('Audio API URL is empty');
    });

    it('should stay und when the duration is unknown', async () => {
      streams().push(makeStream(1, 'audio', 'aac'));
      baseArgs.inputFileObj.ffProbeData = {};

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(2);
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('should throw when the FFmpeg command was not started', async () => {
      baseArgs.variables.ffmpegCommand.init = false;
      await expect(plugin(baseArgs)).rejects.toThrow('FFmpeg command plugins not used correctly');
    });

    it('should clean up its temporary files', async () => {
      streams().push(makeStream(1, 'audio', 'aac'));
      axios.mockImplementation(() => okResponse({ language: 'en' }));

      await plugin(baseArgs);

      expect(fs.readdirSync(workDir)).toEqual([]);
    });
  });
});
