import { useHabiticaResyncApp, SUBSCRIBER_ID } from "../ctx";
import { useEffect, useState } from "react";
import { HabiticaTask } from "../../types";
import * as util from "../../util";
import { ViewProps } from "./nav";
import { TaskDisplay } from "./taskDisplay";

export const EVENT_ID = 'todoUpdated';

export const TodoView = ({active}: ViewProps) => {
    if (!active) {
        return null;
    }
    const { app, habiticaClient } = useHabiticaResyncApp();
    const { vault } = app;
    const [tasks, setTasks] = useState<HabiticaTask[]>(habiticaClient.allTasks.todo);
    
    useEffect(() => {
        habiticaClient.subscribe(EVENT_ID, SUBSCRIBER_ID, setTasks);
        return () => {
            habiticaClient.unsubscribe(EVENT_ID, SUBSCRIBER_ID, setTasks);
        }
    }, []);  // Because I'm cool like that

    const onChange = (taskId: string, completed: boolean) => {
        // habiticaClient.updateTask(taskId, { completed: completed });
        tasks.forEach(task => {
            if (task.id === taskId) {
                task.completed = completed;
            }
        });
        habiticaClient.updateTask({ id: taskId, completed: completed }).then(() => {
            util.log(`Updated task ${taskId} in Habitica`);
        }).catch(err => {
            util.error(`Failed to update task ${taskId} in Habitica:`, err);
        });
        setTasks([...tasks]);
        util.log(`Task ${taskId} set to completed: ${completed}`);
    }

    return (
        <div>
            <h2>Todo View</h2>
            <TaskDisplay tasks={tasks} onChange={onChange} onChecklistChange={() => {}} />
        </div>
    );
}
