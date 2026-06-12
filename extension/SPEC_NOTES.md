# Chrome拡張機能 仕様理解メモ

## 理解した内容

**目的**: 金沢大学ポータル・WebClass LMSから履修・課題情報を取得し、既存バックエンドへPOSTするChrome拡張

### 3つの機能

| 機能 | 対象URL | 概要 |
|---|---|---|
| 履修登録一覧取得 | `RegistList.aspx` | ボタン押下でHTML取得 → 各授業の`LectureList.aspx`をBackground経由でfetch → バックエンドへPOST |
| LMS教材ページ取得 | `course.php/{id}/` | ボタン押下でHTML取得 |
| マイレポート取得 | `course.php/{id}/my-reports` | 機能2と同時にBackground経由でfetch → 教材情報と合わせてPOST |

### 基本方針

- Manifest V3
- CSP対策のため外部fetchはBackground Service Workerで行う
- ユーザーのID・パスワード・Cookieは保存しない
- 取得処理はユーザー操作（ボタン押下）を起点にする
- HTML解析ロジックはスタブでよい（現時点は実装対象外）

### ファイル構成

```
extension/
├── manifest.json
├── package.json
├── vite.config.ts
├── tsconfig.json
└── src/
    ├── background/
    │   └── background.ts
    ├── content/
    │   └── content.ts
    ├── shared/
    │   ├── api.ts
    │   ├── messages.ts
    │   ├── urls.ts
    │   └── types.ts
    └── parsers/
        ├── registParser.ts
        ├── lectureDetailParser.ts
        ├── lmsCourseParser.ts
        └── myReportsParser.ts
```

---

## 不明・不十分な点

### 1. バックエンドへの認証方法が未記載

既存バックエンドはJWT認証を使っているが、Chrome拡張からPOSTする際にどうトークンを渡すか書かれていない。

**要確認**:
- ユーザーがWebアプリにログインしたトークンを `chrome.storage` に保存する想定？
- それとも拡張独自の認証フロー（拡張内でログインする）？

### 2. バックエンドAPIエンドポイントが「案」のまま

仕様書では以下が「案」として示されているが確定していない。

```
POST /api/extension/courses/import
POST /api/extension/lms/import
POST /api/extension/reports/import
// または
POST /api/extension/sync
```

**要確認**:
- どのエンドポイントを使うか
- バックエンド側に実装があるか

### 3. `lct_year` / `lct_cd` の取得元が不明

教室補完のために `LectureList.aspx?lct_year={年度}&lct_cd={授業ID}` をfetchするが、`lct_year` と `lct_cd` の値をどこから取得するか明記されていない。

**推測**: `parseRegisteredCourses()` がHTMLから抽出する想定だが、現時点ではスタブなので設計として確認が必要。

### 4. `acs_` トークンのmy-reportsへの引き継ぎ

LMS教材ページのURL（`?acs_={token}`）からacs_を取得し、my-reportsのURLにも付与する想定と思われるが、仕様書に明記されていない。

**要確認**: `content.ts` でURLから `acs_` を抽出して `background.ts` に渡す流れでよいか？

### 5. ポップアップUIの有無

拡張機能アイコン押下時のPopup UIについて言及なし。

**要確認**: Content Scriptのボタンだけで完結する設計？ポップアップは不要？

### 6. 本番バックエンドURL

`host_permissions` に `http://localhost:8000/*` のみ記載。Renderにデプロイした本番URLへの送信先をどう切り替えるか未記載。

**要確認**: 送信先URLを `chrome.storage` で設定可能にする？それともビルド時の環境変数で切り替える？
