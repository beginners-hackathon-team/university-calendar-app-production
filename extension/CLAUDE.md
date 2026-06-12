以下の実装をお願いします。

目的：
アプリの履修情報画面から、金沢大学ポータルの履修情報一覧ページを開くときに、Q1〜Q4の指定した学期が自動で選択された状態にしたい。

前提：
ポータル側の履修情報一覧ページには、学期選択のselectが存在する。

select id:
ctl00_phContents_ucRegistSearchList_ddlTerm

select name:
ctl00$phContents$ucRegistSearchList$ddlTerm

onchange:
javascript:setTimeout('__doPostBack(\'ctl00$phContents$ucRegistSearchList$ddlTerm\',\'\')', 0)

つまり、学期を切り替えるには以下のようにする。

const term = document.querySelector("#ctl00_phContents_ucRegistSearchList_ddlTerm");
term.value = "12";
__doPostBack("ctl00$phContents$ucRegistSearchList$ddlTerm", "");

要件：
1. アプリ側で「ポータルで開く」を押したとき、現在表示中の学期に応じて以下のURLを開く。
   https://eduweb.sta.kanazawa-u.ac.jp/Portal/StudentApp/RegistList.aspx?targetTerm=Q2

2. targetTerm は Q1 / Q2 / Q3 / Q4 のいずれかを指定できるようにする。

3. Chrome拡張のcontent script側で、URLの targetTerm を読み取る。

4. targetTerm を読み取ったら sessionStorage に保存し、history.replaceState でURLから query parameter を削除する。
   理由：postback後に再実行ループするのを防ぐため。

5. sessionStorage に保存された targetTerm に応じて、ポータルの学期selectを切り替える。

6. 学期の対応値は以下とする。
   Q1 -> "11"
   Q2 -> "12"
   Q3 -> "13"
   Q4 -> "14"

7. 現在のselect値と指定された学期値が異なる場合のみ、
   select.value を変更し、__doPostBack("ctl00$phContents$ucRegistSearchList$ddlTerm", "") を実行する。

8. すでに指定学期が選択されている場合、postbackは実行せず sessionStorage を削除する。

9. __doPostBack が存在しない場合や、selectが存在しない場合はエラーで落とさず、console.warn を出して終了する。

実装イメージ：

const termValueMap = {
  Q1: "11",
  Q2: "12",
  Q3: "13",
  Q4: "14",
};

const params = new URLSearchParams(location.search);
const targetTerm = params.get("targetTerm");

if (targetTerm) {
  sessionStorage.setItem("targetTerm", targetTerm);
  history.replaceState(null, "", location.pathname);
}

const savedTerm = sessionStorage.getItem("targetTerm");
const termValue = termValueMap[savedTerm];

if (termValue) {
  const term = document.querySelector("#ctl00_phContents_ucRegistSearchList_ddlTerm");

  if (!term) {
    console.warn("Term select not found");
    sessionStorage.removeItem("targetTerm");
    return;
  }

  if (term.value !== termValue) {
    if (typeof __doPostBack !== "function") {
      console.warn("__doPostBack is not available");
      sessionStorage.removeItem("targetTerm");
      return;
    }

    sessionStorage.removeItem("targetTerm");
    term.value = termValue;
    __doPostBack("ctl00$phContents$ucRegistSearchList$ddlTerm", "");
  } else {
    sessionStorage.removeItem("targetTerm");
  }
}

注意：
- content scriptでTypeScriptを使っている場合は、window.__doPostBack の型定義も追加する。
- URLにtargetTermを残したままだとpostback後にループする可能性があるので、必ずhistory.replaceStateで削除する。
- アプリ側では現在表示中のQ1〜Q4を openPortalRegistList(term) に渡す形にする。