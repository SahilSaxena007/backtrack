import { IpcMain } from 'electron';
import { getGeminiClient, ParsedIntent } from '../services/gemini-client';

/**
 * Result structure for intent parsing
 */
interface IntentResult {
  success: boolean;
  intent?: ParsedIntent;
  error?: string;
  metadata?: {
    duration?: number;
    retries?: number;
  };
}

/**
 * Result structure for clarification generation
 */
interface ClarificationResult {
  success: boolean;
  question?: string;
  error?: string;
}

/**
 * Register all Gemini-related IPC handlers
 */
export function registerGeminiHandlers(ipcMain: IpcMain): void {
  /**
   * Parse user intent from natural language message
   *
   * @param message - User's natural language message
   * @param context - Conversation context (previous messages)
   * @returns IntentResult with parsed intent or error
   */
  ipcMain.handle('parse-intent', async (_event, message: string, context: string): Promise<IntentResult> => {
    const startTime = Date.now();
    console.log('[IPC] parse-intent called');
    console.log(`[IPC] Message: "${message}"`);
    console.log(`[IPC] Context length: ${context.length} characters`);

    try {
      // Validate input
      if (!message || typeof message !== 'string') {
        return {
          success: false,
          error: 'Invalid message: must be a non-empty string'
        };
      }

      if (message.trim().length === 0) {
        return {
          success: false,
          error: 'Message cannot be empty'
        };
      }

      // Get Gemini client
      const geminiClient = getGeminiClient();

      // Parse intent
      const intent = await geminiClient.parseIntent(message, context);

      const duration = Date.now() - startTime;
      console.log(`[IPC] Intent parsed successfully in ${duration}ms`);

      return {
        success: true,
        intent,
        metadata: {
          duration
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      console.error(`[IPC] Error parsing intent (after ${duration}ms):`, errorMessage);
      console.error('[IPC] Full error:', error);

      return {
        success: false,
        error: errorMessage,
        metadata: {
          duration
        }
      };
    }
  });

  /**
   * Generate clarification question for unclear intent
   *
   * @param intent - Parsed intent object that needs clarification
   * @returns ClarificationResult with question or error
   */
  ipcMain.handle('generate-clarification', async (_event, intent: ParsedIntent): Promise<ClarificationResult> => {
    const startTime = Date.now();
    console.log('[IPC] generate-clarification called');
    console.log('[IPC] Intent:', intent);

    try {
      // Validate input
      if (!intent || typeof intent !== 'object') {
        return {
          success: false,
          error: 'Invalid intent: must be an object'
        };
      }

      // Get Gemini client
      const geminiClient = getGeminiClient();

      // Generate clarification
      const question = await geminiClient.generateClarification(intent);

      const duration = Date.now() - startTime;
      console.log(`[IPC] Clarification generated successfully in ${duration}ms`);

      return {
        success: true,
        question
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      console.error(`[IPC] Error generating clarification (after ${duration}ms):`, errorMessage);
      console.error('[IPC] Full error:', error);

      return {
        success: false,
        error: errorMessage
      };
    }
  });

  console.log('[Gemini] IPC handlers registered (parse-intent, generate-clarification)');
}
