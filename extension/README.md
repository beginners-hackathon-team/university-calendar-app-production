# Chrome拡張機能 MVP仕様書

## 目的

金沢大学ポータルおよびWebClass LMS上のHTMLを取得し、既存バックエンドへ送信するChrome拡張機能を実装する。

現段階ではHTML解析は行わない。

取得したHTMLをそのままバックエンドへ送信できる状態を最初のゴールとする。

---

## 対象サイト

### 金沢大学ポータル

```text
https://eduweb.sta.kanazawa-u.ac.jp/
```

### WebClass LMS

```text
https://lms-wc.el.kanazawa-u.ac.jp/
```

---

## 対象ページ

### 履修登録一覧

```text
https://eduweb.sta.kanazawa-u.ac.jp/Portal/StudentApp/Regist/RegistList.aspx
```

### LMS教材ページ

```text
https://lms-wc.el.kanazawa-u.ac.jp/webclass/course.php/{courseId}/?acs_={token}
```

### LMSマイレポートページ

```text
https://lms-wc.el.kanazawa-u.ac.jp/webclass/course.php/{courseId}/my-reports?acs_={token}
```

---

## 実装対象

### 1. 履修登録一覧ページ

対象URLでContent Scriptを実行する。

ページ上に以下のボタンを表示する。

```text
履修情報を取得
```

ボタン押下時の処理

```text
現在ページのHTMLを取得
↓
バックエンドへPOST
```

また、将来の教室取得のために以下のURL取得処理だけ実装する。

```text
LectureList.aspx?lct_year={年度}&lct_cd={授業ID}
```

ただし現段階ではHTML解析しない。

取得したHTMLをそのままバックエンドへ送信する。

---

### 2. LMS教材ページ

対象URLでContent Scriptを実行する。

ページ上に以下のボタンを表示する。

```text
LMS情報を取得
```

ボタン押下時の処理

```text
現在ページのHTMLを取得
↓
バックエンドへPOST
```

---

### 3. LMSマイレポート取得

LMS教材ページでボタンが押された際に実行する。

現在のURLから

```text
courseId
acs_
```

を取得する。

以下のURLを生成する。

```text
/course.php/{courseId}/my-reports?acs_={token}
```

Background Service Worker経由で取得する。

取得したHTMLはそのままバックエンドへ送信する。

---

## HTML解析

実装しない。

以下は全てスタブでよい。

```text
parseRegisteredCourses()
parseLectureDetail()
parseLmsCoursePage()
parseMyReports()
```

現段階では呼び出さなくてもよい。

---

## バックエンド送信

エンドポイント

```text
POST /api/extension/sync
```

送信形式

```json
{
  "type": "regist-list",
  "url": "current_url",
  "html": "<html>...</html>"
}
```

```json
{
  "type": "lecture-detail",
  "url": "lecture_url",
  "html": "<html>...</html>"
}
```

```json
{
  "type": "lms-course",
  "url": "course_url",
  "html": "<html>...</html>"
}
```

```json
{
  "type": "my-reports",
  "url": "report_url",
  "html": "<html>...</html>"
}
```

---

## CSP対策

ページJavaScriptからのfetchは使用しない。

外部URL取得はすべてBackground Service Workerで行う。

```text
content script
↓
runtime.sendMessage
↓
background
↓
fetch
↓
結果返却
```

---

## Manifest

必要権限

```json
{
  "permissions": [
    "storage"
  ],
  "host_permissions": [
    "https://eduweb.sta.kanazawa-u.ac.jp/*",
    "https://lms-wc.el.kanazawa-u.ac.jp/*",
    "http://localhost:8000/*"
  ]
}
```

---

## 実装ファイル

```text
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
    │   └── urls.ts
    └── parsers/
        ├── registParser.ts
        ├── lectureDetailParser.ts
        ├── lmsCourseParser.ts
        └── myReportsParser.ts
```

---

## MVP完了条件

* RegistList.aspx にボタンが表示される
* LMS教材ページにボタンが表示される
* 現在ページHTMLを取得できる
* my-reportsをBackground経由で取得できる
* LectureList.aspxをBackground経由で取得できる
* バックエンドへPOSTできる
* HTML解析は未実装でもよい

---

## 認証・拡張機能接続方針

### 基本方針

Chrome拡張機能内でユーザー名・パスワードによるログイン画面は実装しない。

認証はWebアプリ側で行い、Chrome拡張機能は発行済みの接続トークンを利用してバックエンドと通信する。

これにより、将来的な認証方式の変更（Googleログイン、GitHubログイン等）に対して、拡張機能側の変更を最小限にできる。

---

### 想定フロー

```text
ユーザーがWebアプリにログイン
（メールアドレス / Googleログイン 等）
↓
Webアプリの設定画面で
「Chrome拡張機能を接続」を実行
↓
バックエンドが extension token を発行
↓
Chrome拡張機能に保存
(chrome.storage.local)
↓
以降のAPI通信では
Authorization: Bearer {extension_token}
を付与
```

---

### MVPでの実装方針

初期実装では、接続フローは簡易化する。

```text
Webアプリで extension token を発行
↓
ユーザーが拡張機能へ貼り付け
↓
chrome.storage.local に保存
```

拡張機能は保存されたトークンを利用してバックエンドへ通信する。

---

### 将来実装

将来的には以下のような接続フローへ移行する。

```text
Webアプリにログイン済み
↓
「Chrome拡張機能を接続」
↓
ワンクリックで拡張機能へトークンを受け渡し
↓
自動接続
```

---

### Googleログイン対応

認証はWebアプリ側で管理する。

そのため、

* メールアドレス / パスワード
* Googleログイン
* GitHubログイン
* その他OAuthログイン

へ変更しても、Chrome拡張機能側の実装変更は不要とする。

Chrome拡張機能は認証方式を意識せず、発行済みの extension token のみを利用する。

