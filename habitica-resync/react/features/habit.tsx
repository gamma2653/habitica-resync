import { useHabiticaResyncApp, SUBSCRIBER_ID } from "../ctx";
import { useEffect, useState } from "react";
import { HabiticaTask } from "../../types";
import * as util from "../../util";
import { ViewProps } from "./nav";
import { TaskDisplay } from "./taskDisplay";

export const EVENT_ID = 'habitUpdated';

export const HabitView = ({active}: ViewProps) => {
    if (!active) {
        return null;
    }
    const { app, habiticaClient } = useHabiticaResyncApp();
    const { vault } = app;
    const [tasks, setTasks] = useState<HabiticaTask[]>(habiticaClient.allTasks.habit);
    
    useEffect(() => {
        habiticaClient.subscribe(EVENT_ID, SUBSCRIBER_ID, setTasks);
        return () => {
            habiticaClient.unsubscribe(EVENT_ID, SUBSCRIBER_ID, setTasks);
        }
    }, []);

    const onChange = (taskId: string, completed: boolean) => {
        tasks.forEach(task => {
            if (task.id === taskId) {
                task.completed = completed;
            }
        });
        util.log(`Calling updateTask for task ${taskId} with completed=${completed}`);
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
            <h2>Habits View</h2>
            <TaskDisplay tasks={tasks} onChange={onChange} onChecklistChange={() => {}} />
        </div>
    );
}
