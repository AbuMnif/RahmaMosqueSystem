Awn v1.1.3

This release adds the educational records area, attendance, memorization/review, exams and results, teacher notes, Excel workbook export, audit-log viewing, local IndexedDB snapshots, offline operation queue with automatic retry, offline status banner, service-worker caching, and 30-day Supabase SSR cookie persistence.

Deployment:
1. Upload this archive to the repository root.
2. Update the replacement workflow archive name to Awn-v1.1.3.zip.
3. Run the GitHub Actions workflow.

Important:
- No SQL migrations are included; the implementation uses the provided existing tables/columns.
- Offline edits are stored in the browser on the current device and queued for sync. The teacher must first sign in online and allow data to download.
- Test on a staging deployment before using with live student records.
