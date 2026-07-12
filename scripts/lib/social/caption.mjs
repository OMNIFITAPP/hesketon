// ============================================================
//  caption.mjs — write an Instagram-native Hebrew caption + hashtags
//  for a post, with Claude (reuses @anthropic-ai/sdk like anthropic.mjs).
//
//  Falls back to a clean template-built caption when there's no API key
//  or when called with { offline:true } (used by --dry-run), so the whole
//  pipeline runs end-to-end for free with zero API calls.
// ============================================================

import Anthropic from '@anthropic-ai/sdk';
import { supportsTemperature } from '../llm-utils.mjs';

const DEFAULT_MODEL = 'claude-sonnet-4-6';

const FORMAT_HINT = {
  carousel: 'קרוסלה (כמה שקופיות) — פתיח חזק שגורם להחליק, ואז הזמנה לשמור ולשתף.',
  lessons: 'קרוסלה קצרה של לקחים — פתיח עם הבטחת ערך מהירה.',
  quote: 'כרטיס ציטוט בודד — הקשר קצר סביב הציטוט.',
  story: 'סטורי — משפט אחד קצר וקריאה לפעולה.',
};

/** Hashtag pool, kept Hebrew-first; deduped against the post tags. */
function buildHashtags(post) {
  const base = ['הסכתון', 'פודקאסטים', 'תקציר', 'ידעבעברית', 'פודקאסטבעברית'];
  const fromTags = (post.tags || []).map((t) => String(t).replace(/[\s־-]+/g, '')).filter(Boolean);
  const byCat = {
    'בריאות וכושר': ['בריאות', 'כושר', 'אריכותחיים'],
    'פסיכולוגיה ומיינדסט': ['פסיכולוגיה', 'מיינדסט', 'מוטיבציה'],
    'עסקים וקריירה': ['עסקים', 'יזמות', 'קריירה'],
    'מדע וטכנולוגיה': ['מדע', 'טכנולוגיה', 'בינהמלאכותית'],
    'כסף והשקעות': ['כסף', 'השקעות', 'פיננסים'],
  }[post.category] || [];
  const all = [...base, ...byCat, ...fromTags];
  return [...new Set(all)].slice(0, 15).map((t) => `#${t}`);
}

/** Deterministic, no-API caption — also the fallback if Claude fails. */
export function fallbackCaption(post, format = 'carousel') {
  const hook = post.lead?.text
    ? `"${post.lead.text}"`
    : post.description || post.title;
  const who = post.guest ? `${post.guest}${post.podcast ? ` (${post.podcast})` : ''}` : post.podcast;
  const cta =
    format === 'story'
      ? 'הסיפור המלא — קישור בביו 🔗'
      : 'התקציר המלא מחכה לכם בבלוג — קישור בביו 🔗\nשמרו לקריאה מאוחר יותר ושתפו עם מי שצריך 💬';
  const lines = [hook, who ? `\n🎙️ ${who}` : '', `\n${cta}`].filter(Boolean);
  return { caption: lines.join('\n').trim(), hashtags: buildHashtags(post) };
}

/**
 * Generate caption + hashtags. Returns { caption, hashtags }.
 * @param {object} opts { post, format, model, offline }
 */
export async function generateCaption({ post, format = 'carousel', model, offline = false }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (offline || !apiKey) return fallbackCaption(post, format);

  const client = new Anthropic({ apiKey });
  const chosen = model || process.env.CLAUDE_MODEL || DEFAULT_MODEL;

  const system = `אתה מנהל סושיאל בעברית עבור "הסכתון" — בלוג תקצירי פודקאסטים.
כתוב כיתוב (caption) לאינסטגרם בעברית טבעית, חדה וקריאה. כללים:
- פתיח (hook) חזק בשורה הראשונה שעוצר את הגלילה.
- בלי קלישאות AI ("בעולם של היום", "בואו נצלול", "חשוב לציין").
- 3–6 שורות קצרות, עם מעברי שורה. מותרים 1–3 אימוג'ים רלוונטיים, לא יותר.
- אל תמציא עובדות שלא מופיעות בחומר. הישען רק על הכותרת, התקציר, הציטוט והלקחים שסופקו.
- סיים בקריאה לפעולה שמתאימה לפורמט, והזכרה ש"הסיפור המלא בבלוג — קישור בביו".
- אל תכלול האשטגים (הם נוספים בנפרד).
החזר אך ורק JSON: {"caption": string, "hashtags": string[]}. ה-hashtags בעברית בלי הסימן #.`;

  const material = {
    format: FORMAT_HINT[format] || format,
    title: post.title,
    description: post.description,
    guest: post.guest,
    podcast: post.podcast,
    category: post.category,
    lead: post.lead,
    tldr: post.tldr,
    takeaways: post.takeaways,
  };

  const params = {
    model: chosen,
    max_tokens: 1200,
    system,
    messages: [{ role: 'user', content: 'החומר:\n' + JSON.stringify(material, null, 2) }],
  };
  if (supportsTemperature(chosen)) params.temperature = 0.8;

  try {
    const msg = await client.messages.create(params);
    const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const json = JSON.parse(fence ? fence[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    const hashtags = (json.hashtags?.length ? json.hashtags : [])
      .map((t) => `#${String(t).replace(/^#/, '').replace(/[\s־-]+/g, '')}`)
      .filter(Boolean);
    return {
      caption: (json.caption || '').trim() || fallbackCaption(post, format).caption,
      hashtags: hashtags.length ? hashtags : buildHashtags(post),
    };
  } catch (err) {
    console.warn(`  ⚠️  כתיבת כיתוב נכשלה (${err.message}) — נופלים לתבנית`);
    return fallbackCaption(post, format);
  }
}

/** Join caption + hashtags into the final text posted to Instagram. */
export function composeCaption({ caption, hashtags }) {
  return `${caption}\n\n${(hashtags || []).join(' ')}`.trim();
}
