type NavBarProps = {
    tabs: [string, string][];
    activeTab: string;
    setActiveTab: (tabId: string) => void;
}

export type ViewProps = {
    active: boolean;
}

export const NavBar = ({ tabs, activeTab, setActiveTab }: NavBarProps) => {
    return (
        <nav className="habitica-resync-nav">
            <ul className="navbar-links">
                {tabs.map(([label, id]) => (
                    <li key={id} className={activeTab === id ? 'active' : ''}>
                        <button onClick={() => setActiveTab(id)}>
                            {label}
                        </button>
                    </li>
                ))}
            </ul>
        </nav>
    );
}