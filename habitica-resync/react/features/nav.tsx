import { useState } from "react";

type NavBarProps = {
    tabs: [string, string][];
    activeTabCallback: (tabId: string) => void;
}

export type ViewProps = {
    active: boolean;
}

export const NavBar = ({ tabs, activeTabCallback }: NavBarProps) => {
    const [activeTab, setActiveTab] = useState<string>('daily');
    return (
        <nav className="habitica-resync-nav">
            <ul className="navbar-links">
                {tabs.map(([label, id]) => (
                    <li key={id} className={activeTab === id ? 'active' : ''}>
                        <button onClick={() => {
                            setActiveTab(id);
                            activeTabCallback(id);
                        }}>
                            {label}
                        </button>
                    </li>
                ))}
            </ul>
        </nav>
    );
}