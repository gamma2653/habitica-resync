import { useEffect, useState } from "react";
import { HabiticaTask } from "../../../types";
import { useHabiticaResyncApp, SUBSCRIBER_ID } from "../../ctx";
import { ViewProps } from "../nav";
import { TaskDisplay } from "./taskDisplay";

export const EVENT_ID = 'todoUpdated';

export const TodoView = ({ active }: ViewProps) => {
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

    return (
        <div>
            <h2>Todo View</h2>
            <TaskDisplay habiticaClient={habiticaClient} tasks={tasks} setTasks={setTasks}/>
        </div>
    );
}
