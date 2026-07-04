# API リファレンス

`backend/app/main.py` に定義されている実際のエンドポイント一覧。
`fetch` の書き方・CORS・エラーハンドリングなど一般的なパターンは [TYPESCRIPT.md](./TYPESCRIPT.md) を参照。

---

## 共通事項

- **ベースURL**: 開発時は `http://localhost:8000`、本番は同一オリジン（フロントと同じドメインから配信）
- **認証**: `/api/health` と `/privacy` を除く全エンドポイントで Supabase Auth の JWT が必要
  - ヘッダー: `Authorization: Bearer <access_token>`
  - フロント側は `frontend/src/api/client.ts` の `authFetch` がトークン付与と401時のログアウト処理を自動で行う
- **管理者限定エンドポイント**: JWTの `app_metadata.is_admin` が `true` であることが必要（`get_admin_user` 依存関数、403で拒否）
- **エラー形式**: `{ "detail": "エラーメッセージ" }`

---

## ヘルスチェック

```
GET /api/health
  認証: 不要
  res: 200 { "status": "ok" }
```

---

## ユーザー情報（me / profiles）

```
GET /api/me
  res: 200 { id, display_name, is_admin, assignment_sync_mode }

PATCH /api/me
  req: { display_name?, assignment_sync_mode? }   # assignment_sync_mode は "auto" | "manual"
  res: 200 { display_name, assignment_sync_mode }
```

初回アクセス時に `profiles` テーブルの行が無ければ自動作成される（`ensure_profile`）。

---

## 時間割（courses）

```
POST /api/course
  req: { name, room, teacher, year, quarter(1-4), day_of_week("月"〜"日"), period(1-6) }
  res: 200（courseとcourse_date, enrollmentを同時作成）

GET /api/courses/{year-quarter}
  例: /api/courses/2026-1
  res: 200 [{ id, name, room, teacher, year, quarter, day_of_week, period,
              is_intensive_lct, lms_course_id, lms_system_type }]
  ※ 自分の履修（enrollments）のみ返す

PUT /api/course/{course_id}
  req: { name, room, teacher }
  res: 200 { id, name, room, teacher }
  ※ 自分の履修のみ編集可（enrollmentが無ければ404）

DELETE /api/course/{course_id}
  res: 204
  ※ 自分の履修のみ削除可

DELETE /api/courses
  認可: 管理者のみ
  res: 204（全courseを削除）
```

---

## カレンダー（集約）

```
GET /api/calendar/{year-month}
  例: /api/calendar/2026-4
  res: 200 [{ id, name, room, teacher, dates: ["2026-04-15", ...], period }]
```

`course_dates`（開講メタ情報）から `services/schedule.py` の `build_class_dates` で実際の開催日を計算して返す。`is_intensive_lct=true`（集中講義）は対象月に関わらず除外される。大学イベント・祝日はここには含まれず、フロント側で別途取得して合成する。

---

## 大学イベント（university-events）

```
GET /api/university-events/{year}
  res: 200 [{ id, name, type, date, original_day }]
  type: "exam" | "interval" | "transfer" | "other" | "holiday"
  date: "MM-DD" 形式（例: "04-01"）

POST /api/university-events        認可: 管理者のみ
  req: { year, name, type, date, original_day }
  res: 200 作成されたイベント

PUT /api/university-events/{id}    認可: 管理者のみ
  req: { year, name, type, date, original_day }
  res: 200 更新後のイベント

DELETE /api/university-events/{id} 認可: 管理者のみ
  res: 204
```

---

## 拡張機能連携（extension）

Chrome拡張機能（`extension/`）が大学ポータル・LMSから取得した情報を同期するためのエンドポイント。

```
POST /api/extension/sync
  req: { type: "regist-list"|"lecture-detail"|"lms-course"|"my-reports", url, html }
  res: 200 { status: "received", type }
  ※ 現状はログ出力のみ（受信確認用）

POST /api/extension/import-courses
  req: { courses: [{ name, teacher, room, year, quarter, day_of_week?, period,
                      is_intensive_lct, lms_course_id?, lms_system_type? }],
         sync_year, sync_quarters: [1,2,...] }
  res: 200 { status: "ok", count }
  ※ 取得内容で自分の履修をupsert。sync_year/sync_quartersの範囲内で
     今回取得されなかった履修は削除される（差分同期）

POST /api/extension/import-assignments   （旧フォーマット、互換用）
  req: { assignments: [{ task_name, task_contents_id, course_name?,
                          submitted_at?, result, score? }] }
  res: 200 { status: "ok", count }

POST /api/extension/import-lms-tasks
  req: { tasks: [{ content_id?, source_url?, title, kind?, course_id?, course_name?,
                    available_from?, available_until?, raw_text?, is_active_url }] }
  res: 200 { status: "ok", count }
  ※ (lms_course_id, content_id) または (lms_course_id, source_url) をキーにupsert
```

---

## 課題（assignments）

`type="assignment"` の `Task` を扱う。提出済みで1週間以上経過したものは一覧から自動的に除外される。

```
GET /api/assignments
  res: 200 [AssignmentPublic]
  ※ タイトル・種別からLMSの資料/掲示板等を除外するフィルタ（_is_assignment_candidate）を通す

GET /api/lms-system-types
  res: 200 { [lms_course_id]: lms_system_type }
  ※ 自分が履修しているLMS連携科目のシステム種別一覧

PUT /api/assignments/{id}/done
  req: { is_done }
  res: 200 { status: "ok" }

PUT /api/assignments/{id}/board-status
  req: { board_status: "assignment" | "todo" | "done" }
  res: 200 { status: "ok" }
  ※ "done"にするとis_done/done_atも連動して更新される

PUT /api/assignments/{id}/title
  req: { task_name }
  res: 200 { status: "ok" }

DELETE /api/assignments/{id}
  res: 204
  ※ 物理削除ではなく is_hidden = true（非表示化）
```

---

## Todo（todos）

`type="todo"` の `Task` を扱う。

```
GET /api/todos
  res: 200 [TodoPublic]

POST /api/todos
  req: { title }
  res: 201 TodoPublic

PUT /api/todos/{id}
  req: { title?, is_done? }
  res: 200 TodoPublic

DELETE /api/todos/{id}
  res: 204
  ※ is_hidden = true（非表示化）
```

---

## 個人イベント（personal-events）

```
GET /api/personal-events
  res: 200 [PersonalEventPublic]

POST /api/personal-events
  req: { title, start, end?, all_day, color? }
  res: 201 PersonalEventPublic

PUT /api/personal-events/{id}
  req: { title, start, end?, all_day, color? }
  res: 200 PersonalEventPublic

DELETE /api/personal-events/{id}
  res: 204
```

---

## プライバシーポリシー（非API）

```
GET /privacy
  認証: 不要
  res: 200 HTML（Chrome拡張機能のプライバシーポリシーページ）
```

内容は [privacy-policy.md](./privacy-policy.md) を参照（Markdown複製）。実体は `main.py` の `_PRIVACY_POLICY_HTML`。
