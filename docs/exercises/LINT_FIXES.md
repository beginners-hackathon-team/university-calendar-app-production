# 課題: CIのlintエラーを直そう

CI（GitHub Actions）のFrontendジョブがeslintエラーで落ちています。
これを直してCIを緑にするのが課題です。**答えは書いていないので、ヒントを頼りに自分で直してみてください。**

## 進め方

1. `bash scripts/check.sh frontend` をローカルで実行してエラーを再現する
2. 1つ直すたびに再実行して、エラーが減ることを確認する
3. 全部消えたらPRを出す → CIとCodeRabbitのレビューが緑になることを確認

> 25件中17件（`react-hooks/exhaustive-deps` was not found）は設定の問題で修正済み。
> 残りの**8件**が皆さんの課題です。

---

## 課題1: 未使用の変数・import（6件）

「宣言したけど一度も使っていない」ものはバグの温床（消し忘れ？使い忘れ？）なのでeslintが検出します。
直し方は状況によって違います。**「なぜ未使用なのか」を考えてから消すこと。**

| 場所 | エラー | 考えるポイント |
|---|---|---|
| `components/tasks/AssignmentBlockContent.tsx` 27-28行 | `expanded`, `onExpand` が未使用 | propsとして受け取っているが関数内で使っていない。本当に不要？それとも使い忘れ？呼び出し元がこのpropsを渡しているか確認 |
| `components/tasks/TodoBlockContent.tsx` 14-15行 | 同上 | 同上（同じパターン） |
| `components/tasks/DoneColumn.tsx` 276行 | `onClick={(e) => ...}` の `e` が未使用 | 引数を受け取っているが中で使っていない。引数ごと消せる？ |
| `pages/TasksPage.arrowbugs.test.tsx` 5行 | `import type { Todo }` が未使用 | importの消し忘れ。単純に削除でOK |

ヒント: propsを消す場合は、そのコンポーネントの **Props型定義** と **呼び出し元** も一緒に直す必要があります。
消して `npm run typecheck` が通るかで確認できます。

## 課題2: `any` の使用（2件）

`pages/AdminEventsPage.tsx` 27行・29行:

```ts
await updateUniversityEvent(editing.id, data as any);
await createUniversityEvent(data as any);
```

`as any` は「型チェックを放棄する」という意味で、TypeScriptを使う意味がなくなります。
（AGENTS.mdの方針「`any` の多用を避ける」参照）

考える手順:

1. `updateUniversityEvent` / `createUniversityEvent` の引数の型定義を見る（`src/api/` 配下）
2. `data`（`{...form, year}`）の型と何が合わなくて `as any` でごまかしたのかを特定する
3. `form` のstate型を直すか、APIが期待する型のオブジェクトを組み立てて渡す

ヒント: エラーメッセージに「どのプロパティの型が合わないか」が出ます。
`as any` を外して `npm run typecheck` を実行し、エラーを読むところから始めてください。

---

## 課題3: Backend `== False` / `== True` 比較（E712・4件）

`backend/app/api/tasks.py` の40・41・196・197行:

```python
Task.is_hidden == False,
~((Task.is_done == True) & (Task.done_at < cutoff)),
```

ruffは「`not Task.is_hidden` にしろ」と提案してきますが、**ここでそれをやると実行時エラーになります。**
これはSQLAlchemyのフィルタ式で、`Task.is_hidden == False` は「Pythonの比較」ではなく
「SQLの `WHERE is_hidden = false` を組み立てる式」だからです。Pythonの `not` はSQL式に変換できません。

考える手順:

1. なぜ通常のPythonでは `== False` がダメとされるのか（PEP 8）を調べる
2. なぜSQLAlchemyでは事情が違うのかを理解する（`==` が演算子オーバーロードされている）
3. SQLAlchemyには真偽値カラムをSQL的に比較する専用の書き方がある。公式ドキュメントで
   「is_」「boolean column comparison」を調べて、ruffにもSQLAlchemyにも怒られない形に直す

直したら `bash scripts/check.sh backend` で確認。**テストが通ることも必ず確認すること**
（フィルタの意味が変わっていたらテストが落ちるはず。これがテストの価値です）。

> なお、alembicと `__init__.py` のF401（15件）は意図的なimportのため
> ruff設定（`backend/pyproject.toml` の per-file-ignores）で除外済み。コード修正は不要です。

---

## 詰まったら

エラーの読み方が分からなければ、エラー全文をAIに貼って「原因の説明だけ」してもらうのも可です。
