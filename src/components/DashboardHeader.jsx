import { Plus } from "lucide-react";
import { Link } from "react-router-dom";
import Button from "./Button.jsx";

function getGreeting(hour) {
  if (hour < 12) {
    return "Good morning";
  }
  if (hour < 17) {
    return "Good afternoon";
  }
  return "Good evening";
}

export default function DashboardHeader() {
  const greeting = getGreeting(new Date().getHours());

  return (
    <div className="dashboard-header">
      <div>
        <h1 className="page-header__title">{greeting}, Merchandiser</h1>
        <p className="page-header__description">
          Here&apos;s what&apos;s happening across your production orders.
        </p>
      </div>
      <Button
        as={Link}
        className="dashboard-header__create"
        to="/orders/new"
        variant="primary"
      >
        <Plus aria-hidden="true" size={18} />
        Create Order
      </Button>
    </div>
  );
}
