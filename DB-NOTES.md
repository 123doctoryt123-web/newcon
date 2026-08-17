# ملاحظات على الداتابيز بعد ما شوفتها

## ✅ اللي اتظبط عشان يتماشى مع نظامك

راجعت الهيكل بتاعك وعدّلت الكود عشان يستخدم اللي عندك بدل ما يعمل نظام موازي:

| بدل ما كان | بقى يستخدم |
|---|---|
| مفتاح قفل خاص بيه | `get_feature_status` / `admin_set_feature_status` — نفس نظام قفل باقي الألعاب |
| مفيش شارة | `award_badge` — الشاب بياخد شارة **المستكشف 🗺️** لما يخلّص كل المحطات |
| ٣ ملفات SQL | ملف واحد `QR_HUNT_ALL.sql` |

**مفيش تعارض في أي اسم دالة أو جدول** — راجعت الـ140 دالة والـ50 جدول اللي عندك،
وكل أسامي اللعبة الجديدة (`qr_stations`, `qr_scans`, `scan_qr_station` …) مش موجودة عندك.

اختبرت المنطق كله على نسخة مطابعة لداتابيزك: النقط بتتحسب مرة واحدة بس،
الكود بيقبل حروف كبيرة وصغيرة ومسافات زيادة، القفل بيشتغل، وكلمة سر الأدمن بتترفض لو غلط.

---

## ⚠️ حاجة مهمة لقيتها — مش من شغلي، بس لازم تعرفها

جدول `members` عليه سياسة اسمها **`allow_all`** لكل العمليات.
والجدول ده فيه عمود **`password`**.

المفتاح العام (anon key) موجود في `js/supabaseclient.js` — وده طبيعي وبيتحط في كل مواقع
Supabase — لكن معناه إن **أي حد يفتح الموقع ويفتح Console يقدر يقرا يوزرات وباسوردات
كل الشباب** بأمر واحد.

### تتأكد إزاي

```sql
select tablename, policyname, cmd, qual
from pg_policies
where schemaname='public' and tablename='members';
```

لو `qual` طلعت `true` — يبقى الجدول مفتوح فعلًا.

### الحل

مينفعش تقفل الجدول خالص، لأن فيه **٢٠ مكان في الموقع** بيقروا منه على طول
(زي `dashboard.html` و `secretary.html` و `scan.html` بيجيبوا `role` و `team_name`).
لو قفلته هيقف نص الموقع.

أأمن حل من غير ما تكسر حاجة: **اقفل عمود الباسورد بس**، وسيب الباقي:

```sql
-- ١) امنع القراءة المباشرة للجدول
drop policy if exists allow_all on members;

-- ٢) اعمل نسخة للقراءة من غير الباسورد
create or replace view members_public as
  select id, name, username, team_name, points, role, assigned_room, created_at
  from members;

grant select on members_public to anon, authenticated;

-- ٣) اسمح بالقراءة من الجدول للأعمدة الآمنة بس
create policy members_read_safe on members for select using (true);
revoke select on members from anon, authenticated;
grant select (id, name, username, team_name, points, role, assigned_room, created_at)
  on members to anon, authenticated;
```

بعدها **جرّب** إن `verify_login` والدخول لسه شغالين (هما بيعدّوا من دالة
`SECURITY DEFINER` فمش هيتأثروا)، وإن الصفحات اللي بتقرا `role` لسه شغالة.

> جرّبه على وقت مفيهوش حد على الموقع، وخد نسخة احتياطية الأول.

---

## 🧹 حاجات صغيرة ملاحظة

- فيه **٩ جداول باسم `_backup_*`** من نسخة قديمة، واحد منهم `_backup_members` فيه
  باسوردات قديمة. الـRLS عليهم مقفول ومفيش سياسات، فمش مقروءين من برة —
  بس لو مش محتاجهم، امسحهم أنضف.
- `online_presence` و `online_status` جدولين بنفس الشكل بالظبط — يمكن واحد قديم.
- فيه دوال ليها نسختين بنفس الاسم (`admin_clear_book_questions`, `submit_secret`,
  `admin_create_project_group`, `admin_add_puzzle_participant`). دي شغالة دلوقتي
  لأن الأسامي مختلفة، بس لو ضفت نسخة تالتة ممكن تحصل مشكلة "function is not unique".
