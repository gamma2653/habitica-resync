import type { HabiticaAPI, HabiticaResponse, HabiticaTask, HabiticaTaskRequest, HabiticaTaskMap } from './types';
import { organizeHabiticaTasksByType, log } from './util';
import type HabiticaResyncPlugin from '../main';

const HABITICA_SIDE_PLUGIN_ID = 'habitica-x-obsidian-task-integration';
const HABITICA_API_URL = 'https://habitica.com/api';
const DEVELOPER_USER_ID = 'a8e40d27-c872-493f-acf2-9fe75c56ac0c'  // Itssa me, GammaThought!

/**
 * Interfaces with the Habitica API while respecting rate limits.
 */
export class HabiticaClient implements HabiticaAPI {
    plugin: HabiticaResyncPlugin | null = null;
    remainingRequests: number = 30;
    nextResetTime: Date | null = null;
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
     * Serves as a local router for building Habitica API URLs.
     * @param endpoint The API endpoint to access.
     * @param version The API version to use.
     * @param queryParams The query parameters to include in the URL.
     * @returns The constructed API URL.
     */
    buildApiUrl(endpoint: string, version: number = 3, queryParams: Record<string, string> = {}): string {
        const queryString = new URLSearchParams(queryParams).toString();
        return `${HABITICA_API_URL}/v${version}/${endpoint}?${queryString}`;
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
     * Calls the provided function when the rate limit allows it.
     * If there are remaining requests, it calls the function immediately.
     * If there are no remaining requests, it waits until the next reset time plus a buffer before calling the function.
     * @param fn The function to call when the rate limit allows it. This function should return a promise that resolves to a Response.
     * @returns A promise that resolves to the result of the function.
     * @throws An error if the function call fails.
     */
    async callWhenRateLimitAllows(fn: () => Promise<Response>): Promise<HabiticaResponse> {
        // If we have remaining requests, call the function immediately
        if (this.remainingRequests > 0) {
            log("callWhenRateLimitAllows: Remaining requests available, calling function immediately.");
            return fn().then(this._handleResponse.bind(this));
        }
        // If we don't have remaining requests, wait until the reset time and resolve then.
        if (this.nextResetTime && this.nextResetTime > new Date()) {
            log(`callWhenRateLimitAllows: No remaining requests, waiting until reset time at ${this.nextResetTime.toISOString()} (${this.nextResetTime}).`);
            const waitTime = this.nextResetTime.getTime() - new Date().getTime();
            return new Promise<HabiticaResponse>((resolve) => {
                setTimeout(() => {
                    // Recursively call this function after waiting to ensure rate limit is respected
                    this.callWhenRateLimitAllows(fn).then(resolve);
                }, waitTime + this.settings().rateLimitBuffer);
            });
        }
        log("!!! callWhenRateLimitAllows: No reset time available, calling function immediately.");
        // If we don't have a reset time, just call the function (shouldn't happen, except maybe on first call)
        return fn().then(this._handleResponse.bind(this));
    }

    /**
     * Handles the response from the Habitica API.
     * @param response The response from the API.
     * @returns A promise that resolves to the parsed HabiticaResponse.
     * @throws An error if the response is not ok or if the API indicates failure.
     */
    async _handleResponse(response: Response): Promise<HabiticaResponse> {
        // Check response headers for rate limiting info
        this.remainingRequests = parseInt(response.headers.get('x-ratelimit-remaining') || this.remainingRequests?.toString() || '30');
        this.nextResetTime = new Date(response.headers.get('x-ratelimit-reset') || this.nextResetTime?.toISOString() || new Date().toISOString());
        log(`Rate Limit - Remaining: ${this.remainingRequests}, Next Reset Time: ${this.nextResetTime}`);
        // Check if response is ok & successful
        if (!response.ok) {
            throw new Error(`HTTP error (Is Habitica API down?); status: ${response.status}, statusText: ${response.statusText}`);
        }
        // Sneak peek at the response JSON
        const data = await response.json() as HabiticaResponse;
        if (!data.success) {
            throw new Error(`Habitica API error (Was there a Habitica API update?); response: ${JSON.stringify(data)}`);
        }
        return data;
    }

    /**
     * Retrieves tasks from Habitica API based on the provided context.
     * If no context is provided, retrieves all tasks.
     * If the request fails, notifies the user and returns an empty array.
     * @param ctx The context for retrieving tasks, including type and due date.
     * @returns A promise that resolves to an array of HabiticaTask objects.
     */
    async retrieveTasks(ctx: HabiticaTaskRequest = {}): Promise<HabiticaTask[]> {
        // Fetch
        // Only include keys for non-null/defined parameters
        const queryParams: Record<string, string> = {
            ...(ctx.type ? { type: ctx.type } : {}),
            ...(ctx.dueDate ? { dueDate: ctx.dueDate.toISOString() } : {})
        };
        const url = this.buildApiUrl('tasks/user', 3, queryParams);
        const headers = this._defaultJSONHeaders();
        log(`Fetching tasks from Habitica: ${url}`);

        // First retrieve data, then parse response
        return this.callWhenRateLimitAllows(() =>
            fetch(url, { method: 'GET', headers })
        ).then((data: HabiticaResponse) => {
            // Presume failure is caught by _handleResponse
            return data.data as HabiticaTask[];
        });
    }

    /**
     * Utility method to retrieve all tasks organized by type.
     * @returns A promise that resolves to a map of tasks organized by type.
     */
    async retrieveAllTasks(): Promise<HabiticaTaskMap> {
        // Retrieve all tasks of all types
        const tasks = await this.retrieveTasks();
        return organizeHabiticaTasksByType(tasks);
    }

    // async createTask(task: Partial<HabiticaTask>): Promise<HabiticaTask | null> {
    // 	// Create a new task in Habitica
    // 	const url = this.buildApiUrl('tasks/user', 3);
    // 	const headers = this._defaultJSONHeaders();
    // 	log(`Creating task in Habitica: ${url}`);

    // 	return this.callWhenRateLimitAllows(() =>
    // 		fetch(url, { method: 'POST', headers, body: JSON.stringify(task) })
    // 	).then((data: HabiticaResponse) => {
    // 		// Presume failure is caught by _handleResponse
    // 		return data.data as HabiticaTask;
    // 	});
    // }
}