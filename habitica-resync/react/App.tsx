// import { useHabiticaResyncApp, SUBSCRIBER_ID } from "./ctx";
import { HabitView } from "./features/tasks/habit";
import { DailyView } from "./features/tasks/daily";
import { TodoView } from "./features/tasks/todo";
import { NavBar } from "./features/nav";
import * as React from "react";

// import 'styles.css'

export const HabiticaResyncApp = () => {
  // const { app, habiticaClient } = useHabiticaResyncApp();
  // const { vault } = app;
  const [activeTab, setActiveTab] = React.useState<string>('daily');

  return (
    <div>
      <h3>Habitica Resync</h3>
      <NavBar tabs={[['Habits', 'habit'], ['Dailys', 'daily'], ['Todos', 'todo']]} activeTabCallback={setActiveTab} />
      <HabitView active={activeTab === 'habit'} />
      <DailyView active={activeTab === 'daily'} />
      <TodoView active={activeTab === 'todo'} />
    </div>
  );
};
