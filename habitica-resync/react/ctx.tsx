import { createContext, useContext } from 'react';
import { App } from 'obsidian';
import type { Dispatch, SetStateAction } from 'react';

import type { HabiticaTask } from '../types'
import { HabiticaClient } from '../api'
import * as util from '../util'

export const SUBSCRIBER_ID = 'paneSync'

type HabiticaResyncCtx = {
  app: App;
  habiticaClient: HabiticaClient;
}

export const HabiticaResyncAppCtx = createContext<HabiticaResyncCtx | undefined>(undefined);

export const useHabiticaResyncApp = () => {
  const ctx = useContext(HabiticaResyncAppCtx);
  if (!ctx) {
    throw new Error('useHabiticaResyncApp must be used within a HabiticaResyncAppCtx.Provider');
  }
	return ctx;
};


export const onChange = (client: HabiticaClient, tasks: HabiticaTask[], setTasks: Dispatch<SetStateAction<HabiticaTask[]>>) => {
  return (taskId: string, completed: boolean) => {
      tasks.forEach(task => {
          if (task.id === taskId) {
              task.completed = completed;
          }
      });
      util.log(`Calling updateTask for task ${taskId} with completed=${completed}`);
      client.updateTask({ id: taskId, completed: completed }).then((data) => {
          util.log(`Updated task ${taskId} in Habitica`);
          util.log(`Response data: ${JSON.stringify(data)}`);
      }).catch(err => {
          util.error(`Failed to update task ${taskId} in Habitica:`, err);
      });
      setTasks([...tasks]);
      util.log(`Task ${taskId} set to completed: ${completed}`);
  }

}

export const onChecklistChange = (client: HabiticaClient, tasks: HabiticaTask[], setTasks: Dispatch<SetStateAction<HabiticaTask[]>>) => {
    return (task: HabiticaTask, index: number, completed: boolean) => {
        const updatedChecklist = task.checklist!.map((chkItem, chkIndex) => {
            if (chkIndex === index) {
                return { ...chkItem, completed: completed };
            }
            return chkItem;
        });
        client.updateTask({ id: task.id, checklist: updatedChecklist }).then(() => {
            util.log(`Updated checklist item ${index} for task ${task.id} in Habitica`);
        }
        ).catch(err => {
            util.error(`Failed to update checklist item ${index} for task ${task.id} in Habitica:`, err);
        });
        // Update local state
        task.checklist = updatedChecklist;
        setTasks([...tasks]);
        util.log(`Checklist item ${index} for task ${task.id} set to completed: ${completed}`);
    }
}