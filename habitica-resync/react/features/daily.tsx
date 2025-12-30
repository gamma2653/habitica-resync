import { useHabiticaResyncApp, SUBSCRIBER_ID } from "../ctx";
import { useEffect, useState } from "react";
import { HabiticaTask } from "../../types";
import * as util from '../../util';
import { ViewProps } from "./nav";
import { TaskDisplay } from "./taskDisplay";

export const EVENT_ID = 'dailyUpdated';


export const DailyView = ({ active }: ViewProps) => {
    if (!active) {
        return null;
    }
    const { app, habiticaClient } = useHabiticaResyncApp();
    const { vault } = app;
    const [tasks, setTasks] = useState<HabiticaTask[]>(habiticaClient.allTasks.daily);

    useEffect(() => {
        habiticaClient.subscribe(EVENT_ID, SUBSCRIBER_ID, setTasks);
        return () => {
            habiticaClient.unsubscribe(EVENT_ID, SUBSCRIBER_ID, setTasks);
        }
    }, []);  // empty dependency for only subscribing once

    const onChange = (taskId: string, completed: boolean) => {
        tasks.forEach(task => {
            if (task.id === taskId) {
                task.completed = completed;
            }
        });
        util.log(`Calling updateTask for task ${taskId} with completed=${completed}`);
        habiticaClient.updateTask({ id: taskId, completed: completed }).then((data) => {
            util.log(`Updated task ${taskId} in Habitica`);
            util.log(`Response data: ${JSON.stringify(data)}`);
        }).catch(err => {
            util.error(`Failed to update task ${taskId} in Habitica:`, err);
        });
        setTasks([...tasks]);
        util.log(`Task ${taskId} set to completed: ${completed}`);
    }
    const onChecklistChange = (task: HabiticaTask, index: number, completed: boolean) => {
        const updatedChecklist = task.checklist!.map((chkItem, chkIndex) => {
            if (chkIndex === index) {
                return { ...chkItem, completed: completed };
            }
            return chkItem;
        });
        habiticaClient.updateTask({ id: task.id, checklist: updatedChecklist }).then(() => {
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

    return (
        <div>
            <h2>Dailies View</h2>
            <TaskDisplay tasks={tasks} onChange={onChange} onChecklistChange={onChecklistChange} />
        </div>
    );
}
