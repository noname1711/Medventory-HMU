import React from "react";

/* Shared, minimalistic pagination used across every dashboard page.
   - 0-based `page`; `onChange(targetPageIndex)` is called on navigation.
   - Prev/Next render monochrome chevron symbols (‹ ›) instead of text.
   - Renders nothing when there is only a single page. */

function visiblePageNumbers(totalPages, currentPage) {
  const total = Math.max(1, Number(totalPages) || 1);
  const current = Math.min(Math.max(0, Number(currentPage) || 0), total - 1);
  const start = Math.max(0, current - 2);
  const end = Math.min(total - 1, start + 4);
  const adjustedStart = Math.max(0, end - 4);
  const pages = [];
  for (let i = adjustedStart; i <= end; i += 1) pages.push(i);
  return pages;
}

export default function Pagination({
  page = 0,
  totalPages = 1,
  onChange,
  disabled = false,
  ariaLabel = "Phân trang",
}) {
  const total = Math.max(1, Number(totalPages) || 1);
  const current = Math.min(Math.max(0, Number(page) || 0), total - 1);

  if (total <= 1) return null;

  const go = (target) => {
    if (!onChange) return;
    const t = Math.min(Math.max(0, target), total - 1);
    if (t !== current) onChange(t);
  };

  return (
    <div className="ui-pagination" aria-label={ariaLabel}>
      <button
        type="button"
        className="ui-pagination-btn ui-pagination-nav"
        onClick={() => go(current - 1)}
        disabled={disabled || current <= 0}
        aria-label="Trang trước"
      >
        ‹
      </button>

      {visiblePageNumbers(total, current).map((p) => (
        <button
          key={p}
          type="button"
          className={`ui-pagination-btn ${p === current ? "is-active" : ""}`}
          onClick={() => go(p)}
          disabled={disabled || p === current}
        >
          {p + 1}
        </button>
      ))}

      <button
        type="button"
        className="ui-pagination-btn ui-pagination-nav"
        onClick={() => go(current + 1)}
        disabled={disabled || current >= total - 1}
        aria-label="Trang sau"
      >
        ›
      </button>
    </div>
  );
}
