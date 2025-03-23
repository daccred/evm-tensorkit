import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { usePrivy } from '@privy-io/react-auth';
import { Loader2 } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface MCPClientProps {
  contractAddress: string;
  network: string;
}

export function MCPClient({ contractAddress, network }: MCPClientProps) {
  const { login, authenticated, user } = usePrivy();
  const [isExecuting, setIsExecuting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    const userMessage = { role: 'user' as const, content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    await processMessage(userMessage);
  };

  const handleVoiceInput = async (text: string) => {
    if (!text.trim() || isLoading) return;
    
    const userMessage = { role: 'user' as const, content: text };
    setMessages(prev => [...prev, userMessage]);
    await processMessage(userMessage);
  };

  const processMessage = async (userMessage: Message) => {
    try {
      setIsLoading(true);
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messages.concat(userMessage),
          contractAddress,
          network,
          walletAddress: user?.wallet?.address,
          ...user,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to get response');
      }
      
      const data = await response.json();
      
      // Add the assistant's response to the messages
      setMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
      
      // Check if the response contains an action to execute
      try {
        const actionMatch = data.content.match(/```json\s*({[\s\S]*?})\s*```/);
        if (actionMatch) {
          const actionData = JSON.parse(actionMatch[1]);
          if (actionData.action && actionData.parameters) {
            await executeAction(actionData.action, actionData.parameters);
          }
        }
      } catch (error) {
        console.error('Error parsing action:', error);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, there was an error processing your request.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const executeAction = async (action: string, params: any) => {
    try {
      setIsExecuting(true);
      
      const response = await fetch(`/api/contract-server/${contractAddress}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...params,
          schemaType: 'mcp',
        }),
      });
      
      const result = await response.json();
      
      // Add the result to the chat
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Action executed: ${action}\nResult: ${JSON.stringify(result, null, 2)}`,
      }]);
    } catch (error) {
      console.error('Error executing action:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error executing action: ${error}`,
      }]);
    } finally {
      setIsExecuting(false);
    }
  };

  if (!authenticated) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Connect Wallet</CardTitle>
          <CardDescription>Connect your wallet to interact with the MCP client.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => login()}>Connect Wallet</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>MCP Client</CardTitle>
        <CardDescription>Connected as: {user?.wallet?.address}</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] w-full rounded-md border p-4">
          {messages.map((msg, idx) => (
            <div key={idx} className={`mb-4 ${msg.role === 'assistant' ? 'text-blue-600' : 'text-gray-800'}`}>
              <strong>{msg.role === 'assistant' ? 'Assistant: ' : 'You: '}</strong>
              {msg.content}
            </div>
          ))}
          {isLoading && (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </div>
          )}
        </ScrollArea>
      </CardContent>
      <CardFooter className="flex flex-col gap-4">
        <form onSubmit={handleSubmit} className="flex w-full gap-2">
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Type your message..."
            disabled={isLoading || isExecuting}
          />
          <Button type="submit" disabled={isLoading || isExecuting}>
            Send
          </Button>
        </form>
        <VoiceRecorder onTranscription={handleVoiceInput} isProcessing={isLoading || isExecuting} />
      </CardFooter>
    </Card>
  );
}