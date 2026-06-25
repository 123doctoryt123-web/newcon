-- ============================================================
-- شغّل ده في Supabase SQL Editor
-- يصلح push_subscriptions ودالة الجاسوس
-- ============================================================

-- 1) إصلاح جدول push_subscriptions
-- الجدول الموجود عنده subscription (jsonb) — هنضيف الأعمدة المنفصلة
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS endpoint text;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS p256dh   text;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS auth_key text;

-- 2) دالة حفظ الـ subscription
DROP FUNCTION IF EXISTS save_push_subscription(uuid, jsonb);
DROP FUNCTION IF EXISTS save_push_subscription(uuid, text, text, text);

CREATE OR REPLACE FUNCTION save_push_subscription(
  p_member_id uuid,
  p_endpoint  text,
  p_p256dh    text,
  p_auth      text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO push_subscriptions (member_id, endpoint, p256dh, auth_key)
    VALUES (p_member_id, p_endpoint, p_p256dh, p_auth)
    ON CONFLICT DO NOTHING;
END; $$;

-- 3) دالة جيب كل الـ subscriptions للأدمن
DROP FUNCTION IF EXISTS get_all_push_subscriptions(text);

CREATE OR REPLACE FUNCTION get_all_push_subscriptions(p_password text)
RETURNS TABLE(member_id uuid, endpoint text, p256dh text, auth_key text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT admin_check(p_password) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  RETURN QUERY SELECT ps.member_id, ps.endpoint, ps.p256dh, ps.auth_key
    FROM push_subscriptions ps WHERE ps.endpoint IS NOT NULL;
END; $$;

-- 4) إصلاح دالة الجاسوس عشان تاخد قايمة أعضاء
DROP FUNCTION IF EXISTS admin_create_spy_game(text, text, int, text);
DROP FUNCTION IF EXISTS admin_create_spy_game(text, text, int, uuid[]);

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

  UPDATE spy_games SET active = false WHERE active = true;

  INSERT INTO spy_games (word, active) VALUES (p_word, true) RETURNING id INTO v_game_id;

  SELECT array_agg(id) INTO v_spy_ids FROM (
    SELECT unnest(p_member_ids) AS id ORDER BY random() LIMIT p_spy_count
  ) t;

  FOREACH v_mid IN ARRAY p_member_ids LOOP
    INSERT INTO spy_roles (game_id, member_id, is_spy)
      VALUES (v_game_id, v_mid, v_mid = ANY(v_spy_ids));
  END LOOP;
END; $$;

GRANT EXECUTE ON FUNCTION save_push_subscription(uuid, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_all_push_subscriptions(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_create_spy_game(text, text, int, uuid[]) TO anon, authenticated;
