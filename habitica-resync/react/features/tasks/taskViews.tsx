import { useEffect, useState } from "react";
import { HabiticaTask, HabiticaApiEvent } from "../../../types";
import { useHabiticaResyncApp, SUBSCRIBER_ID } from "../../ctx";
import { ViewProps } from "../nav";
import { TaskList } from "./TaskList";

type ActiveTaskType = 'habit' | 'daily' | 'todo';

type TaskViewConfig = {
    eventId: HabiticaApiEvent;
    taskKey: ActiveTaskType;
    title: string;
};

const createTaskView = ({ eventId, taskKey, title }: TaskViewConfig) => {
    return ({ active }: ViewProps) => {
        if (!active) {
            return null;
        }
        const { habiticaClient } = useHabiticaResyncApp();
        const [tasks, setTasks] = useState<HabiticaTask[]>(habiticaClient.allTasks[taskKey]);
        const [isRefreshing, setIsRefreshing] = useState(false);

        useEffect(() => {
            habiticaClient.subscribe(eventId, SUBSCRIBER_ID, setTasks);
            return () => {
                habiticaClient.unsubscribe(eventId, SUBSCRIBER_ID, setTasks);
            }
        }, []);

        const handleRefresh = async () => {
            setIsRefreshing(true);
            try {
                const taskMap = await habiticaClient.retrieveTaskMap();
                setTasks(taskMap[taskKey]);
            } catch (err) {
                console.error(`Failed to refresh ${title.toLowerCase()}:`, err);
            } finally {
                setIsRefreshing(false);
            }
        };

        return (
            <div>
                <h2>{title}</h2>
                <TaskList
                    tasks={tasks}
                    habiticaClient={habiticaClient}
                    onRefresh={handleRefresh}
                    isRefreshing={isRefreshing}
                    taskType={taskKey}
                />
            </div>
        );
    };
};

export const DailyView = createTaskView({ eventId: 'dailyUpdated', taskKey: 'daily', title: 'Dailies' });
export const HabitView = createTaskView({ eventId: 'habitUpdated', taskKey: 'habit', title: 'Habits' });
export const TodoView = createTaskView({ eventId: 'todoUpdated', taskKey: 'todo', title: 'Todos' });
