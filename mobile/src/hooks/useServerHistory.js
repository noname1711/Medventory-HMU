import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '../api/apiClient';

export function useServerHistory({ buildUrl, userId, pageSize = 10, active = true }) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);          // 1-based UI
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async (kw = keyword, pg = page) => {
    if (!active || !userId) return;
    setLoading(true);
    const url = buildUrl({ keyword: kw || '', page0: Math.max(0, pg - 1), size: pageSize });
    const { ok, data } = await apiGet(url, userId);
    if (ok && data) {
      setItems(Array.isArray(data.items) ? data.items : (Array.isArray(data.requests) ? data.requests : []));
      setTotalPages(Math.max(1, data.totalPages || 1));
      setTotalCount(data.totalCount ?? data.filteredCount ?? 0);
    } else {
      setItems([]); setTotalPages(1); setTotalCount(0);
    }
    setLoading(false);
  }, [active, userId, buildUrl, pageSize, keyword, page]);

  useEffect(() => { setPage(1); }, [keyword]);
  useEffect(() => {
    if (!active) return undefined;
    const t = setTimeout(() => reload(keyword, page), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, userId, keyword, page]);

  return { items, page, setPage, totalPages, totalCount, keyword, setKeyword, loading, reload };
}
