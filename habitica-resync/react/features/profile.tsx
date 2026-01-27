import { useEffect, useState } from "react";
import { HabiticaUser } from "../../types";
import { useHabiticaResyncApp } from "../ctx";
import { ViewProps } from "./nav";

type StatBarProps = {
    emoji: string;
    label: string;
    value: number;
    max: number;
    barClass: string;
};

const StatBar = ({ emoji, label, value, max, barClass }: StatBarProps) => (
    <div className="stat-row">
        <div className="stat-label">{emoji} {label}:</div>
        <div className="stat-bar-container">
            <div className={`stat-bar ${barClass}`} style={{ width: `${(value / max) * 100}%` }}></div>
        </div>
        <div className="stat-text">{Math.floor(value)} / {max}</div>
    </div>
);

type AttributeItemProps = {
    emoji: string;
    label: string;
    base: number | undefined;
    buff: number | undefined;
};

const AttributeItem = ({ emoji, label, base, buff }: AttributeItemProps) => {
    if (base === undefined) return null;
    const total = (base || 0) + (buff || 0);
    return (
        <div className="attribute-item">
            <div className="attribute-label">{emoji} {label}:</div>
            <div className="attribute-value">
                {total}
                {buff ? (
                    <span className="attribute-breakdown"> ({base} + {buff})</span>
                ) : null}
            </div>
        </div>
    );
};

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

        habiticaClient.subscribe('profileUpdated', 'paneSync', setUser);

        return () => {
            habiticaClient.unsubscribe('profileUpdated', 'paneSync', setUser);
        };
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
                <StatBar emoji="❤️" label="Health" value={stats.hp} max={stats.maxHealth} barClass="health-bar" />
                <StatBar emoji="✨" label="Mana" value={stats.mp} max={stats.maxMP} barClass="mana-bar" />
                <StatBar emoji="⭐" label="Experience" value={stats.exp} max={stats.toNextLevel} barClass="exp-bar" />
                <div className="stat-row gold-row">
                    <div className="stat-label">💰 Gold:</div>
                    <div className="stat-text">{stats.gp.toFixed(2)}</div>
                </div>
            </div>

            {(stats.str !== undefined || stats.con !== undefined || stats.int !== undefined || stats.per !== undefined) && (
                <div className="profile-section attributes-section">
                    <h3>Attributes</h3>
                    <div className="attributes-grid">
                        <AttributeItem emoji="💪" label="Strength" base={stats.str} buff={stats.buffs?.str} />
                        <AttributeItem emoji="🛡️" label="Constitution" base={stats.con} buff={stats.buffs?.con} />
                        <AttributeItem emoji="🧠" label="Intelligence" base={stats.int} buff={stats.buffs?.int} />
                        <AttributeItem emoji="👁️" label="Perception" base={stats.per} buff={stats.buffs?.per} />
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
