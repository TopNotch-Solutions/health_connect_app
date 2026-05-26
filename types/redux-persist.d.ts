declare module "redux-persist/integration/react" {
  import type { Persistor } from "redux-persist";
  import type { ReactNode } from "react";

  export interface PersistGateProps {
    persistor: Persistor;
    loading?: ReactNode | null;
    onBeforeLift?: () => void | Promise<void>;
    children?: ReactNode;
  }

  export const PersistGate: (props: PersistGateProps) => ReactNode;
}
