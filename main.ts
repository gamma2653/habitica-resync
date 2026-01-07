import type { App } from 'obsidian';
import { Notice, Editor, Plugin, PluginSettingTab, Setting, MarkdownView, TFolder, WorkspaceLeaf } from 'obsidian';

// import type { HabiticaTasksSettings, TaskType } from './habitica-resync/types';
import * as types from './habitica-resync/types';
import * as mounting from './habitica-resync/react/mounting';
import * as habiticaAPI from './habitica-resync/api';
import * as util from './habitica-resync/util';


const DEFAULT_SETTINGS: types.HabiticaTasksSettings = {
	userId: '',
	timeOut: 30000,
	apiKey: '',
	rateLimitBuffer: 10000, // 10 second buffer
	habiticaFolderPath: 'HabiticaTasks',
	indentString: '    ',
	enableNotes: true,
	enablePane: false
}

const PLUGIN_NAME = 'Habitica-Tasks Integration';

/**
 * Main plugin class for Habitica-Tasks Integration.
 * 
 * Handles plugin lifecycle, settings, and UI integration.
 */
export default class HabiticaResyncPlugin extends Plugin {
	settings: types.HabiticaTasksSettings;
	client: habiticaAPI.HabiticaClient;
	functioning: boolean = true;
	nonFunctionalReason: string = '';
	lastFunctionalNotice: Date | null = null;
	tasksPlugin: Plugin | null = null;

	async showPane() {
		const { workspace } = this.app;
		const view_type = Object.keys(mounting.VIEW_ID_TO_TYPE)[0];
		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(view_type);

		if (leaves.length > 0) {
			// A leaf with our view already exists, use that
			leaf = leaves[0];
		} else {
			// Our view could not be found in the workspace, create a new leaf
			// in the right sidebar for it
			leaf = workspace.getRightLeaf(false);
			if (leaf) {
				await leaf.setViewState({ type: view_type, active: true });
			} else {
				util.warn('Could not create or find a workspace leaf for the Habitica pane view.');
				return;
			}
		}

		// "Reveal" the leaf in case it is in a collapsed sidebar
		workspace.revealLeaf(leaf);
	}

	attachRibbonButton() {
		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('swords', PLUGIN_NAME, async (_evt: MouseEvent) => {
			// Called when the user clicks the icon.
			if (this.settings.enableNotes) {
				new Notice(`${PLUGIN_NAME}: Refreshing notes...`);
				await this.client.retrieveTaskMap();
				await this.client.retrieveUser();
			}
			if (this.settings.enablePane) {
				await this.showPane();
			}
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('habitica-task-btn');
	}

	runOrNotify<T extends (...args: any[]) => any>(fn: T): T {  // Actually fair use of 'any' here
		const plugin = this;
		return function(this: any, ...args: Parameters<T>): ReturnType<T> | void {
			if (!plugin.functioning) {
				util.warn(`Plugin is not functioning: ${plugin.nonFunctionalReason}`);
				if (!plugin.lastFunctionalNotice || (new Date().getTime() - plugin.lastFunctionalNotice.getTime()) > 60000) {
					new Notice(`${PLUGIN_NAME} is not functioning: ${plugin.nonFunctionalReason}\nCheck the console for more details.`);
					plugin.lastFunctionalNotice = new Date();
				}
				return;
			}
			return fn.apply(this, args);
		} as T;
	}

	// async handleNotesUpdate(habiticaTasks: types.HabiticaTaskMap) {
	async handleHomogeneousUpdate(type_: string, habiticaTasks: types.HabiticaTask[]) {
		const folderPath = this.getOrCreateHabiticaFolder();
		if (habiticaTasks.length === 0) {
			return;
		}
		if (this.settings.enableNotes) {
			for (const task of habiticaTasks) {
				if (type_ !== task.type) {
					util.warn(`Received tasks for type ${task.type} in handler for type ${type_}, skipping.`);
					continue;
				}
				// Skip ignored types
				if (types.EXCLUDED_TASK_TYPES.has(type_ as types.TaskType)) {  // Surprised TypeScript allows this cast
					continue;
				}
			}
			const filePath = `${folderPath}/${type_}.md`;
			const file = this.app.vault.getFileByPath(filePath);
			// util.log(`Updating Habitica notes for type ${type_} at path ${filePath}`);
			// util.log(`File exists: ${file}`);
			if (!file) {
				// Create new file
				await this.app.vault.create(filePath, habiticaTasks.map(task => util.taskToNoteLines(task, this.settings)).join('\n\n---\n\n'));
			} else {
				// Overwrite existing file
				await this.app.vault.process(file, _ => habiticaTasks.map(task => util.taskToNoteLines(task, this.settings)).join('\n\n---\n\n'));
			}
		}
	}

	async handleProfileUpdate(user: types.HabiticaUser) {
		const folderPath = this.getOrCreateHabiticaFolder();
		if (this.settings.enableNotes) {
			const filePath = `${folderPath}/profile.md`;
			const file = this.app.vault.getFileByPath(filePath);
			const content = util.profileToNoteLines(user, this.settings);

			if (!file) {
				// Create new file
				await this.app.vault.create(filePath, content);
			} else {
				// Overwrite existing file
				await this.app.vault.process(file, _ => content);
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
		const habiticaFiles: Record<types.TaskType, string> = {} as Record<types.TaskType, string>;
		for (const type of Object.values(types.TASK_TYPES)) {
			if (types.EXCLUDED_TASK_TYPES.has(type)) {
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
				// TODO: Push content to Habitica
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
				util.log(editor.getSelection());
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
				util.error('Error accessing plugins manager to detect Tasks plugin:', error);
				this.tasksPlugin = null;
			}
		});
	}
	addViews() {
		for (const [viewId, ViewType] of Object.entries(mounting.VIEW_ID_TO_TYPE)) {
			this.registerView(
				viewId,
				(leaf => new ViewType(leaf, this.client))
			);
		}
	}

	async onload() {
		await this.loadSettings();
		this.attachRibbonButton();
		this.attachStatusBar();
		this.attachCommands();
		this.addSettingTab(new HabiticaResyncSettingTab(this.app, this));
		this.addViews();
		this.detectTasksPlugin();
		this.client = new habiticaAPI.HabiticaClient(this);
		// Retrieve tasks, the event will trigger view updates where applicable
		this.initSubscriptions();
		this.app.workspace.onLayoutReady(async () => {
			await this.client.retrieveTaskMap();
			await this.client.retrieveUser();
		});
	}

	onunload() {

	}

	initSubscriptions() {
		if (this.settings.enableNotes) {
			for (const type_ of types.TASK_TYPES) {
				if (types.EXCLUDED_TASK_TYPES.has(type_)) {
					continue;
				}
				const eventName = `${type_}Updated` as Exclude<types.HabiticaApiEvent, 'profileUpdated'>;
				this.client.subscribe(eventName, 'noteSync', this.runOrNotify(this.handleHomogeneousUpdate.bind(this, type_)));
			}
			// Subscribe to profile updates
			this.client.subscribe('profileUpdated', 'noteSync', this.runOrNotify(this.handleProfileUpdate.bind(this)));
		}
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
