interface TabsProps<T extends string> {
  tabs: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function Tabs<T extends string>({ tabs, value, onChange }: TabsProps<T>) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-bg-surface p-1">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            value === tab.value
              ? 'bg-accent text-white'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
