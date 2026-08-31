export const getCurrentUserId = (): number => {
  if (typeof window === "undefined") return 1;
  try {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const user = JSON.parse(userStr);
      return Number(user.id || user.ID || user.user_id || 1);
    }
  } catch (e) {
    console.error("Failed to parse user from localStorage", e);
  }
  return 1;
};