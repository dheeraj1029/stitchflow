import {
  Settings2,
  TriangleAlert,
  UsersRound,
} from "lucide-react";
import Card from "../components/Card.jsx";
import PageHeader from "../components/PageHeader.jsx";
import Dashboard from "./Dashboard.jsx";

function PlaceholderPage({
  description,
  icon: Icon,
  placeholderDescription,
  placeholderTitle,
  title,
}) {
  return (
    <>
      <PageHeader description={description} title={title} />
      <Card className="placeholder-card" title={placeholderTitle}>
        <div aria-hidden="true" className="placeholder-card__icon">
          <Icon size={20} strokeWidth={1.8} />
        </div>
        <p className="placeholder-card__description">
          {placeholderDescription}
        </p>
      </Card>
    </>
  );
}

export function OverviewPage() {
  return <Dashboard />;
}

export function DelayWarningsPage() {
  return (
    <PlaceholderPage
      description="A future view of production risks and potential delays."
      icon={TriangleAlert}
      placeholderDescription="Risk monitoring and delay information will be introduced in a later phase."
      placeholderTitle="Production risk monitoring"
      title="Delay Warnings"
    />
  );
}

export function BuyersPage() {
  return (
    <PlaceholderPage
      description="A future home for your buyer relationships."
      icon={UsersRound}
      placeholderDescription="Buyer records and management tools will be available in a later phase."
      placeholderTitle="Buyer management"
      title="Buyers"
    />
  );
}

export function SettingsPage() {
  return (
    <PlaceholderPage
      description="Workspace preferences will live here."
      icon={Settings2}
      placeholderDescription="Settings and preferences will be introduced in a later phase."
      placeholderTitle="Workspace settings"
      title="Settings"
    />
  );
}
