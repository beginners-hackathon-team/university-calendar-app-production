# Extension UI デザイン仕様

Chrome 拡張（content script）が注入する UI のデザイン仕様。
すべての UI はダークパネルテーマに統一する。

---

## カラーパレット

| 用途 | 値 |
|---|---|
| パネル背景 | `rgba(15, 23, 42, 0.95)` |
| ボタン通常背景 | `rgba(255, 255, 255, 0.05)` |
| ボタンホバー背景 | `rgba(255, 255, 255, 0.12)` |
| ボタン枠線 | `rgba(255, 255, 255, 0.20)` |
| ボタン枠線（ホバー） | `rgba(255, 255, 255, 0.35)` |
| テキスト（メイン） | `#f8fafc` |
| テキスト（サブ） | `#94a3b8` |
| セパレータ | `rgba(255, 255, 255, 0.08)` |
| 成功アクセント | `rgba(74, 222, 128, 0.6)` |
| LMSリンク色 | `#93c5fd` |
| LMSリンク（ホバー） | `#bfdbfe` |

---

## コンポーネント

### 1. サイドパネル（LMS ページ）

`initLmsSidePanel()` で生成する右側固定パネル。

```
position: fixed
top: 16px / right: 16px（ドラッグ後は left/top に切り替わる）
width: 210px
background: rgba(15, 23, 42, 0.95)
border-radius: 10px
box-shadow: 0 4px 20px rgba(0,0,0,0.5)
overflow: hidden
z-index: 2147483647
```

**構造（上から順）:**
```
[ ⠿ ⠿ ⠿ ]          ← ドラッグハンドル（cursor: grab）
[ 課題を追加 ]        ← extrasArea（manual mode のみ）
[ 時間割へ   ]        ← makePanelNavBtn
[ タスクへ   ]        ← makePanelNavBtn
[ 授業一覧 ▲ ]       ← トグルヘッダー
  [ Q1 ][ Q2 ][ Q3 ][ Q4 ]
  月1  授業名...
  火2  授業名...
```

---

### 2. ナビゲーションボタン（`makePanelNavBtn`）

ページ遷移用。クリック後のフィードバックは不要（すぐに画面が変わる）。

```css
display: block
width: calc(100% - 12px)
margin: 4px 6px
padding: 8px 12px
background: rgba(255,255,255,0.05)
border: 1px solid rgba(255,255,255,0.20)
border-radius: 6px
color: #f8fafc
font-size: 13px
font-weight: bold
cursor: pointer
box-sizing: border-box
```

ホバー時:
```css
background: rgba(255,255,255,0.12)
border-color: rgba(255,255,255,0.35)
```

---

### 3. アクションボタン（`makePanelActionBtn`）

非同期処理（課題取得など）を伴うボタン。ローディング・完了・エラー状態を持つ。

ナビゲーションボタンと同じ見た目。クリック時の状態遷移:

| 状態 | textContent | opacity | border-color |
|---|---|---|---|
| 通常 | `label` | 1.0 | `rgba(255,255,255,0.2)` |
| 処理中 | `処理中...` | 0.6 | ― |
| 完了 | `完了 ✓` | ― | `rgba(74,222,128,0.6)` |
| エラー | `エラー` | ― | ― |

2.5 秒後に通常状態に戻る。

---

### 4. 個別固定ボタン（`createButton`）

ポータルページ（時間割登録画面など）で使用する独立した固定ボタン。

```css
position: fixed
top: 16px / right: 16px（top は呼び出し元が上書き）
padding: 9px 16px
background: rgba(15,23,42,0.92)
border: 1px solid rgba(255,255,255,0.22)
border-radius: 8px
color: #f8fafc
font-size: 13px
font-weight: bold
box-shadow: 0 4px 16px rgba(0,0,0,0.4)
z-index: 2147483647
```

ホバー時:
```css
border-color: rgba(255,255,255,0.40)
```

クリック後の状態遷移はアクションボタンと同様（`処理中...` → `完了` → 元のラベルに戻る）。

---

## ドラッグ動作

サイドパネルはドラッグハンドルを掴んで任意の位置に移動できる。

- `mousedown` 時: `position.right` を無効化し `left` に切り替え
- `mousemove` 時: ウィンドウ内に収まるよう `left`/`top` をクランプ
- `mouseup` 時: `chrome.storage.local` の `panelPosition` に保存
- 次回表示時: 保存された位置を復元

---

## Q セレクタ

```css
display: flex
gap: 3px
background: rgba(255,255,255,0.08)
border-radius: 6px
padding: 3px
```

選択中のボタン:
```css
background: white
color: #1d4ed8
font-weight: 600
box-shadow: 0 1px 2px rgba(0,0,0,0.15)
```

非選択ボタン:
```css
background: transparent
color: #94a3b8
font-weight: 400
```

---

## 授業行（LMS リンク）

```css
display: flex
align-items: center
gap: 5px
padding: 4px 2px
border-bottom: 1px solid rgba(255,255,255,0.06)
font-size: 11px
```

LMS リンクあり: `color: #93c5fd; cursor: pointer`（ホバーで `#bfdbfe`）  
LMS リンクなし: `color: #475569; cursor: default`

クリック時: `window.location.href = lmsUrl`（現在のタブで遷移）
