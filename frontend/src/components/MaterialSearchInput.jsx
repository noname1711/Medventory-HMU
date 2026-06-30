import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './MaterialSearchInput.css';

/**
 * Shared autocomplete component for material/item search.
 *
 * Props:
 *   value        string   — controlled display text
 *   onChange(text)        — called on every keystroke
 *   onSelect(item)        — called when user picks a suggestion
 *   items        array    — pre-loaded list: { id, materialName, materialCode?, unitName? }
 *   onSearch(keyword)     — optional async server search → returns items array.
 *                           When provided, suggestions come from the backend
 *                           (debounced) instead of filtering `items` in the browser.
 *   placeholder  string   — default "Tên vật tư"
 *   disabled     boolean  — disables input
 *   className    string   — extra class on wrapper div
 *   emptyText    string   — text shown when no suggestion matches
 */
export default function MaterialSearchInput({
  value = '',
  onChange,
  onSelect,
  items = [],
  onSearch = null,
  placeholder = 'Tên vật tư',
  disabled = false,
  className = '',
  emptyText = 'Không tìm thấy vật tư',
}) {
  const [remoteItems, setRemoteItems] = useState([]);
  const [searching, setSearching] = useState(false);
  // Keep latest onSearch in a ref so an inline prop doesn't retrigger the effect.
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;
  const instanceId = useRef(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now() + Math.random())
  );
  const inputRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [style, setStyle] = useState({});

  // Server-side search (debounced) when onSearch is provided.
  useEffect(() => {
    if (!onSearchRef.current || !isOpen) return undefined;
    let active = true;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await onSearchRef.current(value || '');
        if (active) setRemoteItems(Array.isArray(res) ? res : []);
      } catch {
        if (active) setRemoteItems([]);
      } finally {
        if (active) setSearching(false);
      }
    }, 250);
    return () => { active = false; clearTimeout(t); };
  }, [value, isOpen]);

  // Suggestions: backend results when onSearch is set, else client-side filter of `items`.
  const filtered = (() => {
    if (onSearch) return remoteItems.filter(m => m && m.id).slice(0, 10);
    const validItems = items.filter(m => m && m.id);
    if (!value?.trim()) return validItems.slice(0, 10);
    const terms = value.toLowerCase().trim().split(/\s+/);
    return validItems
      .filter(m =>
        terms.every(t =>
          (m.materialName || '').toLowerCase().includes(t) ||
          (m.materialCode || '').toLowerCase().includes(t)
        )
      )
      .slice(0, 10);
  })();

  // Recalculate dropdown position (uses fixed so no scrollY offset needed)
  const updatePosition = () => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      maxHeight: 240,
      overflowY: 'auto',
      zIndex: 9999,
    });
  };

  // Attach/detach scroll+resize listeners while dropdown is open
  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    // Capture phase (true) catches scroll from any element, not just window
    document.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      document.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen]);

  // Click-outside detection
  useEffect(() => {
    if (!isOpen) return;
    const id = 'msi-dd-' + instanceId.current;
    const handleOut = (e) => {
      const portal = document.getElementById(id);
      if (!inputRef.current?.contains(e.target) && !portal?.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOut);
    return () => document.removeEventListener('mousedown', handleOut);
  }, [isOpen]);

  const handleSelect = (item) => {
    onSelect(item);
    onChange(item.materialName);
    setIsOpen(false);
  };

  return (
    <div className={`msi-wrap ${className}`}>
      <input
        ref={inputRef}
        type="text"
        className="ui-input msi-input"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        onChange={e => { onChange(e.target.value); setIsOpen(true); }}
        onFocus={() => setIsOpen(true)}
      />

      {isOpen && !disabled && createPortal(
        <div id={'msi-dd-' + instanceId.current} className="msi-dropdown" style={style}>
          {filtered.length > 0
            ? filtered.map(item => (
                <div key={item.id} className="msi-item" onMouseDown={() => handleSelect(item)}>
                  <strong className="msi-item-name">{item.materialName}</strong>
                  {item.materialCode && <span className="msi-item-code">{item.materialCode}</span>}
                </div>
              ))
            : <div className="msi-empty">{onSearch && searching ? 'Đang tìm...' : emptyText}</div>
          }
        </div>,
        document.body
      )}
    </div>
  );
}
