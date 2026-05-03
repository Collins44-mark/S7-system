"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type SearchCtx = {
  query: string;
  setQuery: (q: string) => void;
  clearQuery: () => void;
};

const SearchContext = createContext<SearchCtx | null>(null);

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [query, setQueryState] = useState("");
  const setQuery = useCallback((q: string) => {
    setQueryState(q);
  }, []);
  const clearQuery = useCallback(() => setQueryState(""), []);
  const value = useMemo(
    () => ({ query, setQuery, clearQuery }),
    [query, setQuery, clearQuery],
  );
  return (
    <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
  );
}

export function useSearch(): SearchCtx {
  const ctx = useContext(SearchContext);
  if (!ctx) {
    throw new Error("useSearch must be used within SearchProvider");
  }
  return ctx;
}
