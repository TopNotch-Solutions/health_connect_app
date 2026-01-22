import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  isFirstTimeUser: true,
};

export const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    changeFirstTimeStatus: (state, action) => {
      state.isFirstTimeUser = false;
    },
    removeStatus: (state) => {
      state.isFirstTimeUser = true;
    },
  },
});

export const { changeFirstTimeStatus, removeStatus } = userSlice.actions;

export const selectFirstTimeStatus = (state: any) => state.user.isFirstTimeUser;

export default userSlice.reducer;
