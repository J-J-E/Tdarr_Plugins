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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decideEncode = exports.buildOutputArgs = exports.buildMaxCll = exports.buildMasterDisplay = exports.analyseVideo = exports.plugin = exports.details = void 0;
var child_process_1 = require("child_process");
var flowUtils_1 = require("../../../../FlowHelpers/1.0.0/interfaces/flowUtils");
/* eslint-disable no-param-reassign */
var details = function () { return ({
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
}); };
exports.details = details;
/** "13250/50000", "0.265" or 1000 to a number. NaN when not parseable. */
var toNumber = function (value) {
    if (value === undefined || value === null || value === '') {
        return NaN;
    }
    var match = String(value).match(/^\s*(-?[\d.]+)\s*\/\s*(-?[\d.]+)\s*$/);
    if (match) {
        var denominator = parseFloat(match[2]);
        return denominator === 0 ? NaN : parseFloat(match[1]) / denominator;
    }
    return Number(value);
};
/**
 * x265 master-display string from ffprobe "Mastering display metadata" side data.
 * x265 units: chromaticity in steps of 0.00002 (x50000), luminance in steps of 0.0001 cd/m2 (x10000).
 * Returns '' when any value is missing.
 */
var buildMasterDisplay = function (sd) {
    if (!sd) {
        return '';
    }
    var keys = [
        'green_x', 'green_y', 'blue_x', 'blue_y', 'red_x', 'red_y',
        'white_point_x', 'white_point_y', 'max_luminance', 'min_luminance',
    ];
    var v = {};
    for (var i = 0; i < keys.length; i += 1) {
        v[keys[i]] = toNumber(sd[keys[i]]);
        if (!Number.isFinite(v[keys[i]])) {
            return '';
        }
    }
    var c = function (x) { return Math.round(x * 50000); };
    var l = function (x) { return Math.round(x * 10000); };
    return "G(".concat(c(v.green_x), ",").concat(c(v.green_y), ")B(").concat(c(v.blue_x), ",").concat(c(v.blue_y), ")")
        + "R(".concat(c(v.red_x), ",").concat(c(v.red_y), ")WP(").concat(c(v.white_point_x), ",").concat(c(v.white_point_y), ")")
        + "L(".concat(l(v.max_luminance), ",").concat(l(v.min_luminance), ")");
};
exports.buildMasterDisplay = buildMasterDisplay;
/** x265 max-cll string "maxCLL,maxFALL" from ffprobe "Content light level metadata" side data. */
var buildMaxCll = function (sd) {
    if (!sd) {
        return '';
    }
    var maxContent = toNumber(sd.max_content);
    var maxAverage = toNumber(sd.max_average);
    if (!Number.isFinite(maxContent) || !Number.isFinite(maxAverage)) {
        return '';
    }
    return "".concat(Math.round(maxContent), ",").concat(Math.round(maxAverage));
};
exports.buildMaxCll = buildMaxCll;
var findSideData = function (list, re) { return list.find(function (sd) { return re.test(String(sd.side_data_type || '')); }); };
var getBitDepth = function (stream) {
    var raw = parseInt(String(stream.bits_per_raw_sample || ''), 10);
    if (raw > 0) {
        return raw;
    }
    var match = String(stream.pix_fmt || '').match(/(\d+)(le|be)/);
    return match ? parseInt(match[1], 10) : 8;
};
/**
 * Work out what a video stream is from its ffprobe stream data and the side data of its first frame.
 * Side data is read from the stream and from the frame (mastering display and content light level
 * live on the stream in MKV/MP4, HDR10+ and Dolby Vision RPU only on frames).
 */
var analyseVideo = function (stream, frameSideData) {
    if (frameSideData === void 0) { frameSideData = []; }
    var streamSideData = Array.isArray(stream.side_data_list) ? stream.side_data_list : [];
    var all = __spreadArray(__spreadArray([], streamSideData, true), frameSideData, true);
    var dovi = findSideData(all, /dovi configuration/i);
    var doviRpu = findSideData(all, /dolby vision (rpu|metadata)/i);
    var hdr10Plus = findSideData(all, /smpte2094-40|hdr10\+|hdr dynamic metadata/i);
    var transfer = String(stream.color_transfer || '');
    return {
        bitDepth: getBitDepth(stream),
        width: Number(stream.width) || 0,
        height: Number(stream.height) || 0,
        primaries: String(stream.color_primaries || ''),
        transfer: transfer,
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
exports.analyseVideo = analyseVideo;
/** Encode, or skip because libx265 cannot carry the Dolby Vision / HDR10+ metadata. */
var decideEncode = function (a, action) {
    if (a.isDolbyVision && a.doviProfile === 5) {
        return {
            encode: false,
            reason: 'Dolby Vision profile 5 has no HDR10 base layer (IPT-PQ-C2 colours would be wrong)',
        };
    }
    if (a.isDolbyVision || a.isHdr10Plus) {
        var kind = a.isDolbyVision
            ? "Dolby Vision profile ".concat(a.doviProfile, " (compat id ").concat(a.doviCompatId, ")")
            : 'HDR10+ dynamic metadata';
        if (action !== 'encodeKeepHdr10Base') {
            return { encode: false, reason: "".concat(kind, " found, libx265 cannot keep it (action: skip)") };
        }
        if (a.isDolbyVision && a.doviProfile !== 7 && a.doviProfile !== 8) {
            return { encode: false, reason: "".concat(kind, " is not profile 7 or 8, encodeKeepHdr10Base not allowed") };
        }
        if (a.isDolbyVision && a.doviCompatId === 0) {
            return { encode: false, reason: "".concat(kind, " has no backwards compatible base layer") };
        }
        if (!a.isDolbyVision && a.transfer !== 'smpte2084') {
            return { encode: false, reason: "".concat(kind, " without a PQ base, encodeKeepHdr10Base not allowed") };
        }
        return { encode: true, reason: "".concat(kind, ": encoding the HDR base layer only, the dynamic metadata is lost") };
    }
    return { encode: true, reason: a.isHdr ? 'HDR10/HLG' : 'SDR' };
};
exports.decideEncode = decideEncode;
var pickCrf = function (a, settings) {
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
var buildOutputArgs = function (a, settings) {
    var pixFmt = a.isHdr || a.bitDepth > 8 ? 'yuv420p10le' : 'yuv420p';
    var outputArgs = [
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
    var x265Params = [];
    if (a.isHdr) {
        x265Params.push('hdr10=1', 'hdr10-opt=1', 'repeat-headers=1');
        if (a.masterDisplay) {
            x265Params.push("master-display=".concat(a.masterDisplay));
        }
        if (a.maxCll) {
            x265Params.push("max-cll=".concat(a.maxCll));
        }
    }
    if (settings.threads > 0) {
        outputArgs.push('-threads', String(settings.threads));
        x265Params.push("pools=".concat(settings.threads));
    }
    if (x265Params.length > 0) {
        outputArgs.push('-x265-params:{outputIndex}', x265Params.join(':'));
    }
    return outputArgs;
};
exports.buildOutputArgs = buildOutputArgs;
var getFfprobePath = function (ffmpegPath) {
    var path = String(ffmpegPath || 'ffmpeg');
    return /ffmpeg(\.exe)?$/i.test(path)
        ? path.replace(/ffmpeg(\.exe)?$/i, function (m) { return m.replace(/ffmpeg/i, 'ffprobe'); })
        : 'ffprobe';
};
/** Side data of the first frame of a stream (HDR10+ and Dolby Vision RPU only exist at frame level). */
var probeFrameSideData = function (ffmpegPath, filePath, streamIndex) { return new Promise(function (resolve, reject) {
    (0, child_process_1.execFile)(getFfprobePath(ffmpegPath), [
        '-v', 'error', '-print_format', 'json', '-select_streams', String(streamIndex),
        '-show_frames', '-read_intervals', '%+#1', filePath,
    ], { timeout: 120000, maxBuffer: 16 * 1024 * 1024 }, function (err, stdout) {
        if (err) {
            reject(err);
            return;
        }
        try {
            var frames_1 = JSON.parse(stdout).frames || [];
            resolve((frames_1[0] && frames_1[0].side_data_list) || []);
        }
        catch (e) {
            reject(e);
        }
    });
}); };
var isRealVideoStream = function (stream) { return stream.codec_type === 'video'
    && !['mjpeg', 'png', 'bmp', 'gif'].includes(stream.codec_name)
    && !(stream.disposition && stream.disposition.attached_pic === 1); };
// eslint-disable-next-line @typescript-eslint/no-unused-vars
var plugin = function (args) { return __awaiter(void 0, void 0, void 0, function () {
    var lib, asCrf, settings, action, forceEncoding, probeStreams, targets, _loop_1, i, state_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                lib = require('../../../../../methods/lib')();
                // eslint-disable-next-line @typescript-eslint/no-unused-vars,no-param-reassign
                args.inputs = lib.loadDefaultValues(args.inputs, details);
                (0, flowUtils_1.checkFfmpegCommandInit)(args);
                asCrf = function (value, fallback) { return (Number(value) > 0 ? Number(value) : fallback); };
                settings = {
                    crfSd: asCrf(args.inputs.crfSd, 22),
                    crfHd: asCrf(args.inputs.crfHd, 22),
                    crfUhd: asCrf(args.inputs.crfUhd, 24),
                    preset: String(args.inputs.preset),
                    threads: Math.max(0, Math.floor(Number(args.inputs.threads)) || 0),
                };
                action = String(args.inputs.dvHdr10PlusAction);
                forceEncoding = args.inputs.forceEncoding === true;
                probeStreams = (args.inputFileObj.ffProbeData && args.inputFileObj.ffProbeData.streams) || [];
                targets = [];
                _loop_1 = function (i) {
                    var stream, probeStream, frameSideData, hasDoviConfig, isHdrTransfer, err_1, analysis, decision;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                stream = args.variables.ffmpegCommand.streams[i];
                                if (!isRealVideoStream(stream)) return [3 /*break*/, 5];
                                probeStream = probeStreams.find(function (s) { return s.index === stream.index; }) || stream;
                                frameSideData = [];
                                hasDoviConfig = Array.isArray(probeStream.side_data_list)
                                    && probeStream.side_data_list.some(function (sd) { return /dovi/i.test(String(sd.side_data_type)); });
                                isHdrTransfer = ['smpte2084', 'arib-std-b67'].includes(probeStream.color_transfer);
                                if (!(isHdrTransfer || hasDoviConfig)) return [3 /*break*/, 4];
                                _b.label = 1;
                            case 1:
                                _b.trys.push([1, 3, , 4]);
                                return [4 /*yield*/, probeFrameSideData(args.ffmpegPath, args.inputFileObj._id, stream.index)];
                            case 2:
                                // eslint-disable-next-line no-await-in-loop
                                frameSideData = _b.sent();
                                return [3 /*break*/, 4];
                            case 3:
                                err_1 = _b.sent();
                                args.jobLog("Could not read frame side data (HDR10+ / Dolby Vision RPU detection limited): ".concat(err_1));
                                return [3 /*break*/, 4];
                            case 4:
                                analysis = analyseVideo(probeStream, frameSideData);
                                args.jobLog("Video stream ".concat(stream.index, ": ").concat(analysis.width, "x").concat(analysis.height, " ").concat(analysis.bitDepth, "-bit")
                                    + " primaries=".concat(analysis.primaries || 'n/a', " transfer=").concat(analysis.transfer || 'n/a')
                                    + " master-display=".concat(analysis.masterDisplay || 'none', " max-cll=").concat(analysis.maxCll || 'none'));
                                decision = decideEncode(analysis, action);
                                if (!decision.encode) {
                                    args.jobLog("Skipping, nothing changed: ".concat(decision.reason));
                                    return [2 /*return*/, { value: {
                                                outputFileObj: args.inputFileObj,
                                                outputNumber: 2,
                                                variables: args.variables,
                                            } }];
                                }
                                args.jobLog("Stream ".concat(stream.index, ": ").concat(decision.reason));
                                targets.push({ stream: stream, analysis: analysis });
                                _b.label = 5;
                            case 5: return [2 /*return*/];
                        }
                    });
                };
                i = 0;
                _a.label = 1;
            case 1:
                if (!(i < args.variables.ffmpegCommand.streams.length)) return [3 /*break*/, 4];
                return [5 /*yield**/, _loop_1(i)];
            case 2:
                state_1 = _a.sent();
                if (typeof state_1 === "object")
                    return [2 /*return*/, state_1.value];
                _a.label = 3;
            case 3:
                i += 1;
                return [3 /*break*/, 1];
            case 4:
                targets.forEach(function (_a) {
                    var _b;
                    var stream = _a.stream, analysis = _a.analysis;
                    if (!forceEncoding && stream.codec_name === 'hevc') {
                        args.jobLog("Stream ".concat(stream.index, " is already hevc and Force Encoding is off, leaving it"));
                        return;
                    }
                    args.variables.ffmpegCommand.shouldProcess = true;
                    (_b = stream.outputArgs).push.apply(_b, buildOutputArgs(analysis, settings));
                });
                return [2 /*return*/, {
                        outputFileObj: args.inputFileObj,
                        outputNumber: 1,
                        variables: args.variables,
                    }];
        }
    });
}); };
exports.plugin = plugin;
