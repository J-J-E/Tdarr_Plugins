import {
  plugin,
  details,
  analyseVideo,
  buildMasterDisplay,
  buildMaxCll,
  decideEncode,
} from '../../../../../../FlowPluginsTs/CommunityFlowPlugins/ffmpegCommand/ffmpegCommandSetVideoEncoderHdr/1.0.0/index';
import { IpluginInputArgs } from '../../../../../../FlowPluginsTs/FlowHelpers/1.0.0/interfaces/interfaces';

const mockExecFile = jest.fn();
jest.mock('child_process', () => ({
  execFile: (...a: unknown[]) => mockExecFile(...a),
}));

const masteringDisplay = {
  side_data_type: 'Mastering display metadata',
  red_x: '34000/50000',
  red_y: '16000/50000',
  green_x: '13250/50000',
  green_y: '34500/50000',
  blue_x: '7500/50000',
  blue_y: '3000/50000',
  white_point_x: '15635/50000',
  white_point_y: '16450/50000',
  min_luminance: '1/10000',
  max_luminance: '10000000/10000',
};
const contentLight = {
  side_data_type: 'Content light level metadata',
  max_content: 1000,
  max_average: 400,
};
const expectedMasterDisplay = 'G(13250,34500)B(7500,3000)R(34000,16000)WP(15635,16450)L(10000000,1)';

const sdr8 = {
  index: 0,
  codec_name: 'h264',
  codec_type: 'video',
  width: 1920,
  height: 1080,
  pix_fmt: 'yuv420p',
  color_range: 'tv',
  color_space: 'bt709',
  color_transfer: 'bt709',
  color_primaries: 'bt709',
};
const sdr10 = {
  ...sdr8, codec_name: 'hevc', pix_fmt: 'yuv420p10le', bits_per_raw_sample: '10',
};
const hdr10 = {
  index: 0,
  codec_name: 'hevc',
  codec_type: 'video',
  width: 3840,
  height: 2160,
  pix_fmt: 'yuv420p10le',
  color_range: 'tv',
  color_space: 'bt2020nc',
  color_transfer: 'smpte2084',
  color_primaries: 'bt2020',
  side_data_list: [masteringDisplay, contentLight],
};
const hlg = {
  ...hdr10, color_transfer: 'arib-std-b67', side_data_list: [],
};
const doviConfig = (profile: number, compat: number) => ({
  side_data_type: 'DOVI configuration record',
  dv_profile: profile,
  dv_bl_signal_compatibility_id: compat,
  rpu_present_flag: 1,
});
const dv5 = {
  ...hdr10,
  color_transfer: 'unknown',
  color_primaries: 'unknown',
  color_space: 'unknown',
  side_data_list: [doviConfig(5, 0)],
};
const dv8 = { ...hdr10, side_data_list: [masteringDisplay, contentLight, doviConfig(8, 1)] };
const dv7 = { ...hdr10, side_data_list: [masteringDisplay, contentLight, doviConfig(7, 6)] };
const hdr10plusFrame = [{ side_data_type: 'HDR Dynamic Metadata SMPTE2094-40 (HDR10+)' }];

const makeArgs = (video: Record<string, unknown>, inputs: Record<string, unknown> = {}): IpluginInputArgs => ({
  inputs,
  variables: {
    ffmpegCommand: {
      init: true,
      inputFiles: [],
      streams: [
        {
          ...video,
          removed: false,
          forceEncoding: false,
          inputArgs: [],
          outputArgs: [],
          mapArgs: ['-map', '0:0'],
        },
        {
          index: 1,
          codec_name: 'aac',
          codec_type: 'audio',
          removed: false,
          forceEncoding: false,
          inputArgs: [],
          outputArgs: [],
          mapArgs: ['-map', '0:1'],
        },
      ],
      container: 'mkv',
      hardwareDecoding: false,
      shouldProcess: false,
      overallInputArguments: [],
      overallOuputArguments: [],
    },
    flowFailed: false,
    user: {},
  },
  inputFileObj: {
    _id: '/data/test.mkv',
    ffProbeData: { streams: [video, { index: 1, codec_name: 'aac', codec_type: 'audio' }] },
  },
  ffmpegPath: '/usr/local/bin/ffmpeg',
  jobLog: jest.fn(),
} as unknown as IpluginInputArgs);

const mockFrameSideData = (sideData: unknown[]) => {
  mockExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
    cb(null, JSON.stringify({ frames: [{ side_data_list: sideData }] }));
  });
};

const valueAfter = (list: string[], flag: string): string => list[list.indexOf(flag) + 1];

describe('ffmpegCommandSetVideoEncoderHdr', () => {
  beforeEach(() => {
    mockExecFile.mockReset();
    mockFrameSideData([]);
  });

  describe('x265 unit conversion', () => {
    it('converts chromaticity x50000 and luminance x10000', () => {
      expect(buildMasterDisplay(masteringDisplay)).toBe(expectedMasterDisplay);
    });

    it('handles decimal values and rounds', () => {
      expect(buildMasterDisplay({
        red_x: '0.68',
        red_y: '0.32',
        green_x: '0.265',
        green_y: '0.69',
        blue_x: '0.15',
        blue_y: '0.06',
        white_point_x: '0.3127',
        white_point_y: '0.329',
        max_luminance: '1000',
        min_luminance: '0.005',
      })).toBe('G(13250,34500)B(7500,3000)R(34000,16000)WP(15635,16450)L(10000000,50)');
    });

    it('returns empty when a value is missing', () => {
      expect(buildMasterDisplay({ ...masteringDisplay, red_x: undefined })).toBe('');
      expect(buildMasterDisplay(undefined)).toBe('');
    });

    it('builds max-cll', () => {
      expect(buildMaxCll(contentLight)).toBe('1000,400');
      expect(buildMaxCll({ max_content: 'x', max_average: 1 })).toBe('');
      expect(buildMaxCll(undefined)).toBe('');
    });
  });

  describe('details', () => {
    it('has the documented defaults and two outputs', () => {
      const d = details();
      const defaults = Object.fromEntries(d.inputs.map((i) => [i.name, i.defaultValue]));
      expect(defaults).toEqual({
        crfSd: '22',
        crfHd: '22',
        crfUhd: '24',
        preset: 'medium',
        threads: '0',
        dvHdr10PlusAction: 'skip',
        forceEncoding: 'true',
      });
      expect(d.outputs).toHaveLength(2);
    });
  });

  describe('SDR', () => {
    it('keeps 8-bit as yuv420p', async () => {
      const result = await plugin(makeArgs(sdr8));
      const out = result.variables.ffmpegCommand.streams[0].outputArgs;
      expect(result.outputNumber).toBe(1);
      expect(result.variables.ffmpegCommand.shouldProcess).toBe(true);
      expect(out).toContain('libx265');
      expect(valueAfter(out, '-pix_fmt:{outputIndex}')).toBe('yuv420p');
      expect(valueAfter(out, '-crf')).toBe('22');
      expect(valueAfter(out, '-preset')).toBe('medium');
      expect(out).not.toContain('-threads');
      expect(out.join(' ')).not.toContain('hdr10');
      expect(result.variables.ffmpegCommand.streams[1].outputArgs).toEqual([]);
      expect(mockExecFile).not.toHaveBeenCalled();
    });

    it('keeps 10-bit as yuv420p10le and force-encodes existing HEVC', async () => {
      const result = await plugin(makeArgs(sdr10));
      const out = result.variables.ffmpegCommand.streams[0].outputArgs;
      expect(valueAfter(out, '-pix_fmt:{outputIndex}')).toBe('yuv420p10le');
      expect(out).toContain('libx265');
      expect(valueAfter(out, '-color_trc:{outputIndex}')).toBe('bt709');
    });

    it('leaves HEVC alone when force encoding is off', async () => {
      const result = await plugin(makeArgs(sdr10, { forceEncoding: false }));
      expect(result.outputNumber).toBe(1);
      expect(result.variables.ffmpegCommand.shouldProcess).toBe(false);
      expect(result.variables.ffmpegCommand.streams[0].outputArgs).toEqual([]);
    });

    it('picks CRF by resolution tier', async () => {
      const sd = await plugin(makeArgs({ ...sdr8, width: 720, height: 480 }, { crfSd: '19' }));
      expect(valueAfter(sd.variables.ffmpegCommand.streams[0].outputArgs, '-crf')).toBe('19');
      const scope720 = await plugin(makeArgs({ ...sdr8, width: 1280, height: 536 }, { crfHd: '21' }));
      expect(valueAfter(scope720.variables.ffmpegCommand.streams[0].outputArgs, '-crf')).toBe('21');
      const uhd = await plugin(makeArgs({ ...sdr8, width: 3840, height: 1600 }));
      expect(valueAfter(uhd.variables.ffmpegCommand.streams[0].outputArgs, '-crf')).toBe('24');
    });

    it('adds -threads and pools when threads is set', async () => {
      const result = await plugin(makeArgs(sdr8, { threads: '6' }));
      const out = result.variables.ffmpegCommand.streams[0].outputArgs;
      expect(valueAfter(out, '-threads')).toBe('6');
      expect(valueAfter(out, '-x265-params:{outputIndex}')).toBe('pools=6');
    });

    it('ignores cover art streams', async () => {
      const args = makeArgs(sdr8);
      args.variables.ffmpegCommand.streams.push({
        index: 2,
        codec_name: 'mjpeg',
        codec_type: 'video',
        removed: false,
        forceEncoding: false,
        inputArgs: [],
        outputArgs: [],
        mapArgs: ['-map', '0:2'],
      } as never);
      const result = await plugin(args);
      expect(result.variables.ffmpegCommand.streams[2].outputArgs).toEqual([]);
    });
  });

  describe('HDR10 and HLG', () => {
    it('encodes HDR10 as 10-bit with master-display and max-cll', async () => {
      const result = await plugin(makeArgs(hdr10, { threads: '4' }));
      const out = result.variables.ffmpegCommand.streams[0].outputArgs;
      expect(result.outputNumber).toBe(1);
      expect(valueAfter(out, '-pix_fmt:{outputIndex}')).toBe('yuv420p10le');
      expect(valueAfter(out, '-crf')).toBe('24');
      expect(valueAfter(out, '-color_primaries:{outputIndex}')).toBe('bt2020');
      expect(valueAfter(out, '-color_trc:{outputIndex}')).toBe('smpte2084');
      expect(valueAfter(out, '-colorspace:{outputIndex}')).toBe('bt2020nc');
      expect(valueAfter(out, '-color_range:{outputIndex}')).toBe('tv');
      expect(valueAfter(out, '-x265-params:{outputIndex}')).toBe(
        `hdr10=1:hdr10-opt=1:repeat-headers=1:master-display=${expectedMasterDisplay}:max-cll=1000,400:pools=4`,
      );
    });

    it('reads mastering display from frame side data when the stream has none', async () => {
      mockFrameSideData([masteringDisplay, contentLight]);
      const result = await plugin(makeArgs({ ...hdr10, side_data_list: [] }));
      const params = valueAfter(result.variables.ffmpegCommand.streams[0].outputArgs, '-x265-params:{outputIndex}');
      expect(params).toContain(`master-display=${expectedMasterDisplay}`);
      expect(params).toContain('max-cll=1000,400');
    });

    it('encodes HLG as 10-bit without master-display', async () => {
      const result = await plugin(makeArgs(hlg));
      const out = result.variables.ffmpegCommand.streams[0].outputArgs;
      expect(valueAfter(out, '-pix_fmt:{outputIndex}')).toBe('yuv420p10le');
      expect(valueAfter(out, '-color_trc:{outputIndex}')).toBe('arib-std-b67');
      expect(valueAfter(out, '-x265-params:{outputIndex}')).toBe('hdr10=1:hdr10-opt=1:repeat-headers=1');
    });

    it('still encodes when the frame probe fails', async () => {
      mockExecFile.mockImplementation((_c, _a, _o, cb) => cb(new Error('boom')));
      const result = await plugin(makeArgs(hdr10));
      expect(result.outputNumber).toBe(1);
      expect(result.variables.ffmpegCommand.streams[0].outputArgs).toContain('libx265');
    });
  });

  describe('Dolby Vision and HDR10+', () => {
    const expectSkipped = (result: Awaited<ReturnType<typeof plugin>>) => {
      expect(result.outputNumber).toBe(2);
      expect(result.variables.ffmpegCommand.shouldProcess).toBe(false);
      expect(result.variables.ffmpegCommand.streams[0].outputArgs).toEqual([]);
    };

    it('skips DV profile 5 by default', async () => {
      expectSkipped(await plugin(makeArgs(dv5)));
    });

    it('skips DV profile 5 even with encodeKeepHdr10Base', async () => {
      expectSkipped(await plugin(makeArgs(dv5, { dvHdr10PlusAction: 'encodeKeepHdr10Base' })));
    });

    it('skips DV profile 8 by default', async () => {
      expectSkipped(await plugin(makeArgs(dv8)));
    });

    it('encodes the base of DV profile 8 with encodeKeepHdr10Base', async () => {
      const result = await plugin(makeArgs(dv8, { dvHdr10PlusAction: 'encodeKeepHdr10Base' }));
      expect(result.outputNumber).toBe(1);
      expect(result.variables.ffmpegCommand.streams[0].outputArgs).toContain('libx265');
    });

    it('encodes the base of DV profile 7 with encodeKeepHdr10Base', async () => {
      const result = await plugin(makeArgs(dv7, { dvHdr10PlusAction: 'encodeKeepHdr10Base' }));
      expect(result.outputNumber).toBe(1);
    });

    it('skips DV profile 8 without a compatible base even with encodeKeepHdr10Base', async () => {
      const noBase = { ...hdr10, side_data_list: [doviConfig(8, 0)] };
      expectSkipped(await plugin(makeArgs(noBase, { dvHdr10PlusAction: 'encodeKeepHdr10Base' })));
    });

    it('skips HDR10+ found in frame side data by default', async () => {
      mockFrameSideData(hdr10plusFrame);
      expectSkipped(await plugin(makeArgs(hdr10)));
    });

    it('encodes HDR10+ base with encodeKeepHdr10Base', async () => {
      mockFrameSideData(hdr10plusFrame);
      const result = await plugin(makeArgs(hdr10, { dvHdr10PlusAction: 'encodeKeepHdr10Base' }));
      expect(result.outputNumber).toBe(1);
      expect(result.variables.ffmpegCommand.streams[0].outputArgs).toContain('libx265');
    });

    it('detects a Dolby Vision RPU in frame side data', async () => {
      mockFrameSideData([{ side_data_type: 'Dolby Vision RPU Data' }]);
      const result = await plugin(makeArgs(hdr10));
      expect(result.outputNumber).toBe(2);
    });
  });

  describe('pure helpers', () => {
    it('analyseVideo reports DV profile and bit depth', () => {
      const a = analyseVideo(dv8 as never);
      expect(a.isDolbyVision).toBe(true);
      expect(a.doviProfile).toBe(8);
      expect(a.doviCompatId).toBe(1);
      expect(a.bitDepth).toBe(10);
      expect(a.masterDisplay).toBe(expectedMasterDisplay);
    });

    it('decideEncode never allows profile 5', () => {
      const a = analyseVideo(dv5 as never);
      expect(decideEncode(a, 'encodeKeepHdr10Base').encode).toBe(false);
    });
  });
});
