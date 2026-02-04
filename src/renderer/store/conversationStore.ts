import { create } from 'zustand';

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
}

export const useConversationStore = create<ConversationStore>((set) => ({
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
}));
