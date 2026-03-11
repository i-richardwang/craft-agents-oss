/**
 * Centralized path configuration for DataPilot.
 *
 * Supports multi-instance development via DATAPILOT_CONFIG_DIR environment variable.
 * When running from a numbered folder (e.g., datapilot-1), the detect-instance.sh
 * script sets DATAPILOT_CONFIG_DIR to ~/.datapilot-1, allowing multiple instances to run
 * simultaneously with separate configurations.
 *
 * Default (non-numbered folders): ~/.datapilot/
 * Instance 1 (-1 suffix): ~/.datapilot-1/
 * Instance 2 (-2 suffix): ~/.datapilot-2/
 */

import { homedir } from 'os';
import { join } from 'path';

// Allow override via environment variable for multi-instance dev
// Falls back to default ~/.datapilot/ for production and non-numbered dev folders
export const CONFIG_DIR = process.env.DATAPILOT_CONFIG_DIR || join(homedir(), '.datapilot');
