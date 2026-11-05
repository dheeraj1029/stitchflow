import { Plus } from "lucide-react";
import { useState } from "react";
import Button from "./Button.jsx";
import ModalDialog from "./ModalDialog.jsx";

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
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const greeting = getGreeting(new Date().getHours());

  return (
    <>
      <div className="dashboard-header">
        <div>
          <h1 className="page-header__title">
            {greeting}, Merchandiser
          </h1>
          <p className="page-header__description">
            Here&apos;s what&apos;s happening across your production orders.
          </p>
        </div>
        <Button
          className="dashboard-header__create"
          onClick={() => setIsCreateDialogOpen(true)}
          variant="primary"
        >
          <Plus aria-hidden="true" size={18} />
          Create Order
        </Button>
      </div>
      <ModalDialog
        onClose={() => setIsCreateDialogOpen(false)}
        open={isCreateDialogOpen}
        title="Order creation is not available yet"
      >
        <p className="modal-dialog__note">
          Order creation will be introduced in a later phase. For now, this
          dashboard uses illustrative sample orders only.
        </p>
      </ModalDialog>
    </>
  );
}
