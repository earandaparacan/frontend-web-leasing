"use client";

import { useState } from "react";

export function LogoutButton() {
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogout() {
    setIsLoading(true);
    await fetch("/api/auth/staff/logout", { method: "POST" });
    window.location.assign("/");
  }

  return (
    <button
      className="logout-button"
      type="button"
      onClick={handleLogout}
      disabled={isLoading}
    >
      {isLoading ? "Cerrando..." : "Cerrar sesión"}
    </button>
  );
}
