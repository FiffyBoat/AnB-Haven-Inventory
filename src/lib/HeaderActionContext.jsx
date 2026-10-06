import { createContext, useContext, useState } from "react";

const HeaderActionContext = createContext({ action: null, setAction: () => {} });

export function HeaderActionProvider({ children }) {
  const [action, setAction] = useState(null);
  return (
    <HeaderActionContext.Provider value={{ action, setAction }}>
      {children}
    </HeaderActionContext.Provider>
  );
}

export function useHeaderAction() {
  return useContext(HeaderActionContext);
}