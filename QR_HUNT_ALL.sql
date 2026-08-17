-- ============================================================
-- QR_HUNT_ALL.sql — لعبة محطات الـ QR + الواقع المعزز
-- ده الملف الوحيد اللي محتاج تشغّله. بيغني عن:
--   QR_HUNT.sql  /  QR_HUNT_AR.sql  /  QR_HUNT_AR2.sql
-- آمن إنك تشغّله أكتر من مرة.
--
-- مبني على النظام الموجود عندك:
--   - admin_check(p_password)        للتحقق من الأدمن
--   - get_feature_status(p_key)      لفتح/قفل اللعبة (نفس نظام باقي الألعاب)
--   - admin_set_feature_status(...)  للتحكم من لوحة التحكم
--   - members.points                 لإضافة النقط
--   - award_badge(member, badge)     لمنح شارة عند إنهاء كل المحطات
-- ============================================================

-- ------------------------------------------------------------
-- 1) الجداول
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS qr_stations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text UNIQUE NOT NULL,
  title       text NOT NULL,
  body        text,
  image_url   text,
  video_url   text,
  hint        text,
  points      int  NOT NULL DEFAULT 0,
  active      boolean NOT NULL DEFAULT true,
  sort_order  int DEFAULT 0,
  model_url   text,
  usdz_url    text,
  ar_type     text DEFAULT 'text',
  ar_text     text,
  ar_color    text,
  created_at  timestamptz DEFAULT now()
);

-- لو الجدول موجود من نسخة قديمة، نكمّل الأعمدة الناقصة
ALTER TABLE qr_stations ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE qr_stations ADD COLUMN IF NOT EXISTS model_url text;
ALTER TABLE qr_stations ADD COLUMN IF NOT EXISTS usdz_url  text;
ALTER TABLE qr_stations ADD COLUMN IF NOT EXISTS ar_type   text DEFAULT 'text';
ALTER TABLE qr_stations ADD COLUMN IF NOT EXISTS ar_text   text;
ALTER TABLE qr_stations ADD COLUMN IF NOT EXISTS ar_color  text;

CREATE TABLE IF NOT EXISTS qr_scans (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id  uuid NOT NULL REFERENCES qr_stations(id) ON DELETE CASCADE,
  member_id   uuid NOT NULL REFERENCES members(id)     ON DELETE CASCADE,
  scanned_at  timestamptz DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qr_scans_unique') THEN
    ALTER TABLE qr_scans ADD CONSTRAINT qr_scans_unique UNIQUE (station_id, member_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS qr_scans_member_idx  ON qr_scans (member_id);
CREATE INDEX IF NOT EXISTS qr_stations_code_idx ON qr_stations (lower(code));

-- مفتاح اللعبة في نفس نظام الأقفال بتاع باقي الألعاب
INSERT INTO settings (key, value) VALUES ('qr_hunt_open', 'true')
ON CONFLICT (key) DO NOTHING;

-- شارة اللي يخلّص كل المحطات (اختيارية — امسح السطر لو مش عايزها)
INSERT INTO badge_definitions (id, name, emoji, description, points) VALUES
  ('qr_explorer', 'المستكشف', '🗺️', 'لقى كل محطات الـ QR في المؤتمر', 25)
ON CONFLICT (id) DO NOTHING;


-- ------------------------------------------------------------
-- 2) اللاعب: تسجيل سكان محطة
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS scan_qr_station(uuid, text);

CREATE OR REPLACE FUNCTION scan_qr_station(p_member_id uuid, p_code text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_st      qr_stations%ROWTYPE;
  v_new     boolean := false;
  v_found   int;
  v_total   int;
  v_awarded int := 0;
  v_badge   jsonb := NULL;
BEGIN
  -- نفس نظام القفل بتاع باقي الفيتشرز
  IF NOT COALESCE(get_feature_status('qr_hunt_open'), true) THEN
    RETURN json_build_object('status','closed');
  END IF;

  SELECT * INTO v_st FROM qr_stations WHERE lower(code) = lower(trim(p_code)) LIMIT 1;
  IF NOT FOUND THEN RETURN json_build_object('status','not_found'); END IF;
  IF NOT v_st.active THEN RETURN json_build_object('status','inactive','title',v_st.title); END IF;

  BEGIN
    INSERT INTO qr_scans (station_id, member_id) VALUES (v_st.id, p_member_id);
    v_new := true;
  EXCEPTION WHEN unique_violation THEN
    v_new := false;
  END;

  IF v_new AND v_st.points > 0 THEN
    UPDATE members SET points = COALESCE(points,0) + v_st.points WHERE id = p_member_id;
    v_awarded := v_st.points;
  END IF;

  SELECT count(*) INTO v_found FROM qr_scans s
    JOIN qr_stations t ON t.id = s.station_id AND t.active
   WHERE s.member_id = p_member_id;
  SELECT count(*) INTO v_total FROM qr_stations WHERE active;

  -- خلّص كل المحطات؟ ياخد الشارة (الدالة نفسها بتمنع التكرار)
  IF v_new AND v_total > 0 AND v_found >= v_total THEN
    BEGIN
      v_badge := award_badge(p_member_id, 'qr_explorer');
    EXCEPTION WHEN OTHERS THEN
      v_badge := NULL;   -- لو نظام الشارات مش موجود، ما نوقعش اللعبة
    END;
  END IF;

  RETURN json_build_object(
    'status',    CASE WHEN v_new THEN 'ok' ELSE 'already' END,
    'code',      v_st.code,
    'title',     v_st.title,
    'body',      v_st.body,
    'image_url', v_st.image_url,
    'video_url', v_st.video_url,
    -- فيه محتوى واقع معزز يستاهل نظهر الزرار عشانه؟
    'has_ar', CASE COALESCE(v_st.ar_type,'text')
                WHEN 'image' THEN COALESCE(v_st.image_url,'') <> ''
                WHEN 'video' THEN COALESCE(v_st.video_url,'') <> ''
                WHEN 'model' THEN COALESCE(v_st.model_url,'') <> ''
                ELSE COALESCE(v_st.ar_text, v_st.title, '') <> ''
              END,
    'ar_type', COALESCE(v_st.ar_type,'text'),
    'points',    v_awarded,
    'found',     v_found,
    'total',     v_total,
    'badge',     v_badge
  );
END $$;


-- ------------------------------------------------------------
-- 3) اللاعب: تقدّمه
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS get_my_qr_progress(uuid);

CREATE OR REPLACE FUNCTION get_my_qr_progress(p_member_id uuid)
RETURNS TABLE(
  station_id uuid, title text, hint text, points int, found boolean,
  image_url text, body text, video_url text, sort_order int
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.title, t.hint, t.points,
         (s.id IS NOT NULL),
         CASE WHEN s.id IS NOT NULL THEN t.image_url END,
         CASE WHEN s.id IS NOT NULL THEN t.body      END,
         CASE WHEN s.id IS NOT NULL THEN t.video_url END,
         t.sort_order
  FROM qr_stations t
  LEFT JOIN qr_scans s ON s.station_id = t.id AND s.member_id = p_member_id
  WHERE t.active
  ORDER BY t.sort_order, t.created_at;
$$;


-- ------------------------------------------------------------
-- 4) اللاعب: محتوى الواقع المعزز (بعد ما يعمل سكان بس)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS get_qr_station_model(uuid, text);

CREATE OR REPLACE FUNCTION get_qr_station_model(p_member_id uuid, p_code text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_st qr_stations%ROWTYPE; v_seen boolean;
BEGIN
  SELECT * INTO v_st FROM qr_stations WHERE lower(code) = lower(trim(p_code)) LIMIT 1;
  IF NOT FOUND OR NOT v_st.active THEN RETURN json_build_object('status','not_found'); END IF;

  SELECT EXISTS(SELECT 1 FROM qr_scans WHERE station_id=v_st.id AND member_id=p_member_id) INTO v_seen;
  IF NOT v_seen THEN RETURN json_build_object('status','locked'); END IF;

  RETURN json_build_object(
    'status','ok', 'title', v_st.title, 'body', v_st.body,
    'ar_type',  COALESCE(v_st.ar_type,'text'),
    'ar_text',  COALESCE(v_st.ar_text, v_st.title),
    'ar_color', COALESCE(v_st.ar_color,'#D4A257'),
    'image_url', v_st.image_url, 'video_url', v_st.video_url,
    'model_url', v_st.model_url, 'usdz_url', v_st.usdz_url
  );
END $$;


-- ------------------------------------------------------------
-- 5) الأدمن
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS admin_upsert_qr_station(text, uuid, text, text, text, text, text, text, int, boolean, int);
DROP FUNCTION IF EXISTS admin_upsert_qr_station(text, uuid, text, text, text, text, text, text, int, boolean, int, text, text);
DROP FUNCTION IF EXISTS admin_upsert_qr_station(text, uuid, text, text, text, text, text, text, int, boolean, int, text, text, text, text, text);

CREATE OR REPLACE FUNCTION admin_upsert_qr_station(
  p_password text, p_id uuid, p_code text, p_title text, p_body text,
  p_image_url text, p_video_url text, p_hint text, p_points int,
  p_active boolean, p_sort_order int,
  p_model_url text DEFAULT NULL, p_usdz_url text DEFAULT NULL,
  p_ar_type text DEFAULT 'text', p_ar_text text DEFAULT NULL, p_ar_color text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT admin_check(p_password) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_id IS NULL THEN
    INSERT INTO qr_stations (code,title,body,image_url,video_url,hint,points,active,sort_order,
                             model_url,usdz_url,ar_type,ar_text,ar_color)
    VALUES (trim(p_code),p_title,p_body,p_image_url,p_video_url,p_hint,
            COALESCE(p_points,0),COALESCE(p_active,true),COALESCE(p_sort_order,0),
            p_model_url,p_usdz_url,COALESCE(p_ar_type,'text'),p_ar_text,p_ar_color)
    RETURNING id INTO v_id;
  ELSE
    UPDATE qr_stations SET
      code=trim(p_code), title=p_title, body=p_body, image_url=p_image_url,
      video_url=p_video_url, hint=p_hint, points=COALESCE(p_points,0),
      active=COALESCE(p_active,true), sort_order=COALESCE(p_sort_order,0),
      model_url=p_model_url, usdz_url=p_usdz_url,
      ar_type=COALESCE(p_ar_type,'text'), ar_text=p_ar_text, ar_color=p_ar_color
    WHERE id=p_id RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END $$;


DROP FUNCTION IF EXISTS admin_delete_qr_station(text, uuid);
CREATE OR REPLACE FUNCTION admin_delete_qr_station(p_password text, p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT admin_check(p_password) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  DELETE FROM qr_stations WHERE id = p_id;
END $$;


DROP FUNCTION IF EXISTS admin_list_qr_stations(text);
CREATE OR REPLACE FUNCTION admin_list_qr_stations(p_password text)
RETURNS TABLE(
  id uuid, code text, title text, body text, image_url text, video_url text,
  hint text, points int, active boolean, sort_order int, scans bigint,
  model_url text, usdz_url text, ar_type text, ar_text text, ar_color text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT admin_check(p_password) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  RETURN QUERY
    SELECT t.id,t.code,t.title,t.body,t.image_url,t.video_url,t.hint,t.points,
           t.active,t.sort_order,
           (SELECT count(*) FROM qr_scans s WHERE s.station_id=t.id),
           t.model_url,t.usdz_url,COALESCE(t.ar_type,'text'),t.ar_text,t.ar_color
    FROM qr_stations t ORDER BY t.sort_order, t.created_at;
END $$;


-- لوحة نتائج اللعبة
DROP FUNCTION IF EXISTS get_qr_hunt_leaderboard();
CREATE OR REPLACE FUNCTION get_qr_hunt_leaderboard()
RETURNS TABLE(member_name text, team_name text, found bigint, last_scan timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT m.name, m.team_name, count(*)::bigint, max(s.scanned_at)
  FROM qr_scans s
  JOIN members m ON m.id = s.member_id
  JOIN qr_stations t ON t.id = s.station_id AND t.active
  GROUP BY m.name, m.team_name
  ORDER BY count(*) DESC, max(s.scanned_at) ASC
  LIMIT 50;
$$;


-- ------------------------------------------------------------
-- 6) الصلاحيات + RLS
--    الكتابة كلها بتعدي من الدوال (SECURITY DEFINER) — مفيش كتابة مباشرة
-- ------------------------------------------------------------
GRANT EXECUTE ON FUNCTION scan_qr_station(uuid, text)         TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_my_qr_progress(uuid)            TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_qr_station_model(uuid, text)    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_qr_station(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_list_qr_stations(text)        TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_qr_hunt_leaderboard()           TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_upsert_qr_station(text,uuid,text,text,text,text,text,text,int,boolean,int,text,text,text,text,text) TO anon, authenticated;

ALTER TABLE qr_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_scans    ENABLE ROW LEVEL SECURITY;

-- مفيش policy للقراءة المباشرة عن قصد: محتوى المحطة (الكلام/الصورة) لازم
-- ما يتقراش قبل ما الشاب يوصل المكان فعلاً ويعمل سكان.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='qr_stations' AND policyname='qr_stations_read') THEN
    DROP POLICY qr_stations_read ON qr_stations;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='qr_scans' AND policyname='qr_scans_read') THEN
    DROP POLICY qr_scans_read ON qr_scans;
  END IF;
END $$;


-- ------------------------------------------------------------
-- 7) محطات تجربة (امسح الجزء ده لو مش عايزها)
-- ------------------------------------------------------------
INSERT INTO qr_stations (code,title,hint,points,sort_order,ar_type,ar_text) VALUES
  ('CT-01','محطة الملعب',  'دوّر في الملعب',        10, 1, 'text', 'مبروك! أول محطة ✨'),
  ('CT-02','محطة المطعم',  'مكان ما بتاكلوا فيه',   10, 2, 'text', 'تمام! فاضل شوية'),
  ('CT-03','محطة القاعة',  'فوق، مكان الاجتماعات',  20, 3, 'text', 'آخر محطة — أنت جامد 🔥')
ON CONFLICT (code) DO NOTHING;
