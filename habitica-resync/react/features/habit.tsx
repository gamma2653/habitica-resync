import { useHabiticaResyncApp, SUBSCRIBER_ID } from "../ctx";
import { useEffect, useState } from "react";
import { HabiticaTask } from "habitica-resync/types";
import { ViewProps } from "./nav";

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

    return (
        <div>
            <h2>Habits View</h2>
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
