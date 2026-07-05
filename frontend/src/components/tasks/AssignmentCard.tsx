import { useDraggable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Assignment } from '../../api/tasks';
import { AssignmentListItem } from './AssignmentListItem';

type CardProps = {
  assignment: Assignment;
  systemTypes: Record<string, string | null>;
  isMobile?: boolean;
  onChangeTitle: (id: string, taskName: string) => void;
  onMoveToTodo: (id: string) => void;
  onMoveToDone: (id: string) => void;
};

export function SortableAssignmentCard({
  assignment,
  systemTypes,
  isMobile,
  onChangeTitle,
  onMoveToTodo,
  onMoveToDone,
}: CardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `assignment:${assignment.id}`,
    data: { type: 'assignment', column: 'assignment', id: assignment.id },
  });

  return (
    <AssignmentListItem
      assignment={assignment}
      systemTypes={systemTypes}
      isMobile={isMobile}
      setNodeRef={setNodeRef}
      attributes={attributes}
      listeners={listeners}
      isDragging={isDragging}
      transform={CSS.Transform.toString(transform)}
      transition={transition}
      onChangeTitle={title => onChangeTitle(assignment.id, title)}
      onMoveToTodo={() => onMoveToTodo(assignment.id)}
      onMoveToDone={() => onMoveToDone(assignment.id)}
    />
  );
}

export function DraggableAssignmentCard({
  assignment,
  systemTypes,
  isMobile,
  onChangeTitle,
  onMoveToTodo,
  onMoveToDone,
}: CardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `assignment:${assignment.id}`,
    data: { type: 'assignment', column: 'assignment', id: assignment.id },
  });

  return (
    <AssignmentListItem
      assignment={assignment}
      systemTypes={systemTypes}
      isMobile={isMobile}
      setNodeRef={setNodeRef}
      attributes={attributes}
      listeners={listeners}
      isDragging={isDragging}
      onChangeTitle={title => onChangeTitle(assignment.id, title)}
      onMoveToTodo={() => onMoveToTodo(assignment.id)}
      onMoveToDone={() => onMoveToDone(assignment.id)}
    />
  );
}
