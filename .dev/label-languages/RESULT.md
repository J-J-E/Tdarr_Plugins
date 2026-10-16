# Result: Label Languages flow plugin

Delete this `.dev/` folder before any upstream PR.

## Files
- `FlowPluginsTs/CommunityFlowPlugins/ffmpegCommand/ffmpegCommandLabelLanguages/1.0.0/index.ts`: the source.
- `FlowPlugins/CommunityFlowPlugins/ffmpegCommand/ffmpegCommandLabelLanguages/1.0.0/index.js`: compiled with tsc.
- `tests/FlowPlugins/CommunityFlowPlugins/ffmpegCommand/ffmpegCommandLabelLanguages/1.0.0/index.test.ts`: 29 jest tests. They mock HTTP (`args.deps.axios`) and ffmpeg/ffprobe (`child_process.spawn`).

Checks: `tsc`, `npm run checkPlugins`, `npm run lint` (0 errors), `npx jest` (all suites pass) and `npm test`.

## Flow placement
```
Input -> Begin Command -> Label Languages -> Keep Languages -> (other ffmpegCommand plugins) -> Execute
```
`ffmpegCommandKeepLanguages` is on branch `feat/keep-languages` and is not on this branch, so the plugin description only says "before plugins that remove streams by language". If the two go upstream, Keep Languages should land first or with this plugin.

Label Languages is an ffmpegCommand plugin, so it needs **Begin Command** before it and **Execute** after it.
- Output 1: at least one stream was labelled.
- Output 2: nothing to label, or no language could be found.

Both outputs can lead to Keep Languages.

## Design choices
**How tags are written: through the FFmpeg command, not mkvpropedit.** For each labelled stream the plugin does three things:
- sets `stream.tags.language` in `args.variables.ffmpegCommand`;
- pushes `-metadata:s:{outputIndex} language=xxx` onto the stream's `outputArgs`;
- once anything has been labelled, sets `shouldProcess = true`.

The reasons:
- **Keep Languages works on the same pass.** It reads the language from the ffmpegCommand streams, so it sees the new labels at once. With mkvpropedit, the tags would be on a file whose ffmpegCommand state is already stale, and you would need a second Begin Command.
- **The original is never touched.** Execute writes its output to the work directory. Nothing is copied or edited before that, so the prototype's in-place edit bug cannot happen.
- **Every container works.** MP4 and other containers get their tags from the same Execute run, with no separate remux to MKV and no MKV-only tool.
- **One write instead of two.** Copying a file to the cache so mkvpropedit can edit it costs about as much I/O as the stream-copy remux Execute already does. Execute uses `-c copy` here, because metadata-only `outputArgs` count as copy-compatible.

There is one cost: if nothing else changes the file, labelling still triggers a stream-copy remux in Execute. To label only, run Begin Command → Label Languages → Execute.

**Text subtitles go to the chat endpoint.** The repo has no language-detection dependency. Plugins can't add npm packages, and the small detectors such as franc are ESM-only, so the plugin sends sample lines to the same chat-completions endpoint with a text prompt.

**HTTP.** Requests go through `args.deps.axios`, like the other flow plugins. Multipart bodies are built by hand, so they work with whichever axios version Tdarr ships. Endpoint URLs can be a base URL (`http://host:8000`), a `/v1` base (`https://api.groq.com/openai/v1`) or the full endpoint URL. The plugin adds the path only when it is missing.

**Voting.** Each sample gets one vote, and the decision works like this:
- A language wins only if it has **more than half of the answered votes** and **at least "Minimum Agreeing Samples" votes**. That minimum defaults to 2 and is capped at the sample count.
- Ties never win.
- An audio clip whose reported confidence is below "Audio Minimum Confidence" does not vote. whisper-asr-webservice reports `confidence`, and some OpenAI-compatible servers return `language_probability`, which is used too. OpenAI itself reports none.
- Text samples whose lines repeat an earlier sample are asked only once, since they are not independent evidence.
- When unsure, the stream stays `und`.

**Model answers.** The plugin strips `<think>…</think>` first. A one-word answer may be any ISO 639-1/2 code or English name. In a longer answer, only English names and unambiguous 3-letter codes count, so "is" or "may" are never read as Icelandic or Malay. The answer must name exactly one language. "und" means unknown.

**Picture subtitles:**
1. `ffprobe -read_intervals start%+window` finds one real subtitle packet in each of N windows. Packets of 400 bytes or less are skipped, because they only clear the screen.
2. In one ffmpeg call, the video is blacked out and the subtitle is overlaid on it at the subtitle canvas size. The frame is scaled to at most 1280 wide and written twice: as a PNG, and as raw 8-bit gray on stdout.
3. The bounding box of the bright pixels is computed in JS, with 12 px of padding. A blank frame is skipped without calling the model.
4. A second ffmpeg call crops the PNG to that box and scales it to at most "Subtitle Image Max Width" (768). If the raw frame does not have the expected size, the whole uncropped frame is sent instead. The image goes to the model as a `data:image/png;base64,…` URI. Images this small should cut the ~20 s per frame you measured on the GTX 1660 by a lot.

These steps were checked with the real ffmpeg 6.1 in the cloud session:
- the dual-output filter graph and its raw frame size;
- the box detection;
- the crop to a PNG on stdout;
- the `-read_intervals` output.

ffmpeg can't encode bitmap subtitles from text, so the overlay of a real PGS/VobSub stream was not re-run there. The overlay is the same `[bg][0:<index>]overlay` the prototype used on real files.

**Failures never fail the file:**
- A network error, timeout, 401/403/404/405/408/429 or 5xx marks that service as **down for the rest of the file**. The current stream and the later streams of that type stay `und`, and the plugin moves on. For example, audio still gets labelled when the chat endpoint is down.
- Any other HTTP error (such as a 400 or 422 for one clip) only drops that sample's vote. The service stays in use.
- ffmpeg failures skip that sample.
- Any unexpected error is logged, and the file continues unchanged.
- The one thing that does throw is using the plugin without Begin Command. That is a flow configuration error, and it is the same check every ffmpegCommand plugin makes.

**Which streams are processed:**
- Audio and subtitle streams whose language tag is missing, empty, `und`, `unk`, `unknown` or `undetermined`, and that are not already marked removed.
- Picture codecs: `hdmv_pgs_subtitle`, `dvd_subtitle`, `dvb_subtitle`, `xsub`.
- Text codecs: `subrip`, `ass`, `ssa`, `webvtt`, `mov_text`, `text`…
- Any other codec, such as `eia_608`, is logged and skipped.
- Written codes are ISO 639-2/B (`fre`, `ger`, `chi`…). Whisper's codes (`en`, `jw`…) and names (`english`) are converted.

## Inputs
| Input | Default | Notes |
|---|---|---|
| Label Audio | true | |
| Audio API Style | openai | `openai` = `POST /v1/audio/transcriptions` (multipart: file, model, `response_format=verbose_json`); `whisperAsrWebservice` = `POST /detect-language?encode=true` (multipart: `audio_file`) |
| Audio API URL | *(empty)* | empty = audio skipped |
| Audio Model | whisper-1 | OpenAI style only |
| Audio API Key | *(empty)* | sent as `Authorization: Bearer` |
| Audio Sample Count / Seconds | 4 / 30 | clips spread across the runtime, mono 16 kHz WAV; seconds must be at least 5; on short files the clip length shrinks to duration ÷ count, and the stream is skipped below 5 s |
| Audio Minimum Confidence | 0.5 | only when the API reports a confidence |
| Label Picture Subtitles | true | PGS, VobSub, DVB |
| Label Text Subtitles | true | SRT, ASS, WebVTT, mov_text |
| Chat API URL | *(empty)* | OpenAI-compatible `/v1/chat/completions`; empty = subtitles skipped |
| Chat Model | *(empty)* | left out of the request when empty (fine for llama.cpp) |
| Chat API Key | *(empty)* | Bearer |
| Subtitle Sample Count | 5 | frames or line groups per stream |
| Subtitle Image Max Width | 768 | cropped image width sent to the vision model |
| Minimum Agreeing Samples | 2 | capped at the sample count |
| Request Timeout Seconds | 120 | per request; a timeout marks that service down for the file |
| FFprobe Path | *(empty)* | empty = the `ffprobe` next to the node's FFmpeg, else `ffprobe` on PATH |

## Configuring for whisper-asr-webservice + llama.cpp
1. **Audio**
   - Set Audio API Style to `whisperAsrWebservice`.
   - Set Audio API URL to `http://<whisper-host>:9000`. The plugin calls `/detect-language?encode=true`.
   - Leave the Audio Model and Audio API Key fields as they are; whisper-asr-webservice ignores them.
   - Optionally set Audio Minimum Confidence to the 0.6 your prototype used.
2. **Subtitles**
   - Set Chat API URL to `http://<llama-host>:8080`, the llama.cpp server started with the Qwen3-VL-2B model and its mmproj.
   - Leave Chat Model empty, or set it to the alias passed with `--alias`, such as the prototype's `local-vision-small`.
   - Leave the key empty.
3. **Flow**
   - Begin Command → Label Languages → Keep Languages → Execute.
   - The prototype used a custom tag field and a fixed `local-vision-small` model. Neither is needed any more.
4. **What to look for in the job log on real files**
   - Each sample's answer, and the vote result per stream.
   - The crop: if the picture-subtitle answers get worse than with the prototype, raise Subtitle Image Max Width (for example to 1024).
   - Timing: each picture-subtitle frame should now take far less than ~20 s.

## Other services
- **OpenAI:** set the audio URL to `https://api.openai.com`, the model to `whisper-1` and add a key. For the chat, use `https://api.openai.com` with `gpt-4o-mini`.
- **Groq:** set the audio URL to `https://api.groq.com/openai/v1` and the model to `whisper-large-v3-turbo`.
- **speaches / faster-whisper-server:** set the audio URL to `http://host:8000` and the model to, for example, `Systran/faster-whisper-small`.
- **Ollama:** set the chat URL to `http://host:11434` and the model to a vision model, for example `qwen2.5vl:3b`.
