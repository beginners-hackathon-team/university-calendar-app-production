import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  tseslint.configs.recommended,
  {
    // Reactフックの誤用を検出するプラグイン。
    // コード中の eslint-disable-next-line react-hooks/exhaustive-deps は
    // このプラグインがないと「未定義ルール」エラーになる。
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error', // フックは条件分岐の中で呼ばない等の基本ルール
      'react-hooks/exhaustive-deps': 'warn', // useEffect等の依存配列の漏れを警告
    },
  },
);
