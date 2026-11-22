-- منظومة عَون الإدارية
-- حذف بيانات السجلات التعليمية فقط مع الإبقاء على الجداول والمفاتيح والعلاقات والتسلسلات.
-- سيُبقي هذا الأمر بيانات الطلاب والحلقات والمعلمين والحسابات والتسجيلات كما هي.

BEGIN;

-- طلبات التعديل وسجل التدقيق مرتبطان بالسجلات التعليمية؛ يُفرغان أولاً.
DELETE FROM public.record_change_requests;
DELETE FROM public.record_audit_logs;

-- النتائج تعتمد على الاختبارات، لذلك تُحذف قبل الاختبارات.
DELETE FROM public.exam_results;
DELETE FROM public.exams;

-- بقية السجلات التعليمية.
DELETE FROM public.attendance_records;
DELETE FROM public.memorization_records;
DELETE FROM public.teacher_notes;

COMMIT;

-- لم يتم حذف أو إعادة إنشاء أي جدول أو عمود أو مفتاح أو سياسة أو تسلسل.
-- لم يتم المساس ببيانات profiles أو students أو classes أو class_teachers أو student_enrollments.
