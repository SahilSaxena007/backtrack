import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    thinking_level?: 'low' | 'high';
    thought_signature?: string;
    tokens_used?: number;
  };
}

interface ConversationStore {
  conversationId: string;
  messages: Message[];
  isLoading: boolean;

  addUserMessage: (content: string) => void;
  addAssistantMessage: (content: string, metadata?: Message['metadata']) => void;
  setLoading: (loading: boolean) => void;
  clearConversation: () => void;
  buildConversationContext: () => string;
}

/**
 * Builds conversation context for Gemini API from message history
 * Includes last 10 messages with system message at the beginning
 */
function buildContextFromMessages(messages: Message[]): string {
  const systemMessage = `You are Backtrack, an AI assistant that helps users organize their files through natural language commands. Your role is to:
1. Understand user intent for file organization tasks
2. Ask clarifying questions when needed
3. Confirm understanding before taking action
4. Be helpful, friendly, and concise`;

  // Take last 10 messages for context (to avoid token limits)
  const recentMessages = messages.slice(-10);

  const conversationHistory = recentMessages
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');

  return `${systemMessage}\n\n${conversationHistory}`;
}

export const useConversationStore = create<ConversationStore>()(
  persist(
    (set, get) => ({
      conversationId: `conv_${Date.now()}`,
      messages: [],
      isLoading: false,

      addUserMessage: (content: string) =>
        set((state) => ({
          messages: [
            ...state.messages,
            {
              id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              role: 'user',
              content,
              timestamp: new Date(),
            },
          ],
        })),

      addAssistantMessage: (content: string, metadata?: Message['metadata']) =>
        set((state) => ({
          messages: [
            ...state.messages,
            {
              id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              role: 'assistant',
              content,
              timestamp: new Date(),
              metadata,
            },
          ],
        })),

      setLoading: (loading: boolean) => set({ isLoading: loading }),

      clearConversation: () =>
        set({
          conversationId: `conv_${Date.now()}`,
          messages: [],
          isLoading: false,
        }),

      buildConversationContext: () => {
        const state = get();
        return buildContextFromMessages(state.messages);
      },
    }),
    {
      name: 'backtrack-conversation-storage',
      // Custom serialization to handle Date objects
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const data = JSON.parse(str);
          // Convert timestamp strings back to Date objects
          if (data.state?.messages) {
            data.state.messages = data.state.messages.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp),
            }));
          }
          return data;
        },
        setItem: (name, value) => {
          localStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          localStorage.removeItem(name);
        },
      },
    }
  )
);
