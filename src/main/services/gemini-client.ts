import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

/**
 * Parsed intent structure from Gemini
 */
export interface ParsedIntent {
  target: string; // "Downloads" | "Desktop" | "unknown"
  action: string; // "organize" | "find" | "create" | "unknown"
  method: string; // "by_type" | "by_date" | "unknown"
  constraints: string[];
  conflicts: string[];
  clarityScore: number;
  needsClarification: boolean;
}

/**
 * Gemini API Client for intent parsing and clarification
 */
export class GeminiClient {
  private client: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor(apiKey: string) {
    if (!apiKey || apiKey === 'your_api_key_here') {
      throw new Error('Gemini API key not configured. Please set GEMINI_API_KEY in .env file');
    }

    this.client = new GoogleGenerativeAI(apiKey);

    // Use Gemini 2.5 Flash for accurate and fast intent parsing
    // Best balance of accuracy and speed for real-time UX
    this.model = this.client.getGenerativeModel({
      model: 'gemini-2.5-flash'
    });

    console.log('[Gemini] Client initialized with model: gemini-2.5-flash');
  }

  /**
   * Parse user intent from natural language message
   * Uses low thinking level for speed (<800ms target)
   */
  async parseIntent(userMessage: string, conversationContext: string): Promise<ParsedIntent> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Gemini] Parsing intent (attempt ${attempt}/${maxRetries})...`);
        const startTime = Date.now();

        const prompt = `${conversationContext}

User Request: "${userMessage}"

Analyze this request and determine:
1. Target folder (which folder to organize) - look for folder names like "Downloads", "Desktop", "Documents", or specific paths
2. Action type (organize, find, create, delete, move, etc.)
3. Method (by type, by date, by name, by size, etc.)
4. Constraints (keep X separate, don't touch Y, only files from date range, etc.)
5. Conflicts (contradictory requirements)
6. Clarity score (0.0 to 1.0, where 1.0 is completely clear)

IMPORTANT: If the user request is unclear or missing critical information (like which folder to organize), set needsClarification to true and clarityScore below 0.7.

Output JSON in this exact format:
{
  "target": "Downloads" | "Desktop" | "Documents" | "specific_path" | "unknown",
  "action": "organize" | "find" | "create" | "delete" | "move" | "unknown",
  "method": "by_type" | "by_date" | "by_name" | "by_size" | "custom" | "unknown",
  "constraints": ["array", "of", "constraint", "strings"],
  "conflicts": ["array", "of", "conflict", "strings"],
  "clarityScore": 0.9,
  "needsClarification": false
}`;

        // Call Gemini with JSON response format
        const result = await this.timeoutPromise(
          this.model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.3, // Lower temperature for more consistent JSON
            }
          }),
          10000 // 10 second timeout
        );

        const responseText = result.response.text();
        const duration = Date.now() - startTime;
        console.log(`[Gemini] Intent parsed in ${duration}ms`);

        // Parse JSON response
        const intent = JSON.parse(responseText) as ParsedIntent;

        // Validate the response structure
        if (!this.validateIntentStructure(intent)) {
          throw new Error('Invalid intent structure returned from Gemini');
        }

        console.log('[Gemini] Parsed intent:', intent);
        return intent;

      } catch (error) {
        lastError = error as Error;
        console.error(`[Gemini] Attempt ${attempt} failed:`, error);

        // Exponential backoff before retry
        if (attempt < maxRetries) {
          const backoffMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          console.log(`[Gemini] Retrying in ${backoffMs}ms...`);
          await this.sleep(backoffMs);
        }
      }
    }

    // All retries failed
    throw new Error(`Failed to parse intent after ${maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Generate clarification question when intent is unclear
   */
  async generateClarification(intent: ParsedIntent): Promise<string> {
    try {
      console.log('[Gemini] Generating clarification question...');
      const startTime = Date.now();

      const prompt = `User intent is unclear: ${JSON.stringify(intent, null, 2)}

Based on what's missing or unclear, generate ONE friendly clarification question.

Guidelines:
- If target folder is unknown: Ask "Which folder would you like me to work with?"
- If action is unclear: Ask "What would you like me to do with your files?"
- If method is ambiguous: Ask "How would you like me to organize them? By file type or by date?"
- Keep it conversational and friendly
- Only ask about the MOST important missing piece of information
- Do NOT ask multiple questions - just one clear question

Return ONLY the question text, no JSON, no extra formatting.`;

      const result = await this.timeoutPromise(
        this.model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7, // Slightly higher for natural language
          }
        }),
        10000 // 10 second timeout
      );

      const question = result.response.text().trim();
      const duration = Date.now() - startTime;

      console.log(`[Gemini] Clarification generated in ${duration}ms: "${question}"`);
      return question;

    } catch (error) {
      console.error('[Gemini] Error generating clarification:', error);

      // Fallback clarification questions based on intent
      if (intent.target === 'unknown') {
        return "Which folder would you like me to work with?";
      } else if (intent.action === 'unknown') {
        return "What would you like me to do with your files?";
      } else if (intent.method === 'unknown') {
        return "How should I organize them? By file type, by date, or another way?";
      }

      return "Could you provide more details about what you'd like me to do?";
    }
  }

  /**
   * Validate intent structure matches expected format
   */
  private validateIntentStructure(intent: any): intent is ParsedIntent {
    return (
      typeof intent === 'object' &&
      typeof intent.target === 'string' &&
      typeof intent.action === 'string' &&
      typeof intent.method === 'string' &&
      Array.isArray(intent.constraints) &&
      Array.isArray(intent.conflicts) &&
      typeof intent.clarityScore === 'number' &&
      typeof intent.needsClarification === 'boolean' &&
      intent.clarityScore >= 0 &&
      intent.clarityScore <= 1
    );
  }

  /**
   * Wrap promise with timeout
   */
  private timeoutPromise<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }

  /**
   * Sleep utility for exponential backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
let geminiClientInstance: GeminiClient | null = null;

/**
 * Get or create Gemini client singleton
 */
export function getGeminiClient(): GeminiClient {
  if (!geminiClientInstance) {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable not set');
    }

    geminiClientInstance = new GeminiClient(apiKey);
  }

  return geminiClientInstance;
}
