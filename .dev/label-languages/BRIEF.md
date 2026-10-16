# Brief: "Label Languages" Tdarr flow plugin

This is for a cloud Claude session working on branch `feat/label-languages` of J-J-E/Tdarr_Plugins (a fork of HaveAGitGat/Tdarr_Plugins).
Delete this `.dev/` folder before any upstream PR.

## Goal
A **generic community flow plugin** that finds the language of audio and subtitle tracks that are untagged (`und`, empty or missing) and writes the language tags into the file. Anyone can point it at their own endpoints: cloud, a free LLM, or local, as long as the API format matches.

The owner's words: "this should be available for anyone for the language thing and we just point the apis to the correct place, they could be cloud, they could be free llm, or they could be local as long as the format is correct".

## Where it fits
It runs in a flow before the existing plugin `ffmpegCommandKeepLanguages` (branch feat/keep-languages; a reference copy is in `prototype/keepLanguages.reference.ts`). That plugin removes tracks whose language isn't wanted and **always keeps `und` tracks**. So untagged tracks are never trimmed, and labelling them is what lets trimming work on old rips.

## Prior art
`prototype/labelLanguages.js` is a working local prototype in plain JS. It was tested against real files with:
- whisper-asr-webservice `/detect-language`: 4 samples of 30 s each, majority vote;
- a llama.cpp Qwen3-VL-2B server: PGS frames rendered over a black frame, then the question "what language is this text";
- mkvpropedit to write the tags.

Measured timing per track:
- audio: about 15 s;
- picture subtitles: about 2 min (about 20 s per frame on a GTX 1660; cropping and downscaling the frame should help a lot);
- text subtitles: fast.

Reuse its logic; rewrite it to the repo's conventions in TypeScript.

## Requirements
1. **Audio:** sample N clips, default 4 × 30 s, spread across the runtime, mono 16 kHz. Detect each clip's language by majority vote with a configurable minimum confidence and minimum agreement. Two endpoint styles, chosen by an input:
   - **OpenAI-compatible** `POST /v1/audio/transcriptions` (multipart; `model` input; `response_format=verbose_json`, which returns `language`). Works with OpenAI, Groq, speaches and faster-whisper-server.
   - **whisper-asr-webservice** `POST /detect-language` (multipart `audio_file`; returns `language_code` and `confidence`).
   - An optional API key input, sent as a Bearer token.
2. **Picture subtitles (PGS, VobSub, DVB):** pick timestamps where subtitle packets exist (`ffprobe -read_intervals`, not a full packet scan). Render frames, crop to the subtitle area and downscale. Ask an **OpenAI-compatible** `POST /v1/chat/completions` vision model with an image data URI (inputs: URL, model, optional key) for the language as an ISO code. Majority vote.
3. **Text subtitles (srt, ass, webvtt):** extract sample lines. Use a local language detector if a small pure-JS or Node one is acceptable to the repo's dependencies; otherwise the same chat-completions endpoint with a text prompt.
4. **Writing tags:**
   - For MKV, use mkvpropedit on a **copy in the cache/work directory, never the library original**. The prototype once edited the original in place; that was a bug.
   - For other containers, remux to MKV.
   - Alternatively, set the language through the ffmpegCommand stream metadata so it chains with Execute. Pick the approach that fits the repo best and explain the choice.
   - Codes are ISO 639-2/B.
5. **Never fail the file because a helper is down:** log it, leave the track `und`, and continue. If unsure, leave it `und`.
6. **Inputs:**
   - per-type enable switches;
   - sample count and length;
   - thresholds;
   - timeouts;
   - the endpoints and models above.
   - No personal defaults: endpoints are empty or example values.
7. **Outputs:** 1 = "labelled something", 2 = "nothing to label".
8. **Tests:** jest with mocked HTTP. Cover:
   - both audio API styles;
   - the vision flow;
   - text subtitles;
   - majority and threshold logic;
   - an unreachable endpoint;
   - non-MKV input.
9. **Repo rules:** TypeScript in `FlowPluginsTs/CommunityFlowPlugins/<category>/<name>/1.0.0/index.ts`, compiled with tsc into `FlowPlugins/`. Run `npm run checkPlugins`, `npm run lint` (0 errors) and `npx jest`. Read the README and copy the style of existing plugins and their tests.

## Done means
- The branch is pushed with the plugin, its compiled JS and its tests, and every check passes.
- A short `.dev/label-languages/RESULT.md` covers the design choices, the inputs and how to configure it for whisper-asr-webservice plus llama.cpp. The owner tests on real files locally.
