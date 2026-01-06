import { useEffect, useState } from "react";
import { HabiticaTask } from "../../../types";
import { useHabiticaResyncApp, SUBSCRIBER_ID } from "../../ctx";
import { ViewProps } from "../nav";
import { TaskDisplay } from "./taskDisplay";

export const EVENT_ID = 'habitUpdated';

export const HabitView = ({ active }: ViewProps) => {
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

    return (
        <div>
            <h2>Habits View</h2>
            <TaskDisplay habiticaClient={habiticaClient} tasks={tasks} setTasks={setTasks}  />
        </div>
    );
}
