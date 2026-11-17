import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../services/apiClient';
import { useAuth } from '../context/AuthContext';
import { useShell } from '../context/ShellContext';
import { extractListPayload } from '../utils/formatters';

export function useServerTable({
  queryKey,
  endpoint,
  defaultLimit = Number(import.meta.env.VITE_DEFAULT_PAGE_SIZE) || 10,
  initialFilters = {},
  initialSortBy = 'createdAt',
  initialSortOrder = 'desc',
  enabled = true,
}) {
  const { user } = useAuth();
  const { addToast } = useShell();
  const distributorId = user?.distributorId || 'default';

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(defaultLimit);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState(initialSortBy);
  const [sortOrder, setSortOrder] = useState(initialSortOrder);
  const [filters, setFilters] = useState(initialFilters);
  const [viewMode, setViewMode] = useState('table');
  const [visibleColumns, setVisibleColumns] = useState(null);
  const [selectedKeys, setSelectedKeys] = useState([]);

  const serializedFilters = useMemo(() => JSON.stringify(filters), [filters]);

  const query = useQuery({
    queryKey: [
      queryKey,
      distributorId,
      page,
      limit,
      search,
      sortBy,
      sortOrder,
      serializedFilters,
    ],
    queryFn: async () => {
      const parsedFilters = JSON.parse(serializedFilters);
      const cleanFilters = Object.fromEntries(
        Object.entries(parsedFilters).filter(([, val]) => val !== '' && val !== null && val !== undefined)
      );
      const response = await apiClient.get(endpoint, {
        params: {
          page,
          limit,
          search: search || undefined,
          sortBy,
          sortOrder,
          ...cleanFilters,
        },
      });
      return extractListPayload(response);
    },
    enabled: Boolean(enabled && endpoint),
    placeholderData: (prev) => prev,
  });

  const handleSort = useCallback(
    (colKey) => {
      if (sortBy === colKey) {
        setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortBy(colKey);
        setSortOrder('asc');
      }
      setPage(1);
    },
    [sortBy]
  );

  const setFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }, []);

  const resetFilters = useCallback(async () => {
    setSearch('');
    setFilters(initialFilters);
    setPage(1);
    await query.refetch();
  }, [initialFilters, query.refetch]);

  const refresh = useCallback(async () => {
    await query.refetch();
    addToast({ type: 'info', message: 'List refreshed.' });
  }, [query.refetch, addToast]);

  const handlePageSizeChange = useCallback((nextLimit) => {
    setLimit(Number(nextLimit) || defaultLimit);
    setPage(1);
  }, [defaultLimit]);

  const toggleColumn = useCallback((colKey, allColumns = []) => {
    setVisibleColumns((prev) => {
      const current = prev || allColumns.map((c) => c.key);
      if (current.includes(colKey)) {
        return current.filter((k) => k !== colKey);
      }
      return [...current, colKey];
    });
  }, []);

  const resetColumns = useCallback(() => {
    setVisibleColumns(null);
  }, []);

  return {
    rows: query.data?.data || [],
    pagination: query.data?.pagination || {
      totalRecords: 0,
      currentPage: page,
      totalPages: 1,
      pageSize: limit,
      hasNextPage: false,
      hasPrevPage: false,
    },
    summary: query.data?.summary || {},
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    refresh,
    page,
    setPage,
    limit,
    setLimit: handlePageSizeChange,
    search,
    setSearch,
    sortBy,
    sortOrder,
    handleSort,
    filters,
    setFilter,
    resetFilters,
    viewMode,
    setViewMode,
    visibleColumns,
    toggleColumn,
    resetColumns,
    selectedKeys,
    setSelectedKeys,
  };
}

export default useServerTable;
