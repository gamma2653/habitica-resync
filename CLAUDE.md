# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Obsidian plugin that integrates Habitica task management with Obsidian. It supports two modes:
- **Notes Mode**: Creates and syncs markdown files compatible with the Obsidian Tasks plugin
- **Pane Mode**: Provides a React-based sidebar pane for managing Habitica tasks without creating files

The plugin is the spiritual successor to the deprecated `habitica-sync` plugin.

## Build Commands

```bash
# Install dependencies
npm install

# Development build with watch mode
npm run dev

# Production build (includes type checking)
npm run build

# Linting (requires global eslint)
eslint main.ts
eslint ./habitica-resync/
```

## Architecture

### Directory Structure

```
main.ts                           # Plugin entry point and lifecycle
habitica-resync/
  api.ts                          # HabiticaClient - API wrapper with rate limiting
  types.ts                        # TypeScript types and interfaces
  util.ts                         # Utility functions for task conversion and logging
  react/
    mounting.tsx                  # React view registration
    App.tsx                       # Main React app component
    ctx.tsx                       # React context (app + client access)
    features/                     # React feature components
      nav.tsx                     # NavBar (controlled component, no internal state)
      profile.tsx                 # ProfileView with StatBar and AttributeItem sub-components
      tasks/
        taskViews.tsx             # createTaskView factory → DailyView, HabitView, TodoView
        TaskCard.tsx              # Individual task card component
        TaskList.tsx              # Task list with sorting and refresh
```

### Key Components

**HabiticaClient (`habitica-resync/api.ts`)**
- Central API wrapper with automatic rate limiting
- Implements event-driven architecture via subscribe/emit pattern
- Handles task CRUD operations
- Rate limit tracking via `remainingRequests` and `nextResetTime`
- Events: `todoUpdated`, `dailyUpdated`, `habitUpdated`, `taskUpdated`

**Plugin Class (`main.ts`)**
- `functioning` flag controls plugin availability based on configuration
- `runOrNotify()` wrapper ensures commands only run when properly configured
- Dual-mode operation via `enableNotes` and `enablePane` settings
- Event subscriptions are initialized in `initSubscriptions()`
- `writeToHabiticaFile()` shared helper for create-or-overwrite file operations

**Task Sync Flow**
1. `HabiticaClient.retrieveTaskMap()` fetches tasks from Habitica API
2. Client emits type-specific events (e.g., `todoUpdated`)
3. Subscribers handle updates:
   - Notes mode: `handleHomogeneousUpdate()` writes markdown files
   - Pane mode: React components re-render via context

**Two-Way Sync**
- **From Habitica → Obsidian**: Via `retrieveTaskMap()` and event emissions
- **To Habitica**: Via `updateOrCreateTask()` and `syncTasksToHabitica()`
- Task parsing from markdown: `parseContentToTasks()` in `util.ts`
- Task rendering to markdown: `taskToNoteLines()` in `util.ts`

### Rate Limiting Strategy

The `HabiticaClient.callWhenRateLimitAllows()` method:
- Respects Habitica's rate limits (30 requests per minute)
- Tracks remaining requests via response headers
- Automatically queues requests when limit reached
- Adds configurable buffer time (`rateLimitBuffer` setting)

### Event System

Publisher-subscriber pattern with two subscriber types:
- `noteSync`: Handles markdown file updates
- `paneSync`: Handles React UI updates

Subscribe via `client.subscribe(event, subscriber_id, listener)`, unsubscribe handles circular update prevention.

### React Integration

React view mounted via `HabiticaResyncView` (extends Obsidian's `ItemView`):
- Uses React 19 with strict mode
- Context (`ctx.tsx`) provides access to `app` and `habiticaClient`
- View lifecycle: `onOpen()` creates root, `onClose()` unmounts
- Task views use a `createTaskView` factory in `taskViews.tsx` (parameterized by event ID, task key, and title)
- `NavBar` is a controlled component — `activeTab` state lives in `App.tsx`
- `ProfileView` uses extracted `StatBar` and `AttributeItem` sub-components

## Development Notes

### Task Type Handling

Task types: `habit`, `daily`, `todo`, `reward`, `completedTodo`
- `EXCLUDED_TASK_TYPES` filters out `completedTodo` and `reward` from file sync
- Each non-excluded type gets its own capitalized markdown file (e.g., `Todo.md`)

### Settings Validation

The `determineFunctionality()` method validates:
- User ID and API key presence
- Folder path if Notes mode enabled
- Sets `functioning` flag and `nonFunctionalReason` message

### Markdown Format

Tasks are rendered with:
- Checkbox: `- [ ]` or `- [x]`
- Optional global tag (for Obsidian Tasks integration)
- Priority emoji: ⏬ 🔽 🔼 ⏫
- Due date emoji: 📅 YYYY-MM-DD
- Checklist items indented with `indentString` setting

Example:
```markdown
- [ ] #task Buy groceries 🔼 📅 2025-01-06
    - [x] Milk
    - [ ] Bread
```

### Common Patterns

**Adding a new command:**
Use `runOrNotify()` wrapper to ensure plugin is functional:
```typescript
this.addCommand({
  id: 'my-command',
  name: 'My Command',
  callback: this.runOrNotify(() => {
    // Command logic
  })
});
```

**Subscribing to task updates:**
```typescript
this.client.subscribe('todoUpdated', 'myFeature', (tasks) => {
  // Handle tasks
});
```

**Preventing circular updates:**
Use `performWhileUnsubscribed()` when making changes that would trigger events:
```typescript
await this.client.performWhileUnsubscribed('todoUpdated', 'noteSync',
  this.client.updateTask(taskData)
);
```

## Testing

Manual testing workflow:
1. Run `npm run build`
2. Reload Obsidian
3. Configure User ID and API Key in settings
4. Enable desired mode (Notes/Pane)
5. Click ribbon icon or run commands

## Important Constraints

- Minimum timeout: 30000ms (30 seconds)
- Minimum rate limit buffer: 1000ms
- Plugin works on mobile (isDesktopOnly: false)
- Uses esbuild for bundling (entry: `main.ts`, output: `main.js`)
- External dependencies: obsidian, electron, @codemirror/*, react, react-dom

## Habitica API
For Habitica API endpoints, refer to `https://habitica.com/apidoc/`