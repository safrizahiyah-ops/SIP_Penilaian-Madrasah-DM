# Security Specification — SIP-KELAS DARUL MAHFUDZ

## 1. Data Invariants

1. **Default-Deny Catch-All**: Every path not explicitly matched under `/databases/{database}/documents` is unconditionally denied (`allow read, write: if false`).
2. **Verified Identity & Anti-Spoofing**: All reads and writes require `request.auth != null && request.auth.token.email_verified == true`. Bootstrapped admin status (`safrialwahyu@gmail.com`) strictly requires `request.auth.token.email_verified == true`.
3. **Zero Self-Privilege Escalation**: Non-bootstrapped users creating `/users/{userId}` can ONLY assign `role == 'viewer'` and `judgeSlot == 'NONE'`. Non-admin users updating their own `/users/{userId}` can ONLY modify `displayName` and `updatedAt`—never `role`, `judgeSlot`, `active`, or `readerUids`.
4. **PII Split-Collection Isolation**: User email/phone (`/user_private/{userId}`) and teacher contact phones (`/teacher_contacts/{teacherId}`) are strictly isolated from master documents. Neither collection allows `list` queries (`allow list: if false`), and `get` is restricted strictly to `isOwner(userId) || isAdmin()` (or `isAdmin()` for `teacher_contacts`).
5. **Query Enforcer & Cost Optimization**: Every `allow list` block strictly checks `request.auth.uid in resource.data.readerUids` with ZERO `get()` or `exists()` calls inside `list` blocks. Unfiltered client queries are rejected with `PERMISSION_DENIED`.
6. **Relational Integrity (Master Gate)**: Creating an `Evaluation` requires `exists()` checks confirming that `classId`, `judgeId`, and `periodId` exist in `/classes`, `/judges`, and `/judging_periods`, and `createdBy == request.auth.uid`.
7. **Mathematical Rubric Integrity**: `Evaluation` writes validate that all 22 Lampiran 1 items (`a1..a9`, `b1..b5`, `c1..c5`, `d1..d3`) are within `[0, maxScore]`, subtotals A (`<=45`), B (`<=35`), C (`<=10`), D (`<=10`) are non-negative, and `subtotalA + subtotalB + subtotalC + subtotalD == totalScore` (`0..100`).
8. **Terminal State Locking**: Once `WeeklyResult.status == 'APPROVED'`, `MonthlyResult.status == 'APPROVED'`, or `Evaluation.status == 'LOCKED'`, non-admin roles (`penilai`, `koordinator`, `kepala_madrasah`) cannot overwrite or unlock locked/ratified records; only `isAdmin()` can perform an audited correction.
9. **Immutable Audit Trail**: `/audit_logs/{logId}` is strictly append-only (`allow update, delete: if false`) with `actorUid == request.auth.uid` and `createdAt == request.time`.
10. **Strict Temporal & Schema Bounds**: Every string has `.size() <= MAX`, every ID matches `^[a-zA-Z0-9_\-]+$` (`<= 128`), `readerUids` is bounded `1..50`, and `createdAt` / `updatedAt` must equal `request.time`.

---

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Payload 1 — Privilege Escalation on Registration**: Authenticated non-admin creates `/users/attacker_1` with `role: "administrator"`. -> `PERMISSION_DENIED`
2. **Payload 2 — Shadow Field Injection on Class Creation**: Admin creates `/classes/cls_1` with required fields plus ghost key `"isSuperClass": true`. -> `PERMISSION_DENIED`
3. **Payload 3 — Unverified Admin Email Spoof**: Attacker with `email: "safrialwahyu@gmail.com"` and `email_verified: false` writes to `/school_settings/main`. -> `PERMISSION_DENIED`
4. **Payload 4 — PII Blanket Read Leak**: Authenticated judge (`uid: "judge_1"`) executes `get` on `/user_private/other_user` or `/teacher_contacts/tch_1`. -> `PERMISSION_DENIED`
5. **Payload 5 — Unscoped Collection Scraping (`list` bypass)**: Authenticated user queries `/evaluations` without `where('readerUids', 'array-contains', uid)` where `readerUids` excludes attacker. -> `PERMISSION_DENIED`
6. **Payload 6 — Evaluation Score Overflow**: Judge submits `/evaluations/eval_1` with `scores.a1 = 8` (exceeding max 5) or `totalScore = 105`. -> `PERMISSION_DENIED`
7. **Payload 7 — Orphaned Evaluation Write**: Judge submits `/evaluations/eval_orphan` referencing non-existent `classId: "nonexistent_cls"`. -> `PERMISSION_DENIED`
8. **Payload 8 — Unauthorized Ratification by Judge/Coordinator**: `koordinator` attempts to create or update `/weekly_results/weekly_p1` with `status: "APPROVED"`. -> `PERMISSION_DENIED`
9. **Payload 9 — Terminal State Tampering**: `penilai` or `koordinator` attempts to update `/weekly_results/weekly_p1` after `status` is already `"APPROVED"`. -> `PERMISSION_DENIED`
10. **Payload 10 — Value Poisoning on Update**: User updates whitelisted field `displayName` on `/users/u1` with a boolean `true` or 500-char string. -> `PERMISSION_DENIED`
11. **Payload 11 — ID Poisoning Attack**: Admin attempts to create `/classes/bad$id!with spaces` failing `^[a-zA-Z0-9_\-]+$`. -> `PERMISSION_DENIED`
12. **Payload 12 — Audit Log Deletion / Forged Timestamp**: Admin attempts to `delete` `/audit_logs/log_1` or `create` with forged past `createdAt`. -> `PERMISSION_DENIED`
