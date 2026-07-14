# CI/CD・自動レビュー・開発ハーネス ガイド

このプロジェクトの「品質を自動で守る仕組み」の全体像と導入手順。

```
feature/xxx で開発
   │  bash scripts/check.sh でローカル自己検証（CIと同一）
   ▼
PR作成 (→ develop / main)
   │  ① CI (GitHub Actions) が lint・型チェック・テストを自動実行
   │  ② CodeRabbit がAIコードレビューを自動でコメント
   ▼
develop → main へマージ
   │  ③ Render が「CIチェック通過後」に自動デプロイ (CD)
   ▼
本番反映 (https://<service>.onrender.com)
```

---

## ① CI（導入済み）

`.github/workflows/ci.yml` で、`main` / `develop` へのPRとpush時に自動実行される。

| ジョブ | 内容 |
|---|---|
| backend | ruff (lint) + pytest（PostgreSQL 16サービスコンテナ使用） |
| frontend | eslint + tsc --noEmit + vitest |

ローカルで同じチェックを走らせるには `bash scripts/check.sh`。**ローカルで通ればCIも通る。**

### 推奨: ブランチ保護の設定（リポジトリ管理者）

CIを「通らないとマージできない」ゲートにする。

1. GitHub → リポジトリ → Settings → Branches → Add branch ruleset（または Add rule）
2. 対象ブランチ: `main` と `develop`
3. 「Require status checks to pass before merging」を有効化し、
   `Backend (ruff + pytest)` と `Frontend (eslint + tsc + vitest)` を必須チェックに指定
4. 「Require a pull request before merging」も有効化推奨（直接pushの禁止）

---

## ② CodeRabbit（AI自動レビュー）

設定ファイル `.coderabbit.yaml` は作成済み（日本語レビュー・学習用の指摘スタイル・パス別のレビュー観点を設定済み）。残りはGitHub Appのインストールのみ。

### 導入手順（Organization管理者が1回だけ実行）

1. https://coderabbit.ai を開き「Sign in with GitHub」でサインイン
2. Organization（beginners-hackathon-team）を選択
3. GitHub Appのインストール画面で「Only select repositories」→ このリポジトリを選択して許可
4. 以降、PRを作成すると自動でレビューコメントが付く。`.coderabbit.yaml` が
   mainブランチにあれば自動で読み込まれる（ダッシュボード側の設定より優先）

### 使い方のポイント

- PRごとに要約・シーケンス図・指摘コメントが自動で付く
- 指摘に返信すると会話できる（`@coderabbitai` にメンションで質問も可能）
- 誤指摘は「これは意図的です」と返信すれば学習して以後抑制される
- 料金: パブリックリポジトリは無料。プライベートは無料プランだと要約のみ
  （フルレビューは有料プラン or 学生向けプログラムを確認）

---

## ③ CD: Renderへの自動デプロイ

現在は「mainへのpushで即デプロイ」(Auto-Deploy: On Commit)。これを
**「CIチェック通過後のみデプロイ」に変更する**ことで、テストが落ちたコードが本番に出るのを防ぐ。

### 設定手順（Renderダッシュボード・1回だけ）

1. Render → 対象のWeb Service → Settings → Build & Deploy
2. **Auto-Deploy** を `On Commit` から **`After CI Checks Pass`** に変更

これだけ。追加のワークフローファイルは不要。

### 動作

- `main` にpush（= develop→mainマージ）されると、RenderはそのコミットのGitHub Actionsの結果を待つ
- 全チェックが success / neutral / skipped → デプロイ実行
- 1つでも失敗 → デプロイされない（Renderダッシュボードにスキップ理由が表示される）

> 注意: この設定はCIが必ず走ることが前提。`ci.yml` は `main` へのpushでも
> 実行されるようになっているのでこのままでOK。

### 参考

- [Render Docs: Deploying on Render](https://render.com/docs/deploys)
- [Render Changelog: Skip auto-deploying if CI checks fail](https://render.com/changelog/skip-auto-deploying-if-ci-checks-fail)

---

## ④ 開発ハーネス（AIエージェント向け環境整備）

AIコーディングエージェント（Claude Code等）が正確に働けるように、
「エージェントが自己検証できる仕組み」をリポジトリ側に用意している。

| 要素 | 場所 | 役割 |
|---|---|---|
| エージェントへの指示 | `CLAUDE.md` / `AGENTS.md` | プロジェクト方針・回答スタイル・必須の検証手順 |
| 一括検証コマンド | `scripts/check.sh` | CIと同一のlint/型/テストを1コマンドで実行 |
| E2Eハーネス | `scripts/e2e/run.sh` | 環境起動〜Playwright実行〜後始末を自動化 |
| 実機検証レシピ | `.claude/skills/verify` | ブラウザでの動作確認手順（認証バイパス等） |
| CI | `.github/workflows/ci.yml` | push/PR時の自動フィードバックループ |
| AIレビュー | `.coderabbit.yaml` | PR時の自動レビューフィードバック |

考え方: **エージェントを賢くするのではなく、失敗にすぐ気づける環境を作る。**
「変更 → `scripts/check.sh` → 失敗なら修正」のループをエージェント自身が回せることが核。
人間の開発者（学生）にとっても同じコマンドがそのまま使える。

### 運用ルール

- コード変更を伴う作業をAIに依頼したら、最後に `bash scripts/check.sh` を通させる
- 新しい「ハマりどころ」を見つけたら `CLAUDE.md` の該当セクションに追記する
  （エージェントが同じ穴に落ちなくなる）
- 検証手順が手作業になっていたらスクリプト化を検討する（`scripts/e2e/run.sh` が前例）
