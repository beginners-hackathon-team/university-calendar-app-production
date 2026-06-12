1. Supabase SDK導入

フロントエンドに Supabase SDK を追加。

npm install @supabase/supabase-js

以下のような初期化ファイルを作成。

src/lib/supabase.ts

環境変数から取得。

VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
2. Supabase Auth実装

以下の機能を実装。

サインアップ
supabase.auth.signUp()
ログイン
supabase.auth.signInWithPassword()
ログアウト
supabase.auth.signOut()
セッション取得
supabase.auth.getSession()
認証状態監視
supabase.auth.onAuthStateChange()
3. FastAPIでSupabase JWT検証

現在の自前JWT検証ロジックを削除。

代わりに、

Authorization: Bearer <access_token>

で送られてきた Supabase JWT を検証する。

実装要件

JWT署名検証
有効期限検証
ユーザーID取得
current_user取得Dependency作成

例

async def get_current_user(...)

返却値

{
    "id": "...",
    "email": "..."
}
4. usersテーブル整理

現在の users テーブルを確認。

現在

users
--------
id
username
password_hash
...

password_hash は不要になる。

Supabase Auth の

auth.users

を認証情報の正とする。

5. profilesテーブル作成

アプリ固有情報を保持するため、

profiles
--------
user_id UUID PRIMARY KEY
display_name
created_at
updated_at

を作成。

user_id は

auth.users.id

への外部キーとする。

6. ユーザー作成フロー

サインアップ成功時、

profiles

にレコードを作成。

保持したい項目があれば移行する。

7. API認可修正

現在

current_user.id

を参照している箇所を確認。

今後は

auth.users.id

を基準とする。

全APIで正常動作するよう修正。

8. 移行作業

以下を洗い出して一覧化。

認証関連エンドポイント
JWT関連処理
password_hash利用箇所
usersテーブル参照箇所
移行後に不要になるコード

削除対象コードと残すコードを明確にする。

ゴール
認証を完全に Supabase Auth へ移行
自前パスワード管理廃止
自前JWT発行廃止
FastAPIは Supabase JWT を検証
ユーザー情報は profiles テーブルで管理
既存APIが継続動作する状態にする

まずは現状コードを調査し、変更が必要なファイル一覧と移行計画を作成してから実装してください。