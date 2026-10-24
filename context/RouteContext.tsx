import React, { createContext, useContext, useState } from "react";

// Define the shape of a request object for the context
interface Request {
  _id: string;
  patientId?: {
    fullname: string;
    profileImage?: string;
    cellphoneNumber?: string;
  };
  providerId?: {
    fullname?: string;
    profileImage?: string;
  };
  address?: {
    coordinates?: unknown;
    route?: string;
    locality?: string;
    administrative_area_level_1?: string;
  };
  locationTracking?: {
    patientLocation?: { latitude?: number; longitude?: number };
  };
  ailmentCategoryId?:
    | {
        title?: string;
      }
    | string;
  consultationMode?: "house_visit" | "video_consultation";
  createdAt?: string;
  // Add any other properties from your request object that the map modal might need
}

interface RouteContextType {
  activeRoute: Request | null;
  startRoute: (request: Request) => void;
  clearRoute: () => void;
}

const RouteContext = createContext<RouteContextType | undefined>(undefined);

export const RouteProvider = ({ children }: { children: React.ReactNode }) => {
  const [activeRoute, setActiveRoute] = useState<Request | null>(null);

  const startRoute = (request: Request) => {
    setActiveRoute(request);
  };

  const clearRoute = () => {
    setActiveRoute(null);
  };

  return (
    <RouteContext.Provider value={{ activeRoute, startRoute, clearRoute }}>
      {children}
    </RouteContext.Provider>
  );
};

export const useRoute = () => {
  const context = useContext(RouteContext);
  if (!context) {
    throw new Error("useRoute must be used within a RouteProvider");
  }
  return context;
};
