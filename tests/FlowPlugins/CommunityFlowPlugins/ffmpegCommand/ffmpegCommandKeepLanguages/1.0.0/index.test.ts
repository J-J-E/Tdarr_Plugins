import { plugin, details } from
  '../../../../../../FlowPluginsTs/CommunityFlowPlugins/ffmpegCommand/ffmpegCommandKeepLanguages/1.0.0/index';
import { IpluginInputArgs } from '../../../../../../FlowPluginsTs/FlowHelpers/1.0.0/interfaces/interfaces';

const sampleH264 = require('../../../../../sampleData/media/sampleH264_1.json');

interface IFixtureStream {
  index: number,
  codec_type: string,
  codec_name: string,
  lang?: string,
  title?: string,
  def?: boolean,
  forced?: boolean,
}

const makeStream = (s: IFixtureStream) => ({
  index: s.index,
  codec_name: s.codec_name,
  codec_type: s.codec_type,
  tags: {
    ...(s.lang !== undefined ? { language: s.lang } : {}),
    ...(s.title !== undefined ? { title: s.title } : {}),
  },
  disposition: { default: s.def ? 1 : 0, forced: s.forced ? 1 : 0 },
  removed: false,
  forceEncoding: false,
  mapArgs: ['-map', `0:${s.index}`],
  inputArgs: [],
  outputArgs: [],
});

// ffprobe-like layout of a typical movie rip
const movieStreams = (): IFixtureStream[] => [
  { index: 0, codec_type: 'video', codec_name: 'hevc' },
  {
    index: 1, codec_type: 'audio', codec_name: 'eac3', lang: 'eng', def: true,
  },
  {
    index: 2, codec_type: 'audio', codec_name: 'ac3', lang: 'jpn',
  },
  {
    index: 3, codec_type: 'audio', codec_name: 'ac3', lang: 'fra',
  },
  {
    index: 4, codec_type: 'subtitle', codec_name: 'subrip', lang: 'eng',
  },
  {
    index: 5, codec_type: 'subtitle', codec_name: 'subrip', lang: 'jpn',
  },
  {
    index: 6, codec_type: 'subtitle', codec_name: 'subrip', lang: 'ger', forced: true,
  },
  {
    index: 7, codec_type: 'subtitle', codec_name: 'subrip', lang: 'ger',
  },
  { index: 8, codec_type: 'subtitle', codec_name: 'subrip' },
  {
    index: 9, codec_type: 'subtitle', codec_name: 'subrip', lang: 'und',
  },
  { index: 10, codec_type: 'attachment', codec_name: 'ttf' },
  { index: 11, codec_type: 'data', codec_name: 'bin_data' },
];

const mockAxios = jest.fn();

describe('ffmpegCommandKeepLanguages Plugin', () => {
  const makeArgs = (
    inputs: Record<string, unknown>,
    streams: IFixtureStream[] = movieStreams(),
    filePath = '/media/Movies/Test Movie (2020) [tmdbid-123]/Test Movie.mkv',
  ): IpluginInputArgs => ({
    inputs,
    variables: {
      ffmpegCommand: {
        init: true,
        inputFiles: [],
        streams: streams.map(makeStream),
        container: 'mkv',
        hardwareDecoding: false,
        shouldProcess: false,
        overallInputArguments: [],
        overallOuputArguments: [],
      },
      flowFailed: false,
      user: {},
    } as unknown as IpluginInputArgs['variables'],
    inputFileObj: { ...JSON.parse(JSON.stringify(sampleH264)), _id: filePath },
    originalLibraryFile: { ...JSON.parse(JSON.stringify(sampleH264)), _id: filePath },
    jobLog: jest.fn(),
    deps: { axios: mockAxios },
  } as unknown as IpluginInputArgs);

  const removedIndexes = (args: IpluginInputArgs): number[] => args.variables.ffmpegCommand.streams
    .filter((s) => s.removed).map((s) => s.index);

  beforeEach(() => {
    jest.clearAllMocks();
    mockAxios.mockReset();
  });

  describe('details', () => {
    it('has the documented inputs and two outputs', () => {
      const d = details();
      expect(d.inputs.map((i) => i.name)).toEqual([
        'languagesToKeep', 'keepOriginalLanguage', 'radarrUrl', 'radarrApiKey', 'sonarrUrl', 'sonarrApiKey',
        'tmdbApiKey', 'ifOriginalLanguageUnknown', 'keepForcedSubtitles', 'keepUndefined', 'streamTypes',
      ]);
      expect(d.inputs.find((i) => i.name === 'languagesToKeep')?.defaultValue).toBe('eng');
      expect(d.outputs.map((o) => o.number)).toEqual([1, 2]);
    });

    it('does not ship credentials or hosts as defaults', () => {
      details().inputs.filter((i) => /Url|ApiKey/.test(i.name)).forEach((i) => {
        expect(i.defaultValue).toBe('');
      });
    });
  });

  describe('keep list', () => {
    it('removes audio and subtitles outside the keep list, and leaves other streams alone', () => {
      const args = makeArgs({ languagesToKeep: 'eng', keepOriginalLanguage: false });
      return plugin(args).then((result) => {
        expect(result.outputNumber).toBe(1);
        // jpn/fra audio, jpn and non forced ger subs removed
        expect(removedIndexes(args)).toEqual([2, 3, 5, 7]);
        expect(mockAxios).not.toHaveBeenCalled();
      });
    });

    it('treats ISO 639-2 B/T, 639-1 and name variants as the same language', async () => {
      const args = makeArgs({ languagesToKeep: 'fra, deu, ja, English', keepOriginalLanguage: false });
      await plugin(args);
      // eng, jpn, fra and ger tracks all match, so nothing is removed
      expect(removedIndexes(args)).toEqual([]);
    });

    it('only filters the chosen stream types', async () => {
      const audioOnly = makeArgs({ languagesToKeep: 'eng', streamTypes: 'audio' });
      await plugin(audioOnly);
      expect(removedIndexes(audioOnly)).toEqual([2, 3]);

      const subsOnly = makeArgs({ languagesToKeep: 'eng', streamTypes: 'subtitle' });
      await plugin(subsOnly);
      expect(removedIndexes(subsOnly)).toEqual([5, 7]);
    });

    it('accepts a multi language list', async () => {
      const args = makeArgs({ languagesToKeep: 'eng,jpn' });
      await plugin(args);
      expect(removedIndexes(args)).toEqual([3, 7]);
    });
  });

  describe('forced subtitles', () => {
    it('keeps forced subtitles of any language by default', async () => {
      const args = makeArgs({ languagesToKeep: 'eng' });
      await plugin(args);
      expect(removedIndexes(args)).not.toContain(6);
    });

    it('detects forced from the title as well', async () => {
      const streams = movieStreams();
      streams[6] = {
        index: 6, codec_type: 'subtitle', codec_name: 'subrip', lang: 'ger', title: 'German [Forced]',
      };
      const args = makeArgs({ languagesToKeep: 'eng' }, streams);
      await plugin(args);
      expect(removedIndexes(args)).not.toContain(6);
    });

    it('removes forced subtitles when keepForcedSubtitles is off', async () => {
      const args = makeArgs({ languagesToKeep: 'eng', keepForcedSubtitles: 'false' });
      await plugin(args);
      expect(removedIndexes(args)).toContain(6);
    });
  });

  describe('undefined language', () => {
    it('keeps untagged and und streams by default', async () => {
      const args = makeArgs({ languagesToKeep: 'eng' });
      await plugin(args);
      expect(removedIndexes(args)).not.toContain(8);
      expect(removedIndexes(args)).not.toContain(9);
    });

    it('removes them when keepUndefined is off', async () => {
      const args = makeArgs({ languagesToKeep: 'eng', keepUndefined: false });
      await plugin(args);
      expect(removedIndexes(args)).toEqual(expect.arrayContaining([8, 9]));
    });

    it('keeps tags it cannot recognise', async () => {
      const streams = movieStreams();
      streams[2] = {
        index: 2, codec_type: 'audio', codec_name: 'ac3', lang: 'qaa',
      };
      const args = makeArgs({ languagesToKeep: 'eng' }, streams);
      await plugin(args);
      expect(removedIndexes(args)).not.toContain(2);
    });
  });

  describe('original language', () => {
    const radarrInputs = {
      languagesToKeep: 'eng',
      keepOriginalLanguage: true,
      radarrUrl: 'http://radarr:7878/',
      radarrApiKey: 'secret',
    };

    it('keeps the original language from Radarr found by tmdb id in the path', async () => {
      mockAxios.mockResolvedValueOnce({ data: [{ tmdbId: 123, originalLanguage: { name: 'Japanese' } }] });
      const args = makeArgs(radarrInputs);
      await plugin(args);

      expect(mockAxios).toHaveBeenCalledTimes(1);
      expect(mockAxios).toHaveBeenCalledWith(expect.objectContaining({
        url: 'http://radarr:7878/api/v3/movie',
        params: { tmdbId: '123' },
        headers: expect.objectContaining({ 'X-Api-Key': 'secret' }),
      }));
      expect(removedIndexes(args)).toEqual([3, 7]);
    });

    it('supports the {tmdb-N} naming and Sonarr for series', async () => {
      mockAxios.mockResolvedValueOnce({ data: [{ tmdbId: 55, originalLanguage: { name: 'Japanese' } }] });
      const args = makeArgs(
        {
          languagesToKeep: 'eng', keepOriginalLanguage: true, sonarrUrl: 'http://sonarr:8989', sonarrApiKey: 'k',
        },
        movieStreams(),
        '/media/TV/Show (2020) {tmdb-55}/Season 01/Show - S01E01.mkv',
      );
      await plugin(args);
      expect(mockAxios).toHaveBeenCalledWith(expect.objectContaining({
        url: 'http://sonarr:8989/api/v3/series',
        params: { tmdbId: '55' },
      }));
      expect(removedIndexes(args)).toEqual([3, 7]);
    });

    it('looks the title up by file name when the path has no tmdb id', async () => {
      mockAxios.mockResolvedValueOnce({ data: { movie: { originalLanguage: { name: 'French' } } } });
      const args = makeArgs(radarrInputs, movieStreams(), '/media/Movies/Test Movie (2020)/Test Movie (2020).mkv');
      await plugin(args);
      expect(mockAxios).toHaveBeenCalledWith(expect.objectContaining({
        url: 'http://radarr:7878/api/v3/parse',
        params: { title: 'Test Movie (2020).mkv' },
      }));
      expect(removedIndexes(args)).toEqual([2, 5, 7]);
    });

    it('falls back to the parse lookup when Radarr does not know the tmdb id', async () => {
      mockAxios
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: { movie: { originalLanguage: { name: 'Japanese' } } } });
      const args = makeArgs(radarrInputs);
      await plugin(args);
      expect(mockAxios).toHaveBeenCalledTimes(2);
      expect(removedIndexes(args)).toEqual([3, 7]);
    });

    it('uses TMDB when no Radarr or Sonarr is set', async () => {
      mockAxios.mockResolvedValueOnce({ data: { original_language: 'ja' } });
      const args = makeArgs({ languagesToKeep: 'eng', keepOriginalLanguage: true, tmdbApiKey: 'tmdbkey' });
      await plugin(args);
      expect(mockAxios).toHaveBeenCalledWith(expect.objectContaining({
        url: 'https://api.themoviedb.org/3/movie/123',
        params: { api_key: 'tmdbkey' },
      }));
      expect(removedIndexes(args)).toEqual([3, 7]);
    });

    it('uses TMDB after Radarr fails', async () => {
      mockAxios
        .mockRejectedValueOnce(new Error('connect ECONNREFUSED'))
        .mockResolvedValueOnce({ data: { original_language: 'ja' } });
      const args = makeArgs({ ...radarrInputs, tmdbApiKey: 'tmdbkey' });
      await plugin(args);
      expect(removedIndexes(args)).toEqual([3, 7]);
    });

    it('maps Radarr language names such as Chinese to the matching tracks', async () => {
      const streams = movieStreams();
      streams[2] = {
        index: 2, codec_type: 'audio', codec_name: 'ac3', lang: 'zho',
      };
      mockAxios.mockResolvedValueOnce({ data: [{ tmdbId: 123, originalLanguage: { name: 'Chinese' } }] });
      const args = makeArgs(radarrInputs, streams);
      await plugin(args);
      expect(removedIndexes(args)).not.toContain(2);
    });

    it('falls back to the keep list when the lookup fails', async () => {
      mockAxios.mockRejectedValue(new Error('timeout of 15000ms exceeded'));
      const args = makeArgs({ ...radarrInputs, ifOriginalLanguageUnknown: 'keepListOnly' });
      const result = await plugin(args);
      expect(result.outputNumber).toBe(1);
      expect(removedIndexes(args)).toEqual([2, 3, 5, 7]);
    });

    it('falls back to the keep list when nothing is configured', async () => {
      const args = makeArgs({
        languagesToKeep: 'eng', keepOriginalLanguage: true, ifOriginalLanguageUnknown: 'keepListOnly',
      });
      await plugin(args);
      expect(mockAxios).not.toHaveBeenCalled();
      expect(removedIndexes(args)).toEqual([2, 3, 5, 7]);
    });

    it('falls back to the keep list when Radarr returns an unrecognised language', async () => {
      mockAxios.mockResolvedValueOnce({ data: [{ tmdbId: 123, originalLanguage: { name: 'Klingon' } }] });
      const args = makeArgs({ ...radarrInputs, ifOriginalLanguageUnknown: 'keepListOnly' });
      await plugin(args);
      expect(removedIndexes(args)).toEqual([2, 3, 5, 7]);
    });

    it('does not call any service when keepOriginalLanguage is off', async () => {
      const args = makeArgs({ ...radarrInputs, keepOriginalLanguage: false });
      await plugin(args);
      expect(mockAxios).not.toHaveBeenCalled();
    });
  });

  describe('several instances and unknown original language', () => {
    const multiInputs = {
      languagesToKeep: 'eng',
      keepOriginalLanguage: true,
      radarrUrl: 'http://r1:7878, http://r2:7879/',
      radarrApiKey: 'k1,k2',
    };
    const known = { data: [{ tmdbId: 123, originalLanguage: { name: 'Japanese' } }] };

    it('tries the second instance when the first does not know the title', async () => {
      mockAxios
        .mockResolvedValueOnce({ data: [] }) // r1 movie
        .mockResolvedValueOnce({ data: { movie: undefined } }) // r1 parse
        .mockResolvedValueOnce(known); // r2 movie
      const args = makeArgs(multiInputs);
      await plugin(args);
      const urls = mockAxios.mock.calls.map((c) => c[0].url);
      expect(urls).toEqual([
        'http://r1:7878/api/v3/movie',
        'http://r1:7878/api/v3/parse',
        'http://r2:7879/api/v3/movie',
      ]);
      expect(mockAxios.mock.calls[2][0].headers['X-Api-Key']).toBe('k2');
      expect(removedIndexes(args)).toEqual([3, 7]);
    });

    it('resolves {{{args.userVariables.global.X}}} placeholders that Tdarr left in a comma list', async () => {
      mockAxios
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: { movie: undefined } })
        .mockResolvedValueOnce(known);
      const args = makeArgs({
        ...multiInputs,
        radarrApiKey: '{{{args.userVariables.global.keyOne}}}, {{{args.userVariables.global.keyTwo}}}',
      });
      (args as unknown as { userVariables: unknown }).userVariables = {
        global: { keyOne: 'k1', keyTwo: 'k2' }, library: {},
      };
      await plugin(args);
      expect(mockAxios.mock.calls[0][0].headers['X-Api-Key']).toBe('k1');
      expect(mockAxios.mock.calls[2][0].headers['X-Api-Key']).toBe('k2');
      expect(removedIndexes(args)).toEqual([3, 7]);
    });

    it('moves on to the next instance when one errors', async () => {
      mockAxios
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValueOnce(known);
      const args = makeArgs(multiInputs);
      await plugin(args);
      expect(removedIndexes(args)).toEqual([3, 7]);
    });

    it('tries several Sonarr instances for series', async () => {
      mockAxios
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: { series: undefined } })
        .mockResolvedValueOnce({ data: [{ tmdbId: 55, originalLanguage: { name: 'Japanese' } }] });
      const args = makeArgs(
        {
          languagesToKeep: 'eng',
          keepOriginalLanguage: true,
          sonarrUrl: 'http://s1:8989,http://s2:8990',
          sonarrApiKey: 'a,b',
        },
        movieStreams(),
        '/media/TV/Show (2020) {tmdb-55}/Season 01/Show - S01E01.mkv',
      );
      await plugin(args);
      expect(mockAxios.mock.calls[2][0].url).toBe('http://s2:8990/api/v3/series');
      expect(removedIndexes(args)).toEqual([3, 7]);
    });

    it('keeps all audio by default when every instance fails, and still filters subtitles', async () => {
      mockAxios.mockRejectedValue(new Error('timeout'));
      const args = makeArgs(multiInputs);
      const result = await plugin(args);
      expect(mockAxios).toHaveBeenCalledTimes(2);
      expect(removedIndexes(args)).toEqual([5, 7]);
      expect(result.outputNumber).toBe(1);
      expect(args.jobLog).toHaveBeenCalledWith(
        expect.stringContaining('ifOriginalLanguageUnknown=keepAllAudio applied'),
      );
    });

    it('keeps all audio when no instance knows the title', async () => {
      mockAxios.mockResolvedValue({ data: [] });
      const args = makeArgs({ ...multiInputs, ifOriginalLanguageUnknown: 'keepAllAudio' });
      await plugin(args);
      expect(removedIndexes(args)).toEqual([5, 7]);
    });

    it('keepListOnly keeps the old behaviour when every instance fails', async () => {
      mockAxios.mockRejectedValue(new Error('timeout'));
      const args = makeArgs({ ...multiInputs, ifOriginalLanguageUnknown: 'keepListOnly' });
      await plugin(args);
      expect(removedIndexes(args)).toEqual([2, 3, 5, 7]);
      expect(args.jobLog).toHaveBeenCalledWith(
        expect.stringContaining('ifOriginalLanguageUnknown=keepListOnly applied'),
      );
    });

    it('does not throw and keeps all audio when the key list is shorter than the URL list', async () => {
      mockAxios.mockResolvedValue({ data: [] });
      const args = makeArgs({ ...multiInputs, radarrApiKey: 'k1' });
      await plugin(args);
      expect(mockAxios.mock.calls.every((c) => c[0].url.startsWith('http://r1:7878'))).toBe(true);
      expect(removedIndexes(args)).toEqual([5, 7]);
    });

    it('does not apply the unknown handling when the language is known', async () => {
      mockAxios.mockResolvedValueOnce(known);
      const args = makeArgs({ ...multiInputs, radarrUrl: 'http://r1:7878', radarrApiKey: 'k1' });
      await plugin(args);
      expect(mockAxios).toHaveBeenCalledTimes(1);
      expect(removedIndexes(args)).toEqual([3, 7]);
    });
  });

  describe('guards', () => {
    it('never removes the last audio stream', async () => {
      const args = makeArgs({ languagesToKeep: 'spa' });
      const result = await plugin(args);
      const audio = args.variables.ffmpegCommand.streams.filter((s) => s.codec_type === 'audio');
      expect(audio.every((s) => !s.removed)).toBe(true);
      // the subtitles are still filtered
      expect(removedIndexes(args)).toEqual([4, 5, 7]);
      expect(result.outputNumber).toBe(1);
    });

    it('never touches video, attachments or data streams', async () => {
      const args = makeArgs({ languagesToKeep: 'xyz' });
      await plugin(args);
      [0, 10, 11].forEach((i) => expect(removedIndexes(args)).not.toContain(i));
    });

    it('makes another audio stream default when the default one is removed', async () => {
      const streams = movieStreams();
      streams[1].lang = 'fra';
      const args = makeArgs({ languagesToKeep: 'jpn', streamTypes: 'audio' }, streams);
      await plugin(args);
      expect(removedIndexes(args)).toEqual([1, 3]);
      const jpn = args.variables.ffmpegCommand.streams[2];
      expect(jpn.outputArgs).toEqual(['-disposition:a:{outputTypeIndex}', 'default']);
    });

    it('leaves dispositions alone when a kept audio stream is already default', async () => {
      const args = makeArgs({ languagesToKeep: 'eng' });
      await plugin(args);
      args.variables.ffmpegCommand.streams.forEach((s) => expect(s.outputArgs).toEqual([]));
    });

    it('throws when the ffmpeg command was not started', async () => {
      const args = makeArgs({ languagesToKeep: 'eng' });
      args.variables.ffmpegCommand.init = false;
      await expect(plugin(args)).rejects.toThrow('FFmpeg command plugins not used correctly');
    });
  });

  describe('nothing to remove', () => {
    it('uses output 2 when every stream is kept', async () => {
      const args = makeArgs({ languagesToKeep: 'eng,jpn,fre,ger' });
      const result = await plugin(args);
      expect(result.outputNumber).toBe(2);
      expect(removedIndexes(args)).toEqual([]);
      expect(result.outputFileObj).toBe(args.inputFileObj);
    });

    it('uses output 2 for a file with no audio or subtitles', async () => {
      const args = makeArgs({ languagesToKeep: 'eng' }, [{ index: 0, codec_type: 'video', codec_name: 'h264' }]);
      const result = await plugin(args);
      expect(result.outputNumber).toBe(2);
    });
  });
});
