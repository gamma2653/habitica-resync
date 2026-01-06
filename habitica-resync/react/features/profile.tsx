import { useEffect, useState } from "react";
import { HabiticaUser } from "../../types";
import { useHabiticaResyncApp } from "../ctx";
import { ViewProps } from "./nav";

export const ProfileView = ({ active }: ViewProps) => {
    if (!active) {
        return null;
    }

    const { habiticaClient } = useHabiticaResyncApp();
    const [user, setUser] = useState<HabiticaUser | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                setLoading(true);
                setError(null);
                const userData = await habiticaClient.retrieveUser();
                setUser(userData);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load user data');
            } finally {
                setLoading(false);
            }
        };

        fetchUser();
    }, [habiticaClient]);

    if (loading) {
        return <div className="profile-loading">Loading profile...</div>;
    }

    if (error) {
        return <div className="profile-error">Error: {error}</div>;
    }

    if (!user) {
        return <div className="profile-error">No user data available</div>;
    }

    const { stats, profile } = user;
    const hpPercent = (stats.hp / stats.maxHealth) * 100;
    const mpPercent = (stats.mp / stats.maxMP) * 100;
    const expPercent = (stats.exp / stats.toNextLevel) * 100;

    return (
        <div className="habitica-profile">
            <h2>Profile</h2>

            <div className="profile-section">
                <div className="profile-name">
                    <strong>{profile.name}</strong>
                </div>
                <div className="profile-level">
                    Level {stats.lvl} {stats.class ? `${stats.class}` : ''}
                </div>
            </div>

            <div className="profile-section stats-section">
                <div className="stat-row">
                    <div className="stat-label">❤️ Health:</div>
                    <div className="stat-bar-container">
                        <div className="stat-bar health-bar" style={{ width: `${hpPercent}%` }}></div>
                    </div>
                    <div className="stat-text">{Math.floor(stats.hp)} / {stats.maxHealth}</div>
                </div>

                <div className="stat-row">
                    <div className="stat-label">✨ Mana:</div>
                    <div className="stat-bar-container">
                        <div className="stat-bar mana-bar" style={{ width: `${mpPercent}%` }}></div>
                    </div>
                    <div className="stat-text">{Math.floor(stats.mp)} / {stats.maxMP}</div>
                </div>

                <div className="stat-row">
                    <div className="stat-label">⭐ Experience:</div>
                    <div className="stat-bar-container">
                        <div className="stat-bar exp-bar" style={{ width: `${expPercent}%` }}></div>
                    </div>
                    <div className="stat-text">{Math.floor(stats.exp)} / {stats.toNextLevel}</div>
                </div>

                <div className="stat-row gold-row">
                    <div className="stat-label">💰 Gold:</div>
                    <div className="stat-text">{stats.gp.toFixed(2)}</div>
                </div>
            </div>

            {(stats.str || stats.con || stats.int || stats.per) && (
                <div className="profile-section attributes-section">
                    <h3>Attributes</h3>
                    <div className="attributes-grid">
                        {stats.str !== undefined && (
                            <div className="attribute-item">
                                <div className="attribute-label">💪 Strength:</div>
                                <div className="attribute-value">{stats.str}</div>
                            </div>
                        )}
                        {stats.con !== undefined && (
                            <div className="attribute-item">
                                <div className="attribute-label">🛡️ Constitution:</div>
                                <div className="attribute-value">{stats.con}</div>
                            </div>
                        )}
                        {stats.int !== undefined && (
                            <div className="attribute-item">
                                <div className="attribute-label">🧠 Intelligence:</div>
                                <div className="attribute-value">{stats.int}</div>
                            </div>
                        )}
                        {stats.per !== undefined && (
                            <div className="attribute-item">
                                <div className="attribute-label">👁️ Perception:</div>
                                <div className="attribute-value">{stats.per}</div>
                            </div>
                        )}
                    </div>
                    {stats.points !== undefined && stats.points > 0 && (
                        <div className="unallocated-points">
                            🎯 Unallocated Points: {stats.points}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
