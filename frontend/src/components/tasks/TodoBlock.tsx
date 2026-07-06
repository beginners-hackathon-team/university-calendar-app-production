import { memo, useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MobileMenu, MobileMenuItem } from './MobileMenu';
import { type TodoColumnItem, todoColumnItemKey } from '../../lib/tasksBoard';
import { getTextRowStyle } from './ui';
import { AssignmentBlockContent } from './AssignmentBlockContent';
import { TodoBlockContent } from './TodoBlockContent';
import type { AssignmentFocusField, CaretPos, TodoBlockVariant } from './todoBlockHelpers';

export type { AssignmentFocusField, CaretPos, TodoBlockVariant } from './todoBlockHelpers';

type Props = {
  item: TodoColumnItem;
  variant: TodoBlockVariant;
  lineNumber?: number;
  isLast?: boolean;
  systemTypes: Record<string, string | null>;
  isMobile?: boolean;
  busy: boolean;
  autoFocus?: boolean;
  caret?: CaretPos;
  focusField?: AssignmentFocusField;
  onConsumeFocus?: () => void;
  internalFocusMoveRef?: React.MutableRefObject<boolean>;
  onChangeTitle: (id: string, title: string) => void;
  onChangeAssignmentTitle: (id: string, taskName: string) => void;
  onCreateBelow: (afterId: string) => void;
  onCreateBefore: (beforeId: string) => void;
  onDeleteBlock: (id: string, focusPrev: boolean) => void;
  onNavigate: (id: string, dir: 'prev' | 'next') => void;
  onEnsureTrailingBlock?: (id: string) => void;
  onMoveAssignmentToAssignment?: () => void;
  onMoveAssignmentToDone?: () => void;
  onMoveTodoToDone?: () => void;
};

// TODOカラムの1ブロック（Todo / 課題 共通）。
// リストモードは従来どおり（カード寄りの強調・ドラッグ並び替え）。
// テキストモードは「本当にエディタに見えるUI」を優先し、通常時は背景・枠線・角丸を
// 一切出さず、行番号ガターだけ固定幅で揃えた、ただのテキスト行として表示する。
// ドラッグ操作（オブジェクト化）はテキストモードでは一旦オフにしている（後で戻す）。
function TodoBlock({
  item,
  variant,
  lineNumber,
  isLast = false,
  systemTypes,
  isMobile,
  busy,
  autoFocus = false,
  caret = 'end',
  focusField,
  onConsumeFocus,
  internalFocusMoveRef,
  onChangeTitle,
  onChangeAssignmentTitle,
  onCreateBelow,
  onCreateBefore,
  onDeleteBlock,
  onNavigate,
  onEnsureTrailingBlock,
  onMoveAssignmentToAssignment,
  onMoveAssignmentToDone,
  onMoveTodoToDone,
}: Props) {
  const id = item.type === 'todo' ? item.todo.id : item.assignment.id;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: todoColumnItemKey(item),
    data: { type: item.type, column: 'todo', id },
  });

  // ホバーは「テキストモードのごく薄いハイライト」と「削除ボタンの表示判定」に使う。
  const [hovered, setHovered] = useState(false);
  // Todo のテキストエリアにフォーカスがある間は「現在行」としてハイライトを出す。
  const [focused, setFocused] = useState(false);
  // モバイルでカードをタップしたときにボタン類を展開する。
  const [expanded, setExpanded] = useState(false);
  // モバイルメニューの「編集」から TodoBlockContent の編集モードを起動する ref。
  const startTodoEditRef = useRef<(() => void) | null>(null);

  const isListVariant = variant === 'list';

  const style: React.CSSProperties = isListVariant
    ? {
        transform: CSS.Transform.toString(transform),
        transition,
        cursor: 'grab',
        touchAction: isMobile ? 'pan-y' : 'none',
        opacity: isDragging ? 0.08 : 1,
        ...(isDragging ? {
          outline: '2px dashed var(--c-accent)',
          outlineOffset: -2,
          borderRadius: 8,
        } : {}),
        padding: '6px 10px',
        ...getTextRowStyle(item.type, { selected: focused, variant }),
      }
    : {
        display: 'grid',
        gridTemplateColumns: '22px minmax(0, 1fr)',
        gap: 8,
        padding: '0 6px',
        borderRadius: hovered || focused ? 3 : 0,
        // VSCode の「現在行ハイライト」のような、ごく薄い背景のみ。境界線・角丸の強調・
        // ドラッグの浮き上がりは出さない（通常時は完全に透明）。
        background: hovered || focused ? 'rgba(15, 23, 42, 0.045)' : 'transparent',
      };

  const lineNumberCell = (
    <div
      className="text-[11px]"
      style={{
        color: 'var(--c-text-3)',
        textAlign: 'right',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        userSelect: 'none',
        lineHeight: '1.55',
      }}
    >
      {lineNumber ?? ''}
    </div>
  );

  const contentCell = (
    <div style={{ minWidth: 0 }}>
      {item.type === 'assignment' ? (
        <AssignmentBlockContent
          assignment={item.assignment}
          systemTypes={systemTypes}
          variant={variant}
          isMobile={isMobile}
          expanded={expanded}
          onExpand={() => setExpanded(true)}
          autoFocus={autoFocus}
          caret={caret}
          focusField={focusField}
          hovered={hovered}
          onConsumeFocus={onConsumeFocus}
          onChangeTaskName={onChangeAssignmentTitle}
          onCreateBelow={onCreateBelow}
          onCreateBefore={onCreateBefore}
          onNavigate={onNavigate}
          onMoveToAssignment={onMoveAssignmentToAssignment}
          onMoveToDone={onMoveAssignmentToDone}
        />
      ) : (
        <TodoBlockContent
          todo={item.todo}
          busy={busy}
          isLast={isLast}
          variant={variant}
          isMobile={isMobile}
          expanded={expanded}
          onExpand={() => setExpanded(true)}
          autoFocus={autoFocus}
          caret={caret}
          hovered={hovered}
          focused={focused}
          onFocusChange={setFocused}
          onConsumeFocus={onConsumeFocus}
          onChangeTitle={onChangeTitle}
          onCreateBelow={onCreateBelow}
          onDeleteBlock={onDeleteBlock}
          onNavigate={onNavigate}
          onEnsureTrailingBlock={onEnsureTrailingBlock}
          internalFocusMoveRef={internalFocusMoveRef}
          onMoveToDone={onMoveTodoToDone}
          startEditRef={startTodoEditRef}
        />
      )}
    </div>
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isListVariant ? attributes : {})}
      {...(isListVariant ? listeners : {})}
      title={isListVariant ? 'ドラッグして並び替え' : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={isMobile && isListVariant ? () => setExpanded(v => !v) : undefined}
    >
      {isListVariant ? (
        <>
          {/* Inner content grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '22px minmax(0, 1fr)', gap: 8 }}>
            {lineNumberCell}
            {contentCell}
          </div>
          {/* Mobile expand menu */}
          {isMobile && expanded && !isDragging && (
            <MobileMenu
              onClick={e => e.stopPropagation()}
              onPointerDown={e => e.stopPropagation()}
            >
              {item.type === 'assignment' && onMoveAssignmentToAssignment && (
                <MobileMenuItem
                  onPointerDown={e => e.stopPropagation()}
                  onClick={() => { onMoveAssignmentToAssignment(); setExpanded(false); }}
                  leading="←"
                >
                  課題へ
                </MobileMenuItem>
              )}
              {item.type === 'assignment' && onMoveAssignmentToDone && (
                <MobileMenuItem
                  onPointerDown={e => e.stopPropagation()}
                  onClick={() => { onMoveAssignmentToDone(); setExpanded(false); }}
                  trailing="→"
                >
                  完了へ
                </MobileMenuItem>
              )}
              {item.type === 'todo' && onMoveTodoToDone && (
                <MobileMenuItem
                  onPointerDown={e => e.stopPropagation()}
                  onClick={() => { onMoveTodoToDone(); setExpanded(false); }}
                  trailing="→"
                >
                  完了へ
                </MobileMenuItem>
              )}
              {item.type === 'todo' && (
                <MobileMenuItem
                  onPointerDown={e => e.stopPropagation()}
                  onClick={() => { startTodoEditRef.current?.(); setExpanded(false); }}
                >
                  編集
                </MobileMenuItem>
              )}
              {item.type === 'todo' && (
                <MobileMenuItem
                  onPointerDown={e => e.stopPropagation()}
                  onClick={() => { onDeleteBlock(item.todo.id, false); setExpanded(false); }}
                  danger
                >
                  削除
                </MobileMenuItem>
              )}
            </MobileMenu>
          )}
        </>
      ) : (
        <>
          {lineNumberCell}
          {contentCell}
        </>
      )}
    </div>
  );
}

// カスタム comparator: item の参照は todo タイトル変更のたびに変わるため ref 比較だと
// 毎回再レンダーになる。実際に表示・挙動に影響するフィールドだけを比較してスキップを判定する。
// コールバック群は useCallback (安定参照) またはstableなsetter を閉じるインライン矢印で
// 動作上の意味は変わらないため比較対象から外す（チェックするとドラッグ中に毎回再レンダーになる）。
// LMS由来フィールド (course_name / availability_end 等) はセッション中に変化しないため省略。
export default memo(TodoBlock, (prev, next) => {
  if (prev.variant !== next.variant) return false;
  if (prev.lineNumber !== next.lineNumber) return false;
  if (prev.isLast !== next.isLast) return false;
  if (prev.busy !== next.busy) return false;
  if (prev.autoFocus !== next.autoFocus) return false;
  if (prev.caret !== next.caret) return false;
  if (prev.focusField !== next.focusField) return false;
  if (prev.isMobile !== next.isMobile) return false;
  if (prev.item === next.item) return true;
  if (prev.item.type !== next.item.type) return false;
  if (prev.item.type === 'todo' && next.item.type === 'todo') {
    return prev.item.todo.id === next.item.todo.id
      && prev.item.todo.title === next.item.todo.title
      && prev.item.todo.is_done === next.item.todo.is_done;
  }
  if (prev.item.type === 'assignment' && next.item.type === 'assignment') {
    return prev.item.assignment.id === next.item.assignment.id
      && prev.item.assignment.task_name === next.item.assignment.task_name
      && prev.item.assignment.board_status === next.item.assignment.board_status;
  }
  return false;
});
