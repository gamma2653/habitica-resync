import { useEffect, useState } from "react";
import { HabiticaTask } from "../../../types";
import { useHabiticaResyncApp, SUBSCRIBER_ID } from "../../ctx";
import { ViewProps } from "../nav";
import { TaskDisplay, onChange, onChecklistChange } from "./taskDisplay";

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



    return (
        <div>
            <h2>Dailies View</h2>
            <TaskDisplay habiticaClient={habiticaClient} tasks={tasks} setTasks={setTasks} />
        </div>
    );
}
