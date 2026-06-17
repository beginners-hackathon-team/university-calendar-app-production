import { Fragment, useRef, type PointerEvent, type ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Assignment } from '../../api/tasks';
import { MIN_SHARE_FRACTION, type AssignmentSortMode, type ColumnKey, type DoneItem, type TodoColumnItem, type TodoViewMode } from '../../lib/tasksBoard';
import AssignmentColumn from './AssignmentColumn';
import TodoColumn from './TodoColumn';
import DoneColumn from './DoneColumn';

type Props = {
  visibleOrder: ColumnKey[];
  dropTargetColumn: ColumnKey | null;
  columnShares: Record<ColumnKey, number>;
  pendingAssignments: Assignment[];
  todoColumnItems: TodoColumnItem[];
  todoViewMode: TodoViewMode;
  doneItems: DoneItem[];
  systemTypes: Record<string, string | null>;
  busyKeys: Set<string>;
  assignmentSortMode: AssignmentSortMode;
  onAssignmentSortModeChange: (mode: AssignmentSortMode) => void;
  onTodoViewModeChange: (mode: TodoViewMode) => void;
  onCreateTodo: (title: string) => void;
  onChangeTodoTitle: (id: string, title: string) => void;
  onChangeAssignmentTitle: (id: string, taskName: string) => void;
  onCreateTodoBelow: (afterId: string | null) => Promise<string | undefined>;
  onCreateTodoBefore: (beforeId: string) => Promise<string | undefined>;
  onDeleteTodo: (id: string) => void;
  onDeleteAssignment: (id: string) => void;
  onResizeColumns: (a: ColumnKey, b: ColumnKey, shareA: number, shareB: number) => void;
  onMoveAssignmentToTodo: (id: string) => void;
  onMoveAssignmentToDone: (id: string) => void;
  onMoveTodoAssignmentToAssignment: (id: string) => void;
  onMoveTodoToDone: (id: string) => void;
  onMoveDoneAssignmentToAssignment: (id: string) => void;
  onMoveDoneAssignmentToTodo: (id: string) => void;
  onMoveDoneTodoToTodo: (id: string) => void;
};

export default function KanbanBoard(props: Props) {
  const { visibleOrder } = props;
  // 列の実測幅（px）を保持し、リサイズ開始時の基準値として使う。
  const columnRefs = useRef<Partial<Record<ColumnKey, HTMLElement | null>>>({});

  if (visibleOrder.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-[13px]"
        style={{ color: 'var(--c-text-3)', border: '1px dashed var(--c-border)', borderRadius: 'var(--r-card)', padding: '48px 16px' }}
      >
        上のボタンから表示するカラムを選んでください
      </div>
    );
  }

  return (
    <SortableContext items={visibleOrder.map(key => `col:${key}`)} strategy={horizontalListSortingStrategy}>
      <div className="flex items-stretch">
        {visibleOrder.map((key, index) => {
          const nextKey = visibleOrder[index + 1];
          return (
            <Fragment key={key}>
              <SortableColumn
                columnKey={key}
                share={props.columnShares[key]}
                registerRef={node => {
                  columnRefs.current[key] = node;
                }}
              >
                {slot => renderColumn(key, props, slot)}
              </SortableColumn>
              {nextKey && (
                <ColumnResizer
                  shareA={props.columnShares[key]}
                  shareB={props.columnShares[nextKey]}
                  measure={() => ({
                    a: columnRefs.current[key]?.getBoundingClientRect().width ?? 0,
                    b: columnRefs.current[nextKey]?.getBoundingClientRect().width ?? 0,
                  })}
                  onChange={(shareA, shareB) => props.onResizeColumns(key, nextKey, shareA, shareB)}
                />
              )}
            </Fragment>
          );
        })}
      </div>
    </SortableContext>
  );
}

type SlotProps = {
  setNodeRef: (node: HTMLElement | null) => void;
  style: React.CSSProperties;
  gripRef: (node: HTMLElement | null) => void;
  gripProps: Record<string, unknown>;
};

function SortableColumn({
  columnKey,
  share,
  registerRef,
  children,
}: {
  columnKey: ColumnKey;
  share: number;
  registerRef: (node: HTMLElement | null) => void;
  children: (slot: SlotProps) => ReactNode;
}) {
  const { setNodeRef, setActivatorNodeRef, transform, transition, attributes, listeners, isDragging } = useSortable({
    id: `col:${columnKey}`,
    data: { type: 'column', column: columnKey },
  });

  const style: React.CSSProperties = {
    flex: `${share} 1 0%`,
    minWidth: 0,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 5 : undefined,
  };

  const combinedRef = (node: HTMLElement | null) => {
    setNodeRef(node);
    registerRef(node);
  };

  return (
    <>
      {children({
        setNodeRef: combinedRef,
        style,
        gripRef: setActivatorNodeRef,
        gripProps: { ...attributes, ...listeners },
      })}
    </>
  );
}

// 列の間のハンドルをドラッグして、隣り合う2列で幅の比率を分け合う（合計の比率は変えないので画面外に出ない）。
function ColumnResizer({
  shareA,
  shareB,
  measure,
  onChange,
}: {
  shareA: number;
  shareB: number;
  measure: () => { a: number; b: number };
  onChange: (shareA: number, shareB: number) => void;
}) {
  const startX = useRef(0);
  const startPxA = useRef(0);
  const startPxB = useRef(0);
  const shareSum = useRef(0);

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    startX.current = e.clientX;
    const { a, b } = measure();
    startPxA.current = a;
    startPxB.current = b;
    shareSum.current = shareA + shareB;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!(e.buttons & 1)) return;
    const totalPx = startPxA.current + startPxB.current;
    if (totalPx <= 0) return;
    const minPx = totalPx * MIN_SHARE_FRACTION;
    const deltaX = e.clientX - startX.current;
    const newPxA = Math.min(Math.max(startPxA.current + deltaX, minPx), totalPx - minPx);
    const fractionA = newPxA / totalPx;
    const sum = shareSum.current;
    onChange(fractionA * sum, (1 - fractionA) * sum);
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      role="separator"
      aria-orientation="vertical"
      aria-label="列幅を調整"
      style={{
        flex: '0 0 auto',
        width: 16,
        cursor: 'col-resize',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        touchAction: 'none',
      }}
    >
      <div style={{ width: 3, height: 38, borderRadius: 3, background: 'var(--c-border)' }} />
    </div>
  );
}

function renderColumn(key: ColumnKey, props: Props, slot: SlotProps): ReactNode {
  const highlighted = props.dropTargetColumn === key;
  if (key === 'assignment') {
    return (
      <AssignmentColumn
        assignments={props.pendingAssignments}
        sortMode={props.assignmentSortMode}
        systemTypes={props.systemTypes}
        setNodeRef={slot.setNodeRef}
        style={slot.style}
        gripRef={slot.gripRef}
        gripProps={slot.gripProps}
        highlighted={highlighted}
        onSortModeChange={props.onAssignmentSortModeChange}
        onChangeTitle={props.onChangeAssignmentTitle}
        onMoveToTodo={props.onMoveAssignmentToTodo}
        onMoveToDone={props.onMoveAssignmentToDone}
      />
    );
  }
  if (key === 'todo') {
    return (
      <TodoColumn
        items={props.todoColumnItems}
        viewMode={props.todoViewMode}
        systemTypes={props.systemTypes}
        busyKeys={props.busyKeys}
        setNodeRef={slot.setNodeRef}
        style={slot.style}
        gripRef={slot.gripRef}
        gripProps={slot.gripProps}
        highlighted={highlighted}
        onViewModeChange={props.onTodoViewModeChange}
        onChangeTitle={props.onChangeTodoTitle}
        onChangeAssignmentTitle={props.onChangeAssignmentTitle}
        onCreateTodo={props.onCreateTodo}
        onCreateTodoBelow={props.onCreateTodoBelow}
        onCreateTodoBefore={props.onCreateTodoBefore}
        onDeleteTodo={props.onDeleteTodo}
        onMoveAssignmentToAssignment={props.onMoveTodoAssignmentToAssignment}
        onMoveAssignmentToDone={props.onMoveAssignmentToDone}
        onMoveTodoToDone={props.onMoveTodoToDone}
      />
    );
  }
  return (
    <DoneColumn
      items={props.doneItems}
      systemTypes={props.systemTypes}
      busyKeys={props.busyKeys}
      setNodeRef={slot.setNodeRef}
      style={slot.style}
      gripRef={slot.gripRef}
      gripProps={slot.gripProps}
      highlighted={highlighted}
      onDeleteTodo={props.onDeleteTodo}
      onDeleteAssignment={props.onDeleteAssignment}
      onMoveAssignmentToAssignment={props.onMoveDoneAssignmentToAssignment}
      onMoveAssignmentToTodo={props.onMoveDoneAssignmentToTodo}
      onMoveTodoToTodo={props.onMoveDoneTodoToTodo}
      onChangeAssignmentTitle={props.onChangeAssignmentTitle}
    />
  );
}
