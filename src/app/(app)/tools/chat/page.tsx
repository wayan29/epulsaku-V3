'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Send, Bot, User, BrainCircuit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { chatWithGemini, type ChatInput } from '@/ai/flows/chat-flow';
import ProtectedRoute from '@/components/core/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


// The message structure used by the page's state
interface PageMessage {
  role: 'user' | 'model';
  text: string;
}

const availableModels = [
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
]

export default function ChatPage() {
  const { toast } = useToast();
  const { user } = useAuth(); // Get user from auth context
  const [messages, setMessages] = useState<PageMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');


  useEffect(() => {
    // Scroll to bottom when messages change
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !user) {
        if(!user) toast({ title: 'Error', description: 'User not logged in.', variant: 'destructive' });
        return;
    };

    const userMessage: PageMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    
    const currentInput = input;
    setInput('');
    setIsLoading(true);
    
    try {
      // The flow now manages its own history from the DB, so we only need to send the new message.
      const chatInput: ChatInput = {
        userId: user.id,
        message: currentInput,
        model: `googleai/${selectedModel}`,
      };
      const result = await chatWithGemini(chatInput);
      const modelMessage: PageMessage = { role: 'model', text: result.response };
      setMessages((prev) => [...prev, modelMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      toast({
        title: 'Error',
        description: `Failed to get a response: ${errorMessage}`,
        variant: 'destructive',
      });
      // On error, remove the user's message that caused the error to allow retry
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ProtectedRoute requiredPermission="chat_ai">
        <CardContent>
        <div className="flex flex-col h-[70vh] bg-background">
            <div className="p-4 border-b">
                 <Label htmlFor="model-select">AI Model</Label>
                 <Select value={selectedModel} onValueChange={setSelectedModel} disabled={isLoading}>
                    <SelectTrigger id="model-select">
                        <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                        {availableModels.map(model => (
                            <SelectItem key={model.value} value={model.value}>
                                {model.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                 </Select>
            </div>
            <div ref={scrollAreaRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
                <div className="flex justify-center items-center h-full">
                    <div className="text-center text-muted-foreground">
                        <BrainCircuit size={48} className="mx-auto" />
                        <p className="mt-2">Mulai percakapan dengan ePulsaku AI</p>
                        <p className="text-xs mt-1">Menggunakan {availableModels.find(m => m.value === selectedModel)?.label || 'AI Model'}</p>
                    </div>
                </div>
            )}
            {messages.map((message, index) => (
                <div
                key={index}
                className={`flex items-start gap-3 ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
                >
                {message.role === 'model' && (
                    <div className="p-2 bg-primary rounded-full text-primary-foreground">
                        <Bot size={20} />
                    </div>
                )}
                <div
                    className={`max-w-xs md:max-w-md lg:max-w-lg p-3 rounded-lg ${
                    message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                >
                    <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                </div>
                {message.role === 'user' && (
                    <div className="p-2 bg-muted rounded-full text-muted-foreground">
                        <User size={20} />
                    </div>
                )}
                </div>
            ))}
            {isLoading && (
                <div className="flex items-start gap-3 justify-start">
                    <div className="p-2 bg-primary rounded-full text-primary-foreground">
                        <Bot size={20} />
                    </div>
                    <div className="max-w-xs p-3 rounded-lg bg-muted flex items-center">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                </div>
            )}
            </div>
            <div className="p-4 border-t">
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ketik pesan Anda..."
                className="flex-1"
                disabled={isLoading}
                />
                <Button type="submit" disabled={isLoading || !input.trim()}>
                {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <Send className="h-4 w-4" />
                )}
                <span className="sr-only">Send</span>
                </Button>
            </form>
            </div>
        </div>
        </CardContent>
    </ProtectedRoute>
  );
}
