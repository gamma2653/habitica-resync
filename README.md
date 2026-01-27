# Habitica Resync
<sub>The spiritual successor to SuperChamp234's [`habitica sync`](https://github.com/SuperChamp234/habitica-sync) plugin.</sub>
<sub>Although the below 'pane' feature was inspired by Habitica Sync, no code from the original repository was used. (Mostly because on trying to build the original project, it seemed not only very deprecated, but failed to build; plus I had already built up the 'notes' feature detailed below, meaning I already completed much of the API parsing-heavy lifting).</sub>


## Features

### Notes
Enabled via the settings option "Enable Notes." Enable if you wish to have real `.md` files created, populated, and managed in conjunction with the Habitica platform.

Enable this feature if you wish for your tasks and checklists to be [Obsidian Tasks](https://github.com/obsidian-tasks-group/obsidian-tasks) compatible.

This mode of operation provides the most potential workflow compatibility, while also being a bit more clunky in implementation and more prone to compatibility issues as well (as paradoxical as that may sound).

### Pane
Enabled via the settings option "Enable Pane." Enable if you wish to manage your Habitica tasks via it's own window pane, without any managed `.md` files. This option is perfect in plugin heavy workflows where Habitica is desired as a separate standalone feature to compliment your vault.

If you are coming from [`habitica-sync`](https://github.com/SuperChamp234/habitica-sync), you may find this mode of operation to be the closest to that plugin's operation.

## Settings

### User ID
Your Habitica User ID. This is required for the plugin to function. You can find it in your Habitica settings under **Settings > Site Data**.

### API Key
Your Habitica API Key (also called API Token). This is required for the plugin to function. Found in the same location as the User ID: **Settings > Site Data**. 

### Enable Notes
Toggle the Notes feature on or off. When enabled, the plugin creates and manages `.md` files in the configured Habitica Folder Path, keeping them in sync with your Habitica tasks. Default: enabled.

### Enable Pane
Toggle the Pane feature on or off. When enabled, a React-based sidebar pane is registered in Obsidian for managing Habitica tasks directly, without creating any markdown files. Default: disabled.

#### The next few settings all have sensible default values and do not necessarilly need to be changed except for personal preferences

### Global Task Tag
An optional tag prepended to every task line in the generated markdown files. This is primarily useful for integration with the [Obsidian Tasks](https://github.com/obsidian-tasks-group/obsidian-tasks) plugin -- set this to match that plugin's "Global task filter" setting (e.g., `#task`) so that Obsidian Tasks recognizes Habitica tasks. Leave empty if you don't use Obsidian Tasks or don't want a global tag.

### Timeout
The timeout duration (in milliseconds) for Habitica API requests. If a request takes longer than this value, it will be aborted. The minimum allowed value is `30000` (30 seconds). Default: `30000`.

### Rate Limit Buffer
Additional buffer time (in milliseconds) added after hitting Habitica's rate limit before retrying requests. Habitica enforces a limit of 30 requests per minute; this buffer helps avoid exceeding that limit by spacing out retries. The minimum allowed value is `1000` (1 second). Default: `10000`.

### Habitica Folder Path
The folder path within your vault where Habitica task files will be created and managed. Each task type (habits, dailies, todos) gets its own markdown file inside this folder. This setting is required when Notes mode is enabled. Default: `HabiticaTasks`.

### Indent String
The string used to indent checklist sub-items in the generated markdown files. Default: four spaces (`    `). You might change this to a tab character or a different number of spaces depending on your vault's formatting preferences.

