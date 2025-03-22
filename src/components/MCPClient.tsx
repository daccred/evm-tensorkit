import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import dynamic from 'next/dynamic';

// Import the CustomAudioRecorder with no SSR
const CustomAudioRecorder = dynamic(
  () => import('@/components/CustomAudioRecorder'),
  { ssr: false }
);
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
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
  const { address, isConnected } = useAccount();
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
          walletAddress: address,
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

  if (!isConnected) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Connect Wallet</CardTitle>
          <CardDescription>
            Connect your wallet to interact with the contract at {contractAddress}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <ConnectButton />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Smart Contract Assistant</CardTitle>
        <CardDescription>
          Interact with contract {contractAddress.slice(0, 6)}...{contractAddress.slice(-4)} on {network}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`mb-4 p-3 rounded-lg ${
                message.role === 'user'
                  ? 'bg-primary/10 ml-4'
                  : 'bg-muted mr-4'
              }`}
            >
              <div className="font-semibold mb-1">
                {message.role === 'user' ? 'You' : 'Assistant'}
              </div>
              <div className="whitespace-pre-wrap">{message.content}</div>
            </div>
          ))}
          {(isLoading || isExecuting) && (
            <div className="flex justify-center items-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
        </ScrollArea>
      </CardContent>
      <CardFooter className="flex flex-col space-y-4">
        <CustomAudioRecorder 
          onTranscription={handleVoiceInput} 
          isProcessing={isLoading || isExecuting}
        />
        
        <form
          onSubmit={handleSubmit}
          className="flex w-full space-x-2"
        >
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Type your message..."
            disabled={isLoading || isExecuting}
            className="flex-1"
          />
          <Button 
            type="submit" 
            disabled={isLoading || isExecuting || !input.trim()}
          >
            Send
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}