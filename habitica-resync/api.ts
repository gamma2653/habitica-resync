import * as types from './types';
import * as util from './util';
import type HabiticaResyncPlugin from '../main';
import { RecursivePartial } from './types';

const HABITICA_SIDE_PLUGIN_ID = 'habitica-x-obsidian-task-integration';
const HABITICA_API_URL = 'https://habitica.com/api';
const DEVELOPER_USER_ID = 'a8e40d27-c872-493f-acf2-9fe75c56ac0c'  // Itssa me, GammaThought!

/**
 * Interfaces with the Habitica API while respecting rate limits.
 */
export class HabiticaClient implements types.HabiticaAPI {
    plugin: HabiticaResyncPlugin | null = null;
    remainingRequests: number = 30;
    nextResetTime: Date | null = null;
    allTasks: types.HabiticaTaskMap = {
        habit: [],
        daily: [],
        todo: [],
        reward: [],
        completedTodo: []
    };
    cachedUser: types.HabiticaUser | null = null; // Cache for user data to minimize API requests
    eventListeners = {
        todoUpdated: util.newSubscriberEntry(),
        dailyUpdated: util.newSubscriberEntry(),
        habitUpdated: util.newSubscriberEntry(),
        taskUpdated: util.newSubscriberEntry(),
        profileUpdated: util.newSubscriberEntry()
    };
    constructor(plugin: HabiticaResyncPlugin) {
        // Initialize with settings
        this.plugin = plugin;

    }

    settings() {
        if (!this.plugin) {
            throw new Error('HabiticaClient is not bound to a plugin instance.');
        }
        return this.plugin.settings;
    }

    /**
     * Subscribe to Habitica API events.
     * @param event The event to subscribe to.
     * @param subscriber_id The subscriber ID to use.
     * @param listener The listener function to call when the event is triggered.
     */
    subscribe<E extends types.HabiticaApiEvent>(event: E, subscriber_id: types.SubscriberID, listener: types.EventListener<E>): void {
        // Subscribe to Habitica API events
        util.log(`Subscribing to event: ${event}, subscriber_id: ${subscriber_id}`);
        this.eventListeners[event][subscriber_id].add(listener);
    }

    /**
     * Unsubscribe from Habitica API events.
     * @param event The event to unsubscribe from.
     * @param subscriber_id The subscriber ID to use.
     * @param listener The listener function to remove.
     */
    unsubscribe<E extends types.HabiticaApiEvent>(event: E, subscriber_id: types.SubscriberID, listener: types.EventListener<E>): void {
        // Unsubscribe from Habitica API events
        this.eventListeners[event][subscriber_id].delete(listener);
    }

    emit(event: types.HabiticaApiEvent, tasks: types.HabiticaTask[]): void {
        // Emit Habitica API events
        types.SUBSCRIBER_IDs.forEach((subscriber_id) => {
            this.eventListeners[event][subscriber_id].forEach((listener) => {
                listener(tasks);
            });
        });
    }

    emitProfile(user: types.HabiticaUser): void {
        // Emit profile update event
        types.SUBSCRIBER_IDs.forEach((subscriber_id) => {
            this.eventListeners['profileUpdated'][subscriber_id].forEach((listener) => {
                listener(user);
            });
        });
    }

    _emitNonHomogeneous(tasks: types.HabiticaTask[]): void {
        new Set(tasks.map(t => t.type)).forEach((updated_type) => {
            const potentialEvent = `${updated_type}Updated`;
            if (potentialEvent in this.eventListeners) {
                this.emit(potentialEvent as types.HabiticaApiEvent, tasks.filter(t => t.type === updated_type));
            }
        });
    }


    /**
     * Perform the callback while unsubscribing from all events, then resubscribe.
     * Useful for performing an operation without triggering event listeners, ie during a bulk sync OR
     * to avoid infinite loops.
     * @param event The event to unsubscribe from.
     * @param subscriber_id The subscriber ID to unsubscribe.
     * @param fn The function to execute while unsubscribed.
     */
    async performWhileUnsubscribed<T, E extends types.HabiticaApiEvent>(event: E, subscriber_id: types.SubscriberID, awaitable: Promise<T>): Promise<T> {
        // util.log(`event: ${event}, subscriber_id: ${subscriber_id} - Performing while unsubscribed.`);
        const listeners = this.eventListeners[event][subscriber_id];
        listeners.forEach((listener) => {
            this.unsubscribe(event, subscriber_id, listener as types.EventListener<E>);
        });
        const result = await awaitable;
        listeners.forEach((listener) => {
            this.subscribe(event, subscriber_id, listener as types.EventListener<E>);
        });
        return result;
    }

    async performWhileAllUnsubscribed<T>(subscriber_id: types.SubscriberID, awaitable: Promise<T>): Promise<T> {
        let result = awaitable;

        // Wrap promise w/ performWhileUnsubscribed for all events
        types.HABITICA_API_EVENTS.forEach((event) => {
            result = this.performWhileUnsubscribed(event, subscriber_id, result);
        });
        return result;
    }

    /**
     * Serves as a local router for building Habitica API URLs.
     * @param endpoint The API endpoint to access.
     * @param version The API version to use.
     * @param queryParams The query parameters to include in the URL.
     * @returns The constructed API URL.
     */
    buildApiUrl(endpoint: string, version: number = 3, queryParams: Record<string, string> = {}): string {
        const url = new URL(`${HABITICA_API_URL}/v${version}/${endpoint}`);
        url.search = new URLSearchParams(queryParams).toString();
        return url.toString();
    }

    _defaultHeaders() {
        return {
            'x-client': `${DEVELOPER_USER_ID}-${HABITICA_SIDE_PLUGIN_ID}`,
            'x-api-user': `${this.settings().userId}`,
            'x-api-key': `${this.settings().apiKey}`
        };
    }
    _defaultJSONHeaders() {
        return {
            ...this._defaultHeaders(),
            'Content-Type': 'application/json'
        };
    }

    /**
     * Awaits the promise when the rate limit allows it.
     * If there are remaining requests, it calls the function immediately.
     * If there are no remaining requests, it waits until the next reset time plus a buffer before calling the function.
     * @param awaitable The function to call when the rate limit allows it. This function should return a promise that resolves to a Response.
     * @returns A promise that resolves to the result of the function.
     * @throws An error if the function call fails.
     */
    async callWhenRateLimitAllows(awaitable: () => Promise<Response>): Promise<types.HabiticaResponse> {
        // If we have remaining requests, call the function immediately
        if (this.remainingRequests > 0) {
            util.log("callWhenRateLimitAllows: Remaining requests available, making request immediately.");
            return awaitable().then(this._handleResponse.bind(this));
        }
        // If we don't have remaining requests, wait until the reset time and resolve then.
        if (this.nextResetTime && this.nextResetTime > new Date()) {
            util.log(`callWhenRateLimitAllows: No remaining requests, waiting until reset time at ${this.nextResetTime.toISOString()} (${this.nextResetTime}).`);
            const waitTime = this.nextResetTime.getTime() - new Date().getTime();
            return new Promise<types.HabiticaResponse>((resolve) => {
                setTimeout(() => {
                    // Recursively call this function after waiting to ensure rate limit is respected
                    this.callWhenRateLimitAllows(awaitable).then(resolve);
                }, waitTime + this.settings().rateLimitBuffer);
            });
        }
        util.log("!!! callWhenRateLimitAllows: No reset time available, making request immediately.");
        // If we don't have a reset time, just call the function
        // (shouldn't happen, except maybe on first call or when messing w/ sys time, resolves instantly)
        return awaitable().then(this._handleResponse.bind(this));
    }

    /**
     * Handles the response from the Habitica API.
     * @param response The response from the API.
     * @returns A promise that resolves to the parsed HabiticaResponse.
     * @throws An error if the response is not ok or if the API indicates failure.
     */
    async _handleResponse(response: Response): Promise<types.HabiticaResponse> {
        // Check response headers for rate limiting info
        this.remainingRequests = parseInt(response.headers.get('x-ratelimit-remaining') || this.remainingRequests?.toString() || '30');
        this.nextResetTime = new Date(response.headers.get('x-ratelimit-reset') || this.nextResetTime?.toISOString() || new Date().toISOString());
        util.log(`Rate Limit - Remaining: ${this.remainingRequests}, Next Reset Time: ${this.nextResetTime}`);
        // Check if response is ok & successful
        if (!response.ok) {
            throw new Error(`HTTP error (${response.status}); status (${response.statusText})`);
        }
        // Sneak peek at the response JSON
        const data = await response.json() as types.HabiticaResponse;
        if (!data.success) {
            throw new Error(`Habitica API error (Was there a Habitica API update?); response: ${JSON.stringify(data)}`);
        }
        return data;
    }

    /**
     * Retrieves tasks from Habitica API based on the provided context.
     * If no context is provided, retrieves all tasks.
     * If the request fails, notifies the user and returns an empty array.
     * NOTE: This method emits events for retrieved tasks.
     * @param ctx The context for retrieving tasks, including type and due date.
     * @returns A promise that resolves to an array of HabiticaTask objects.
     */
    async retrieveTasks(ctx: types.HabiticaTaskRequest = {}): Promise<types.HabiticaTask[]> {
        // Fetch
        // Only include keys for non-null/defined parameters
        const queryParams: Record<string, string> = {
            ...(ctx.type ? { type: ctx.type } : {}),
            ...(ctx.dueDate ? { dueDate: ctx.dueDate.toISOString() } : {})
        };
        const url = this.buildApiUrl('tasks/user', 3, queryParams);
        const headers = this._defaultJSONHeaders();
        util.log(`Fetching tasks from Habitica: ${url}`);

        // First retrieve data, then parse response
        return this.callWhenRateLimitAllows(
            () => fetch(url, { method: 'GET', headers })
        ).then((data: types.HabiticaResponse) => {
            // Presume failure is caught by _handleResponse; cast as appropriate type
            // TODO: Add zod validation here
            const tasks = data.data as types.HabiticaTask[];
            util.addTasksToMap(this.allTasks, tasks);
            this._emitNonHomogeneous(tasks);
            return tasks;
        });
    }

    /**
     * Utility method to retrieve all tasks organized by type.
     * @returns A promise that resolves to a map of tasks organized by type.
     */
    async retrieveTaskMap(): Promise<types.HabiticaTaskMap> {
        // Retrieve all tasks of all types
        return util.organizeHabiticaTasksByType(await this.retrieveTasks());
    }

    async retrieveTask(taskId: string): Promise<types.HabiticaTask | null> {
        // Retrieve a specific task by ID
        const url = this.buildApiUrl(`tasks/${taskId}`, 3);
        const headers = this._defaultJSONHeaders();
        util.log(`Retrieving specific task from Habitica: ${url}`);
        return this.callWhenRateLimitAllows(
            () => fetch(url, { method: 'GET', headers })
        ).then((data: types.HabiticaResponse) => {
            // Presume failure is caught by _handleResponse
            return data.data as types.HabiticaTask;
        });
    }

    async updateTask(task_data: types.RecursePartialExcept<types.HabiticaTask, 'id'>): Promise<types.HabiticaTask | null> {
    	// Update a task in Habitica
        util.log(`Updating task data: ${JSON.stringify(task_data)}`);
    	const url = this.buildApiUrl(`tasks/${task_data.id}`, 3);
    	const headers = this._defaultJSONHeaders();
    	util.log(`Updating task in Habitica: ${url}`);
        // First, score if completed field is present
        if ('completed' in task_data) {
            const scoreUrl = this.buildApiUrl(`tasks/${task_data.id}/score/${task_data.completed ? 'up' : 'down'}`, 3);
            util.log(`Scoring task in Habitica: ${scoreUrl}`);
            const result = await this.callWhenRateLimitAllows(
                () => fetch(scoreUrl, { method: 'POST', headers })
            ).then((response: types.HabiticaResponse) => {
                // Check if response includes updated user stats (hp, mp, exp, gp, lvl)
                if (this.cachedUser && (response.hp !== undefined || response.exp !== undefined)) {
                    // Update cached user with new stats from score response
                    this.cachedUser.stats = {
                        ...this.cachedUser.stats,
                        hp: response.hp ?? this.cachedUser.stats.hp,
                        mp: response.mp ?? this.cachedUser.stats.mp,
                        exp: response.exp ?? this.cachedUser.stats.exp,
                        gp: response.gp ?? this.cachedUser.stats.gp,
                        lvl: response.lvl ?? this.cachedUser.stats.lvl
                    };
                    // Emit profile update with refreshed stats
                    util.log(`Emitting profile update from task scoring (delta: ${response.delta})`);
                    this.emitProfile(this.cachedUser);
                }
                // Presume failure is caught by _handleResponse
                return response.data as types.HabiticaTask;
            });
            console.log(`Scored task ${task_data.id} as completed=${task_data.completed}: ${JSON.stringify(result)}`);
        }
        return this.callWhenRateLimitAllows(
            () => fetch(url, { method: 'PUT', headers, body: JSON.stringify(task_data) })
    	).then((data: types.HabiticaResponse) => {
            // TODO: Parse using zod
    		return data.data as types.HabiticaTask;
    	});
    }

    async createTask(task: RecursivePartial<types.HabiticaTask>): Promise<types.HabiticaTask | null> {
    	// Create a new task in Habitica
    	const url = this.buildApiUrl('tasks/user', 3);
    	const headers = this._defaultJSONHeaders();
    	util.log(`Creating task in Habitica: ${url}`);

    	const new_task = await this.callWhenRateLimitAllows(
            () => fetch(url, { method: 'POST', headers, body: JSON.stringify(task) })
    	).then((data: types.HabiticaResponse) => {
    		// Presume failure is caught by _handleResponse
    		return data.data as types.HabiticaTask;
    	});
        // Create checklist items if present
        if (task.checklist && Array.isArray(task.checklist) && task.checklist.length > 0) {
            for (const checklistItem of task.checklist) {
                const checklistUrl = this.buildApiUrl(`tasks/${new_task.id}/checklist`, 3);
                await this.callWhenRateLimitAllows(
                    () => fetch(checklistUrl, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify(checklistItem)
                    })
                );
            }
        }

        return new_task;
    }

    async updateOrCreateTask(task: types.RecursivePartial<types.HabiticaTask>): Promise<types.HabiticaTask | null> {
        // Check if task with same ID exists
        const existingTask = task.id ? await this.retrieveTask(task.id) : null;
        if (existingTask) {
            // Update existing task w/ merged data
            return this.updateTask({ ...existingTask, ...task });
        } else {
            // Create new task
            return this.createTask(task);
        }
    }

    async syncTasksToHabitica(tasks: RecursivePartial<types.HabiticaTask>[]): Promise<void> {
        // Sync multiple tasks to Habitica
        for (const task of tasks) {
            await this.updateOrCreateTask(task);
        }
    }

    async retrieveUser(): Promise<types.HabiticaUser | null> {
        // Retrieve user data including stats
        const url = this.buildApiUrl('user', 3);
        const headers = this._defaultJSONHeaders();
        util.log(`Retrieving user data from Habitica: ${url}`);
        return this.callWhenRateLimitAllows(
            () => fetch(url, { method: 'GET', headers })
        ).then((data: types.HabiticaResponse) => {
            const user = data.data as types.HabiticaUser;
            this.cachedUser = user; // Cache the user data
            this.emitProfile(user);
            return user;
        });
    }
}