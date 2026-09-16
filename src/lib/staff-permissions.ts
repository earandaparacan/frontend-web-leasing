export type StaffUser = {
  username: string;
  groups: string[];
  permissions: string[];
  is_superuser: boolean;
};

export const STAFF_PERMISSIONS = {
  dashboard: "users.view_operational_dashboard",
  devices: "users.view_mdm_devices",
  lock: "users.execute_mdm_lock",
  unlock: "users.execute_mdm_unlock",
  actionHistory: "users.view_mdm_action_history",
  retryActions: "users.retry_mdm_actions",
  cancelActions: "users.cancel_mdm_actions",
  lockTemplates: "users.manage_mdm_lock_templates",
  messages: "users.view_mdm_messages",
  sendMessages: "users.send_mdm_messages",
  messageHistory: "users.view_mdm_message_history",
  retryMessages: "users.retry_mdm_messages",
  messageTemplates: "users.manage_mdm_message_templates",
  otpChallenges: "users.view_otp_challenges",
  users: "users.view_staff_users",
  manageUsers: "users.manage_staff_users",
  pagopar: "users.view_pagopar_transactions",
  imeiConflicts: "users.view_imei_conflicts",
  exportImeiConflicts: "users.export_imei_conflicts",
} as const;

export function hasStaffPermission(user: StaffUser, permission: string) {
  return user.is_superuser || user.permissions.includes(permission);
}

export function getDefaultStaffPath(user: StaffUser) {
  const destinations = [
    [STAFF_PERMISSIONS.dashboard, "/panel"],
    [STAFF_PERMISSIONS.devices, "/panel/dispositivos"],
    [STAFF_PERMISSIONS.messages, "/panel/mensajeria"],
    [STAFF_PERMISSIONS.otpChallenges, "/panel/desafios-otp"],
    [STAFF_PERMISSIONS.users, "/panel/usuarios"],
    [STAFF_PERMISSIONS.pagopar, "/panel/pagopar"],
    [STAFF_PERMISSIONS.imeiConflicts, "/panel/imei-duplicados"],
  ] as const;
  return destinations.find(([permission]) => hasStaffPermission(user, permission))?.[1] ?? "/";
}
