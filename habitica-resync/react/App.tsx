// import { useHabiticaResyncApp, SUBSCRIBER_ID } from "./ctx";
import { HabitView } from "./features/habit/view";
import { DailyView } from "./features/daily/view";
import { TodoView } from "./features/todo/view";
import { NavBar } from "./features/nav";
import * as React from "react";

import 'styles.css'

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
