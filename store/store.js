import AsyncStorage from "@react-native-async-storage/async-storage";
import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { persistReducer, persistStore } from "redux-persist";
import userReducer from "../slices/userSlice";

// Configuration for Redux Persist
const persistConfig = {
  key: "root", // The key for the storage
  storage: AsyncStorage, // The storage engine to use
  whitelist: ["user"], // An array of reducers to persist
};

// Combine your reducers first
const combinedReducer = combineReducers({
  user: userReducer,
});

// Create a persisted reducer from the combined reducer
const persistedReducer = persistReducer(persistConfig, combinedReducer);

// Configure the Redux store with the persisted reducer
export const store = configureStore({
  reducer: persistedReducer,
  // This is required to prevent a console warning from redux-persist
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

// Create a persistor object
export const persistor = persistStore(store);
