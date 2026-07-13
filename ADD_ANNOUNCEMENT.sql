-- ============================================================
-- ADD_ANNOUNCEMENT.sql
-- يضيف جدول الإعلانات ودوال: حفظ + جلب + مسح آخر إعلان
-- شغّله مرة واحدة في Supabase > SQL Editor
-- ============================================================

-- 1) الجدول
CREATE TABLE IF NOT EXISTS announcements (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title      text    NOT NULL,
  body       text    NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2) دالة الأدمن — تحفظ إعلان جديد
DROP FUNCTION IF EXISTS admin_save_announcement(text, text, text);

CREATE OR REPLACE FUNCTION admin_save_announcement(
  p_password text,
  p_title    text,
  p_body     text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT admin_check(p_password) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  INSERT INTO announcements (title, body) VALUES (p_title, p_body);
END; $$;

-- 3) دالة الأدمن — تمسح إعلان بالـ id
DROP FUNCTION IF EXISTS admin_delete_announcement(text, bigint);

CREATE OR REPLACE FUNCTION admin_delete_announcement(
  p_password text,
  p_id       bigint
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT admin_check(p_password) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  DELETE FROM announcements WHERE id = p_id;
END; $$;

-- 4) دالة عامة — بترجع آخر إعلان بس
DROP FUNCTION IF EXISTS get_latest_announcement();

CREATE OR REPLACE FUNCTION get_latest_announcement()
RETURNS TABLE(id bigint, title text, body text, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
    SELECT a.id, a.title, a.body, a.created_at
    FROM announcements a
    ORDER BY a.created_at DESC
    LIMIT 1;
END; $$;

-- 5) صلاحيات
GRANT EXECUTE ON FUNCTION admin_save_announcement(text, text, text)   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_announcement(text, bigint)      TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_latest_announcement()                    TO anon, authenticated;
