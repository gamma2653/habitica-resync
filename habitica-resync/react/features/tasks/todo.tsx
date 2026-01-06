import { useEffect, useState } from "react";
import { HabiticaTask } from "../../../types";
import { useHabiticaResyncApp, SUBSCRIBER_ID } from "../../ctx";
import { ViewProps } from "../nav";
import { TaskList } from "./TaskList";

export const EVENT_ID = 'todoUpdated';

export const TodoView = ({ active }: ViewProps) => {
    if (!active) {
        return null;
    }
    const { habiticaClient } = useHabiticaResyncApp();
    const [tasks, setTasks] = useState<HabiticaTask[]>(habiticaClient.allTasks.todo);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        habiticaClient.subscribe(EVENT_ID, SUBSCRIBER_ID, setTasks);
        return () => {
            habiticaClient.unsubscribe(EVENT_ID, SUBSCRIBER_ID, setTasks);
        }
    }, []);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            const taskMap = await habiticaClient.retrieveTaskMap();
            setTasks(taskMap.todo);
        } catch (err) {
            console.error('Failed to refresh todos:', err);
        } finally {
            setIsRefreshing(false);
        }
    };

    return (
        <div>
            <h2>Todos</h2>
            <TaskList
                tasks={tasks}
                habiticaClient={habiticaClient}
                onRefresh={handleRefresh}
                isRefreshing={isRefreshing}
                taskType="todo"
            />
        </div>
    );
}
