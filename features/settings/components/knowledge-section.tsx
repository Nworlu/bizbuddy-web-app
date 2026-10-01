"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { learnedAnything, type Learned, type SocialPlatform, type Socials } from "@/features/tell/lib/knowledge";
import { getKnowledge, KnowledgeError, readImage, readWebsite, saveLearned, updateKnowledge, type Knowledge } from "@/features/tell/lib/knowledge-client";
import { formatNaira } from "@/shared/lib/format";

const SOCIAL_FIELDS: { platform: SocialPlatform; label: string; placeholder: string }[] = [
  { platform: "instagram", label: "Instagram", placeholder: "@yourshop" },
  { platform: "tiktok", label: "TikTok", placeholder: "@yourshop" },
  { platform: "facebook", label: "Facebook", placeholder: "yourshop" },
  { platform: "website", label: "Website", placeholder: "yourshop.com" },
];

const inputClass = "w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-200";
const message = (e: unknown, fallback: string) => (e instanceof KnowledgeError ? e.message : fallback);

/**
 * What BizBuddy knows about the business, and teaching it more: screenshots or photos of the owner's
 * page, catalogue, or price list, their website, and social handles. Nothing is saved until they confirm.
 */
export function KnowledgeSection() {
  const [knowledge, setKnowledge] = useState<Knowledge | null>(null);
  const [socials, setSocials] = useState<Socials>({});
  const [site, setSite] = useState("");
  const [reading, setReading] = useState(false);
  const [learned, setLearned] = useState<Learned | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const files = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    getKnowledge()
      .then((k) => {
        if (!live) return;
        setKnowledge(k);
        setSocials(k.socials);
      })
      .catch((e) => live && setError(message(e, "Couldn't load what BizBuddy knows.")));
    return () => {
      live = false;
    };
  }, []);

  async function read(run: () => Promise<Learned>) {
    setReading(true);
    setError(null);
    setNote(null);
    setLearned(null);
    try {
      const result = await run();
      if (learnedAnything(result)) setLearned(result);
      else setNote("BizBuddy couldn't find anything about your business in that. Try a screenshot of your page or price list.");
    } catch (e) {
      setError(message(e, "BizBuddy couldn't read that just now. Try again."));
    } finally {
      setReading(false);
    }
  }

  async function readPictures(list: FileList | null) {
    const pictures = Array.from(list ?? []).slice(0, 3);
    if (pictures.length === 0) return;
    await read(async () => {
      const results = await Promise.all(pictures.map(readImage));
      const products = results.flatMap((r) => r.products);
      return { description: results.find((r) => r.description)?.description ?? null, products, source: pictures.length > 1 ? "your pictures" : "your picture" };
    });
    if (files.current) files.current.value = "";
  }

  async function confirm() {
    if (!learned) return;
    try {
      setKnowledge(await saveLearned(learned));
      setLearned(null);
      setNote("Saved. BizBuddy will use this to understand your notes.");
    } catch (e) {
      setError(message(e, "Couldn't save that. Try again."));
    }
  }

  async function saveSocials(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const next = await updateKnowledge({ socials });
      setKnowledge(next);
      setSocials(next.socials);
      setNote("Saved your pages.");
    } catch (e) {
      setError(message(e, "Couldn't save that. Try again."));
    }
  }

  async function removeProduct(name: string) {
    try {
      setKnowledge(await updateKnowledge({ removeProduct: name }));
    } catch (e) {
      setError(message(e, "Couldn't remove it. Try again."));
    }
  }

  return (
    <section aria-labelledby="settings-knowledge" className="rounded-2xl border border-stone-200 bg-white">
      <div className="border-b border-stone-100 px-5 py-4">
        <h2 id="settings-knowledge" className="text-sm font-semibold text-ink">What BizBuddy knows</h2>
        <p className="mt-0.5 text-xs text-ink-muted">Show BizBuddy your business so it understands your notes. You can also send screenshots or your website link to BizBuddy on WhatsApp.</p>
      </div>
      <div className="space-y-5 px-5 py-4">
        {knowledge === null && !error && <p className="text-sm text-ink-muted">Loading…</p>}
        {knowledge && (
          <div className="space-y-2">
            {knowledge.description ? <p className="text-sm text-ink">“{knowledge.description}”</p> : <p className="text-sm text-ink-muted">Nothing learned from your pages yet.</p>}
            {knowledge.catalog.length > 0 && (
              <ul className="flex flex-wrap gap-1.5" aria-label="Products BizBuddy knows">
                {knowledge.catalog.map((p) => (
                  <li key={p.name} className="flex items-center gap-1 rounded-full bg-stone-100 py-1 pl-3 pr-1 text-xs text-ink">
                    {p.name}
                    {p.price ? <span className="text-ink-muted">· {formatNaira(p.price)}</span> : null}
                    <button type="button" onClick={() => void removeProduct(p.name)} aria-label={`Remove ${p.name}`} className="rounded-full px-1.5 text-ink-muted hover:bg-stone-200 hover:text-ink">×</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium text-ink">Teach it from screenshots or photos</p>
          <p className="text-xs text-ink-muted">Your Instagram or TikTok page, WhatsApp catalogue, or a price list. Up to 3 at a time.</p>
          <input ref={files} type="file" accept="image/*" multiple disabled={reading || knowledge === null} onChange={(e) => void readPictures(e.target.files)} className="block w-full text-xs text-ink-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-brand-800" />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (site.trim()) void read(() => readWebsite(site.trim()));
          }}
          className="space-y-2"
        >
          <label htmlFor="knowledge-site" className="block text-sm font-medium text-ink">Teach it from your website</label>
          <div className="flex gap-2">
            <input id="knowledge-site" value={site} onChange={(e) => setSite(e.target.value)} placeholder="yourshop.com" inputMode="url" className={inputClass} />
            <button type="submit" disabled={reading || !site.trim() || knowledge === null} className="shrink-0 rounded-xl bg-stone-100 px-4 text-sm font-medium text-ink hover:bg-stone-200 disabled:opacity-50">Read</button>
          </div>
        </form>

        {reading && <p className="text-sm text-ink-muted">Reading…</p>}
        {learned && (
          <div className="space-y-2 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">
            <p className="font-semibold">From {learned.source}:</p>
            {learned.description && <p>“{learned.description}”</p>}
            {learned.products.length > 0 && (
              <ul className="list-disc pl-5 text-xs">
                {learned.products.slice(0, 20).map((p) => (
                  <li key={p.name}>{p.name}{p.price ? ` (${formatNaira(p.price)})` : ""}</li>
                ))}
              </ul>
            )}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setLearned(null)} className="flex-1 rounded-lg bg-white py-2 text-sm font-medium text-ink ring-1 ring-stone-200">Don&apos;t save</button>
              <button type="button" onClick={() => void confirm()} className="flex-2 rounded-lg bg-brand-700 py-2 text-sm font-semibold text-white hover:bg-brand-800">Save</button>
            </div>
          </div>
        )}

        <form onSubmit={saveSocials} className="space-y-2">
          <p className="text-sm font-medium text-ink">Your pages</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SOCIAL_FIELDS.map((field) => (
              <label key={field.platform} className="text-xs text-ink-muted">
                {field.label}
                <input value={socials[field.platform] ?? ""} onChange={(e) => setSocials({ ...socials, [field.platform]: e.target.value })} placeholder={field.placeholder} className={`mt-1 ${inputClass}`} />
              </label>
            ))}
          </div>
          <button type="submit" disabled={knowledge === null} className="w-full rounded-xl bg-stone-100 py-2.5 text-sm font-medium text-ink hover:bg-stone-200 disabled:opacity-50">Save pages</button>
        </form>

        {note && <p role="status" className="text-xs text-brand-800">{note}</p>}
        {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
      </div>
    </section>
  );
}
