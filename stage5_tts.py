"""Stage 5: Text-to-speech via Azure Cognitive Services."""

from __future__ import annotations

from pathlib import Path

import azure.cognitiveservices.speech as speechsdk

import config


def synthesize_scene(text: str, output_path: Path, voice: str = "en-US-AriaNeural") -> Path:
    """Generate an MP3 file from *text* using Azure TTS."""
    speech_config = speechsdk.SpeechConfig(
        subscription=config.get("azure_tts_key"),
        region=config.get("azure_tts_region"),
    )
    speech_config.set_speech_synthesis_output_format(
        speechsdk.SpeechSynthesisOutputFormat.Audio16Khz128KBitRateMonoMp3
    )
    speech_config.speech_synthesis_voice_name = voice

    audio_config = speechsdk.audio.AudioOutputConfig(filename=str(output_path))
    synthesizer = speechsdk.SpeechSynthesizer(
        speech_config=speech_config, audio_config=audio_config
    )

    result = synthesizer.speak_text_async(text).get()
    if result.reason == speechsdk.ResultReason.Canceled:
        detail = result.cancellation_details
        raise RuntimeError(f"TTS failed: {detail.reason} — {detail.error_details}")

    return output_path


def synthesize_all(
    narrations: list[str], output_dir: Path, voice: str = "en-US-AriaNeural"
) -> list[Path]:
    """Generate MP3 files for all narrations."""
    output_dir.mkdir(parents=True, exist_ok=True)
    paths: list[Path] = []
    for i, text in enumerate(narrations, 1):
        out = output_dir / f"scene_{i:03d}.mp3"
        synthesize_scene(text, out, voice)
        paths.append(out)
    return paths
