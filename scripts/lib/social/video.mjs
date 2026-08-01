// ============================================================
//  video.mjs — Reels compositor (Phase B). ffmpeg only, no paid services.
//
//  Stills → motion: each scene PNG (rendered 2× by render.mjs, i.e.
//  2160×3840) gets a slow Ken Burns push, scenes are joined with
//  crossfades, and a progress bar runs along the top. Encoded H.264 /
//  AAC, yuv420p, +faststart — what the Graph API wants for REELS.
//
//  Audio is SYNTHESIZED here from oscillators (a slow minor pad + a
//  breath of pink noise). It is original by construction, so there is
//  no licensing question and no sourced track to clear.
// ============================================================

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const FPS = 30;
const OUT_W = 1080;
const OUT_H = 1920;

const ff = (args) => run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { maxBuffer: 1 << 26 });

/**
 * Synthesize an original ambient bed of `duration` seconds.
 * A-minor-ish pad (A2/E3/A3/C4) with slow tremolo + filtered pink noise,
 * softened with a lowpass, given space with a short echo, and topped
 * with fades and a limiter so it never fights the on-screen text.
 */
export async function makeAudioBed(duration, outWav) {
  const d = duration.toFixed(2);
  const sr = 48000;
  const src = (freq) => ['-f', 'lavfi', '-i', `sine=frequency=${freq}:duration=${d}:sample_rate=${sr}`];
  const filter = [
    '[0:a]volume=0.30,tremolo=f=0.18:d=0.35[a0]',
    '[1:a]volume=0.16,tremolo=f=0.13:d=0.40[a1]',
    // tremolo rejects f < 0.1 Hz, so the slowest swells sit just above it.
    '[2:a]volume=0.13,tremolo=f=0.11:d=0.45[a2]',
    '[3:a]volume=0.09,tremolo=f=0.10:d=0.50[a3]',
    '[4:a]volume=0.10,lowpass=f=700[a4]',
    '[a0][a1][a2][a3][a4]amix=inputs=5:normalize=0[mix]',
    // loudnorm lands every reel on the same perceived level (~-16 LUFS, the
    // social norm). Fades go after it so normalization can't undo them, and
    // loudnorm resamples internally — hence the explicit aresample back to 48k.
    `[mix]lowpass=f=2600,aecho=0.8:0.9:220:0.28,` +
      `loudnorm=I=-16:TP=-1.5:LRA=11,aresample=${sr},` +
      `afade=t=in:st=0:d=2.0,afade=t=out:st=${Math.max(0, duration - 2.2).toFixed(2)}:d=2.2,` +
      `alimiter=limit=0.95[out]`,
  ].join(';');

  await ff([
    ...src(110), ...src(164.81), ...src(220), ...src(261.63),
    '-f', 'lavfi', '-i', `anoisesrc=duration=${d}:color=pink:amplitude=0.08:sample_rate=${sr}`,
    '-filter_complex', filter,
    '-map', '[out]', '-ac', '2', '-ar', String(sr),
    outWav,
  ]);
  return outWav;
}

/**
 * Compose scenes into a finished reel.
 * @param {object} o
 * @param {string[]} o.sceneFiles  scene PNGs, in order
 * @param {number[]} o.durations   seconds per scene (same length)
 * @param {number}   o.crossfade   crossfade seconds between scenes
 * @param {string}   o.outMp4
 * @param {string}   [o.coverJpg]  also write a grid cover from the first frame
 * @param {boolean}  [o.silent]    emit a silent track instead of the synth bed.
 *   Use this whenever a licensed Instagram track is attached at publish time —
 *   the platform's audio replaces ours, and shipping silence means a failed
 *   attach can't fall back to an unwanted bed.
 * @returns {Promise<{file:string, duration:number, cover?:string}>}
 */
export async function makeReel({ sceneFiles, durations, crossfade = 0.5, outMp4, coverJpg, silent = false }) {
  if (sceneFiles.length !== durations.length) throw new Error('scenes/durations length mismatch');
  const n = sceneFiles.length;
  const total = durations.reduce((a, b) => a + b, 0) - crossfade * (n - 1);

  fs.mkdirSync(path.dirname(outMp4), { recursive: true });
  const tmpWav = path.join(path.dirname(outMp4), '.bed.wav');
  if (silent) {
    // A real (silent) track, not a missing one — some players and pipelines
    // behave badly with an audio-less MP4.
    await ff(['-f', 'lavfi', '-i', `anullsrc=r=48000:cl=stereo`, '-t', total.toFixed(2), tmpWav]);
  } else {
    await makeAudioBed(total, tmpWav);
  }

  // Inputs: each still looped for its own duration, at the target fps.
  const inputs = [];
  for (let i = 0; i < n; i++) {
    inputs.push('-loop', '1', '-framerate', String(FPS), '-t', durations[i].toFixed(3), '-i', sceneFiles[i]);
  }
  inputs.push('-i', tmpWav);

  // Ken Burns, alternating direction so consecutive scenes don't feel identical.
  // d=1 → one output frame per input frame, so `on` advances the zoom over time.
  const parts = [];
  for (let i = 0; i < n; i++) {
    const frames = Math.max(1, Math.round(durations[i] * FPS));
    const z = i % 2 === 0
      ? `min(1.0+0.00075*on,1.14)`
      : `max(1.14-0.00075*on,1.0)`;
    parts.push(
      `[${i}:v]fps=${FPS},zoompan=z='${z}':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${OUT_W}x${OUT_H}` +
      `,trim=end_frame=${frames},setpts=PTS-STARTPTS[v${i}]`
    );
  }

  // Crossfade chain: offset_i = (length so far) - crossfade.
  let acc = durations[0];
  let last = '[v0]';
  for (let i = 1; i < n; i++) {
    const off = (acc - crossfade).toFixed(3);
    const label = i === n - 1 ? '[vx]' : `[x${i}]`;
    parts.push(`${last}[v${i}]xfade=transition=fade:duration=${crossfade}:offset=${off}${label}`);
    acc = acc + durations[i] - crossfade;
    last = label;
  }
  if (n === 1) parts.push(`[v0]null[vx]`);

  // Brand progress bar along the very top, plus final pixel format.
  parts.push(
    `[vx]drawbox=x=0:y=0:w='iw*t/${total.toFixed(3)}':h=10:color=0xF06595@0.95:t=fill,` +
    `format=yuv420p[vout]`
  );

  await ff([
    ...inputs,
    '-filter_complex', parts.join(';'),
    '-map', '[vout]', '-map', `${n}:a`,
    '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'medium', '-crf', '20',
    '-r', String(FPS), '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2',
    '-movflags', '+faststart',
    '-t', total.toFixed(3),
    outMp4,
  ]);

  fs.rmSync(tmpWav, { force: true });

  const out = { file: outMp4, duration: total };
  if (coverJpg) {
    // Grab a frame just past the opening fade so the cover isn't mid-transition.
    await ff(['-i', outMp4, '-ss', '1.2', '-frames:v', '1', '-q:v', '3', coverJpg]);
    out.cover = coverJpg;
  }
  return out;
}

/**
 * Encode a frame sequence (from frames.mjs) into a finished reel.
 * Frames already carry all the motion, so there is no zoompan and no
 * xfade here — scene changes are hard cuts baked into the frames.
 *
 * Audio is a real silent track: a licensed Instagram song is attached at
 * publish time via audio_configuration, and shipping silence means a
 * failed attach can never fall back to something unwanted.
 *
 * @param {object} o
 * @param {string} o.pattern  printf pattern, e.g. /tmp/x/f%05d.jpg
 * @param {number} o.fps
 * @param {number} o.duration seconds
 * @param {string} o.outMp4
 * @param {number} [o.width=1080]
 * @param {number} [o.height=1920]
 * @param {string} [o.coverJpg]
 * @param {number} [o.coverAt=1.6] seconds — frame to lift the cover from
 */
export async function encodeFrames({ pattern, fps, duration, outMp4, width = 1080, height = 1920, coverJpg, coverAt = 1.6 }) {
  fs.mkdirSync(path.dirname(outMp4), { recursive: true });
  const silentWav = path.join(path.dirname(outMp4), '.silent.wav');
  await ff(['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', duration.toFixed(3), silentWav]);

  await ff([
    '-framerate', String(fps), '-i', pattern,
    '-i', silentWav,
    // lanczos downscale from the 2× capture keeps Hebrew edges clean.
    // out_range=tv matters: the source frames are JPEG (full range), and
    // without it ffmpeg tags the result yuvj420p, which some players
    // re-expand — brand pink drifts and the dark ground crushes.
    '-vf', `scale=${width}:${height}:flags=lanczos:in_range=pc:out_range=tv,format=yuv420p`,
    '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'medium', '-crf', '16',
    '-pix_fmt', 'yuv420p', '-color_range', 'tv',
    '-r', String(fps),
    '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2',
    '-movflags', '+faststart',
    '-t', duration.toFixed(3),
    outMp4,
  ]);

  fs.rmSync(silentWav, { force: true });

  const out = { file: outMp4, duration };
  if (coverJpg) {
    await ff(['-i', outMp4, '-ss', String(coverAt), '-frames:v', '1', '-q:v', '2', coverJpg]);
    out.cover = coverJpg;
  }
  return out;
}

/** ffprobe summary — used to verify what we actually produced. */
export async function probe(file) {
  const { stdout } = await run('ffprobe', [
    '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file,
  ], { maxBuffer: 1 << 26 });
  const j = JSON.parse(stdout);
  const v = j.streams.find((s) => s.codec_type === 'video') || {};
  const a = j.streams.find((s) => s.codec_type === 'audio') || {};
  return {
    duration: Number(j.format.duration),
    sizeMB: +(Number(j.format.size) / 1048576).toFixed(2),
    video: `${v.codec_name} ${v.width}x${v.height} ${v.r_frame_rate} ${v.pix_fmt}`,
    audio: a.codec_name ? `${a.codec_name} ${a.sample_rate}Hz ${a.channels}ch` : 'NONE',
  };
}
