import React, { createContext, useState, useContext } from 'react';

// Define the shape of a request object for the context
interface Request {
    _id: string;
    patientId?: { 
        fullname: string;
        profileImage?: string;
    };
    providerId?: {
        fullname?: string;
        profileImage?: string;
    };
    address?: {
        coordinates?: { latitude: number; longitude: number };
        route?: string;
        locality?: string;
        administrative_area_level_1?: string;
    };
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
        console.log("ROUTE CONTEXT: Starting route for request", request._id);
        setActiveRoute(request);
    };

    const clearRoute = () => {
        console.log("ROUTE CONTEXT: Clearing active route.");
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
        throw new Error('useRoute must be used within a RouteProvider');
    }
    return context;
};
