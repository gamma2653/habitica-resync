import { useState, useMemo } from "react";
import { HabiticaTask, HabiticaAPI } from "../../../types";
import { TaskCard } from "./TaskCard";

type TaskListProps = {
    tasks: HabiticaTask[];
    habiticaClient: HabiticaAPI;
    onRefresh: () => void;
    isRefreshing: boolean;
    taskType: 'habit' | 'daily' | 'todo';
}

type SortOption = 'priority' | 'date' | 'name' | 'default';
type FilterOption = 'all' | 'active' | 'completed';

export const TaskList = ({ tasks, habiticaClient, onRefresh, isRefreshing, taskType }: TaskListProps) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<SortOption>('default');
    const [filterBy, setFilterBy] = useState<FilterOption>('all');
    const [forceUpdate, setForceUpdate] = useState(0);

    const filteredAndSortedTasks = useMemo(() => {
        let result = [...tasks];

        // Apply search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(task =>
                task.text.toLowerCase().includes(query) ||
                task.notes?.toLowerCase().includes(query)
            );
        }

        // Apply completion filter
        if (filterBy === 'active') {
            result = result.filter(task => !task.completed);
        } else if (filterBy === 'completed') {
            result = result.filter(task => task.completed);
        }

        // Apply sorting
        switch (sortBy) {
            case 'priority':
                result.sort((a, b) => (b.priority || 1) - (a.priority || 1));
                break;
            case 'date':
                result.sort((a, b) => {
                    const dateA = a.date ? new Date(a.date as string).getTime() : Infinity;
                    const dateB = b.date ? new Date(b.date as string).getTime() : Infinity;
                    return dateA - dateB;
                });
                break;
            case 'name':
                result.sort((a, b) => a.text.localeCompare(b.text));
                break;
            case 'default':
            default:
                // Keep original order
                break;
        }

        return result;
    }, [tasks, searchQuery, sortBy, filterBy]);

    const stats = useMemo(() => {
        const total = tasks.length;
        const completed = tasks.filter(t => t.completed).length;
        const active = total - completed;
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

        return { total, completed, active, completionRate };
    }, [tasks]);

    const handleUpdate = () => {
        setForceUpdate(prev => prev + 1);
    };

    return (
        <div className="task-list-container">
            {/* Stats Bar */}
            <div className="task-stats-bar">
                <div className="task-stats">
                    <span className="stat-item">
                        <strong>{stats.total}</strong> total
                    </span>
                    <span className="stat-item">
                        <strong>{stats.active}</strong> active
                    </span>
                    {taskType !== 'habit' && (
                        <span className="stat-item">
                            <strong>{stats.completionRate}%</strong> complete
                        </span>
                    )}
                </div>
                <button
                    className="refresh-btn"
                    onClick={onRefresh}
                    disabled={isRefreshing}
                    title="Refresh tasks from Habitica"
                >
                    {isRefreshing ? '⟳ Refreshing...' : '↻ Refresh'}
                </button>
            </div>

            {/* Controls Bar */}
            <div className="task-controls-bar">
                <div className="search-box">
                    <input
                        type="text"
                        placeholder="🔍 Search tasks..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="search-input"
                    />
                    {searchQuery && (
                        <button
                            className="clear-search-btn"
                            onClick={() => setSearchQuery('')}
                            title="Clear search"
                        >
                            ✕
                        </button>
                    )}
                </div>

                <div className="filter-sort-controls">
                    <select
                        value={filterBy}
                        onChange={(e) => setFilterBy(e.target.value as FilterOption)}
                        className="control-select"
                    >
                        <option value="all">All Tasks</option>
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                    </select>

                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortOption)}
                        className="control-select"
                    >
                        <option value="default">Default Order</option>
                        <option value="priority">Priority</option>
                        {taskType !== 'habit' && <option value="date">Due Date</option>}
                        <option value="name">Name</option>
                    </select>
                </div>
            </div>

            {/* Task List */}
            <div className="task-list">
                {filteredAndSortedTasks.length === 0 ? (
                    <div className="empty-state">
                        {searchQuery || filterBy !== 'all' ? (
                            <>
                                <p>No tasks match your filters</p>
                                <button
                                    onClick={() => {
                                        setSearchQuery('');
                                        setFilterBy('all');
                                    }}
                                    className="reset-filters-btn"
                                >
                                    Clear Filters
                                </button>
                            </>
                        ) : (
                            <p>No {taskType}s yet. Create some in Habitica!</p>
                        )}
                    </div>
                ) : (
                    filteredAndSortedTasks.map(task => (
                        <TaskCard
                            key={task.id}
                            task={task}
                            habiticaClient={habiticaClient}
                            onUpdate={handleUpdate}
                            isHabit={taskType === 'habit'}
                        />
                    ))
                )}
            </div>
        </div>
    );
};
