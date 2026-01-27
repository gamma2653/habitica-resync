import { HabitView, DailyView, TodoView } from "./features/tasks/taskViews";
import { ProfileView } from "./features/profile";
import { NavBar } from "./features/nav";
import * as React from "react";

export const HabiticaResyncApp = () => {
  const [activeTab, setActiveTab] = React.useState<string>('daily');

  return (
    <div>
      <h3>Habitica Resync</h3>
      <NavBar tabs={[['Habits', 'habit'], ['Dailys', 'daily'], ['Todos', 'todo'], ['Profile', 'profile']]} activeTab={activeTab} setActiveTab={setActiveTab} />
      <HabitView active={activeTab === 'habit'} />
      <DailyView active={activeTab === 'daily'} />
      <TodoView active={activeTab === 'todo'} />
      <ProfileView active={activeTab === 'profile'} />
    </div>
  );
};
