import { useHabiticaResyncApp, SUBSCRIBER_ID } from "../ctx";
import { useEffect, useState } from "react";
import { HabiticaTask } from "habitica-resync/types";
import { ViewProps } from "./nav";

export const EVENT_ID = 'dailyUpdated';

export const DailyView = ({active}: ViewProps) => {
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
            <h2>Dailys View</h2>
            <ul>
                {tasks.map(task => (
                    <li key={task.id}><span style={{
                        display: 'inline'
                    }}><input type="checkbox" checked={task.completed} id={task.id} /> <label htmlFor={task.id}>{task.text}</label></span></li>
                ))}
            </ul>
        </div>
    );
}
