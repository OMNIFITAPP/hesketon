# רשימת פרסום — הסכתון

צ'קליסט קצר לכל פוסט, מהרעיון ועד ה-live. שמור אותו פתוח כשעובדים.

---

## א. לפני כתיבה
- [ ] הוסף את הפרק ל-`content-queue.yml` (URL + podcast + guest + categoryHint + durationMinutes).
- [ ] ודא שיש קרדיט בחשבון ה-Anthropic API (console.anthropic.com → Billing).

## ב. ייצור (אוטומטי)
- [ ] הרץ את ה-workflow **"Generate draft posts (AI)"** (Actions → Run workflow).
- [ ] המתן ל-PR שנפתח אוטומטית (`auto/new-drafts`).

## ג. בדיקת תוכן (לפני מיזוג)
- [ ] **דיוק:** אין עובדות/תאריכים/שמות/ציטוטים מומצאים. כל ספק → "חסר מידע".
- [ ] **מונחים:** אין תרגום מילולי מאולץ או עברית שיווקית מדי (ראה `scripts/lib/prompt.mjs`).
- [ ] **מבנה:** pull-quote → אמ;לק → digest עם ציטוטים → "מה לוקחים מזה".
- [ ] **טקסונומיה:** `category` היא אחת מ-6 הקטגוריות; תגיות ממחזרות קיימות כשאפשר.
- [ ] **ישויות:** `guestId` / `podcastId` קיימים ב-`src/data/people.json` / `podcasts.json`.
- [ ] **מקור:** `youtubeUrl` נכון (מזין תמונת hero + og:image).
- [ ] **פרימיום?** אם כן — `premium: true` + 2–4 `premiumHooks` (רמזים לעומק, לא הסתרת הליבה).

## ד. פרסום
- [ ] שנה `draft: false` בכל טיוטה שאושרה.
- [ ] מזג את ה-PR ל-`main` → ה-deploy רץ לבד והאתר מתעדכן.
- [ ] ודא ב-Actions שה-deploy עבר ירוק.

## ה. הפצה (כשהניוזלטר פעיל)
- [ ] שלח גיליון (pull-quote + אמ;לק + לינק).
- [ ] סמן `inNewsletter: true` בפוסט.
- [ ] שתף בערוצים (כפתורי השיתוף בכל פוסט).

---

### הפעלת רכיבים שממתינים
- **ניוזלטר:** הדבק את כתובת ה-POST של הספק ל-`NEWSLETTER.action` ב-`src/consts.ts` → הטופס מופיע לבד בפוטר ובכל פוסט.
- **חיפוש:** עובד אוטומטית בפרודקשן (Pagefind רץ ב-`postbuild`). מקומית: `npm run build && npm run preview`.
