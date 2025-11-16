import { Request, Response, NextFunction } from 'express';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Feature flag middleware to enable/disable features
 * Set in environment variables:
 * - ENABLE_DONATIONS=true/false
 * - ENABLE_SUBSCRIPTIONS=true/false
 */

export const checkFeatureFlag = (feature: 'donations' | 'subscriptions') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const flagName = feature === 'donations' 
      ? 'ENABLE_DONATIONS' 
      : 'ENABLE_SUBSCRIPTIONS';
    
    const isEnabled = process.env[flagName] === 'true';

    if (!isEnabled) {
      return res.status(404).json({ 
        error: 'Feature not available',
        message: `${feature} feature is currently disabled` 
      });
    }

    next();
  };
};

// Helper to check if feature is enabled (for use in routes)
export const isFeatureEnabled = (feature: 'donations' | 'subscriptions'): boolean => {
  const flagName = feature === 'donations' 
    ? 'ENABLE_DONATIONS' 
    : 'ENABLE_SUBSCRIPTIONS';
  
  return process.env[flagName] === 'true';
};

