/**
 * User Display Name Utility
 * Provides consistent logic for displaying user names throughout the application
 */

export const getUserDisplayName = (user: { display_name?: string | null; email: string }): string => {
  return user.display_name || user.email;
};

