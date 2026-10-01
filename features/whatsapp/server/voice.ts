// Server only. A WhatsApp voice note is downloaded and turned into text with OpenAI, then read
// like a typed message. The audio is not stored. Needs OPENAI_API_KEY.

import OpenAI, { toFile } from "openai";
import { downloadMedia } from "./meta";

export const VOICE_MAX_BYTES = 8 * 1024 * 1024;

let client: OpenAI | undefined;

/** The words in this voice note. Empty when nothing was said. Throws if it can't be heard. */
export async function hearVoice(mediaId: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) throw new Error("No AI provider configured");
  const { data, mime } = await downloadMedia(mediaId, VOICE_MAX_BYTES);
  const type = mime.split(";")[0]?.trim() || "audio/ogg";
  const ext = type.includes("mpeg") ? "mp3" : type.includes("mp4") ? "m4a" : type.includes("wav") ? "wav" : type.includes("webm") ? "webm" : "ogg";
  client ??= new OpenAI();
  const result = await client.audio.transcriptions.create({
    file: await toFile(data, `voice.${ext}`, { type }),
    model: process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe",
    prompt: "Nigerian shop owner. English, Nigerian English, or Pidgin. Sales, expenses, customer names, and naira amounts such as 85k.",
  });
  return result.text.replace(/\s+/g, " ").trim();
}
