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
