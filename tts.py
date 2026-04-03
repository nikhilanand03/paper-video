"""Stage 5: Text-to-speech via Azure Cognitive Services."""

from __future__ import annotations

import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import azure.cognitiveservices.speech as speechsdk

import config

MAX_RETRIES = 5
INITIAL_BACKOFF = 2  # seconds
MAX_TTS_CONCURRENT = 8

# --- Warm-up: pre-create a SpeechConfig so Azure SDK init happens early ---
_warm_config: speechsdk.SpeechConfig | None = None
_warm_lock = threading.Lock()
_warm_event = threading.Event()


def warmup_tts(voice: str = "en-US-AndrewMultilingualNeural") -> None:
    """Pre-initialize Azure TTS config. Call from a background thread during
    an earlier pipeline stage so the SDK setup cost is already paid."""
    global _warm_config
    with _warm_lock:
        if _warm_config is not None:
            return
        sc = speechsdk.SpeechConfig(
            subscription=config.get("azure_tts_key"),
            region=config.get("azure_tts_region"),
        )
        sc.set_speech_synthesis_output_format(
            speechsdk.SpeechSynthesisOutputFormat.Audio16Khz128KBitRateMonoMp3
        )
        sc.speech_synthesis_voice_name = voice
        _warm_config = sc
    _warm_event.set()


def _get_speech_config(voice: str) -> speechsdk.SpeechConfig:
    """Return the pre-warmed config or create one on-demand."""
    global _warm_config
    # Wait briefly for warmup if it's in progress
    _warm_event.wait(timeout=0.5)
    with _warm_lock:
        if _warm_config is not None:
            return _warm_config
    # Fallback: create fresh config
    sc = speechsdk.SpeechConfig(
        subscription=config.get("azure_tts_key"),
        region=config.get("azure_tts_region"),
    )
    sc.set_speech_synthesis_output_format(
        speechsdk.SpeechSynthesisOutputFormat.Audio16Khz128KBitRateMonoMp3
    )
    sc.speech_synthesis_voice_name = voice
    return sc


def synthesize_scene(
    text: str, output_path: Path, voice: str = "en-US-AndrewMultilingualNeural",
    speech_config: speechsdk.SpeechConfig | None = None,
) -> dict:
    """Generate an MP3 file from *text* using Azure TTS with retry on 429.

    Returns dict with path and timing breakdown.
    """
    t0 = time.monotonic()
    sc = speech_config or _get_speech_config(voice)
    t_config = time.monotonic()

    total_retry_wait = 0.0

    for attempt in range(MAX_RETRIES):
        t_synth_start = time.monotonic()
        audio_config = speechsdk.audio.AudioOutputConfig(filename=str(output_path))
        synthesizer = speechsdk.SpeechSynthesizer(
            speech_config=sc, audio_config=audio_config
        )

        result = synthesizer.speak_text_async(text).get()
        if result.reason != speechsdk.ResultReason.Canceled:
            t_end = time.monotonic()
            return {
                "path": output_path,
                "config_time": round(t_config - t0, 3),
                "synthesis_time": round(t_end - t_synth_start, 3),
                "total_time": round(t_end - t0, 3),
                "retry_wait_time": round(total_retry_wait, 3),
                "retries": attempt,
                "text_length": len(text),
            }

        detail = result.cancellation_details
        error_msg = detail.error_details or ""

        # Retry on rate-limit (429) errors
        if "429" in error_msg and attempt < MAX_RETRIES - 1:
            wait = INITIAL_BACKOFF * (2 ** attempt)
            total_retry_wait += wait
            time.sleep(wait)
            continue

        raise RuntimeError(f"TTS failed: {detail.reason} — {error_msg}")

    raise RuntimeError("TTS failed: max retries exceeded")


def synthesize_all(
    narrations: list[str], output_dir: Path, voice: str = "en-US-AndrewMultilingualNeural"
) -> tuple[list[Path], list[dict]]:
    """Generate MP3 files for all narrations in parallel, reusing a single SpeechConfig.

    Returns (mp3_paths, per_scene_timing).
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    sc = _get_speech_config(voice)

    out_paths = [output_dir / f"scene_{i:03d}.mp3" for i in range(1, len(narrations) + 1)]

    # Per-scene timing, indexed by scene number
    scene_timing: list[dict | None] = [None] * len(narrations)

    with ThreadPoolExecutor(max_workers=MAX_TTS_CONCURRENT) as pool:
        futures = {
            pool.submit(synthesize_scene, text, out, voice, sc): idx
            for idx, (text, out) in enumerate(zip(narrations, out_paths))
        }
        for fut in as_completed(futures):
            idx = futures[fut]
            result = fut.result()
            scene_timing[idx] = {
                "scene": idx,
                "config_time": result["config_time"],
                "synthesis_time": result["synthesis_time"],
                "total_time": result["total_time"],
                "retry_wait_time": result["retry_wait_time"],
                "retries": result["retries"],
                "text_length": result["text_length"],
            }

    return out_paths, scene_timing
