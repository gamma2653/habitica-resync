import { useHabiticaResyncApp } from "./ctx";

export const HabiticaResyncApp = () => {
  const { app, habiticaClient } = useHabiticaResyncApp();
  const { vault } = app;

  return (
    <div>
      <h3>Habitica Resync</h3>
      <p>Syncing with Habitica...</p>
    </div>
  );
};
