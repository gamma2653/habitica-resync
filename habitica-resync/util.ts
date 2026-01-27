import type { HabiticaTask, HabiticaTaskMap, HabiticaTasksSettings, HabiticaUser, RecursivePartial, TaskType } from './types';
import { version as VERSION } from '../manifest.json';

const logWithLevel = (level: 'log' | 'warn' | 'error') =>
    (message: string, ...optionalParams: any[]) =>
        console[level](`[Habitica Resync v${VERSION}] ${message}`, ...optionalParams);

export const log = logWithLevel('log');
export const warn = logWithLevel('warn');
export const error = logWithLevel('error');

export const capitalize = (s: string): string => {
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
}

export const organizeHabiticaTasksByType = (tasks: HabiticaTask[]): HabiticaTaskMap => {
    const taskMap: HabiticaTaskMap = {
        habit: [],
        daily: [],
        todo: [],
        reward: [],
        completedTodo: []
    };
    for (const task of tasks) {
        if (task.type in taskMap) {
            taskMap[task.type].push(task);
        } else {
            warn(`Unknown task type encountered: ${task.type}`);
        }
    }
    return taskMap;
}

export const addTasksToMap = (taskMap: HabiticaTaskMap, tasksToAdd: HabiticaTask[]) => {
    for (const task of tasksToAdd) {
        if (task.type in taskMap) {
            // Check for duplicates before adding
            const existingTaskIndex = taskMap[task.type].findIndex(t => t.id === task.id);
            if (existingTaskIndex === -1) {
                taskMap[task.type].push(task);
            } else {
                // warn(`Duplicate task detected (ID: ${task.id}). Updating existing task.`);
                // Update existing task
                taskMap[task.type][existingTaskIndex] = task;
            }
        } else {
            warn(`Unknown task type encountered: ${task.type}`);
        }
    }
};

export const checklistLinesForTask = (task: HabiticaTask, settings: HabiticaTasksSettings): string[] => {
    // If checklist is invalid, return empty array
    if (!task.checklist || !Array.isArray(task.checklist) || task.checklist.length === 0) {
        return [];
    }
    // Coalesce checklist items into markdown lines
    const checklistLines: string[] = [];
    for (const item of task.checklist) {
        const completed = item.completed ? '- [x]' : '- [ ]';
        checklistLines.push(`${settings.indentString}${completed} ${item.text}`);
    }
    return checklistLines;
}

const isDue = (task: HabiticaTask): boolean => {
    if (task.type === 'daily') {
        return task.isDue || false;
    }
    if (task.type === 'todo' && task.date) {
        // Check nextDue
        if (task.nextDue) {
            const today = new Date().toISOString().split('T')[0];
            const nextDueDate = new Date(task.nextDue[0]).toISOString().split('T')[0];
            return nextDueDate <= today;
        }
        const today = new Date().toISOString().split('T')[0];
        const taskDate = new Date(task.date).toISOString().split('T')[0];
        return taskDate <= today;
    }
    return false;
};

const taskDueDate = (task: HabiticaTask): string => {
    if (task.type === 'daily') {
        return `📅 ${new Date().toISOString().split('T')[0]}`;
    } else if (task.type === 'todo' && task.date) {
        return `📅 ${new Date(task.date).toISOString().split('T')[0]}`;
    }
    // Check nextDue
    if (task.nextDue && task.nextDue.length > 0) {
        // TODO: Inefficient, optimize later if needed (lots of Date objects created, make them once on parsing response.)
        const earliestDue = task.nextDue.reduce((earliest, current) => {
            return (new Date(current) < new Date(earliest)) ? current : earliest;
        }, task.nextDue[0]);
        return `📅 ${new Date(earliestDue).toISOString().split('T')[0]}`;
    }
    return '';
};

const TASK_PRIORITIES = [
    "⏬",
    "🔽",
    "🔼",
    "⏫"
] as const;
type TaskPriorityEmoji = typeof TASK_PRIORITIES[number];

const priorityToEmoji = (priority: number): string => {
    const intPriority = Math.round(Math.max(0, Math.min(3, priority)));
    return TASK_PRIORITIES[intPriority] || '';
};

export const newSubscriberEntry = () => ({
    paneSync: new Set<(...args: any[]) => void>(),
    noteSync: new Set<(...args: any[]) => void>()
});

export const emojiPartForTask = (task: HabiticaTask, settings: HabiticaTasksSettings): string => {
    // First pick emoji based on task type
    const duePart = taskDueDate(task);
    const priorityPart = priorityToEmoji(task.priority);

    return `${priorityPart} ${duePart}`.trim();
}

/**
 * Generates the primary markdown line for a Habitica task.
 * This line includes the completion checkbox, an emoji representing the task type, and the task text.
 * @param task The Habitica task to convert to a markdown line.
 * @param settings Settings for formatting the task line.
 * @returns The primary markdown line for the task.
 */
export const primaryLineForTask = (task: HabiticaTask, settings: HabiticaTasksSettings): string => {
    const completed = task.completed ? '- [x]' : '- [ ]';
    const emojiPart = emojiPartForTask(task, settings);
    const tagPart = settings.globalTaskTag ? `${settings.globalTaskTag}` : '';
    return `${completed} ${tagPart} ${task.text} ${emojiPart}`;
}

/**
 * Converts a Habitica task to a markdown note.
 * @param task The Habitica task to convert.
 * @param settings Settings for formatting the task note.
 * @returns The markdown-formatted string for the task.
 */
export const taskToNoteLines = (task: HabiticaTask, settings: HabiticaTasksSettings): string => {
    return [primaryLineForTask(task, settings), ...checklistLinesForTask(task, settings)].join('\n');
}


export const parseContentToTasks = (content: string, task_type: TaskType): RecursivePartial<HabiticaTask>[] => {
    const lines = content.split('\n');
    const tasks: RecursivePartial<HabiticaTask>[] = [];
    let currentTask: RecursivePartial<HabiticaTask> | null = null;
    // Iterate lines, keeping track of current task and its checklist items
    for (const line of lines) {
        const taskMatch = line.match(/^- \[( |x)\] (.*)$/);
        if (taskMatch) {
            // Save previous task if exists
            if (currentTask) {
                tasks.push(currentTask);
            }
            // Start new task
            const completed = taskMatch[1] === 'x';
            const text = taskMatch[2].trim();
            currentTask = {
                // id: '',  // TODO: ID will need to be set later
                type: task_type,  // Default type, may need to be adjusted
                text: text,
                completed: completed,
            };
        } else {
            const checklistMatch = line.match(/^\s*- \[( |x)\] (.*)$/);
            if (checklistMatch && currentTask) {
                // Add checklist item to current task
                const completed = checklistMatch[1] === 'x';
                const text = checklistMatch[2].trim();
                if (!currentTask.checklist) {
                    currentTask.checklist = [];
                }
                currentTask.checklist.push({
                    text: text,
                    completed: completed,
                    // id: ''  // TODO: ID will need to be set later
                });
            }
        }
    }
    // Push the last task if exists
    if (currentTask) {
        tasks.push(currentTask);
    }
    return tasks;
}

/**
 * Converts a Habitica user profile to markdown format.
 * @param user The Habitica user data.
 * @param settings Settings for formatting (currently unused, but kept for consistency).
 * @returns The markdown-formatted string for the user profile.
 */
export const profileToNoteLines = (user: HabiticaUser, settings: HabiticaTasksSettings): string => {
    const lines: string[] = [];
    const stats = user.stats;

    // Header with name and level
    lines.push(`# Profile: ${user.profile.name}`);
    lines.push('');
    lines.push(`**Level:** ${stats.lvl}`);
    if (stats.class) {
        lines.push(`**Class:** ${stats.class}`);
    }
    lines.push('');

    // Stats section
    lines.push('## Stats');
    lines.push('');
    lines.push(`- **Health:** ${Math.floor(stats.hp)}/${stats.maxHealth}`);
    lines.push(`- **Mana:** ${Math.floor(stats.mp)}/${stats.maxMP}`);
    lines.push(`- **Experience:** ${Math.floor(stats.exp)}/${stats.toNextLevel}`);
    lines.push(`- **Gold:** ${stats.gp.toFixed(2)}`);
    lines.push('');

    // Attributes section
    lines.push('## Attributes');
    lines.push('');

    const str = stats.str || 0;
    const con = stats.con || 0;
    const int = stats.int || 0;
    const per = stats.per || 0;

    const strBuff = stats.buffs?.str || 0;
    const conBuff = stats.buffs?.con || 0;
    const intBuff = stats.buffs?.int || 0;
    const perBuff = stats.buffs?.per || 0;

    lines.push(`- **Strength:** ${str}${strBuff > 0 ? ` (+${strBuff} from buffs)` : ''} = ${str + strBuff}`);
    lines.push(`- **Constitution:** ${con}${conBuff > 0 ? ` (+${conBuff} from buffs)` : ''} = ${con + conBuff}`);
    lines.push(`- **Intelligence:** ${int}${intBuff > 0 ? ` (+${intBuff} from buffs)` : ''} = ${int + intBuff}`);
    lines.push(`- **Perception:** ${per}${perBuff > 0 ? ` (+${perBuff} from buffs)` : ''} = ${per + perBuff}`);

    if (stats.points && stats.points > 0) {
        lines.push('');
        lines.push(`**Unallocated Points:** ${stats.points}`);
    }

    return lines.join('\n');
}