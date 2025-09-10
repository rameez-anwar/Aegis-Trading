import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const StrategyMultiSelect = ({ selected = [], onChange }) => {
  const [allStrategies, setAllStrategies] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await axios.get('/api/strategies');
        const list = (res.data?.data || []).map(s => ({ 
          label: s.name, 
          value: s.name,
          symbol: s.parameters?.symbol || 'UNKNOWN'
        }));
        setAllStrategies(list);
      } catch (e) {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allStrategies.filter(s => s.label.toLowerCase().includes(q));
  }, [allStrategies, search]);

  const toggle = (value) => {
    if (!onChange) return;
    
    if (selected.includes(value)) {
      // Remove strategy
      onChange(selected.filter(v => v !== value));
    } else {
      // Add strategy - but first remove any existing strategy for the same symbol
      const newStrategy = allStrategies.find(s => s.value === value);
      if (newStrategy) {
        const symbol = newStrategy.symbol;
        // Remove any existing strategies for the same symbol
        const filteredSelected = selected.filter(v => {
          const existingStrategy = allStrategies.find(s => s.value === v);
          return existingStrategy && existingStrategy.symbol !== symbol;
        });
        // Add the new strategy
        onChange([...filteredSelected, value]);
      }
    }
  };

  const remove = (value) => {
    if (!onChange) return;
    onChange(selected.filter(v => v !== value));
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {selected.map(v => {
          const strategy = allStrategies.find(s => s.value === v);
          return (
            <span key={v} className="inline-flex items-center space-x-2 px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
              <span className="font-medium">{strategy?.symbol || 'UNKNOWN'}</span>
              <span className="text-xs text-blue-600">({v})</span>
              <button type="button" onClick={() => remove(v)} className="text-blue-600 hover:text-blue-800 ml-1">×</button>
            </span>
          );
        })}
        {selected.length === 0 && (
          <span className="text-sm text-gray-500">No strategies selected</span>
        )}
      </div>
      <input
        type="text"
        placeholder="Search strategies..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-3"
      />
      <div className="max-h-48 overflow-auto border border-gray-300 rounded-lg divide-y divide-gray-100 bg-white">
        {loading ? (
          <div className="px-4 py-3 text-sm text-gray-500">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-3 text-sm text-gray-500">No strategies match.</div>
        ) : (
          filtered.map(s => {
            const isSelected = selected.includes(s.value);
            const hasSymbolConflict = selected.some(selectedValue => {
              const selectedStrategy = allStrategies.find(strat => strat.value === selectedValue);
              return selectedStrategy && selectedStrategy.symbol === s.symbol && selectedValue !== s.value;
            });
            
            return (
              <label key={s.value} className={`flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50 cursor-pointer ${hasSymbolConflict ? 'opacity-50' : ''}`}>
                <div className="flex items-center space-x-3">
                  <input 
                    type="checkbox" 
                    checked={isSelected} 
                    onChange={() => toggle(s.value)}
                    disabled={hasSymbolConflict && !isSelected}
                  />
                  <div>
                    <div className="font-medium text-gray-800">{s.label}</div>
                    <div className="text-xs text-gray-500">{s.symbol}</div>
                  </div>
                </div>
                {hasSymbolConflict && !isSelected && (
                  <span className="text-xs text-orange-600">Symbol conflict</span>
                )}
              </label>
            );
          })
        )}
      </div>
    </div>
  );
};

export default StrategyMultiSelect;


