-- ============================================================
-- ALL_FIXES.sql — شغّله كله مرة واحدة في Supabase SQL Editor
-- يصلح: الجاسوس، الإشعارات، ريست الباسورد، التسجيل الذاتي، QR
-- ============================================================

-- ============================================================
-- 0) جدول إعدادات عامة (لو مش موجود)
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
  key   text PRIMARY KEY,
  value text
);

INSERT INTO settings (key, value) VALUES
  ('book_scan_points',    '5'),
  ('project_scan_points', '10'),
  ('admin_password',      'admin123')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 1) إصلاح الجاسوس — حذف النسخة القديمة المكررة
-- ============================================================
-- نشيل كل الإصدارات القديمة عشان نبدأ نضيف صح
DROP FUNCTION IF EXISTS admin_create_spy_game(text, text, int, text);
DROP FUNCTION IF EXISTS admin_create_spy_game(text, text, int, uuid[]);
DROP FUNCTION IF EXISTS admin_stop_spy_game(text);
DROP FUNCTION IF EXISTS get_my_spy_role(uuid);
DROP FUNCTION IF EXISTS get_spy_game_members(uuid);
DROP FUNCTION IF EXISTS get_spy_vote_results(uuid);
DROP FUNCTION IF EXISTS cast_spy_vote(uuid, uuid, uuid);

-- الجدول المستخدم الصح هو spy_games (بالجمع)
-- نضيف عمود spy_count لو ناقص
ALTER TABLE spy_games ADD COLUMN IF NOT EXISTS spy_count int DEFAULT 1;

-- جدول التصويت — نتأكد من وجود unique constraint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'spy_votes_voter_game_unique'
  ) THEN
    ALTER TABLE spy_votes ADD CONSTRAINT spy_votes_voter_game_unique
      UNIQUE (voter_id, game_id);
  END IF;
END $$;

-- دالة بدء لعبة الجاسوس
CREATE OR REPLACE FUNCTION admin_create_spy_game(
  p_password   text,
  p_word       text,
  p_spy_count  int,
  p_member_ids uuid[]
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_game_id uuid;
  v_spy_ids uuid[];
  v_mid     uuid;
BEGIN
  IF NOT admin_check(p_password) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_member_ids IS NULL OR array_length(p_member_ids, 1) = 0 THEN RAISE EXCEPTION 'no_members'; END IF;
  IF p_spy_count >= array_length(p_member_ids, 1) THEN RAISE EXCEPTION 'too_many_spies'; END IF;

  -- أوقف اللعبة القديمة
  UPDATE spy_games SET active = false WHERE active = true;

  -- ابدأ لعبة جديدة
  INSERT INTO spy_games (word, spy_count, active)
    VALUES (p_word, p_spy_count, true)
    RETURNING id INTO v_game_id;

  -- اختار الجواسيس عشوائياً
  SELECT array_agg(id) INTO v_spy_ids FROM (
    SELECT unnest(p_member_ids) AS id ORDER BY random() LIMIT p_spy_count
  ) t;

  -- امسح أدوار قديمة لو في
  DELETE FROM spy_roles WHERE game_id = v_game_id;

  -- وزّع الأدوار
  FOREACH v_mid IN ARRAY p_member_ids LOOP
    INSERT INTO spy_roles (game_id, member_id, is_spy)
      VALUES (v_game_id, v_mid, v_mid = ANY(v_spy_ids));
  END LOOP;
END; $$;

-- دالة إيقاف اللعبة
CREATE OR REPLACE FUNCTION admin_stop_spy_game(p_password text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT admin_check(p_password) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  UPDATE spy_games SET active = false WHERE active = true;
END; $$;

-- دالة جيب دور العضو في اللعبة الحالية
CREATE OR REPLACE FUNCTION get_my_spy_role(p_member_id uuid)
RETURNS TABLE(game_id uuid, active bool, is_spy bool, word text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
    SELECT g.id, g.active, r.is_spy, g.word
    FROM spy_games g
    JOIN spy_roles r ON r.game_id = g.id AND r.member_id = p_member_id
    WHERE g.active = true
    LIMIT 1;
END; $$;

-- دالة جيب أعضاء اللعبة
CREATE OR REPLACE FUNCTION get_spy_game_members(p_game_id uuid)
RETURNS TABLE(member_id uuid, member_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
    SELECT r.member_id, m.name
    FROM spy_roles r
    JOIN members m ON m.id = r.member_id
    WHERE r.game_id = p_game_id
    ORDER BY m.name;
END; $$;

-- دالة التصويت
CREATE OR REPLACE FUNCTION cast_spy_vote(
  p_voter_id     uuid,
  p_voted_for_id uuid,
  p_game_id      uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO spy_votes (voter_id, target_id, game_id)
    VALUES (p_voter_id, p_voted_for_id, p_game_id)
    ON CONFLICT (voter_id, game_id) DO NOTHING;
END; $$;

-- دالة نتايج التصويت
CREATE OR REPLACE FUNCTION get_spy_vote_results(p_game_id uuid)
RETURNS TABLE(
  member_id   uuid,
  member_name text,
  vote_count  bigint,
  is_spy      bool,
  has_voted   bool
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
    SELECT
      r.member_id,
      m.name,
      COUNT(v.id) AS vote_count,
      r.is_spy,
      EXISTS(SELECT 1 FROM spy_votes sv WHERE sv.voter_id = r.member_id AND sv.game_id = p_game_id) AS has_voted
    FROM spy_roles r
    JOIN members m ON m.id = r.member_id
    LEFT JOIN spy_votes v ON v.target_id = r.member_id AND v.game_id = p_game_id
    WHERE r.game_id = p_game_id
    GROUP BY r.member_id, m.name, r.is_spy
    ORDER BY vote_count DESC, m.name;
END; $$;

-- ============================================================
-- 2) إصلاح push_subscriptions — تحديث دالة الحفظ
-- ============================================================
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS endpoint text;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS p256dh   text;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS auth_key text;

DROP FUNCTION IF EXISTS save_push_subscription(uuid, jsonb);
DROP FUNCTION IF EXISTS save_push_subscription(uuid, text, text, text);

CREATE OR REPLACE FUNCTION save_push_subscription(
  p_member_id uuid,
  p_endpoint  text,
  p_p256dh    text,
  p_auth      text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO push_subscriptions (member_id, endpoint, p256dh, auth_key)
    VALUES (p_member_id, p_endpoint, p_p256dh, p_auth)
    ON CONFLICT (member_id) DO UPDATE
      SET endpoint = EXCLUDED.endpoint,
          p256dh   = EXCLUDED.p256dh,
          auth_key = EXCLUDED.auth_key;
END; $$;

DROP FUNCTION IF EXISTS get_all_push_subscriptions(text);

CREATE OR REPLACE FUNCTION get_all_push_subscriptions(p_password text)
RETURNS TABLE(member_id uuid, endpoint text, p256dh text, auth_key text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT admin_check(p_password) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  RETURN QUERY
    SELECT ps.member_id, ps.endpoint, ps.p256dh, ps.auth_key
    FROM push_subscriptions ps
    WHERE ps.endpoint IS NOT NULL;
END; $$;

-- ============================================================
-- 3) التوقعات — دالة admin_list_predictions لو ناقصة
-- ============================================================
DROP FUNCTION IF EXISTS admin_list_predictions(text);

CREATE OR REPLACE FUNCTION admin_list_predictions(p_password text)
RETURNS TABLE(
  member_id  uuid,
  name       text,
  username   text,
  score1     int,
  score2     int,
  updated_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT admin_check(p_password) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  RETURN QUERY
    SELECT p.member_id, m.name, m.username, p.score1, p.score2, p.updated_at
    FROM predictions p
    JOIN members m ON m.id = p.member_id
    ORDER BY p.updated_at DESC;
END; $$;

-- ============================================================
-- 4) ريست الباسورد — دالة توليد باسورد جديد للعضو
-- ============================================================
DROP FUNCTION IF EXISTS admin_reset_member_password(text, uuid);

CREATE OR REPLACE FUNCTION admin_reset_member_password(
  p_password  text,
  p_member_id uuid
) RETURNS TABLE(new_password text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pass text;
  chars  text := 'abcdefghjkmnpqrstuvwxyz23456789';
  i      int;
BEGIN
  IF NOT admin_check(p_password) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  v_pass := '';
  FOR i IN 1..8 LOOP
    v_pass := v_pass || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  UPDATE members SET password = v_pass WHERE id = p_member_id;
  RETURN QUERY SELECT v_pass;
END; $$;

-- ============================================================
-- 5) التسجيل الذاتي — دالة self_register
-- ============================================================
DROP FUNCTION IF EXISTS self_register(text, text, text);

CREATE OR REPLACE FUNCTION self_register(
  p_name     text,
  p_username text,
  p_password text
) RETURNS TABLE(id uuid, name text, username text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  -- اليوزر مش فاضي
  IF trim(p_name) = '' OR trim(p_username) = '' OR trim(p_password) = '' THEN
    RAISE EXCEPTION 'empty_fields';
  END IF;
  -- اليوزر مش متكرر
  IF EXISTS (SELECT 1 FROM members m WHERE lower(m.username) = lower(trim(p_username))) THEN
    RAISE EXCEPTION 'username_taken';
  END IF;
  INSERT INTO members (name, username, password)
    VALUES (trim(p_name), lower(trim(p_username)), p_password)
    RETURNING members.id INTO v_id;
  RETURN QUERY SELECT v_id, trim(p_name), lower(trim(p_username));
END; $$;

-- ============================================================
-- 6) QR حضور — جدول وعمليات
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id  uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  scan_type  text NOT NULL CHECK (scan_type IN ('book', 'project')),
  scanned_at timestamptz DEFAULT now(),
  scanned_by text DEFAULT 'admin'
);

-- منع الحضور المكرر لنفس النوع في نفس اليوم
CREATE UNIQUE INDEX IF NOT EXISTS attendance_member_type_day_unique
  ON attendance (member_id, scan_type, date(scanned_at));

-- دالة سكان الـ QR
DROP FUNCTION IF EXISTS admin_scan_qr(text, uuid, text);

CREATE OR REPLACE FUNCTION admin_scan_qr(
  p_password  text,
  p_member_id uuid,
  p_scan_type text   -- 'book' or 'project'
) RETURNS TABLE(
  status       text,   -- 'ok' | 'already_scanned' | 'not_found'
  member_name  text,
  points_added int
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name   text;
  v_points int;
  v_key    text;
BEGIN
  IF NOT admin_check(p_password) THEN RAISE EXCEPTION 'unauthorized'; END IF;

  -- جيب اسم العضو
  SELECT name INTO v_name FROM members WHERE id = p_member_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text, ''::text, 0::int;
    RETURN;
  END IF;

  -- شوف النقاط من الإعدادات
  v_key := CASE WHEN p_scan_type = 'book' THEN 'book_scan_points' ELSE 'project_scan_points' END;
  SELECT COALESCE(value::int, 5) INTO v_points FROM settings WHERE key = v_key;

  -- حاول تسجّل الحضور
  BEGIN
    INSERT INTO attendance (member_id, scan_type)
      VALUES (p_member_id, p_scan_type);

    -- ضيف النقاط
    UPDATE members SET points = COALESCE(points, 0) + v_points WHERE id = p_member_id;

    RETURN QUERY SELECT 'ok'::text, v_name, v_points;
  EXCEPTION WHEN unique_violation THEN
    RETURN QUERY SELECT 'already_scanned'::text, v_name, 0::int;
  END;
END; $$;

-- دالة جيب سجل الحضور للأدمن
DROP FUNCTION IF EXISTS admin_list_attendance(text);

CREATE OR REPLACE FUNCTION admin_list_attendance(p_password text)
RETURNS TABLE(
  member_name text,
  scan_type   text,
  scanned_at  timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT admin_check(p_password) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  RETURN QUERY
    SELECT m.name, a.scan_type, a.scanned_at
    FROM attendance a
    JOIN members m ON m.id = a.member_id
    ORDER BY a.scanned_at DESC;
END; $$;

-- دالة حفظ إعدادات النقاط
DROP FUNCTION IF EXISTS admin_set_scan_points(text, int, int);

CREATE OR REPLACE FUNCTION admin_set_scan_points(
  p_password      text,
  p_book_pts      int,
  p_project_pts   int
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT admin_check(p_password) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  INSERT INTO settings (key, value) VALUES ('book_scan_points',    p_book_pts::text)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
  INSERT INTO settings (key, value) VALUES ('project_scan_points', p_project_pts::text)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
END; $$;

-- ============================================================
-- 7) إضافة دالة get_scan_points للفرونت
-- ============================================================
DROP FUNCTION IF EXISTS get_scan_points();

CREATE OR REPLACE FUNCTION get_scan_points()
RETURNS TABLE(book_pts int, project_pts int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
    SELECT
      (SELECT COALESCE(value::int, 5)  FROM settings WHERE key = 'book_scan_points'),
      (SELECT COALESCE(value::int, 10) FROM settings WHERE key = 'project_scan_points');
END; $$;

-- ============================================================
-- Grants
-- ============================================================
GRANT EXECUTE ON FUNCTION admin_create_spy_game(text, text, int, uuid[])     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_stop_spy_game(text)                           TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_my_spy_role(uuid)                               TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_spy_game_members(uuid)                          TO anon, authenticated;
GRANT EXECUTE ON FUNCTION cast_spy_vote(uuid, uuid, uuid)                     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_spy_vote_results(uuid)                          TO anon, authenticated;
GRANT EXECUTE ON FUNCTION save_push_subscription(uuid, text, text, text)      TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_all_push_subscriptions(text)                    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_list_predictions(text)                        TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_reset_member_password(text, uuid)             TO anon, authenticated;
GRANT EXECUTE ON FUNCTION self_register(text, text, text)                     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_scan_qr(text, uuid, text)                     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_list_attendance(text)                         TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_set_scan_points(text, int, int)               TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_scan_points()                                   TO anon, authenticated;
