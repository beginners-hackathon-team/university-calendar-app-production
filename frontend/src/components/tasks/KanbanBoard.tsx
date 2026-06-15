import { useRef, type PointerEvent, type ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Assignment, Todo } from '../../api/tasks';
import { type AssignmentSortMode, type ColumnKey, type DoneItem } from '../../lib/tasksBoard';
import AssignmentColumn from './AssignmentColumn';
import TodoColumn from './TodoColumn';
import DoneColumn from './DoneColumn';

type Props = {
  visibleOrder: ColumnKey[];
  dropTargetColumn: ColumnKey | null;
  columnWidths: Record<ColumnKey, number>;
  pendingAssignments: Assignment[];
  mirroredAssignments: Assignment[];
  orderedTodos: Todo[];
  doneItems: DoneItem[];
  systemTypes: Record<string, string | null>;
  busyKeys: Set<string>;
  assignmentSortMode: AssignmentSortMode;
  onAssignmentSortModeChange: (mode: AssignmentSortMode) => void;
  onChangeTodoTitle: (id: string, title: string) => void;
  onCreateTodoBelow: (afterId: string | null) => Promise<string | undefined>;
  onDeleteTodo: (id: string) => void;
  onReturnAssignment: (id: string) => void;
  onDeleteAssignment: (id: string) => void;
  onResizeColumn: (key: ColumnKey, width: number) => void;
};

export default function KanbanBoard(props: Props) {
  const { visibleOrder } = props;

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
      <div className="flex items-stretch" style={{ height: 'calc(100vh - 220px)', minHeight: 440, overflowX: 'auto', paddingBottom: 4 }}>
        {visibleOrder.map(key => (
          <div key={key} className="flex items-stretch" style={{ flex: '0 0 auto' }}>
            <SortableColumn columnKey={key} width={props.columnWidths[key]}>
              {slot => renderColumn(key, props, slot)}
            </SortableColumn>
            <ColumnResizer width={props.columnWidths[key]} onChange={w => props.onResizeColumn(key, w)} />
          </div>
        ))}
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

function SortableColumn({ columnKey, width, children }: { columnKey: ColumnKey; width: number; children: (slot: SlotProps) => ReactNode }) {
  const { setNodeRef, setActivatorNodeRef, transform, transition, attributes, listeners, isDragging } = useSortable({
    id: `col:${columnKey}`,
    data: { type: 'column', column: columnKey },
  });

  const style: React.CSSProperties = {
    flex: '0 0 auto',
    width,
    height: '100%',
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 5 : undefined,
  };

  return (
    <>
      {children({
        setNodeRef,
        style,
        gripRef: setActivatorNodeRef,
        gripProps: { ...attributes, ...listeners },
      })}
    </>
  );
}

// 列の右端をドラッグして幅をウィンドウのように調整する。
function ColumnResizer({ width, onChange }: { width: number; onChange: (width: number) => void }) {
  const startX = useRef(0);
  const startW = useRef(0);

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    startX.current = e.clientX;
    startW.current = width;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!(e.buttons & 1)) return;
    onChange(startW.current + (e.clientX - startX.current));
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
        height: '100%',
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
      />
    );
  }
  if (key === 'todo') {
    return (
      <TodoColumn
        todos={props.orderedTodos}
        mirroredAssignments={props.mirroredAssignments}
        systemTypes={props.systemTypes}
        busyKeys={props.busyKeys}
        setNodeRef={slot.setNodeRef}
        style={slot.style}
        gripRef={slot.gripRef}
        gripProps={slot.gripProps}
        highlighted={highlighted}
        onChangeTitle={props.onChangeTodoTitle}
        onCreateBelow={props.onCreateTodoBelow}
        onDeleteTodo={props.onDeleteTodo}
        onReturnAssignment={props.onReturnAssignment}
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
    />
  );
}
