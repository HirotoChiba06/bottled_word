# Bottled Word / ボトルメッセージ v2

Bottled Word は、匿名の投稿が複数のユーザーを巡り、コメントをまとって投稿者の元へ帰ってくるリレー型ボトルメッセージSNSです。

このリポジトリは旧Flask版から、Node.js + TypeScript + Express + EJS + SQLite の v2 として再設計しました。ログインや個人情報は扱わず、ブラウザCookieの `anonymous_user_key` だけで自分の投稿・受信・コメント・帰還ボトルを管理します。

## 技術構成

- Node.js 22.x LTS
- TypeScript
- Express
- EJS
- SQLite
- better-sqlite3
- cookie-parser
- dotenv
- Docker / Docker Compose
- Render Node.js デプロイ設定

学習用途とRenderでの安定運用を優先し、Express 5系 / EJS 5系 / TypeScript 6系 / Node型定義25系から、安定版の Express 4系 / EJS 3系 / TypeScript 5系 / Node型定義22系へ調整しています。

## 主な機能

- anonymous_user_key のCookie発行
- 浜辺 / Home
  - ボトル投稿
  - ランダムに漂着したボトルの表示
  - コメント追加
- 物置 / Collection
  - 自分が送ったメッセージ
  - 自分が受け取ったメッセージ
  - 自分が書いたコメント
  - 帰ってきたボトルとコメント履歴
- オプション / Settings
  - 文字サイズ
  - テーマ変更
- 文字数制限
  - ボトル本文: 360文字
  - コメント: 180文字
- 空文字バリデーション
- 3〜5コメントでボトルが投稿者へ帰還

## DB設計

SQLite DBは `data/bottled_word.sqlite` に作成されます。

### anonymous_users

匿名ユーザーをCookieキーで管理します。

- `id`
- `anonymous_user_key`
- `created_at`
- `last_seen_at`

### bottles

漂流するメッセージ本体です。

- `id`
- `author_user_key`
- `content`
- `status`: `drifting` または `returned`
- `target_comment_count`: 3〜5
- `comment_count`
- `created_at`
- `returned_at`

### bottle_comments

ボトルに追加されたコメントです。同じ匿名ユーザーが同じボトルへ複数回コメントしないようにしています。

- `id`
- `bottle_id`
- `commenter_user_key`
- `content`
- `created_at`

### bottle_visits

拾ったボトルの履歴です。

- `id`
- `bottle_id`
- `visitor_user_key`
- `action`: `viewed` または `commented`
- `visited_at`
