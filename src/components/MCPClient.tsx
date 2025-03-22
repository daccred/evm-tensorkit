import React, { useState, useEffect } from 'react';
import { useChat } from 'ai/react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Loader2 } from 'lucide-react';

interface MCPClientProps {
  contractAddress: string;
  network: string;
}

export function MCPClient({ contractAddress, network }: MCPClientProps) {
  const { address, isConnected } = useAccount();
  const [isExecuting, setIsExecuting] = useState(false);
  
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    append,
    setMessages,
  } = useChat({
    api: '/api/chat',
    body: {
      contractAddress,
      network,
      walletAddress: address,
    },
    onResponse: () => {
      setIsExecuting(false);
    },
    onError: (error) => {
      console.error('Chat error:', error);
      setIsExecuting(false);
    },
  });

  const handleVoiceInput = (text: string) => {
    if (text.trim()) {
      append({
        role: 'user',
        content: text,
      });
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
      append({
        role: 'assistant',
        content: `Action executed: ${action}\nResult: ${JSON.stringify(result, null, 2)}`,
      });
    } catch (error) {
      console.error('Error executing action:', error);
      append({
        role: 'assistant',
        content: `Error executing action: ${error}`,
      });
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
        <VoiceRecorder 
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