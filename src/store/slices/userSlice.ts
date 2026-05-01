/**
 * Manages the authenticated user's identity and permission state.
 *
 * State shape:
 * - firstName: The user's first name (displayed in UI greetings, headers)
 * - company: MongoDB ID of the user's company (links to companySlice)
 * - permission: Role-based access level -- "admin", "pm" (project manager), or "user"
 * - isVerified: Whether the user's email has been verified
 * - email: The user's email address
 * - userId: MongoDB identifier for the user
 *
 * Used by: Signup flow, login/index page, Procore OAuth success page
 */
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type Permission = "admin" | "pm" | "user";

interface UserState {
  firstName: string;
  company?: string;
  permission?: Permission;
  isVerified?: boolean;
  email?: string;
  userId?: string;
}

const initialState: UserState = {
  firstName: "",
  company: undefined,
  permission: undefined,
  isVerified: undefined,
  email: undefined,
  userId: undefined,
};

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    /** Sets the user's first name */
    setFirstName(state, action: PayloadAction<string>) {
      state.firstName = action.payload;
    },
    /** Sets the company ID associated with the user */
    setCompanyName(state, action: PayloadAction<string>) {
      state.company = action.payload;
    },
    /** Sets the user's permission level ("admin", "pm", or "user") */
    setPermission(state, action: PayloadAction<Permission>) {
      state.permission = action.payload;
    },
    /** Sets whether the user's email has been verified */
    setIsVerified(state, action: PayloadAction<boolean>) {
      state.isVerified = action.payload;
    },
    /** Sets the user's email address */
    setEmail(state, action: PayloadAction<string>) {
      state.email = action.payload;
    },
    /** Sets the user's MongoDB identifier */
    setUserId(state, action: PayloadAction<string>) {
      state.userId = action.payload;
    },
    /** Batch-updates multiple user fields at once; only provided fields are overwritten */
    setUserData(
      state,
      action: PayloadAction<{
        firstName?: string;
        company?: string;
        permission?: Permission;
        isVerified?: boolean;
        email?: string;
        userId?: string;
      }>,
    ) {
      const { firstName, company, permission, isVerified, email, userId } =
        action.payload;
      if (firstName !== undefined) state.firstName = firstName;
      if (company !== undefined) state.company = company;
      if (permission !== undefined) state.permission = permission;
      if (isVerified !== undefined) state.isVerified = isVerified;
      if (email !== undefined) state.email = email;
      if (userId !== undefined) state.userId = userId;
    },
    /** Clears the user's first name back to an empty string */
    clearFirstName(state) {
      state.firstName = "";
    },
    /** Resets all user state to initial values (used on logout) */
    clearUserData(state) {
      state.firstName = "";
      state.company = undefined;
      state.permission = undefined;
      state.isVerified = undefined;
      state.email = undefined;
      state.userId = undefined;
    },
  },
});

export const {
  setFirstName,
  setCompanyName,
  setPermission,
  setIsVerified,
  setEmail,
  setUserId,
  setUserData,
  clearFirstName,
  clearUserData,
} = userSlice.actions;

export default userSlice.reducer;
