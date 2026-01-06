import { HabiticaTask, HabiticaAPI } from "../../../types";
import { Dispatch, SetStateAction } from "react";
import * as util from '../../../util';

type TaskCardProps = {
    task: HabiticaTask;
    habiticaClient: HabiticaAPI;
    onUpdate: () => void;
    isHabit?: boolean;
}

const PRIORITY_LABELS: Record<number, { label: string; emoji: string; class: string }> = {
    0.1: { label: 'Trivial', emoji: '⏬', class: 'priority-trivial' },
    1: { label: 'Easy', emoji: '🔽', class: 'priority-easy' },
    1.5: { label: 'Medium', emoji: '🔼', class: 'priority-medium' },
    2: { label: 'Hard', emoji: '⏫', class: 'priority-hard' },
};

export const TaskCard = ({ task, habiticaClient, onUpdate, isHabit = false }: TaskCardProps) => {
    const priorityInfo = PRIORITY_LABELS[task.priority] || PRIORITY_LABELS[1];

    const handleCheckboxChange = async () => {
        const newCompleted = !task.completed;
        task.completed = newCompleted;
        onUpdate();

        try {
            await habiticaClient.updateTask({ id: task.id, completed: newCompleted });
            util.log(`Updated task ${task.id} in Habitica`);
        } catch (err) {
            util.error(`Failed to update task ${task.id} in Habitica:`, err);
            task.completed = !newCompleted;
            onUpdate();
        }
    };

    const handleHabitScore = async (direction: 'up' | 'down') => {
        try {
            await habiticaClient.updateTask({ id: task.id, completed: direction === 'up' });
            util.log(`Scored habit ${task.id} ${direction}`);
            // Optionally refetch to get updated stats
        } catch (err) {
            util.error(`Failed to score habit ${task.id}:`, err);
        }
    };

    const handleChecklistChange = async (index: number) => {
        if (!task.checklist) return;

        const updatedChecklist = task.checklist.map((item, i) =>
            i === index ? { ...item, completed: !item.completed } : item
        );

        task.checklist = updatedChecklist;
        onUpdate();

        try {
            await habiticaClient.updateTask({ id: task.id, checklist: updatedChecklist });
            util.log(`Updated checklist for task ${task.id}`);
        } catch (err) {
            util.error(`Failed to update checklist for task ${task.id}:`, err);
        }
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return { text: `${Math.abs(diffDays)}d overdue`, class: 'overdue' };
        if (diffDays === 0) return { text: 'Due today', class: 'due-today' };
        if (diffDays === 1) return { text: 'Due tomorrow', class: 'due-soon' };
        if (diffDays <= 7) return { text: `Due in ${diffDays}d`, class: 'due-soon' };
        return { text: date.toLocaleDateString(), class: 'due-later' };
    };

    const dueDate = formatDate(task.date as string);
    const checklistProgress = task.checklist
        ? `${task.checklist.filter(c => c.completed).length}/${task.checklist.length}`
        : null;

    return (
        <div className={`task-card ${task.completed ? 'completed' : ''} ${priorityInfo.class}`}>
            <div className="task-card-header">
                <div className="task-card-main">
                    {isHabit ? (
                        <div className="habit-controls">
                            {task.up && (
                                <button
                                    className="habit-btn habit-btn-up"
                                    onClick={() => handleHabitScore('up')}
                                    title="Score positive"
                                >
                                    +
                                </button>
                            )}
                            {task.down && (
                                <button
                                    className="habit-btn habit-btn-down"
                                    onClick={() => handleHabitScore('down')}
                                    title="Score negative"
                                >
                                    −
                                </button>
                            )}
                        </div>
                    ) : (
                        <input
                            type="checkbox"
                            className="task-checkbox"
                            checked={task.completed || false}
                            onChange={handleCheckboxChange}
                        />
                    )}

                    <div className="task-content">
                        <div className="task-title-row">
                            <span className="task-text">{task.text}</span>
                            <div className="task-badges">
                                <span className="priority-badge" title={priorityInfo.label}>
                                    {priorityInfo.emoji}
                                </span>
                                {dueDate && (
                                    <span className={`due-badge ${dueDate.class}`}>
                                        📅 {dueDate.text}
                                    </span>
                                )}
                                {task.isDue !== undefined && task.type === 'daily' && (
                                    <span className={`daily-status ${task.isDue ? 'is-due' : 'not-due'}`}>
                                        {task.isDue ? '🔴 Due' : '🟢 Done'}
                                    </span>
                                )}
                                {checklistProgress && (
                                    <span className="checklist-progress">
                                        ✓ {checklistProgress}
                                    </span>
                                )}
                            </div>
                        </div>

                        {task.notes && (
                            <div className="task-notes">
                                {task.notes}
                            </div>
                        )}

                        {task.checklist && task.checklist.length > 0 && (
                            <ul className="task-checklist">
                                {task.checklist.map((item, index) => (
                                    <li key={item.id} className={item.completed ? 'completed' : ''}>
                                        <input
                                            type="checkbox"
                                            checked={item.completed}
                                            onChange={() => handleChecklistChange(index)}
                                            id={`${task.id}-check-${index}`}
                                        />
                                        <label htmlFor={`${task.id}-check-${index}`}>
                                            {item.text}
                                        </label>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
