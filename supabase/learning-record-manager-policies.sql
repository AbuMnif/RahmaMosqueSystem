-- منظومة عَون — سياسات كتابة السجلات التعليمية للمدير والمشرف
-- شغّل هذا الملف مرة واحدة في Supabase SQL Editor قبل استخدام حفظ السجلات.
-- المعلم يحتفظ بسياسات الإدخال/التعديل الحالية، ومشرف المنصة وولي الأمر يظلان للقراءة فقط.

DO $$
DECLARE
  item RECORD;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
      ('attendance_records', 'attendance_records_manager_all'),
      ('memorization_records', 'memorization_records_manager_all'),
      ('exams', 'exams_manager_all'),
      ('exam_results', 'exam_results_manager_all'),
      ('teacher_notes', 'teacher_notes_manager_all')
    ) AS policies(table_name, policy_name)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', item.policy_name, item.table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_admin_or_supervisor()) WITH CHECK (public.is_admin_or_supervisor())',
      item.policy_name,
      item.table_name
    );
  END LOOP;
END
$$;
