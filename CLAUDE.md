# CLAUDE.md

- @AGENTS.mdを必ず参照すること。
- デザインは@DESIGN.mdを参照すること。

# Development Environment

このプロジェクトは Docker 環境で動作する。

## Commands

すべてのコマンドは app コンテナ内で実行する。

```bash
docker compose -f compose.yml -f compose.override.yml exec app bash -c "<command>"