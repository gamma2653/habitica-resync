import type { HabiticaTask } from "../../types";

type TaskDisplayProps = {
    tasks: HabiticaTask[];
    onChange: (taskId: string, completed: boolean) => void;
    onChecklistChange: (task: HabiticaTask, index: number, completed: boolean) => void;
}

export const TaskDisplay = ({ tasks, onChange, onChecklistChange }: TaskDisplayProps) => {
    return (
        <ul>
            {tasks.map(task => (
                <li key={task.id}><span style={{
                    display: 'inline',
                    textDecoration: task.completed ? 'line-through' : 'none',
                }}><input type="checkbox" checked={task.completed} id={task.id} onChange={() => onChange(task.id, !task.completed)} /> <label htmlFor={task.id}>{task.text}</label></span>
                    {
                        task.checklist && task.checklist.length > 0 && <ul>
                            {task?.checklist?.map((chkItem, index) => (
                                <li key={index}>
                                    <span style={{
                                        display: 'inline',
                                        textDecoration: chkItem.completed ? 'line-through' : 'none',
                                    }}>
                                        <input type="checkbox" checked={chkItem.completed} id={`${task.id}-chk-${index}`} onChange={() => onChecklistChange(task, index, !chkItem.completed)} /> <label htmlFor={`${task.id}-chk-${index}`}>{chkItem.text}</label>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    }
                </li>
            ))}
        </ul>
    );
}