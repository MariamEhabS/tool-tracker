/**
 * Manages the current company's profile, subscription, and Procore integration state.
 *
 * State shape (mirrors the Company type):
 * - _id: MongoDB identifier for the company
 * - companyName, companyAddress, companyCity, companyState, companyZIP: Company details
 * - companyWebsite, companyIndustry: Additional company metadata
 * - companyLogo, companyLogoAWSId, companyLogoAWSKey: Logo storage references (AWS S3)
 * - procoreAccess: OAuth tokens for Procore API connectivity (refreshToken, etc.)
 * - procoreCompanyID: The linked Procore company identifier
 * - freeTrialActive, paidAccount, subscriptionCanceled: Subscription/billing status flags
 * - stripeCustomerID, stripeSubscriptionID, stripeProductID, stripePriceID,
 *   stripeSubscriptionStatus: Stripe billing integration fields
 * - deactivated: Whether the company account has been deactivated
 * - companyData: Flexible container for additional company-related data
 * - editProcoreItemsAllowed: Whether this company is allowed to edit Procore items
 *
 * Used by: Settings page, Procore OAuth flow, scanned QR views, tool item pages
 */
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Company } from "../../types";

const initialState: Company = {
  _id: "",
  companyName: "",
  companyAddress: "",
  companyCity: "",
  companyState: "",
  companyZIP: "",
  companyWebsite: "",
  companyIndustry: "",
  companyLogo: "",
  companyLogoAWSId: "",
  companyLogoAWSKey: "",
  procoreAccess: {
    refreshToken: "",
    somethingElse: "",
  },
  procoreCompanyID: 0,
  freeTrialActive: false,
  paidAccount: false,
  subscriptionCanceled: false,
  stripeCustomerID: "",
  stripeSubscriptionID: "",
  stripeProductID: "",
  stripePriceID: "",
  stripeSubscriptionStatus: "",
  deactivated: false,
  companyData: {},
  editProcoreItemsAllowed: false,
};

export const companySlice = createSlice({
  name: "company",
  initialState,
  reducers: {
    /**
     * Merges incoming company data into the current state. If the payload contains
     * a nested `companyData` property, that nested object is spread instead of
     * the top-level payload, allowing the backend response shape to be normalized.
     */
    updateCompany: (state, action: PayloadAction<Partial<Company>>) => {
      const payload = action.payload as Company;
      if (payload.companyData) {
        return { ...state, ...payload.companyData };
      }
      return { ...state, ...payload };
    },
  },
});

export const { updateCompany } = companySlice.actions;
export default companySlice.reducer;
