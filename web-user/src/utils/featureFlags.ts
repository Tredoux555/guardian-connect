/**
 * Feature Flags Utility
 * Checks if features are enabled via environment variables
 */

export const isFeatureEnabled = (feature: 'donations' | 'subscriptions'): boolean => {
  const flagName = feature === 'donations' 
    ? 'VITE_ENABLE_DONATIONS' 
    : 'VITE_ENABLE_SUBSCRIPTIONS';
  
  // Default to false if not set (features hidden by default)
  return import.meta.env[flagName] === 'true';
};

export const FEATURES = {
  donations: isFeatureEnabled('donations'),
  subscriptions: isFeatureEnabled('subscriptions'),
} as const;

