import type { Dispatch, SetStateAction } from "react";
import type { HabiticaTask, HabiticaAPI } from "../../../types";
import * as util from '../../../util'

type TaskDisplayProps = {
    habiticaClient: HabiticaAPI
    tasks: HabiticaTask[];
    setTasks: Dispatch<SetStateAction<HabiticaTask[]>>
    
}

export const TaskDisplay = ({ habiticaClient, tasks, setTasks }: TaskDisplayProps) => {
    const _onChange = onChange(habiticaClient, tasks, setTasks)
    const _onChecklistChange = onChecklistChange(habiticaClient, tasks, setTasks)
    return (
        <ul>
            {tasks.map(task => (
                <li key={task.id}><span style={{
                    display: 'inline',
                    textDecoration: task.completed ? 'line-through' : 'none',
                }}><input type="checkbox" checked={task.completed} id={task.id} onChange={() => _onChange(task.id, !task.completed)} /> <label htmlFor={task.id}>{task.text}</label></span>
                    {
                        task.checklist && task.checklist.length > 0 && <ul>
                            {task?.checklist?.map((chkItem, index) => (
                                <li key={index}>
                                    <span style={{
                                        display: 'inline',
                                        textDecoration: chkItem.completed ? 'line-through' : 'none',
                                    }}>
                                        <input type="checkbox" checked={chkItem.completed} id={`${task.id}-chk-${index}`} onChange={() => _onChecklistChange(task, index, !chkItem.completed)} /> <label htmlFor={`${task.id}-chk-${index}`}>{chkItem.text}</label>
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


export const onChange = (client: HabiticaAPI, tasks: HabiticaTask[], setTasks: Dispatch<SetStateAction<HabiticaTask[]>>) => {
  return (taskId: string, completed: boolean) => {
      tasks.forEach(task => {
          if (task.id === taskId) {
              task.completed = completed;
          }
      });
      util.log(`Calling updateTask for task ${taskId} with completed=${completed}`);
      client.updateTask({ id: taskId, completed: completed }).then((data) => {
          util.log(`Updated task ${taskId} in Habitica`);
          util.log(`Response data: ${JSON.stringify(data)}`);
      }).catch(err => {
          util.error(`Failed to update task ${taskId} in Habitica:`, err);
      });
      setTasks([...tasks]);
      util.log(`Task ${taskId} set to completed: ${completed}`);
  }

}

export const onChecklistChange = (client: HabiticaAPI, tasks: HabiticaTask[], setTasks: Dispatch<SetStateAction<HabiticaTask[]>>) => {
    return (task: HabiticaTask, index: number, completed: boolean) => {
        const updatedChecklist = task.checklist!.map((chkItem, chkIndex) => {
            if (chkIndex === index) {
                return { ...chkItem, completed: completed };
            }
            return chkItem;
        });
        client.updateTask({ id: task.id, checklist: updatedChecklist }).then(() => {
            util.log(`Updated checklist item ${index} for task ${task.id} in Habitica`);
        }
        ).catch(err => {
            util.error(`Failed to update checklist item ${index} for task ${task.id} in Habitica:`, err);
        });
        // Update local state
        task.checklist = updatedChecklist;
        setTasks([...tasks]);
        util.log(`Checklist item ${index} for task ${task.id} set to completed: ${completed}`);
    }
}