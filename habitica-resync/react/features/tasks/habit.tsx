import { useEffect, useState } from "react";
import { HabiticaTask } from "../../../types";
import { useHabiticaResyncApp, SUBSCRIBER_ID } from "../../ctx";
import { ViewProps } from "../nav";
import { TaskList } from "./TaskList";

export const EVENT_ID = 'habitUpdated';

export const HabitView = ({ active }: ViewProps) => {
    if (!active) {
        return null;
    }
    const { habiticaClient } = useHabiticaResyncApp();
    const [tasks, setTasks] = useState<HabiticaTask[]>(habiticaClient.allTasks.habit);
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
            setTasks(taskMap.habit);
        } catch (err) {
            console.error('Failed to refresh habits:', err);
        } finally {
            setIsRefreshing(false);
        }
    };

    return (
        <div>
            <h2>Habits</h2>
            <TaskList
                tasks={tasks}
                habiticaClient={habiticaClient}
                onRefresh={handleRefresh}
                isRefreshing={isRefreshing}
                taskType="habit"
            />
        </div>
    );
}
