# הסכתון · hesketon.co.il

תקצירים חכמים ומקוריים מהפודקאסטים הכי טובים — בעברית.

בלוג סטטי, מהיר וקל, שבו כל פוסט הוא קובץ Markdown. תמלול של פרק נכנס, וקלוד (Claude)
כותב ממנו פוסט עברי מקורי, ידידותי ל-SEO. הכול חי על GitHub: התוכן, האתר והאוטומציה.

- **Astro** — אתר סטטי, אפס JavaScript כברירת מחדל, SEO מצוין, RTL.
- **GitHub Pages** — אחסון חינמי, פריסה אוטומטית בכל push.
- **GitHub Actions** — מריץ את צינור הכתיבה בענן ופותח Pull Request לאישור.

---

## התחלה מהירה

```bash
npm install        # התקנת תלויות (פעם אחת)
npm run dev        # שרת פיתוח מקומי → http://localhost:4321
npm run build      # בנייה ל-dist/ (מה שנפרס)
```

כדי לכתוב פוסטים צריך מפתח Claude:

```bash
cp .env.example .env
# פתחו את .env והדביקו ANTHROPIC_API_KEY
```

---

## איך כותבים פוסט (השלב הידני)

1. העתיקו את [`inbox/_example-episode.md`](inbox/_example-episode.md) לקובץ חדש, למשל `inbox/huberman-sleep.md`.
2. מלאו את הפרטים בראש הקובץ והדביקו את **התמלול המלא** של הפרק בגוף (אפשר באנגלית).
   - להשגת תמלול ביוטיוב: תחת הסרטון `...` → **Show transcript** → העתקה.
3. הריצו:
   ```bash
   npm run new-post           # כתיבה אמיתית (צורך ANTHROPIC_API_KEY)
   npm run new-post:dry       # בדיקת הצינור בלי קריאות API
   ```
4. נוצרת **טיוטה** ב-`src/content/posts/` עם `draft: true`. ה-brief עובר ל-`inbox/_processed/`.
5. `npm run dev`, עברו על הטיוטה, ערכו, ואז שנו `draft: false`.
6. `git commit` + `git push` → האתר מתעדכן לבד.

> טיוטות (`draft: true`) מוצגות ב-`npm run dev` אבל **לא** מתפרסמות באתר עד שמשנים ל-`false`.

---

## הקטגוריות

חמש קטגוריות מוגדרות ב-[`categories.json`](categories.json) (מקור אמת יחיד לאתר ולסקריפט).
הכותב האוטומטי מחויב לבחור בדיוק אחת מהן לכל פוסט. ערכו, הוסיפו או שנו שמות שם —
רק שמרו על `name` ו-`slug` ייחודיים.

---

## פריסה ל-GitHub Pages + הדומיין

### 1. צרו ריפו ודחפו

```bash
gh repo create hesketon --public --source=. --remote=origin --push
```

### 2. הפעילו Pages
ב-GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
ה-workflow ב-[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) בונה ופורס בכל push ל-`main`.

### 3. חברו את hesketon.co.il
הקובץ [`public/CNAME`](public/CNAME) כבר מכוון לדומיין. אצל רשם הדומיין (where you bought
hesketon.co.il) הגדירו:

**דומיין אפקס (hesketon.co.il) — רשומות A:**
```
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153
```
(ואם תרצו IPv6 — רשומות AAAA: `2606:50c0:8000::153`, `8001::153`, `8002::153`, `8003::153`)

**תת-דומיין www — רשומת CNAME:**
```
www  →  <שם-המשתמש-שלך>.github.io
```

אחרי שה-DNS מתעדכן (יכול לקחת כמה שעות), ב-Settings → Pages סמנו **Enforce HTTPS**.

---

## אוטומציה בענן (שלב 2 — Apify)

כדי שהבלוג יכתוב פוסטים גם כשהמחשב כבוי:

1. הוסיפו פרקים ל-[`content-queue.yml`](content-queue.yml) — רק קישור יוטיוב לכל אחד (בלי תמלול).
2. ב-GitHub → **Settings → Secrets and variables → Actions** הוסיפו:
   - Secret `ANTHROPIC_API_KEY`
   - Secret `APIFY_TOKEN` (ל-Apify)
   - Variables (לא חובה): `CLAUDE_MODEL`, `APIFY_ACTOR`
3. הריצו את ה-workflow **"Generate draft posts (AI)"** ידנית (Actions → Run workflow),
   או הסירו את ההערה מ-`schedule` ב-[`.github/workflows/generate.yml`](.github/workflows/generate.yml)
   כדי שירוץ אוטומטית (למשל כל יום).
4. ה-Action מושך תמלול, כותב טיוטות, ופותח **Pull Request**. עברו עליו, מזגו מהטלפון — והאתר עולה.

התמלול נמשך אוטומטית: קודם Apify (אם הוגדר טוקן), אחרת fallback חינמי. ב-`.env.example`
יש הסבר על בחירת actor מ-Apify Store.

---

## מבנה הפרויקט

```
hesketon/
├─ src/
│  ├─ content/posts/        ← הפוסטים (קבצי .md). מקור האמת של התוכן.
│  ├─ content.config.ts      ← סכמת ה-frontmatter (נבדקת בזמן build)
│  ├─ consts.ts              ← הגדרות אתר (שם, תיאור, סושיאל)
│  ├─ pages/                 ← בית, פוסט, קטגוריות, תגיות, אודות, RSS, 404
│  ├─ layouts/ · components/ ← תבניות, SEO, header/footer, כרטיסים
│  └─ styles/global.css      ← העיצוב (RTL, גופנים, צבעים — ערכו כאן)
├─ scripts/
│  ├─ generate.mjs           ← הצינור: inbox/queue → קלוד → טיוטה
│  └─ lib/                   ← prompt (הקול העברי), anthropic, transcript, apify
├─ inbox/                    ← briefs ידניים (תמלולים נשארים מקומית, לא ב-git)
├─ categories.json           ← הקטגוריות (משותף לאתר ולסקריפט)
├─ content-queue.yml         ← תור הפרקים לאוטומציה (שלב 2)
└─ .github/workflows/        ← deploy (Pages) + generate (AI → PR)
```

## שינוי העיצוב / הקול
- **עיצוב:** ערכו את משתני ה-CSS בראש [`src/styles/global.css`](src/styles/global.css).
- **הקול של הכתיבה:** ערכו את [`scripts/lib/prompt.mjs`](scripts/lib/prompt.mjs).
- **מודל:** `CLAUDE_MODEL` ב-`.env` (`claude-sonnet-4-6` זול ומצוין; `claude-opus-4-8` לאיכות שיא).
