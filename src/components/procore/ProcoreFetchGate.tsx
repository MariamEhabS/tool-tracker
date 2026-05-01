import React from "react";
import { useNavigate } from "@tanstack/react-router";
import { useProcoreIntegrationDetails } from "@/api/endpoints/company";
import LockedFeatureCard from "@/components/upgrade/LockedFeatureCard";
import EmptyState from "@/components/ui/EmptyState";
import { ProcoreAccessContext } from "./ProcoreAccessContext";

// Component Props
interface ProcoreFetchGateProps {
  companyId: string;
  children: React.ReactNode;
}

export default function ProcoreFetchGate({
  companyId,
  children,
}: ProcoreFetchGateProps) {
  const navigate = useNavigate();
  const { data, isLoading } = useProcoreIntegrationDetails(companyId);

  // Handle upgrade navigation
  const handleUpgrade = () => {
    navigate({ to: "/settings", search: { tab: "billing" } });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500"></div>
          <span className="text-sm text-gray-500">Checking access...</span>
        </div>
      </div>
    );
  }

  // Trial expired state
  if (data?.accessStatus?.reason === "trial_expired") {
    return (
      <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center">
        <LockedFeatureCard
          title="Procore Integration"
          description="Your free trial has ended. Upgrade to continue using Procore integration."
          requiredTier="Business"
          onUpgrade={handleUpgrade}
        />
      </div>
    );
  }

  // Upgrade required state
  if (data?.accessStatus?.reason === "upgrade_required") {
    return (
      <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center">
        <LockedFeatureCard
          title="Procore Integration"
          description="Connect Procore data to your QR codes with a Business plan."
          requiredTier="Business"
          onUpgrade={handleUpgrade}
        />
      </div>
    );
  }

  // Not connected state
  if (data?.connected === false) {
    return (
      <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center">
        <EmptyState
          icon={<i className="bx bx-link text-gray-400 text-3xl" />}
          title="Connect Procore"
          description="Your company hasn't connected to Procore yet. Connect in Settings to start linking Procore items."
          iconBgClass="bg-gray-100"
          actionLabel="Go to Procore Settings"
          actionTo="/settings?tab=integrations"
        />
      </div>
    );
  }

  // Sync error / reconnection required state
  if (data?.syncHealth === "error") {
    return (
      <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center">
        <EmptyState
          icon={<i className="bx bx-error-circle text-orange-500 text-3xl" />}
          title="Reconnection Required"
          description="Your Procore connection needs to be refreshed. Please reconnect in Settings."
          iconBgClass="bg-orange-100"
          actionLabel="Go to Procore Settings"
          actionTo="/settings?tab=integrations"
        />
      </div>
    );
  }

  // Access granted - provide context and render children
  return (
    <ProcoreAccessContext.Provider
      value={{ accessStatus: data?.accessStatus ?? null }}
    >
      {children}
    </ProcoreAccessContext.Provider>
  );
}
