import * as SecureStore from "expo-secure-store";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, AppStateStatus } from "react-native";
import apiClient from "../lib/api";
import socketService from "../lib/socket";

// Updated User interface with all health provider fields
export interface User {
  // Base fields (all users)
  userId: string;
  fullname: string;
  email: string;
  role:
    | "patient"
    | "provider"
    | "doctor"
    | "nurse"
    | "physiotherapist"
    | "socialworker"
    | "pharmacist";
  consultations?: number; // New field for available consultations
  cellphoneNumber?: string;
  walletID?: string;
  gender?: "Male" | "Female" | "Other";
  dateOfBirth?: string;
  balance?: number;
  profileImage?: string;
  address?: string;
  region?: string;
  town?: string;
  nationalId?: string;
  isAccountVerified?: boolean;
  isPushNotificationEnabled?: boolean;

  // Health provider specific fields
  isDocumentVerified?: boolean;
  isDocumentsSubmitted?: boolean;
  hpcnaNumber?: string;
  hpcnaExpiryDate?: string;
  specializations?: string[];
  yearsOfExperience?: number;
  operationalZone?: string;
  governingCouncil?: string;
  bio?: string;
  HPCNAQualification?: string;
  finalQualification?: string;
  idDocumentFront?: string;
  idDocumentBack?: string;
}

const SESSION_TIMEOUT = 5 * 60 * 1000;
const LAST_ACTIVITY_KEY = "lastActivityTime";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  updateUser: (updatedUserData: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const appState = useRef(AppState.currentState);

  const updateLastActivity = useCallback(async () => {
    const timestamp = Date.now().toString();
    await SecureStore.setItemAsync(LAST_ACTIVITY_KEY, timestamp);
  }, []);

  const logout = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync("authToken");
      if (token) {
        try {
          await apiClient.patch("/app/auth/logout");
        } catch (error) {
          console.error("Failed to call logout endpoint:", error);
        }
      }

      socketService.disconnect();

      setUser(null);
      await SecureStore.deleteItemAsync("user");
      await SecureStore.deleteItemAsync("authToken");
      await SecureStore.deleteItemAsync(LAST_ACTIVITY_KEY);
    } catch (error) {
      console.error("Failed to logout:", error);
      setUser(null);
    }
  }, []);

  const checkSessionTimeout = useCallback(async () => {
    try {
      const lastActivity = await SecureStore.getItemAsync(LAST_ACTIVITY_KEY);
      if (lastActivity) {
        const timeSinceLastActivity = Date.now() - parseInt(lastActivity);
        if (timeSinceLastActivity > SESSION_TIMEOUT) {
          console.log("Session expired after 5 minutes of inactivity");
          await logout();
          return true;
        }
      }
      return false;
    } catch (e) {
      console.error("Failed to check session timeout", e);
      return false;
    }
  }, [logout]);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedUser = await SecureStore.getItemAsync("user");
        if (storedUser) {
          const expired = await checkSessionTimeout();
          if (!expired) {
            setUser(JSON.parse(storedUser));
            await updateLastActivity();
          }
        }
      } catch (e) {
        console.error("Failed to load user from storage", e);
      } finally {
        setIsLoading(false);
      }
    };
    loadUser();
  }, [checkSessionTimeout, updateLastActivity]);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      async (nextAppState: AppStateStatus) => {
        if (
          appState.current.match(/inactive|background/) &&
          nextAppState === "active" &&
          user
        ) {
          const expired = await checkSessionTimeout();
          if (!expired) {
            await updateLastActivity();
          }
        }
        appState.current = nextAppState;
      },
    );

    return () => {
      subscription.remove();
    };
  }, [user, checkSessionTimeout, updateLastActivity]);

  useEffect(() => {
    const fetchAppToken = async () => {
      try {
        const existingToken = await SecureStore.getItemAsync("appToken");
        if (!existingToken) {
          console.log("🔑 Fetching app token...");
          const response = await apiClient.get("/app/auth/retrieve-jwt-token");
          const data = response.data;

          if (data && data.token) {
            await SecureStore.setItemAsync("appToken", data.token);
            console.log("✅ App token saved successfully");
          } else {
            console.error("❌ No app token in response");
          }
        } else {
          console.log("✅ App token already exists");
        }
      } catch (error) {
        console.error("❌ Failed to fetch app token:", error);
      }
    };
    fetchAppToken();
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    try {
      console.log("🔐 Starting login process...");

      // Ensure app token exists before login
      let appToken: any = await SecureStore.getItemAsync("appToken");
      if (!appToken) {
        console.log("⚠️  No app token found, fetching...");
        try {
          const response = await apiClient.get("/app/auth/retrieve-jwt-token");
          if (response.data && response.data.token) {
            appToken = response.data.token;
            await SecureStore.setItemAsync("appToken", appToken);
            console.log("✅ App token fetched and saved");
          } else {
            throw new Error("Failed to get app token from server");
          }
        } catch (tokenError) {
          console.error("❌ Failed to fetch app token:", tokenError);
          throw new Error(
            "Cannot connect to server. Please check your internet connection.",
          );
        }
      }

      // Call login endpoint with email and password
      console.log("🌐 Calling login API...");
      const response = await apiClient.post("/app/auth/login", {
        email,
        password,
      });

      console.log("✅ Login API call successful");
      console.log("📦 Response status:", response.status);

      if (!response.data || !response.data.user) {
        throw new Error("Invalid response from server");
      }

      const userDataFromBackend = response.data.user;

      // Get JWT token from response
      let authToken = null;

      // Check for token in response
      if (response.data.token) {
        authToken = response.data.token;
        console.log("✅ Token found in response.data.token");
      } else if (userDataFromBackend.token) {
        authToken = userDataFromBackend.token;
        console.log("✅ Token found in response.data.user.token");
      }

      // If no token in response, the backend's login function is missing the token return
      if (!authToken) {
        console.error("❌ Backend login response missing token");
        console.log("⚠️  Backend needs to return token in login response");
        throw new Error("Server error: Authentication token not provided");
      }

      console.log(
        "🔑 Auth token obtained:",
        authToken.substring(0, 30) + "...",
      );

      // Create user object with ALL fields (exclude token from user data)
      const userData: User = {
        userId: userDataFromBackend.userId,
        fullname: userDataFromBackend.fullname,
        email: userDataFromBackend.email,
        role: userDataFromBackend.role,
        consultations: userDataFromBackend.consultations,
        cellphoneNumber: userDataFromBackend.cellphoneNumber,
        walletID: userDataFromBackend.walletID,
        gender: userDataFromBackend.gender,
        dateOfBirth: userDataFromBackend.dateOfBirth,
        balance: userDataFromBackend.balance,
        profileImage: userDataFromBackend.profileImage,
        address: userDataFromBackend.address,
        region: userDataFromBackend.region,
        town: userDataFromBackend.town,
        nationalId: userDataFromBackend.nationalId,
        isAccountVerified: userDataFromBackend.isAccountVerified,
        isPushNotificationEnabled:
          userDataFromBackend.isPushNotificationEnabled,

        // Health provider specific fields
        isDocumentVerified: userDataFromBackend.isDocumentVerified,
        isDocumentsSubmitted: userDataFromBackend.isDocumentsSubmitted,
        hpcnaNumber: userDataFromBackend.hpcnaNumber,
        hpcnaExpiryDate: userDataFromBackend.hpcnaExpiryDate,
        specializations: userDataFromBackend.specializations,
        yearsOfExperience: userDataFromBackend.yearsOfExperience,
        operationalZone: userDataFromBackend.operationalZone,
        governingCouncil: userDataFromBackend.governingCouncil,
        bio: userDataFromBackend.bio,
        HPCNAQualification: userDataFromBackend.HPCNAQualification,
        finalQualification: userDataFromBackend.finalQualification,
        idDocumentFront: userDataFromBackend.idDocumentFront,
        idDocumentBack: userDataFromBackend.idDocumentBack,
      };

      // Save token FIRST
      await SecureStore.setItemAsync("authToken", authToken);
      console.log("✅ Auth token saved to SecureStore");

      // Save user data
      await SecureStore.setItemAsync("user", JSON.stringify(userData));
      console.log("✅ User data saved to SecureStore");

      // Set initial activity timestamp
      await updateLastActivity();
      setUser(userData);

      console.log("🎉 Login successful and fully authenticated!");
      return userData;
    } catch (error: any) {
      console.error(
        "❌ Login failed:",
        error.response?.data?.message || error.message,
      );
      setUser(null);
      await SecureStore.deleteItemAsync("user").catch(() => {});
      await SecureStore.deleteItemAsync("authToken").catch(() => {});
      throw error;
    }
  };

  const updateUser = async (updatedUserData: Partial<User>) => {
    if (!user) return;

    const newUser = { ...user, ...updatedUserData };
    setUser(newUser);
    await SecureStore.setItemAsync("user", JSON.stringify(newUser));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
