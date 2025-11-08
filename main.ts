import type { App } from 'obsidian';
import { Notice, Editor, Plugin, PluginSettingTab, Setting, MarkdownView, TFolder } from 'obsidian';
import type { HabiticaTasksSettings, HabiticaTaskRequest, HabiticaTask, HabiticaResponse, HabiticaTaskMap, TaskType } from './habitica-resync/types';
import { ExcludedTaskTypes, TaskTypes } from './habitica-resync/types';
import { organizeHabiticaTasksByType, taskToNoteLines, log } from './habitica-resync/util';


const DEFAULT_SETTINGS: HabiticaTasksSettings = {
	userId: '',
	timeOut: 30000,
	apiKey: '',
	rateLimitBuffer: 10000, // 10 second buffer
	habiticaFolderPath: 'HabiticaTasks',
	indentString: '    ',
	enableNotes: true,
	enablePane: false
}

const HABITICA_SIDE_PLUGIN_ID = 'habitica-x-obsidian-task-integration';
const PLUGIN_NAME = 'Habitica-Tasks Integration';
const HABITICA_API_URL = 'https://habitica.com/api';
const DEVELOPER_USER_ID = 'a8e40d27-c872-493f-acf2-9fe75c56ac0c'  // Itssa me, GammaThought!


/**
 * Interfaces with the Habitica API while respecting rate limits.
 */
class HabiticaClient {
	plugin: HabiticaResyncPlugin;
	remainingRequests: number = 30;
	nextResetTime: Date | null = null;
	constructor(plugin: HabiticaResyncPlugin) {
		// Initialize with settings
		this.plugin = plugin;

	}

	settings() {
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
	 * @param fn The function to call when the rate limit allows it.
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

/**
 * Main plugin class for Habitica-Tasks Integration.
 * 
 * Handles plugin lifecycle, settings, and UI integration.
 */
export default class HabiticaResyncPlugin extends Plugin {
	settings: HabiticaTasksSettings;
	client: HabiticaClient;
	functioning: boolean = true;
	nonFunctionalReason: string = '';
	lastFunctionalNotice: Date | null = null;
	tasksPlugin: Plugin | null = null;

	attachRibbonButton() {
		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('swords', PLUGIN_NAME, async (_evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice(`${PLUGIN_NAME} icon clicked. Retrieving tasks...`);
			await this.retrieveHabiticaNotes();
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('habitica-task-btn');
	}

	runOrNotify<T extends (...args: any[]) => any>(fn: T): T {  // Actually fair use of 'any' here
		const plugin = this;
		return function(this: any, ...args: Parameters<T>): ReturnType<T> | void {
			if (!plugin.functioning) {
				console.warn(`Plugin is not functioning: ${plugin.nonFunctionalReason}`);
				if (!plugin.lastFunctionalNotice || (new Date().getTime() - plugin.lastFunctionalNotice.getTime()) > 60000) {
					new Notice(`${PLUGIN_NAME} is not functioning: ${plugin.nonFunctionalReason}\nCheck the console for more details.`);
					plugin.lastFunctionalNotice = new Date();
				}
				return;
			}
			return fn.apply(this, args);
		} as T;
	}

	async retrieveHabiticaNotes() {
		const folderPath = this.getOrCreateHabiticaFolder();
		// Create files
		const habiticaTasks = await this.client.retrieveAllTasks();
		for (const [type_, tasks] of Object.entries(habiticaTasks)) {
			// Skip ignored types
			if (tasks.length === 0 || ExcludedTaskTypes.has(type_ as TaskType)) {  // Surprised TypeScript allows this cast
				continue;
			}
			const fileName = `${type_}.md`;
			const filePath = `${folderPath}/${fileName}`;
			const file = this.app.vault.getFileByPath(filePath);
			if (!file) {
				// Create new file
				await this.app.vault.create(filePath, tasks.map(task => taskToNoteLines(task, this.settings)).join('\n\n---\n\n'));
			} else {
				// Overwrite existing file
				await this.app.vault.process(file, _ => tasks.map(task => taskToNoteLines(task, this.settings)).join('\n\n---\n\n'));
			}
		}
	}

	getOrCreateHabiticaFolder() {
		const folderPath = this.settings.habiticaFolderPath;
		let folder = this.app.vault.getAbstractFileByPath(folderPath);
		if (folder && !(folder instanceof TFolder)) {
			// If the path exists but is not a folder, throw an error
			throw new Error(`Path ${folderPath} exists but is not a folder. Please remove or rename the file to restore functionality of this plugin.`);
		}
		if (!folder) {
			// If the folder doesn't exist, create it
			this.app.vault.createFolder(folderPath);
		}
		return folderPath;
	}

	getHabiticaFiles() {
		const folderPath = this.getOrCreateHabiticaFolder();
		const habiticaFiles: Record<TaskType, string> = {} as Record<TaskType, string>;
		for (const type of Object.values(TaskTypes)) {
			if (ExcludedTaskTypes.has(type)) {
				continue;
			}
			habiticaFiles[type] = `${folderPath}/${type}.md`;
		}
		return habiticaFiles;
	}

	async pushChangesToHabitica() {
		// Implementation for pushing changes to Habitica
		const habiticaFiles = this.getHabiticaFiles();
		for (const [type, filePath] of Object.entries(habiticaFiles)) {
			const file = this.app.vault.getFileByPath(filePath);
			if (file) {
				const content = await this.app.vault.read(file);
				// Push content to Habitica
			}
		}
	}

	attachCommands() {
		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: this.runOrNotify(() => {
				// new SampleModal(this.app).open();
			})
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: this.runOrNotify((editor: Editor, _view: MarkdownView) => {
				log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			})
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: this.runOrNotify((checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						// new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			})
		});
	}

	attachStatusBar() {
		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');
	}

	/**
	 * This function is called when the plugin is loaded
	 * It is used to register various aspects of the plugin
	 * such as settings, commands, ribbon icons, etc.
	 * 
	 * Throws an error if `this.app.plugins` cannot be accessed.
	 */
	detectTasksPlugin() {
		this.app.workspace.onLayoutReady(() => {
			// Access plugins manager via type assertion since it's not in the public API
			try {
				this.tasksPlugin = (this.app as any).plugins.getPlugin('obsidian-tasks-plugin');
			} catch (error) {
				console.error('Error accessing plugins manager to detect Tasks plugin:', error);
				this.tasksPlugin = null;
			}
		});
	}


	async onload() {
		await this.loadSettings();
		this.attachRibbonButton();
		this.attachStatusBar();
		this.attachCommands();
		this.addSettingTab(new HabiticaResyncSettingTab(this.app, this));
		this.detectTasksPlugin();
		this.client = new HabiticaClient(this);
	}

	onunload() {

	}

	determineFunctionality() {
		this.nonFunctionalReason = '';
		const reasons: string[] = [];
		// Determine if the plugin can function based on settings
		if (!this.settings.userId || this.settings.userId.trim() === '') {
			reasons.push('Missing Habitica User ID in settings');
		}
		if (!this.settings.apiKey || this.settings.apiKey.trim() === '') {
			reasons.push('Missing Habitica API Key in settings');
		}
		if (this.settings.enableNotes && (!this.settings.habiticaFolderPath || this.settings.habiticaFolderPath.trim() === '')) {
			reasons.push('Missing Habitica Folder Path in settings, required for the notes feature');
		}
		this.functioning = reasons.length === 0;
		this.nonFunctionalReason = reasons.join('; ');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		this.determineFunctionality();
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.determineFunctionality();
		this.getOrCreateHabiticaFolder();
	}
}

class HabiticaResyncSettingTab extends PluginSettingTab {
	plugin: HabiticaResyncPlugin;

	constructor(app: App, plugin: HabiticaResyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('User ID')
			.setDesc('Enter your Habitica User ID')
			.addText(text => text
				.setPlaceholder('Enter your Habitica User ID')
				.setValue(this.plugin.settings.userId)
				.onChange(async (value) => {
					this.plugin.settings.userId = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('API Key')
			.setDesc('Enter your Habitica API Key')
			.addText(text => text
				.setPlaceholder('Enter your Habitica API Key')
				.setValue(this.plugin.settings.apiKey)
				.onChange(async (value) => {
					this.plugin.settings.apiKey = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Timeout')  // Minimum value is 30000
			.setDesc('Enter timeout in milliseconds')
			.addText(text => text
				.setPlaceholder('Enter timeout in milliseconds')
				.setValue(this.plugin.settings.timeOut.toString())
				.onChange(async (value) => {
					const intValue = parseInt(value);
					if (!isNaN(intValue) && intValue >= 30000) {
						this.plugin.settings.timeOut = intValue;
						await this.plugin.saveSettings();
					} else {
						new Notice('Please enter a valid number greater than or equal to 30000.');
					}
				}));
		new Setting(containerEl)
			.setName('Rate Limit Buffer')  // Minimum value is 0
			.setDesc('Enter additional buffer time in milliseconds for rate limiting')
			.addText(text => text
				.setPlaceholder('Enter buffer time in milliseconds')
				.setValue(this.plugin.settings.rateLimitBuffer.toString())
				.onChange(async (value) => {
					const intValue = parseInt(value);
					if (!isNaN(intValue) && intValue >= 1000) {
						this.plugin.settings.rateLimitBuffer = intValue;
						await this.plugin.saveSettings();
					} else {
						new Notice('Please enter a valid number greater than or equal to 1000.');
					}
				}));
		new Setting(containerEl)
			.setName('Habitica Folder Path')
			.setDesc('Enter the folder path where Habitica tasks will be stored')
			.addText(text => text
				.setPlaceholder('Enter folder path')
				.setValue(this.plugin.settings.habiticaFolderPath)
				.onChange(async (value) => {
					this.plugin.settings.habiticaFolderPath = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Global Task Tag')
			.setDesc('Enter a global tag to be added to all Habitica tasks (optional)\nIf using Obsidian Tasks plugin, this should match the "Global task filter" setting.')
			.addText(text => text
				.setPlaceholder('Enter global task tag')
				.setValue(this.plugin.settings.globalTaskTag || '')
				.onChange(async (value) => {
					value = value.trim();
					this.plugin.settings.globalTaskTag = (value === '' ? undefined : value);
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Enable Notes')
			.setDesc('Enable creating and syncing notes for Habitica tasks')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableNotes)
				.onChange(async (value) => {
					this.plugin.settings.enableNotes = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Enable Pane')
			.setDesc('Enable the Habitica Tasks pane in the sidebar')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enablePane)
				.onChange(async (value) => {
					this.plugin.settings.enablePane = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Indent String')
			.setDesc('String used for indentation in notes')
			.addText(text => text
				.setPlaceholder('Enter indent string')
				.setValue(this.plugin.settings.indentString)
				.onChange(async (value) => {
					this.plugin.settings.indentString = value;
					await this.plugin.saveSettings();
				}));

	}
}
