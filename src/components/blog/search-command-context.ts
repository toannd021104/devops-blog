import { createContext, useContext } from "react";

export type SearchContextValue = {
  open: () => void;
};

export const SearchContext = createContext<SearchContextValue | null>(null);

export const useSearchCommand = () => {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error("useSearchCommand must be used within a SearchCommandProvider");
  }
  return context;
};
