import { execFile } from 'child_process';
import { checkFfmpegCommandInit } from '../../../../FlowHelpers/1.0.0/interfaces/flowUtils';
import {
  IffmpegCommandStream,
  IpluginDetails,
  IpluginInputArgs,
  IpluginOutputArgs,
} from '../../../../FlowHelpers/1.0.0/interfaces/interfaces';
import { Istreams } from '../../../../FlowHelpers/1.0.0/interfaces/synced/IFileObject';

/* eslint-disable no-param-reassign */
const details = (): IpluginDetails => ({
  name: 'Set Video Encoder x265 (HDR-safe)',
  description: 'Encode video with libx265 on the CPU while keeping the bit depth and HDR10/HLG metadata. '
    + 'SDR keeps its bit depth (8-bit stays 8-bit, 10-bit stays 10-bit). HDR10/HLG is encoded as 10-bit with the '
    + 'colour tags passed through and x265 master-display / max-cll built from the source side data. '
    + 'Dolby Vision and HDR10+ files are skipped by default (output 2) because libx265 cannot carry their metadata, '
    + 'so the flow can route them to a Dolby Vision aware plugin.',
  style: {
    borderColor: '#6efefc',
  },
  tags: 'video,hevc,x265,hdr',
  isStartPlugin: false,
  pType: '',
  requiresVersion: '2.11.01',
  sidebarPosition: -1,
  icon: '',
  inputs: [
    {
      label: 'CRF for SD',
      name: 'crfSd',
      type: 'number',
      defaultValue: '22',
      inputUI: {
        type: 'text',
      },
      tooltip: 'x265 CRF for sources up to 1024 pixels wide and 576 lines high.',
    },
    {
      label: 'CRF for HD',
      name: 'crfHd',
      type: 'number',
      defaultValue: '22',
      inputUI: {
        type: 'text',
      },
      tooltip: 'x265 CRF for sources above SD and up to 2560 pixels wide and 1440 lines high.',
    },
    {
      label: 'CRF for UHD',
      name: 'crfUhd',
      type: 'number',
      defaultValue: '24',
      inputUI: {
        type: 'text',
      },
      tooltip: 'x265 CRF for sources wider than 2560 pixels or taller than 1440 lines.',
    },
    {
      label: 'Preset',
      name: 'preset',
      type: 'string',
      defaultValue: 'medium',
      inputUI: {
        type: 'dropdown',
        options: [
          'ultrafast',
          'superfast',
          'veryfast',
          'faster',
          'fast',
          'medium',
          'slow',
          'slower',
          'veryslow',
        ],
      },
      tooltip: 'x265 preset.',
    },
    {
      label: 'Threads',
      name: 'threads',
      type: 'number',
      defaultValue: '0',
      inputUI: {
        type: 'text',
      },
      tooltip: '0 lets x265 choose. Above 0 adds -threads N and the x265 option pools=N, '
        + 'which limits the CPU used per worker.',
    },
    {
      label: 'Dolby Vision / HDR10+ Action',
      name: 'dvHdr10PlusAction',
      type: 'string',
      defaultValue: 'skip',
      inputUI: {
        type: 'dropdown',
        options: [
          'skip',
          'encodeKeepHdr10Base',
        ],
      },
      tooltip: 'skip: leave the file untouched and continue on output 2. '
        + 'encodeKeepHdr10Base: encode the HDR10 base layer only; the Dolby Vision or HDR10+ metadata is lost. '
        + 'Only allowed for Dolby Vision profile 7 or 8 with a backwards compatible base, or HDR10+ on a PQ base. '
        + 'Dolby Vision profile 5 is always skipped.',
    },
    {
      label: 'Force Encoding',
      name: 'forceEncoding',
      type: 'boolean',
      defaultValue: 'true',
      inputUI: {
        type: 'switch',
      },
      tooltip: 'Encode even when the video is already HEVC. '
        + 'Pair with a file size comparison later in the flow to keep only smaller results.',
    },
  ],
  outputs: [
    {
      number: 1,
      tooltip: 'Continue to next plugin (video set to libx265, or left as is when not forced and already HEVC)',
    },
    {
      number: 2,
      tooltip: 'Skipped: Dolby Vision or HDR10+ detected (or encodeKeepHdr10Base not allowed), nothing changed',
    },
  ],
});

interface IsideData {
  side_data_type?: string,
  [key: string]: unknown,
}

interface IvideoAnalysis {
  bitDepth: number,
  width: number,
  height: number,
  primaries: string,
  transfer: string,
  matrix: string,
  range: string,
  isHdr: boolean,
  masterDisplay: string,
  maxCll: string,
  isDolbyVision: boolean,
  doviProfile: number,
  doviCompatId: number,
  isHdr10Plus: boolean,
}

interface IencodeDecision {
  encode: boolean,
  reason: string,
}

interface IencodeSettings {
  crfSd: number,
  crfHd: number,
  crfUhd: number,
  preset: string,
  threads: number,
}

/** "13250/50000", "0.265" or 1000 to a number. NaN when not parseable. */
const toNumber = (value: unknown): number => {
  if (value === undefined || value === null || value === '') {
    return NaN;
  }
  const match = String(value).match(/^\s*(-?[\d.]+)\s*\/\s*(-?[\d.]+)\s*$/);
  if (match) {
    const denominator = parseFloat(match[2]);
    return denominator === 0 ? NaN : parseFloat(match[1]) / denominator;
  }
  return Number(value);
};

/**
 * x265 master-display string from ffprobe "Mastering display metadata" side data.
 * x265 units: chromaticity in steps of 0.00002 (x50000), luminance in steps of 0.0001 cd/m2 (x10000).
 * Returns '' when any value is missing.
 */
const buildMasterDisplay = (sd?: IsideData): string => {
  if (!sd) {
    return '';
  }
  const keys = [
    'green_x', 'green_y', 'blue_x', 'blue_y', 'red_x', 'red_y',
    'white_point_x', 'white_point_y', 'max_luminance', 'min_luminance',
  ];
  const v: Record<string, number> = {};
  for (let i = 0; i < keys.length; i += 1) {
    v[keys[i]] = toNumber(sd[keys[i]]);
    if (!Number.isFinite(v[keys[i]])) {
      return '';
    }
  }
  const c = (x: number): number => Math.round(x * 50000);
  const l = (x: number): number => Math.round(x * 10000);
  return `G(${c(v.green_x)},${c(v.green_y)})B(${c(v.blue_x)},${c(v.blue_y)})`
    + `R(${c(v.red_x)},${c(v.red_y)})WP(${c(v.white_point_x)},${c(v.white_point_y)})`
    + `L(${l(v.max_luminance)},${l(v.min_luminance)})`;
};

/** x265 max-cll string "maxCLL,maxFALL" from ffprobe "Content light level metadata" side data. */
const buildMaxCll = (sd?: IsideData): string => {
  if (!sd) {
    return '';
  }
  const maxContent = toNumber(sd.max_content);
  const maxAverage = toNumber(sd.max_average);
  if (!Number.isFinite(maxContent) || !Number.isFinite(maxAverage)) {
    return '';
  }
  return `${Math.round(maxContent)},${Math.round(maxAverage)}`;
};

const findSideData = (list: IsideData[], re: RegExp): IsideData | undefined => list.find(
  (sd) => re.test(String(sd.side_data_type || '')),
);

const getBitDepth = (stream: Istreams): number => {
  const raw = parseInt(String(stream.bits_per_raw_sample || ''), 10);
  if (raw > 0) {
    return raw;
  }
  const match = String(stream.pix_fmt || '').match(/(\d+)(le|be)/);
  return match ? parseInt(match[1], 10) : 8;
};

/**
 * Work out what a video stream is from its ffprobe stream data and the side data of its first frame.
 * Side data is read from the stream and from the frame (mastering display and content light level
 * live on the stream in MKV/MP4, HDR10+ and Dolby Vision RPU only on frames).
 */
const analyseVideo = (stream: Istreams, frameSideData: IsideData[] = []): IvideoAnalysis => {
  const streamSideData: IsideData[] = Array.isArray(stream.side_data_list) ? stream.side_data_list : [];
  const all = [...streamSideData, ...frameSideData];

  const dovi = findSideData(all, /dovi configuration/i);
  const doviRpu = findSideData(all, /dolby vision (rpu|metadata)/i);
  const hdr10Plus = findSideData(all, /smpte2094-40|hdr10\+|hdr dynamic metadata/i);
  const transfer = String(stream.color_transfer || '');

  return {
    bitDepth: getBitDepth(stream),
    width: Number(stream.width) || 0,
    height: Number(stream.height) || 0,
    primaries: String(stream.color_primaries || ''),
    transfer,
    matrix: String(stream.color_space || ''),
    range: String(stream.color_range || ''),
    isHdr: transfer === 'smpte2084' || transfer === 'arib-std-b67',
    masterDisplay: buildMasterDisplay(findSideData(all, /mastering display/i)),
    maxCll: buildMaxCll(findSideData(all, /content light level/i)),
    isDolbyVision: !!dovi || !!doviRpu,
    doviProfile: dovi ? parseInt(String(dovi.dv_profile), 10) : -1,
    doviCompatId: dovi ? parseInt(String(dovi.dv_bl_signal_compatibility_id), 10) : -1,
    isHdr10Plus: !!hdr10Plus,
  };
};

/** Encode, or skip because libx265 cannot carry the Dolby Vision / HDR10+ metadata. */
const decideEncode = (a: IvideoAnalysis, action: string): IencodeDecision => {
  if (a.isDolbyVision && a.doviProfile === 5) {
    return {
      encode: false,
      reason: 'Dolby Vision profile 5 has no HDR10 base layer (IPT-PQ-C2 colours would be wrong)',
    };
  }

  if (a.isDolbyVision || a.isHdr10Plus) {
    const kind = a.isDolbyVision
      ? `Dolby Vision profile ${a.doviProfile} (compat id ${a.doviCompatId})`
      : 'HDR10+ dynamic metadata';

    if (action !== 'encodeKeepHdr10Base') {
      return { encode: false, reason: `${kind} found, libx265 cannot keep it (action: skip)` };
    }
    if (a.isDolbyVision && a.doviProfile !== 7 && a.doviProfile !== 8) {
      return { encode: false, reason: `${kind} is not profile 7 or 8, encodeKeepHdr10Base not allowed` };
    }
    if (a.isDolbyVision && a.doviCompatId === 0) {
      return { encode: false, reason: `${kind} has no backwards compatible base layer` };
    }
    if (!a.isDolbyVision && a.transfer !== 'smpte2084') {
      return { encode: false, reason: `${kind} without a PQ base, encodeKeepHdr10Base not allowed` };
    }
    return { encode: true, reason: `${kind}: encoding the HDR base layer only, the dynamic metadata is lost` };
  }

  return { encode: true, reason: a.isHdr ? 'HDR10/HLG' : 'SDR' };
};

const pickCrf = (a: IvideoAnalysis, settings: IencodeSettings): number => {
  if (a.width > 2560 || a.height > 1440) {
    return settings.crfUhd;
  }
  if (a.width <= 1024 && a.height <= 576) {
    return settings.crfSd;
  }
  return settings.crfHd;
};

/**
 * ffmpeg output arguments for one video stream. '{outputIndex}' is replaced by ffmpegCommandExecute.
 * The caller must already have decided to encode.
 */
const buildOutputArgs = (a: IvideoAnalysis, settings: IencodeSettings): string[] => {
  const pixFmt = a.isHdr || a.bitDepth > 8 ? 'yuv420p10le' : 'yuv420p';
  const outputArgs = [
    '-c:{outputIndex}', 'libx265',
    '-crf', String(pickCrf(a, settings)),
    '-preset', settings.preset,
    '-pix_fmt:{outputIndex}', pixFmt,
  ];

  if (a.primaries && a.primaries !== 'unknown') {
    outputArgs.push('-color_primaries:{outputIndex}', a.primaries);
  }
  if (a.transfer && a.transfer !== 'unknown') {
    outputArgs.push('-color_trc:{outputIndex}', a.transfer);
  }
  if (a.matrix && a.matrix !== 'unknown') {
    outputArgs.push('-colorspace:{outputIndex}', a.matrix);
  }
  if (a.range === 'tv' || a.range === 'pc') {
    outputArgs.push('-color_range:{outputIndex}', a.range);
  }

  const x265Params: string[] = [];
  if (a.isHdr) {
    x265Params.push('hdr10=1', 'hdr10-opt=1', 'repeat-headers=1');
    if (a.masterDisplay) {
      x265Params.push(`master-display=${a.masterDisplay}`);
    }
    if (a.maxCll) {
      x265Params.push(`max-cll=${a.maxCll}`);
    }
  }
  if (settings.threads > 0) {
    outputArgs.push('-threads', String(settings.threads));
    x265Params.push(`pools=${settings.threads}`);
  }
  if (x265Params.length > 0) {
    outputArgs.push('-x265-params:{outputIndex}', x265Params.join(':'));
  }

  return outputArgs;
};

const getFfprobePath = (ffmpegPath: string): string => {
  const path = String(ffmpegPath || 'ffmpeg');
  return /ffmpeg(\.exe)?$/i.test(path)
    ? path.replace(/ffmpeg(\.exe)?$/i, (m) => m.replace(/ffmpeg/i, 'ffprobe'))
    : 'ffprobe';
};

/** Side data of the first frame of a stream (HDR10+ and Dolby Vision RPU only exist at frame level). */
const probeFrameSideData = (
  ffmpegPath: string,
  filePath: string,
  streamIndex: number,
): Promise<IsideData[]> => new Promise((resolve, reject) => {
  execFile(
    getFfprobePath(ffmpegPath),
    [
      '-v', 'error', '-print_format', 'json', '-select_streams', String(streamIndex),
      '-show_frames', '-read_intervals', '%+#1', filePath,
    ],
    { timeout: 120000, maxBuffer: 16 * 1024 * 1024 },
    (err, stdout) => {
      if (err) {
        reject(err);
        return;
      }
      try {
        const frames = JSON.parse(stdout).frames || [];
        resolve((frames[0] && frames[0].side_data_list) || []);
      } catch (e) {
        reject(e);
      }
    },
  );
});

const isRealVideoStream = (stream: IffmpegCommandStream): boolean => stream.codec_type === 'video'
  && !['mjpeg', 'png', 'bmp', 'gif'].includes(stream.codec_name)
  && !(stream.disposition && stream.disposition.attached_pic === 1);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const plugin = async (args: IpluginInputArgs): Promise<IpluginOutputArgs> => {
  const lib = require('../../../../../methods/lib')();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars,no-param-reassign
  args.inputs = lib.loadDefaultValues(args.inputs, details);

  checkFfmpegCommandInit(args);

  const asCrf = (value: unknown, fallback: number): number => (Number(value) > 0 ? Number(value) : fallback);
  const settings: IencodeSettings = {
    crfSd: asCrf(args.inputs.crfSd, 22),
    crfHd: asCrf(args.inputs.crfHd, 22),
    crfUhd: asCrf(args.inputs.crfUhd, 24),
    preset: String(args.inputs.preset),
    threads: Math.max(0, Math.floor(Number(args.inputs.threads)) || 0),
  };
  const action = String(args.inputs.dvHdr10PlusAction);
  const forceEncoding = args.inputs.forceEncoding === true;

  const probeStreams: Istreams[] = (args.inputFileObj.ffProbeData && args.inputFileObj.ffProbeData.streams) || [];
  const targets: { stream: IffmpegCommandStream, analysis: IvideoAnalysis }[] = [];

  for (let i = 0; i < args.variables.ffmpegCommand.streams.length; i += 1) {
    const stream = args.variables.ffmpegCommand.streams[i];
    if (isRealVideoStream(stream)) {
      const probeStream = probeStreams.find((s) => s.index === stream.index) || stream;

      let frameSideData: IsideData[] = [];
      const hasDoviConfig = Array.isArray(probeStream.side_data_list)
        && probeStream.side_data_list.some((sd: IsideData) => /dovi/i.test(String(sd.side_data_type)));
      const isHdrTransfer = ['smpte2084', 'arib-std-b67'].includes(probeStream.color_transfer);
      if (isHdrTransfer || hasDoviConfig) {
        try {
          // eslint-disable-next-line no-await-in-loop
          frameSideData = await probeFrameSideData(args.ffmpegPath, args.inputFileObj._id, stream.index);
        } catch (err) {
          args.jobLog(`Could not read frame side data (HDR10+ / Dolby Vision RPU detection limited): ${err}`);
        }
      }

      const analysis = analyseVideo(probeStream, frameSideData);
      args.jobLog(`Video stream ${stream.index}: ${analysis.width}x${analysis.height} ${analysis.bitDepth}-bit`
        + ` primaries=${analysis.primaries || 'n/a'} transfer=${analysis.transfer || 'n/a'}`
        + ` master-display=${analysis.masterDisplay || 'none'} max-cll=${analysis.maxCll || 'none'}`);

      const decision = decideEncode(analysis, action);
      if (!decision.encode) {
        args.jobLog(`Skipping, nothing changed: ${decision.reason}`);
        return {
          outputFileObj: args.inputFileObj,
          outputNumber: 2,
          variables: args.variables,
        };
      }
      args.jobLog(`Stream ${stream.index}: ${decision.reason}`);
      targets.push({ stream, analysis });
    }
  }

  targets.forEach(({ stream, analysis }) => {
    if (!forceEncoding && stream.codec_name === 'hevc') {
      args.jobLog(`Stream ${stream.index} is already hevc and Force Encoding is off, leaving it`);
      return;
    }
    args.variables.ffmpegCommand.shouldProcess = true;
    stream.outputArgs.push(...buildOutputArgs(analysis, settings));
  });

  return {
    outputFileObj: args.inputFileObj,
    outputNumber: 1,
    variables: args.variables,
  };
};

export {
  details,
  plugin,
  analyseVideo,
  buildMasterDisplay,
  buildMaxCll,
  buildOutputArgs,
  decideEncode,
};
