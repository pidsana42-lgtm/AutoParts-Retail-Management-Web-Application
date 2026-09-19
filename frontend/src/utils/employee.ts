export const digitsOnly = (value: string) => value.replace(/\D/g, "");

export const formatThaiId = (value: string) => {
  const digits = digitsOnly(value).slice(0, 13);
  return [
    digits.slice(0, 1),
    digits.slice(1, 5),
    digits.slice(5, 10),
    digits.slice(10, 12),
    digits.slice(12, 13),
  ].filter(Boolean).join("-");
};

export const formatBankAccount = (value: string) => {
  const digits = digitsOnly(value).slice(0, 20);
  return digits.replace(/(.{3})(?=.)/g, "$1-");
};

export const maskLineUserId = (value: string) => {
  const lineUserId = value.trim();
  if (!lineUserId) return "-";
  if (lineUserId.length <= 4) {
    return `${lineUserId.slice(0, 1)}${"•".repeat(Math.max(1, lineUserId.length - 2))}${lineUserId.slice(-1)}`;
  }
  return `${lineUserId.slice(0, 3)}${"•".repeat(Math.max(4, lineUserId.length - 6))}${lineUserId.slice(-3)}`;
};

export const isValidThaiId = (value: string) => {
  const normalized = value.replace(/-/g, "");
  return /^\d{13}$/.test(normalized);
};

export const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { error?: string; message?: string } } }).response;
    return response?.data?.error || response?.data?.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
};
